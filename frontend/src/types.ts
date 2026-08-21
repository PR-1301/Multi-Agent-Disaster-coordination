export interface Location {
  lat: number;
  lng: number;
}

export interface Case {
  id: string;
  sector_id: string;
  reported_at: string;
  category_hint: string;
  urgency: string;
  description: string;
  location_lat: number;
  location_lng: number;
  source_command_center: string;
  status: string;
  assigned_to?: string;
}

export interface Hospital {
  id: string;
  name: string;
  lat: number;
  lng: number;
  bed_count: number;
  icu_count: number;
  ambulance_count: number;
}

export interface NGO {
  id: string;
  name: string;
  lat: number;
  lng: number;
  food_units: number;
  shelter_capacity: number;
  supply_units: number;
}

export interface Escalation {
  id: string;
  case_id: string;
  reason: string;
  status: string;
  case: Case;
}
