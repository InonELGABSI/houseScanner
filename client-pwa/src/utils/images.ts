import type { ImageRef } from '../types/scan-context';

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function transformImagesForServer(images: ImageRef[]) {
  const allImagesBase64: Array<{ base64: string }> = [];
  const roomsMap: Record<string, Array<{ base64: string }>> = {};

  for (const imageRef of images) {
    if (!imageRef.file) {
      continue;
    }

    try {
      const base64 = await fileToBase64(imageRef.file);
      const imageData = { base64 };

      allImagesBase64.push(imageData);

      const roomKey = `room${imageRef.roomIndex + 1}`;
      if (!roomsMap[roomKey]) {
        roomsMap[roomKey] = [];
      }
      roomsMap[roomKey].push(imageData);
    } catch (error) {
      console.error('Failed to convert image to base64:', error);
    }
  }

  return {
    all_images: allImagesBase64,
    rooms: roomsMap,
    custom_checklist: null,
  };
}
