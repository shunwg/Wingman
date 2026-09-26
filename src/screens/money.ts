/**
 * Money, at the render edge.
 *
 * The domain holds minor units and an ISO code and never formats anything —
 * the same split as time, which is UTC inside and local only here. Whole units
 * only: every figure the app shows is an estimate the host guessed, and "€33.34"
 * would claim a precision nobody has.
 */
export function money(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(minor / 100);
  } catch {
    // An unknown code still reads, rather than taking the screen down.
    return `${Math.round(minor / 100)} ${currency}`;
  }
}
