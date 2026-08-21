const express = require('express');
const router = express.Router();
const Ngo = require('../models/Ngo');
const agentBus = require('../services/agentBus');
const { getDistance } = require('../services/geo');

/**
 * GET /api/ngos/coverage/analysis
 * Coverage analysis for a given disaster coordinate and optional resource type / radius
 */
router.get('/coverage/analysis', async (req, res) => {
  try {
    const { lat, lng, radius_km, resource_type, quantity } = req.query;

    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ error: 'lat and lng query parameters are required for coverage analysis' });
    }

    const clientLat = Number(lat);
    const clientLng = Number(lng);
    const maxRadius = radius_km ? Number(radius_km) : 50;
    const resource = resource_type || 'shelter_capacity';
    const reqQuantity = quantity ? Math.max(1, Number(quantity)) : 1;

    if (isNaN(clientLat) || isNaN(clientLng)) {
      return res.status(400).json({ error: 'lat and lng must be valid numbers' });
    }

    const allNgos = await Ngo.find({ is_active: true });

    // Calculate distance and coverage
    const ngosWithDistance = allNgos.map(ngo => {
      const dist = parseFloat(
        getDistance(clientLat, clientLng, ngo.location.lat, ngo.location.lng).toFixed(2)
      );
      const effectiveRadius = ngo.max_coverage_radius_km || 50;
      const withinRadius = dist <= Math.min(maxRadius, effectiveRadius);
      const hasCapacity = (ngo[resource] || 0) >= reqQuantity;

      return {
        ngo_id: ngo._id,
        name: ngo.name,
        location: ngo.location,
        distance_km: dist,
        max_coverage_radius_km: effectiveRadius,
        within_radius: withinRadius,
        has_required_capacity: hasCapacity,
        capacity: {
          food_units: ngo.food_units,
          shelter_capacity: ngo.shelter_capacity,
          supply_units: ngo.supply_units
        },
        workload: ngo.workload,
        reliability_score: ngo.reliability_score,
        is_stale: ngo.isStale ? ngo.isStale(24) : false
      };
    });

    ngosWithDistance.sort((a, b) => a.distance_km - b.distance_km);

    const availableInRadius = ngosWithDistance.filter(n => n.within_radius && n.has_required_capacity);
    const nearestNgo = ngosWithDistance.length > 0 ? ngosWithDistance[0] : null;
    const isCovered = availableInRadius.length > 0;

    let coverageGaps = [];
    if (!nearestNgo) {
      coverageGaps.push('No active NGO facilities registered in the system');
    } else if (!isCovered) {
      if (ngosWithDistance.some(n => n.within_radius)) {
        coverageGaps.push(`NGOs are within ${maxRadius}km radius but lack sufficient ${resource} (needed: ${reqQuantity})`);
      } else {
        coverageGaps.push(`Nearest active NGO (${nearestNgo.name}) is ${nearestNgo.distance_km}km away, exceeding radius of ${maxRadius}km`);
      }
    }

    res.json({
      location: { lat: clientLat, lng: clientLng },
      radius_km: maxRadius,
      resource_type: resource,
      requested_quantity: reqQuantity,
      covered: isCovered,
      coverage_gaps: coverageGaps,
      nearest_ngo: nearestNgo,
      available_ngos_in_radius: availableInRadius,
      total_active_ngos_evaluated: allNgos.length
    });
  } catch (error) {
    console.error('[routes/ngos] Error performing coverage analysis:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ngos/analytics/depletion-monitoring
 * System-wide resource depletion rate and burnout estimation
 */
router.get('/analytics/depletion-monitoring', async (req, res) => {
  try {
    const ngos = await Ngo.find({ is_active: true });
    const now = Date.now();
    const windowHours = 24; // Lookback window for consumption rate

    const summary = ngos.map(ngo => {
      // Calculate consumption rate per hour from allocation_history in last 24h
      const history = ngo.allocation_history || [];
      const recentAllocations = history.filter(h => (now - new Date(h.timestamp).getTime()) <= windowHours * 60 * 60 * 1000);

      const consumption = { food_units: 0, shelter_capacity: 0, supply_units: 0 };
      recentAllocations.forEach(a => {
        if (consumption[a.resource_type] !== undefined) {
          consumption[a.resource_type] += (a.quantity || 0);
        }
      });

      const rates = {
        food_units_per_hour: parseFloat((consumption.food_units / windowHours).toFixed(2)),
        shelter_capacity_per_hour: parseFloat((consumption.shelter_capacity / windowHours).toFixed(2)),
        supply_units_per_hour: parseFloat((consumption.supply_units / windowHours).toFixed(2))
      };

      // Burnout hours = current_inventory / consumption_rate
      const estimateBurnout = (current, rate) => {
        if (current === 0) return 0;
        if (rate === 0) return null; // No immediate depletion threat
        return parseFloat((current / rate).toFixed(1));
      };

      const burnoutHours = {
        food_units: estimateBurnout(ngo.food_units, rates.food_units_per_hour),
        shelter_capacity: estimateBurnout(ngo.shelter_capacity, rates.shelter_capacity_per_hour),
        supply_units: estimateBurnout(ngo.supply_units, rates.supply_units_per_hour)
      };

      // Depletion status warning level
      let status = 'HEALTHY';
      const allBurnouts = [burnoutHours.food_units, burnoutHours.shelter_capacity, burnoutHours.supply_units].filter(b => b !== null);
      if (allBurnouts.some(b => b <= 6)) {
        status = 'CRITICAL';
      } else if (allBurnouts.some(b => b <= 24)) {
        status = 'WARNING';
      }

      return {
        ngo_id: ngo._id,
        name: ngo.name,
        current_inventory: {
          food_units: ngo.food_units,
          shelter_capacity: ngo.shelter_capacity,
          supply_units: ngo.supply_units
        },
        consumption_rates_24h: rates,
        estimated_burnout_hours: burnoutHours,
        depletion_status: status,
        is_stale: ngo.isStale ? ngo.isStale(24) : false
      };
    });

    res.json({
      evaluated_at: new Date(),
      total_active_ngos: ngos.length,
      depletion_summary: summary
    });
  } catch (error) {
    console.error('[routes/ngos] Error performing depletion monitoring:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ngos/analytics/reliability
 * Summary of reliability scores and operational metrics across NGOs
 */
router.get('/analytics/reliability', async (req, res) => {
  try {
    const ngos = await Ngo.find().sort({ name: 1 });
    const metrics = ngos.map(ngo => ({
      ngo_id: ngo._id,
      name: ngo.name,
      is_active: ngo.is_active,
      successful_allocations: ngo.successful_allocations || 0,
      failed_allocations: ngo.failed_allocations || 0,
      reliability_score: ngo.reliability_score,
      workload: ngo.workload || 0,
      last_availability_update: ngo.last_availability_update,
      is_stale: ngo.isStale ? ngo.isStale(24) : false
    }));

    res.json({
      evaluated_at: new Date(),
      total_ngos: ngos.length,
      metrics
    });
  } catch (error) {
    console.error('[routes/ngos] Error fetching reliability metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ngos
 * List all NGOs with optional filtering and distance calculation
 */
router.get('/', async (req, res) => {
  try {
    const { active, min_food, min_shelter, min_supplies, lat, lng } = req.query;
    const filter = {};

    if (active !== undefined) {
      filter.is_active = active === 'true';
    }
    if (min_food) {
      filter.food_units = { $gte: Number(min_food) };
    }
    if (min_shelter) {
      filter.shelter_capacity = { $gte: Number(min_shelter) };
    }
    if (min_supplies) {
      filter.supply_units = { $gte: Number(min_supplies) };
    }

    let ngos = await Ngo.find(filter).sort({ name: 1 });

    // If client provided coordinates, augment with distance in km
    if (lat !== undefined && lng !== undefined) {
      const clientLat = Number(lat);
      const clientLng = Number(lng);
      if (!isNaN(clientLat) && !isNaN(clientLng)) {
        ngos = ngos.map(ngo => {
          const ngoObj = ngo.toObject();
          ngoObj.distance_km = parseFloat(
            getDistance(clientLat, clientLng, ngo.location.lat, ngo.location.lng).toFixed(2)
          );
          return ngoObj;
        });
        ngos.sort((a, b) => a.distance_km - b.distance_km);
      }
    }

    res.json(ngos);
  } catch (error) {
    console.error('[routes/ngos] Error fetching NGOs:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ngos/:id/depletion-monitoring
 * Single facility depletion rate & remaining duration estimate
 */
router.get('/:id/depletion-monitoring', async (req, res) => {
  try {
    const ngo = await Ngo.findById(req.params.id);
    if (!ngo) return res.status(404).json({ error: 'NGO not found' });

    const now = Date.now();
    const windowHours = 24;
    const history = ngo.allocation_history || [];
    const recentAllocations = history.filter(h => (now - new Date(h.timestamp).getTime()) <= windowHours * 60 * 60 * 1000);

    const consumption = { food_units: 0, shelter_capacity: 0, supply_units: 0 };
    recentAllocations.forEach(a => {
      if (consumption[a.resource_type] !== undefined) {
        consumption[a.resource_type] += (a.quantity || 0);
      }
    });

    const rates = {
      food_units_per_hour: parseFloat((consumption.food_units / windowHours).toFixed(2)),
      shelter_capacity_per_hour: parseFloat((consumption.shelter_capacity / windowHours).toFixed(2)),
      supply_units_per_hour: parseFloat((consumption.supply_units / windowHours).toFixed(2))
    };

    const estimateBurnout = (current, rate) => {
      if (current === 0) return 0;
      if (rate === 0) return null;
      return parseFloat((current / rate).toFixed(1));
    };

    const burnoutHours = {
      food_units: estimateBurnout(ngo.food_units, rates.food_units_per_hour),
      shelter_capacity: estimateBurnout(ngo.shelter_capacity, rates.shelter_capacity_per_hour),
      supply_units: estimateBurnout(ngo.supply_units, rates.supply_units_per_hour)
    };

    let status = 'HEALTHY';
    const allBurnouts = [burnoutHours.food_units, burnoutHours.shelter_capacity, burnoutHours.supply_units].filter(b => b !== null);
    if (allBurnouts.some(b => b <= 6)) {
      status = 'CRITICAL';
    } else if (allBurnouts.some(b => b <= 24)) {
      status = 'WARNING';
    }

    res.json({
      ngo_id: ngo._id,
      name: ngo.name,
      current_inventory: {
        food_units: ngo.food_units,
        shelter_capacity: ngo.shelter_capacity,
        supply_units: ngo.supply_units
      },
      consumption_rates_24h: rates,
      estimated_burnout_hours: burnoutHours,
      depletion_status: status,
      is_stale: ngo.isStale ? ngo.isStale(24) : false
    });
  } catch (error) {
    console.error(`[routes/ngos] Error fetching NGO depletion ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ngos/:id
 * Retrieve single NGO by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const ngo = await Ngo.findById(req.params.id);
    if (!ngo) {
      return res.status(404).json({ error: 'NGO not found' });
    }

    const ngoObj = ngo.toObject();
    const { lat, lng } = req.query;
    if (lat !== undefined && lng !== undefined) {
      const clientLat = Number(lat);
      const clientLng = Number(lng);
      if (!isNaN(clientLat) && !isNaN(clientLng)) {
        ngoObj.distance_km = parseFloat(
          getDistance(clientLat, clientLng, ngo.location.lat, ngo.location.lng).toFixed(2)
        );
      }
    }

    res.json(ngoObj);
  } catch (error) {
    console.error(`[routes/ngos] Error fetching NGO ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ngos
 * Register a new NGO facility
 */
router.post('/', async (req, res) => {
  try {
    const { name, location, food_units, shelter_capacity, supply_units, contact_phone, address, is_active, max_coverage_radius_km } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Valid NGO name is required' });
    }

    if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
      return res.status(400).json({ error: 'Valid location { lat, lng } is required' });
    }

    const newNgo = new Ngo({
      name: name.trim(),
      location: { lat: location.lat, lng: location.lng },
      food_units: food_units !== undefined ? Math.max(0, Number(food_units)) : 0,
      shelter_capacity: shelter_capacity !== undefined ? Math.max(0, Number(shelter_capacity)) : 0,
      supply_units: supply_units !== undefined ? Math.max(0, Number(supply_units)) : 0,
      contact_phone: contact_phone || '',
      address: address || '',
      max_coverage_radius_km: max_coverage_radius_km !== undefined ? Number(max_coverage_radius_km) : 50,
      is_active: is_active !== undefined ? Boolean(is_active) : true,
      last_availability_update: new Date()
    });

    await newNgo.save();
    console.log(`[routes/ngos] Registered new NGO: ${newNgo.name} (${newNgo._id})`);

    // Emit live update
    await agentBus.emitEvent('ngo.availability.updated', null, newNgo.toObject ? newNgo.toObject() : newNgo);

    res.status(201).json(newNgo);
  } catch (error) {
    console.error('[routes/ngos] Error creating NGO:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/ngos/:id/availability
 * Update NGO capacity / availability and broadcast to agent bus
 */
router.post('/:id/availability', async (req, res) => {
  try {
    const { food_units, shelter_capacity, supply_units, workload, is_active, max_coverage_radius_km } = req.body;
    const ngo = await Ngo.findById(req.params.id);

    if (!ngo) {
      return res.status(404).json({ error: 'NGO not found' });
    }

    // Validate non-negative numbers if provided
    if (food_units !== undefined) {
      const num = Number(food_units);
      if (isNaN(num) || num < 0) return res.status(400).json({ error: 'food_units must be a non-negative number' });
      ngo.food_units = num;
    }

    if (shelter_capacity !== undefined) {
      const num = Number(shelter_capacity);
      if (isNaN(num) || num < 0) return res.status(400).json({ error: 'shelter_capacity must be a non-negative number' });
      ngo.shelter_capacity = num;
    }

    if (supply_units !== undefined) {
      const num = Number(supply_units);
      if (isNaN(num) || num < 0) return res.status(400).json({ error: 'supply_units must be a non-negative number' });
      ngo.supply_units = num;
    }

    if (workload !== undefined) {
      const num = Number(workload);
      if (isNaN(num) || num < 0) return res.status(400).json({ error: 'workload must be a non-negative number' });
      ngo.workload = num;
    }

    if (max_coverage_radius_km !== undefined) {
      const num = Number(max_coverage_radius_km);
      if (isNaN(num) || num <= 0) return res.status(400).json({ error: 'max_coverage_radius_km must be a positive number' });
      ngo.max_coverage_radius_km = num;
    }

    if (is_active !== undefined) {
      ngo.is_active = Boolean(is_active);
    }

    // Update freshness timestamp
    ngo.last_availability_update = new Date();

    await ngo.save();
    console.log(`[routes/ngos] Updated availability for NGO ${ngo.name} (${ngo._id})`);

    // Emit event on bus for live Resource Dashboard and Audit Log
    await agentBus.emitEvent('ngo.availability.updated', null, ngo.toObject ? ngo.toObject() : ngo);

    res.json(ngo);
  } catch (error) {
    console.error(`[routes/ngos] Error updating NGO availability ${req.params.id}:`, error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/ngos/:id
 * Remove NGO
 */
router.delete('/:id', async (req, res) => {
  try {
    const ngo = await Ngo.findByIdAndDelete(req.params.id);
    if (!ngo) return res.status(404).json({ error: 'NGO not found' });
    res.json({ message: 'NGO deleted successfully', id: req.params.id });
  } catch (error) {
    console.error(`[routes/ngos] Error deleting NGO ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
