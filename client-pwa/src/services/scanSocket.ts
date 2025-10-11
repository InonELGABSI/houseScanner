import { io, Socket } from 'socket.io-client';

export interface ScanEvents {
  'scan:uploaded': (data: {
    scanId: string;
    roomsCount: number;
    imagesCount: number;
    message: string;
  }) => void;

  'scan:processing': (data: {
    scanId: string;
    message: string;
  }) => void;

  'scan:progress': (data: {
    scanId: string;
    progress: number;
    stage?: string;
  }) => void;

  'scan:completed': (data: {
    scanId: string;
    message: string;
    result?: any;
  }) => void;

  'scan:failed': (data: {
    scanId: string;
    error: string;
  }) => void;
}

class ScanSocketService {
  private socket: Socket | null = null;
  private readonly baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  /**
   * Connect to WebSocket after user login
   */
  connect(userId: string) {
    if (this.socket?.connected) {
      console.log('Socket already connected');
      return;
    }

    this.socket = io(`${this.baseUrl}/scans`, {
      auth: {
        userId,
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    this.socket.on('connect', () => {
      console.log('✅ Connected to scan WebSocket');
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from scan WebSocket');
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });

    this.socket.onAny((event, ...args) => {
      try {
        const payload = args.length === 1 ? args[0] : args;
        console.debug('[ScanSocket] Event received:', event, payload);
      } catch (err) {
        console.warn('[ScanSocket] Failed to log event payload', err);
      }
    });
  }

  /**
   * Disconnect WebSocket (e.g., on logout)
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log('Socket disconnected');
    }
  }

  /**
   * Subscribe to a specific event
   */
  on<K extends keyof ScanEvents>(event: K, handler: ScanEvents[K]) {
    this.socket?.on(event as string, handler as any);
    console.debug(`[ScanSocket] Listener registered for ${event}`);
  }

  /**
   * Unsubscribe from an event
   */
  off<K extends keyof ScanEvents>(event: K, handler?: ScanEvents[K]) {
    this.socket?.off(event as string, handler as any);
    console.debug(`[ScanSocket] Listener removed for ${event}`);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const scanSocket = new ScanSocketService();
