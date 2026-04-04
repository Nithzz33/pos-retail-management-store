/**
 * Surge Pricing Service
 * Implements dynamic pricing based on demand vs supply ratio.
 */
export class SurgeService {
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
   * Anti-Manipulation Logic: Smooths surge spikes using a moving average.
   * (Simplified for this implementation)
   */
  public smoothSurge(currentSurge: number, historicalSurge: number): number {
    const alpha = 0.2; // Smoothing factor
    return (alpha * currentSurge) + ((1 - alpha) * historicalSurge);
  }
}

export const surgeService = new SurgeService();
