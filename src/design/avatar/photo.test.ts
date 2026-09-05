import { describe, expect, it } from 'vitest';
import { MAX_SOURCE_BYTES, cropSquare, resizeToDataUrl } from './photo';

describe('cropSquare', () => {
  it('takes the centre of a landscape image', () => {
    expect(cropSquare(2000, 1000)).toEqual({ sx: 500, sy: 0, size: 1000 });
  });
  it('takes the centre of a portrait image', () => {
    expect(cropSquare(600, 900)).toEqual({ sx: 0, sy: 150, size: 600 });
  });
  it('leaves a square alone', () => {
    expect(cropSquare(512, 512)).toEqual({ sx: 0, sy: 0, size: 512 });
  });
});

describe('resizeToDataUrl', () => {
  it('refuses an oversized source before decoding it', async () => {
    const big = { size: MAX_SOURCE_BYTES + 1 } as Blob;
    await expect(resizeToDataUrl(big)).rejects.toThrow(/10 MB/);
  });
});
