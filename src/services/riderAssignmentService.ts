import { 
  geohashForLocation, 
  geohashQueryBounds, 
  distanceBetween 
} from 'geofire-common';
import { 
  calculateHaversineDistance, 
  calculateETA, 
  calculateRiderScore 
} from '../utils/geoUtils';

/**
 * Rider Assignment Service
 * Implements a high-performance matching algorithm for a delivery platform.
 */

export interface Rider {
  id: string;
  name: string;
  location: {
    lat: number;
    lng: number;
  };
  geohash: string;
  rating: number;
  acceptanceRate: number;
  status: 'online' | 'busy' | 'offline';
  lastUpdated: number;
}

export interface Order {
  id: string;
  pickupLocation: {
    lat: number;
    lng: number;
  };
  deliveryLocation: {
    lat: number;
    lng: number;
  };
  status: 'pending' | 'assigned' | 'picked_up' | 'delivered';
  createdAt: number;
}

export interface MatchingResult {
  riderId: string;
  score: number;
  eta: number;
  distance: number;
}

class RiderAssignmentService {
  /**
   * Calculate Surge Pricing based on demand vs supply ratio.
   * Formula: Surge = (Demand / Supply) * TimeFactor
   */
  public calculateSurge(demandCount: number, supplyCount: number): { multiplier: number; amount: number } {
    const ratio = demandCount / (Math.max(1, supplyCount));
    let multiplier = 1.0;

    // 1. Demand/Supply Ratio Factor
    if (ratio > 1.5) multiplier = 1.2;
    if (ratio > 2.5) multiplier = 1.5;
    if (ratio > 4.0) multiplier = 2.0;

    // 2. Time of Day Factor (Peak Hours in India)
    const hour = new Date().getHours();
    const isLunchPeak = hour >= 12 && hour <= 14;
    const isDinnerPeak = hour >= 19 && hour <= 22;
    const isLateNight = hour >= 23 || hour <= 4;

    if (isLunchPeak || isDinnerPeak) multiplier += 0.2;
    if (isLateNight) multiplier += 0.4;

    // 3. Prevent extreme spikes (Cap at 3.5x)
    multiplier = Math.min(3.5, multiplier);

    return {
      multiplier: Number(multiplier.toFixed(2)),
      amount: 0 // Will be calculated based on order total
    };
  }

  /**
   * Find and rank nearby riders for a new order.
   * @param order The order to find riders for
   * @param allRiders List of all online riders (in a real app, this would be a database query)
   * @param radiusKm Initial search radius in kilometers
   * @param maxRiders Maximum number of riders to return
   */
  public async findBestRiders(
    order: Order,
    allRiders: Rider[],
    radiusKm: number = 5,
    maxRiders: number = 5
  ): Promise<MatchingResult[]> {
    const center = [order.pickupLocation.lat, order.pickupLocation.lng];
    
    // 1. Fetch nearby riders using Geohash bounds
    // In a real database (Firestore/PostGIS), this would be a query like:
    // const bounds = geohashQueryBounds(center, radiusKm * 1000);
    // const results = await query(collection(db, 'riders'), where('geohash', '>=', bounds[0][0]), where('geohash', '<=', bounds[0][1]));
    
    // For this simulation, we filter the provided list
    const nearbyRiders = allRiders.filter(rider => {
      const distance = distanceBetween([rider.location.lat, rider.location.lng], center as [number, number]);
      return distance <= radiusKm;
    });

    // 2. Dynamic Radius Expansion: If no riders found, expand radius and retry
    if (nearbyRiders.length === 0 && radiusKm < 15) {
      console.log(`No riders found in ${radiusKm}km. Expanding to ${radiusKm + 5}km...`);
      return this.findBestRiders(order, allRiders, radiusKm + 5, maxRiders);
    }

    // 3. Filter top K riders based on Haversine distance for initial ranking
    const topKRiders = nearbyRiders
      .map(rider => ({
        rider,
        distance: calculateHaversineDistance(
          rider.location.lat,
          rider.location.lng,
          order.pickupLocation.lat,
          order.pickupLocation.lng
        )
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 20); // Consider top 20 for more detailed ETA calculation

    // 4. Compute ETA using A* (simplified) and Rank Riders
    const rankedRiders: MatchingResult[] = topKRiders.map(({ rider, distance }) => {
      const eta = calculateETA(
        rider.location.lat,
        rider.location.lng,
        order.pickupLocation.lat,
        order.pickupLocation.lng
      );
      
      const score = calculateRiderScore(eta, rider.rating, rider.acceptanceRate);
      
      return {
        riderId: rider.id,
        score,
        eta,
        distance
      };
    });

    // 5. Sort by score (descending) and return top N
    return rankedRiders
      .sort((a, b) => b.score - a.score)
      .slice(0, maxRiders);
  }

  /**
   * Batch Dispatch Logic
   * Sends requests to the top N riders. First acceptance wins.
   */
  public async dispatchOrder(order: Order, riders: MatchingResult[]): Promise<string | null> {
    console.log(`Dispatching order ${order.id} to ${riders.length} riders...`);
    
    // In a real system, this would:
    // 1. Send WebSocket/Push notifications to all riders in the list.
    // 2. Use a distributed lock (Redis) or optimistic concurrency (Firestore) to handle the first acceptance.
    // 3. Set a timeout for each batch.
    
    // Simulation of first acceptance
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log(`Order ${order.id} dispatch timed out.`);
        resolve(null);
      }, 30000); // 30 second timeout

      // Simulate a rider accepting after a random delay
      const randomDelay = Math.random() * 5000 + 2000; // 2-7 seconds
      setTimeout(() => {
        const winner = riders[0].riderId; // Top ranked rider accepts
        clearTimeout(timeout);
        console.log(`Rider ${winner} accepted order ${order.id}.`);
        resolve(winner);
      }, randomDelay);
    });
  }
}

export const riderAssignmentService = new RiderAssignmentService();
