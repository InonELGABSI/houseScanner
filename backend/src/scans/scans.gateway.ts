import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

/**
 * WebSocket Gateway for real-time scan progress updates.
 *
 * Client connects after login with auth token:
 * socket = io('http://localhost:3000', {
 *   auth: { token: 'jwt_token' }
 * });
 *
 * Events emitted to client:
 * - 'scan:uploaded' - Images uploaded, scan created
 * - 'scan:processing' - Processing started
 * - 'scan:progress' - Progress updates (0-100)
 * - 'scan:completed' - Processing completed successfully
 * - 'scan:failed' - Processing failed
 */
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',').map(o => o.trim()) || ['http://localhost:5173'],
    credentials: true,
  },
  namespace: '/scans',
})
export class ScansGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ScansGateway.name);

  // Map userId to socket IDs
  private readonly userSockets = new Map<string, Set<string>>();

  handleConnection(client: Socket) {
    const userId = this.extractUserId(client);

    if (!userId) {
      this.logger.warn(`Client ${client.id} connected without valid auth`);
      client.disconnect();
      return;
    }

    // Register user socket
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(client.id);

    this.logger.log(`Client ${client.id} connected for user ${userId}`);
    client.join(`user:${userId}`); // Join room for this user
  }

  handleDisconnect(client: Socket) {
    const userId = this.extractUserId(client);

    if (userId) {
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
        }
      }
    }

    this.logger.log(`Client ${client.id} disconnected`);
  }

  /**
   * Emit event when images are uploaded successfully
   */
  emitImagesUploaded(
    userId: string,
    data: {
      scanId: string;
      roomsCount: number;
      imagesCount: number;
      message: string;
    },
  ) {
    this.server.to(`user:${userId}`).emit('scan:uploaded', data);
    this.logger.log(`Emitted 'scan:uploaded' to user ${userId}`);
  }

  /**
   * Emit event when scan processing starts
   */
  emitProcessingStarted(
    userId: string,
    data: {
      scanId: string;
      message: string;
    },
  ) {
    this.server.to(`user:${userId}`).emit('scan:processing', data);
    this.logger.log(`Emitted 'scan:processing' to user ${userId}`);
  }

  /**
   * Emit progress update during processing
   */
  emitProgress(
    userId: string,
    data: {
      scanId: string;
      progress: number;
      stage?: string;
    },
  ) {
    this.server.to(`user:${userId}`).emit('scan:progress', data);
    this.logger.debug(
      `Emitted 'scan:progress' to user ${userId} | scanId=${data.scanId} progress=${data.progress}${
        data.stage ? ` stage="${data.stage}"` : ''
      }`,
    );
  }

  /**
   * Emit event when scan completes successfully
   */
  emitCompleted(
    userId: string,
    data: {
      scanId: string;
      message: string;
      result?: any; // Optional: full scan results from agents-service
    },
  ) {
    this.server.to(`user:${userId}`).emit('scan:completed', data);
    this.logger.log(`Emitted 'scan:completed' to user ${userId}`);
  }

  /**
   * Emit event when scan fails
   */
  emitFailed(
    userId: string,
    data: {
      scanId: string;
      error: string;
    },
  ) {
    this.server.to(`user:${userId}`).emit('scan:failed', data);
    this.logger.log(`Emitted 'scan:failed' to user ${userId}`);
  }

  /**
   * Extract userId from socket auth token
   * In a real app, validate JWT token here
   */
  private extractUserId(client: Socket): string | null {
    try {
      // For now, expect userId in auth
      // In production, decode JWT token
      const userId =
        client.handshake.auth?.userId || client.handshake.query?.userId;
      return (userId as string) || null;
    } catch (error) {
      this.logger.error('Failed to extract userId from socket', error);
      return null;
    }
  }
}
