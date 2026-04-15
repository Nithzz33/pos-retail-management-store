import { Server, Socket } from 'socket.io';
import type { MatchingResult, Order } from '../../types.ts';

/**
 * Dispatch Service (WebSocket)
 * Implements real-time order dispatch with first-accept-wins logic.
 */
export class DispatchService {
  private io: Server | null = null;
  private activeDispatches: Map<string, { order: Order; riders: MatchingResult[]; timeout: NodeJS.Timeout }> = new Map();

  constructor() {}

  public init(io: Server) {
    this.io = io;
    this.setupListeners();
  }

  private setupListeners() {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      const riderId = socket.handshake.query.riderId as string;
      if (riderId) {
        socket.join(`rider_${riderId}`);
        console.log(`Rider ${riderId} connected to Dispatch Service.`);
      }

      // Handle Acceptance
      socket.on('ACCEPT_ORDER', async ({ orderId, riderId }) => {
        const dispatch = this.activeDispatches.get(orderId);
        if (dispatch) {
          // Atomic Lock (Simulated Redis SETNX)
          this.activeDispatches.delete(orderId);
          clearTimeout(dispatch.timeout);

          // Notify Winner
          this.io?.to(`rider_${riderId}`).emit('ORDER_CONFIRMED', { orderId });
          
          // Notify Others
          socket.broadcast.emit('ORDER_TAKEN', { orderId });
          
          console.log(`Order ${orderId} accepted by Rider ${riderId}.`);
        } else {
          socket.emit('ORDER_MISSED', { message: 'Already accepted by another rider or timed out.' });
        }
      });

      // Handle Rejection
      socket.on('REJECT_ORDER', ({ orderId, riderId }) => {
        console.log(`Rider ${riderId} rejected order ${orderId}.`);
        // In a real system, we would immediately try the next best rider
      });
    });
  }

  /**
   * Batch Dispatch Logic
   * Sends requests to riders in batches. First acceptance wins.
   */
  public async dispatchOrder(order: Order, allRiders: MatchingResult[], batchIndex: number = 0) {
    if (!this.io) return;

    const BATCH_SIZE = 5;
    const currentBatch = allRiders.slice(batchIndex * BATCH_SIZE, (batchIndex + 1) * BATCH_SIZE);

    if (currentBatch.length === 0) {
      console.log(`Order ${order.id} failed to find a rider after all retries.`);
      this.io?.emit('ORDER_FAILED', { orderId: order.id, reason: 'No riders available' });
      return;
    }

    console.log(`Dispatching order ${order.id} to batch ${batchIndex + 1} (${currentBatch.length} riders)...`);

    // Notify Batch
    currentBatch.forEach(result => {
      this.io?.to(`rider_${result.riderId}`).emit('NEW_ORDER', {
        orderId: order.id,
        pickup: order.pickupLocation,
        delivery: order.deliveryAddress,
        eta: result.eta,
        distance: result.distance,
        surge: order.surgeMultiplier
      });
    });

    // Set Timeout (10 seconds for acceptance)
    const timeout = setTimeout(() => {
      const dispatch = this.activeDispatches.get(order.id);
      if (dispatch) {
        this.activeDispatches.delete(order.id);
        this.io?.emit('ORDER_TIMEOUT', { orderId: order.id, batchIndex });
        console.log(`Order ${order.id} dispatch timed out for batch ${batchIndex + 1}. Retrying next batch...`);
        // Retry logic: dispatch to next batch
        this.dispatchOrder(order, allRiders, batchIndex + 1);
      }
    }, 10000);

    this.activeDispatches.set(order.id, { order, riders: currentBatch, timeout });
  }
}

export const dispatchService = new DispatchService();
