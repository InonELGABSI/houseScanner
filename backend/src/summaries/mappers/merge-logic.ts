export interface MergeInputRoom {
  id: string;
  ordinal: number;
  label?: string | null;
  detectedRoomTypes?: string[];
}

export interface MergeInput {
  house: Record<string, unknown>;
  rooms: MergeInputRoom[];
  products: Array<Record<string, unknown>>;
}

export interface MergeResult {
  summary: Record<string, unknown>;
}

export const mergeAgentOutputs = (input: MergeInput): MergeResult => {
  const rooms = input.rooms.map((room) => ({
    id: room.id,
    ordinal: room.ordinal,
    label: room.label ?? `Room ${room.ordinal + 1}`,
    detectedRoomTypes: room.detectedRoomTypes ?? [],
    products: [] as Array<{ name: string; confidence?: number }>,
  }));

  return {
    summary: {
      overview: {
        description:
          'Scan in progress. Detailed AI summary will appear here once processing completes.',
        highlights: [] as string[],
        recommendations: [] as string[],
      },
      house: input.house,
      rooms,
      products: input.products,
      checklist: {
        decisions: [] as Array<{
          roomId: string;
          productName: string;
          shouldStay: boolean;
        }>,
        tests: [] as Array<{ name: string; passed: boolean }>,
      },
    },
  };
};
