/**
 * A photo someone picked, made small enough to keep.
 *
 * Everything lives in localStorage for now, and localStorage is ~5 MB per
 * origin with a persist layer that fails silently past it. So a picked photo
 * is centre-cropped to a square and re-encoded at 256px JPEG — 20–40 KB —
 * before it goes anywhere near the store. The original is never kept.
 */

export const PHOTO_SIZE = 256;
export const PHOTO_QUALITY = 0.8;
/** Refused before decoding: a 40 MB RAW is not a portrait. */
export const MAX_SOURCE_BYTES = 10 * 1024 * 1024;

/** The largest centred square inside a w×h image. Pure, so it is testable. */
export function cropSquare(w: number, h: number): { sx: number; sy: number; size: number } {
  const size = Math.min(w, h);
  return { sx: Math.floor((w - size) / 2), sy: Math.floor((h - size) / 2), size };
}

export async function resizeToDataUrl(
  file: Blob,
  opts: { size?: number; quality?: number } = {},
): Promise<string> {
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('That file is over 10 MB. A phone photo is plenty.');
  }
  const size = opts.size ?? PHOTO_SIZE;
  const quality = opts.quality ?? PHOTO_QUALITY;

  const bitmap = await decode(file);
  const { sx, sy, size: side } = cropSquare(bitmap.width, bitmap.height);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot resize images.');
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  if ('close' in bitmap) bitmap.close();
  return canvas.toDataURL('image/jpeg', quality);
}

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') return createImageBitmap(file);
  // Older WebKit: go through an <img>.
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('That does not look like an image.'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
