/**
 * Returns the configured canonical application origin without trusting request
 * headers. Security-sensitive email links must never be built from Host/XFH.
 */
export function canonicalAppUrl(): string | null {
  const configured = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!configured) return null;
  try {
    const url = new URL(configured);
    if (url.protocol !== 'https:' && process.env.NODE_ENV === 'production') return null;
    return url.origin;
  } catch {
    return null;
  }
}
