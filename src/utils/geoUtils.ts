/**
 * Geospatial Utilities for Rider Assignment System
 */

/**
 * Haversine distance formula to calculate the distance between two points on a sphere.
 * @param lat1 Latitude of point 1
 * @param lon1 Longitude of point 1
 * @param lat2 Latitude of point 2
 * @param lon2 Longitude of point 2
 * @returns Distance in kilometers
 */
export const calculateHaversineDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Traffic Simulation Engine
 * Models real-world traffic patterns based on time of day, day of week, and location.
 */
const getTrafficFactor = (lat: number, lon: number): number => {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0 = Sunday, 6 = Saturday
  
  let factor = 1.0;
  
  // 1. Peak Hour Traffic (Rush Hour)
  const isWeekday = day >= 1 && day <= 5;
  const isMorningRush = hour >= 8 && hour <= 10;
  const isEveningRush = hour >= 17 && hour <= 19;
  
  if (isWeekday) {
    if (isMorningRush || isEveningRush) {
      factor += 0.8; // 80% increase during rush hour
    }
  } else {
    // Weekend leisure traffic
    if (hour >= 11 && hour <= 20) {
      factor += 0.3; // 30% increase during weekend daytime
    }
  }
  
  // 2. Congestion Zones (Simulated City Center)
  // Assuming a hypothetical city center at (12.9716, 77.5946) - Bangalore example
  const cityCenterLat = 12.9716;
  const cityCenterLon = 77.5946;
  const distToCenter = calculateHaversineDistance(lat, lon, cityCenterLat, cityCenterLon);
  
  if (distToCenter < 5) {
    factor += (5 - distToCenter) * 0.1; // Higher congestion closer to center
  }
  
  // 3. Random Micro-congestion (Accidents, Roadwork)
  factor += Math.random() * 0.2;
  
  return factor;
};

/**
 * Simplified A* Pathfinding Algorithm for ETA calculation.
 * In a real-world scenario, this would use a road network graph (OpenStreetMap data)
 * or an external API like Google Maps Distance Matrix.
 */
export const calculateETA = (
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
  averageSpeedKmh: number = 25 // Average speed in city traffic
): number => {
  const distance = calculateHaversineDistance(startLat, startLon, endLat, endLon);
  
  // Simulation of A* pathfinding overhead (roads aren't straight lines)
  // Typically 1.2x to 1.5x the straight line distance
  const roadDistance = distance * 1.35;
  
  // Real-time Traffic Factor
  const trafficFactor = getTrafficFactor(startLat, startLon);
  
  const timeHours = (roadDistance * trafficFactor) / averageSpeedKmh;
  const etaMinutes = Math.round(timeHours * 60);
  
  // Minimum ETA of 2 minutes for any delivery
  return Math.max(2, etaMinutes);
};

/**
 * Rider Scoring Function
 * score = w1 * ETA + w2 * rating + w3 * acceptance_rate
 */
export const calculateRiderScore = (
  eta: number,
  rating: number,
  acceptanceRate: number
): number => {
  const w1 = -0.5; // Lower ETA is better (negative weight)
  const w2 = 0.3;  // Higher rating is better
  const w3 = 0.2;  // Higher acceptance rate is better
  
  // Normalize values (simplified)
  const normalizedEta = Math.max(0, 1 - eta / 30); // 0 to 1 scale, 30+ mins is 0
  const normalizedRating = rating / 5;
  const normalizedAcceptance = acceptanceRate;
  
  return (w1 * (1 - normalizedEta)) + (w2 * normalizedRating) + (w3 * normalizedAcceptance);
};
