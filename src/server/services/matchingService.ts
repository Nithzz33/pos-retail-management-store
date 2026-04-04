import axios from 'axios';
import { calculateHaversineDistance, calculateETA, calculateRiderScore } from '../../utils/geoUtils';
import { Order, Rider, MatchingResult } from '../../types';

/**
 * Matching Service (The Brain)
 * Implements high-performance rider matching with traffic optimization.
 */
export class MatchingService {
  private readonly GOOGLE_MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY;

  /**
   * Find and rank nearby riders for a new order.
   * 1. Spatial Filter (Haversine)
   * 2. Traffic-Aware ETA Calculation
   * 3. Multi-Factor Scoring
   */
  public async findBestRiders(order: Order, riders: Rider[], radiusKm: number = 5): Promise<MatchingResult[]> {
    const orderLat = order.pickupLocation?.lat || 12.9716;
    const orderLng = order.pickupLocation?.lng || 77.5946;

    // 1. Initial Filtering (Haversine distance < radiusKm)
    const nearbyRiders = riders.filter(rider => {
      if (rider.status !== 'online') return false;
      const distance = calculateHaversineDistance(
        rider.location.lat,
        rider.location.lng,
        orderLat,
        orderLng
      );
      return distance <= radiusKm;
    });

    // 2. Dynamic Radius Expansion: If no riders found, expand radius and retry
    if (nearbyRiders.length === 0 && radiusKm < 15) {
      return this.findBestRiders(order, riders, radiusKm + 5);
    }

    // 3. Filter top 20 riders based on Haversine distance for initial ranking
    const topKRiders = nearbyRiders
      .map(rider => ({
        rider,
        distance: calculateHaversineDistance(
          rider.location.lat,
          rider.location.lng,
          orderLat,
          orderLng
        )
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 20);

    // 4. Compute ETA using Traffic Optimization (Simulated A* or Real API)
    const results: MatchingResult[] = await Promise.all(topKRiders.map(async ({ rider, distance }) => {
      let eta: number;
      
      if (this.GOOGLE_MAPS_KEY) {
        try {
          // Real Google Maps API Call (Optional)
          const response = await axios.get(`https://maps.googleapis.com/maps/api/distancematrix/json`, {
            params: {
              origins: `${rider.location.lat},${rider.location.lng}`,
              destinations: `${orderLat},${orderLng}`,
              departure_time: 'now',
              traffic_model: 'best_guess',
              key: this.GOOGLE_MAPS_KEY
            }
          });
          eta = response.data.rows[0].elements[0].duration_in_traffic.value / 60;
        } catch (error) {
          // Fallback to Simulated ETA
          eta = calculateETA(rider.location.lat, rider.location.lng, orderLat, orderLng);
        }
      } else {
        // Simulated Traffic-Aware ETA
        eta = calculateETA(rider.location.lat, rider.location.lng, orderLat, orderLng);
      }

      // 5. Multi-Factor Scoring
      // Score = w1*ETA + w2*Rating + w3*Acceptance
      const score = calculateRiderScore(eta, rider.rating || 4.5, rider.acceptanceRate || 0.9);

      return {
        riderId: rider.id,
        score,
        distance,
        eta
      };
    }));

    // 6. Rank by Score (Descending) and return top 5 for batch dispatch
    return results.sort((a, b) => b.score - a.score).slice(0, 5);
  }
}

export const matchingService = new MatchingService();
