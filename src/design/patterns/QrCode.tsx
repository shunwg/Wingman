import { useMemo } from 'react';
import QRCode from 'qrcode';

/**
 * A QR code as inline SVG.
 *
 * Built from `qrcode`'s pure encoder — no canvas, so it renders identically
 * on a lanyard printer, a slide, and a dark phone. Ink on canvas tokens, with
 * a white-ish quiet zone the spec asks for.
 */
export function QrCode({ text, size = 200, label }: { text: string; size?: number; label?: string }) {
  const { modules, count } = useMemo(() => {
    const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
    const count = qr.modules.size;
    const data = qr.modules.data as Uint8Array;
    let d = '';
    for (let y = 0; y < count; y++) {
      for (let x = 0; x < count; x++) {
        if (data[y * count + x]) d += `M${x + 4} ${y + 4}h1v1h-1z`;
      }
    }
    return { modules: d, count };
  }, [text]);
  const side = count + 8;
  return (
    <svg
      className="qr"
      viewBox={`0 0 ${side} ${side}`}
      width={size}
      height={size}
      role="img"
      aria-label={label ?? 'QR code'}
      shapeRendering="crispEdges"
    >
      <rect width={side} height={side} fill="#ffffff" />
      <path d={modules} fill="#141110" />
    </svg>
  );
}
