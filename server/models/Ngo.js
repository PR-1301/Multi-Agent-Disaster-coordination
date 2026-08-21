const mongoose = require('mongoose');

const ngoSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'NGO name is required'],
      trim: true
    },
    location: {
      lat: {
        type: Number,
        required: [true, 'Latitude is required']
      },
      lng: {
        type: Number,
        required: [true, 'Longitude is required']
      }
    },
    food_units: {
      type: Number,
      default: 0,
      min: [0, 'Food units cannot be negative']
    },
    shelter_capacity: {
      type: Number,
      default: 0,
      min: [0, 'Shelter capacity cannot be negative']
    },
    supply_units: {
      type: Number,
      default: 0,
      min: [0, 'Supply units cannot be negative']
    },
    workload: {
      type: Number,
      default: 0,
      min: [0, 'Workload cannot be negative']
    },
    is_active: {
      type: Boolean,
      default: true
    },
    last_availability_update: {
      type: Date,
      default: Date.now
    },
    successful_allocations: {
      type: Number,
      default: 0,
      min: 0
    },
    failed_allocations: {
      type: Number,
      default: 0,
      min: 0
    },
    max_coverage_radius_km: {
      type: Number,
      default: 50,
      min: 1
    },
    allocation_history: [
      {
        timestamp: { type: Date, default: Date.now },
        resource_type: { type: String, default: 'shelter_capacity' },
        quantity: { type: Number, default: 1 },
        case_id: { type: String, default: '' }
      }
    ],
    contact_phone: {
      type: String,
      default: '',
      trim: true
    },
    address: {
      type: String,
      default: '',
      trim: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for dynamic reliability score (0.0 to 1.0)
ngoSchema.virtual('reliability_score').get(function () {
  const total = (this.successful_allocations || 0) + (this.failed_allocations || 0);
  if (total === 0) return 1.0; // Default 100% for fresh NGO
  return parseFloat(((this.successful_allocations || 0) / total).toFixed(2));
});

// Helper method to check if inventory data is stale (> thresholdHours)
ngoSchema.methods.isStale = function (thresholdHours = 24) {
  if (!this.last_availability_update) return true;
  const ageHours = (Date.now() - new Date(this.last_availability_update).getTime()) / (1000 * 60 * 60);
  return ageHours > thresholdHours;
};

// Indexes for query performance
ngoSchema.index({ is_active: 1, food_units: 1 });
ngoSchema.index({ is_active: 1, shelter_capacity: 1 });
ngoSchema.index({ is_active: 1, supply_units: 1 });
ngoSchema.index({ last_availability_update: 1 });

module.exports = mongoose.model('Ngo', ngoSchema);
