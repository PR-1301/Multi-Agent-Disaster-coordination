module.exports = {
  CONFIDENCE_THRESHOLD: 0.75,
  RETRY_COUNT: 2,
  BASE_BACKOFF_MS: 500,
  PRIORITY_WEIGHTS: {
    urgency: {
      critical: 40,
      high: 30,
      medium: 15,
      low: 0
    },
    signals: {
      injuries_mentioned: 20,
      trapped_or_immobile: 30,
      vulnerable_persons: 15,
      structural_damage: 5
    },
    // Boost score by this much per hour unrouted
    age_boost_per_hour: 5 
  },
  // Bidding and Arbitration
  BID_WINDOW_MIN_MS: process.env.BID_WINDOW_MIN_MS || 1000,
  BID_WINDOW_MAX_MS: process.env.BID_WINDOW_MAX_MS || 5000,
  UNDO_WINDOW_MS: 60000,
  
  // Clustering
  CLUSTER_RADIUS_KM: 3,
  CLUSTER_TIME_WINDOW_MS: 1000 * 60 * 30, // 30 minutes
  CAPACITY_RISK_WINDOW_SIZE: 5,
  CAPACITY_RISK_THRESHOLD: -1.0, // if losing > 1 unit per update
  
  // LLM Versioning
  PROMPT_VERSION: process.env.PROMPT_VERSION || 'v1.0',

  CIRCUIT_BREAKER_THRESHOLD: 3, // consecutive failures to open circuit
  CIRCUIT_BREAKER_COOLDOWN_MS: 10000 // 10 seconds cooldown
};
