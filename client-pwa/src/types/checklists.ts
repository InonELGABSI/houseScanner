export interface Checklist {
  id: string;
  scope: 'house' | 'room' | 'product';
  name: string;
  version: number;
  itemsRaw: Record<string, unknown>;
  createdAt: string;
  isBase?: boolean;
}

export interface UpdateChecklistData {
  name?: string;
  version?: number;
  itemsRaw?: Record<string, unknown>;
}
