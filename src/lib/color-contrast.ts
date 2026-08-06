export type HexColor = `#${string}`;

function channel(hex: string, offset: number): number {
  const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function isHexColor(value: string): value is HexColor {
  return /^#[0-9a-f]{6}$/i.test(value);
}

export function normalizeHex(value: string, fallback = '#FFFFFF'): string {
  return isHexColor(value) ? value.toUpperCase() : fallback.toUpperCase();
}

export function contrastRatio(foreground: string, background: string): number | null {
  if (!isHexColor(foreground) || !isHexColor(background)) return null;
  const luminance = (hex: string) => 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Mix opaque foreground into opaque background in sRGB. Useful for deriving
 * accessible muted text and borders without relying on element opacity. */
export function mixHex(foreground: string, background: string, amount: number): string {
  const fg = normalizeHex(foreground).slice(1);
  const bg = normalizeHex(background).slice(1);
  const alpha = Math.max(0, Math.min(1, amount));
  const channels = [0, 2, 4].map((offset) => {
    const from = Number.parseInt(fg.slice(offset, offset + 2), 16);
    const to = Number.parseInt(bg.slice(offset, offset + 2), 16);
    return Math.round(from * alpha + to * (1 - alpha)).toString(16).padStart(2, '0');
  });
  return `#${channels.join('')}`.toUpperCase();
}

export function bestContrastingColor(background: string, candidates = ['#0A0A0A', '#FFFFFF']): string {
  const normalizedBackground = normalizeHex(background);
  return candidates
    .map((candidate) => ({
      color: normalizeHex(candidate),
      ratio: contrastRatio(candidate, normalizedBackground) ?? 0,
    }))
    .sort((a, b) => b.ratio - a.ratio)[0]?.color ?? '#0A0A0A';
}

/** Return the softest tint of foreground that still reaches `minimum` on bg. */
export function minimumContrastTint(foreground: string, background: string, minimum: number): string {
  const fg = normalizeHex(foreground);
  const bg = normalizeHex(background);
  if ((contrastRatio(fg, bg) ?? 0) < minimum) return fg;

  let low = 0;
  let high = 1;
  for (let index = 0; index < 16; index += 1) {
    const mid = (low + high) / 2;
    if ((contrastRatio(mixHex(fg, bg, mid), bg) ?? 0) >= minimum) high = mid;
    else low = mid;
  }
  return mixHex(fg, bg, high);
}
