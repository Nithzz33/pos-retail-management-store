import { Server, Socket } from 'socket.io';
import { MatchingResult, Order } from '../../types';

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
   * Sends requests to the top N riders. First acceptance wins.
   */
  public async dispatchOrder(order: Order, riders: MatchingResult[]) {
    if (!this.io) return;

    console.log(`Dispatching order ${order.id} to ${riders.length} riders...`);

    // Notify Batch
    riders.forEach(result => {
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
        this.io?.emit('ORDER_TIMEOUT', { orderId: order.id });
        console.log(`Order ${order.id} dispatch timed out.`);
        // Retry logic would go here
      }
    }, 10000);

    this.activeDispatches.set(order.id, { order, riders, timeout });
  }
}

export const dispatchService = new DispatchService();
