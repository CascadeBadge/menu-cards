export type Squashed = { base64: string; preview: string };

const SIZE = 160;

async function drawCover(source: CanvasImageSource, width: number, height: number): Promise<Squashed> {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read that photo.");
  const scale = Math.max(SIZE / width, SIZE / height);
  const w = width * scale;
  const h = height * scale;
  ctx.drawImage(source, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
  const preview = canvas.toDataURL("image/jpeg", 0.82);
  return { preview, base64: preview.slice(preview.indexOf(",") + 1) };
}

export async function squashFile(file: File): Promise<Squashed> {
  const bitmap = await createImageBitmap(file);
  try {
    return await drawCover(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

export async function squashFiles(files: File[]): Promise<{ photos: Squashed[]; failed: string[] }> {
  const photos: Squashed[] = [];
  const failed: string[] = [];
  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      failed.push(file.name || "a file");
      continue;
    }
    try {
      photos.push(await squashFile(file));
    } catch {
      failed.push(file.name || "a photo");
    }
  }
  return { photos, failed };
}
