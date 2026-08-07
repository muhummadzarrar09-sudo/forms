import type { Form, FormTheme } from '@/types/form';
import {
  bestContrastingColor,
  contrastRatio,
  isHexColor,
  minimumContrastTint,
  mixHex,
  normalizeHex,
} from '@/lib/color-contrast';

export const DEFAULT_FORM_THEME = {
  backgroundColor: '#FFFFFF',
  textColor: '#333333',
  buttonColor: '#1A1A1A',
  buttonTextColor: '#FFFFFF',
  fontFamily: 'sans',
} as const;

type FormThemeSource = Pick<
  Form,
  'backgroundColor' | 'textColor' | 'buttonColor' | 'buttonTextColor' | 'fontFamily'
> | Partial<FormTheme>;

export interface FormThemeValidation {
  textContrast: number;
  buttonContrast: number;
  accentContrast: number;
  isTextAccessible: boolean;
  isButtonAccessible: boolean;
  isAccentAccessible: boolean;
  isAccessible: boolean;
}

const ERROR_CANDIDATES = ['#7F1D1D', '#B91C1C', '#DC2626', '#FCA5A5', '#FEE2E2'];
const SUCCESS_CANDIDATES = ['#14532D', '#166534', '#15803D', '#86EFAC', '#DCFCE7'];

function formHex(value: string | undefined, fallback: string): string {
  return value && isHexColor(value) ? normalizeHex(value) : fallback;
}

/**
 * Produces every public-form visual role from the four persisted source colors.
 * It deliberately never uses opacity for readable text: a theme is responsible
 * for supplying complete opaque foreground colors that can be audited.
 */
export function deriveFormTheme(source: FormThemeSource | null | undefined): FormTheme {
  const backgroundColor = formHex(source?.backgroundColor, DEFAULT_FORM_THEME.backgroundColor);
  const requestedText = formHex(source?.textColor, DEFAULT_FORM_THEME.textColor);
  const requestedButton = formHex(source?.buttonColor, DEFAULT_FORM_THEME.buttonColor);
  const requestedButtonText = formHex(source?.buttonTextColor, DEFAULT_FORM_THEME.buttonTextColor);

  const textColor = (contrastRatio(requestedText, backgroundColor) ?? 0) >= 4.5
    ? requestedText
    : bestContrastingColor(backgroundColor);
  const buttonColor = (contrastRatio(requestedButton, backgroundColor) ?? 0) >= 3
    ? requestedButton
    : bestContrastingColor(backgroundColor);
  const buttonTextColor = (contrastRatio(requestedButtonText, buttonColor) ?? 0) >= 4.5
    ? requestedButtonText
    : bestContrastingColor(buttonColor);
  const accentTextColor = (contrastRatio(buttonColor, backgroundColor) ?? 0) >= 4.5
    ? buttonColor
    : textColor;

  return {
    backgroundColor,
    textColor,
    buttonColor,
    buttonTextColor,
    fontFamily: source?.fontFamily || DEFAULT_FORM_THEME.fontFamily,
    textSecondaryColor: minimumContrastTint(textColor, backgroundColor, 4.7),
    textTertiaryColor: minimumContrastTint(textColor, backgroundColor, 4.5),
    placeholderColor: minimumContrastTint(textColor, backgroundColor, 4.5),
    fieldBorderColor: minimumContrastTint(textColor, backgroundColor, 3),
    fieldHoverBorderColor: minimumContrastTint(textColor, backgroundColor, 4.5),
    controlSurfaceColor: mixHex(textColor, backgroundColor, 0.08),
    selectedSurfaceColor: mixHex(buttonColor, backgroundColor, 0.12),
    hoverSurfaceColor: mixHex(textColor, backgroundColor, 0.06),
    trackColor: minimumContrastTint(textColor, backgroundColor, 3),
    accentTextColor,
    errorColor: bestContrastingColor(backgroundColor, ERROR_CANDIDATES),
    successColor: bestContrastingColor(backgroundColor, SUCCESS_CANDIDATES),
  };
}

export function validateFormTheme(source: FormThemeSource | null | undefined): FormThemeValidation {
  const backgroundColor = formHex(source?.backgroundColor, DEFAULT_FORM_THEME.backgroundColor);
  const textColor = formHex(source?.textColor, DEFAULT_FORM_THEME.textColor);
  const buttonColor = formHex(source?.buttonColor, DEFAULT_FORM_THEME.buttonColor);
  const buttonTextColor = formHex(source?.buttonTextColor, DEFAULT_FORM_THEME.buttonTextColor);
  const textContrast = contrastRatio(textColor, backgroundColor) ?? 0;
  const buttonContrast = contrastRatio(buttonTextColor, buttonColor) ?? 0;
  const accentContrast = contrastRatio(buttonColor, backgroundColor) ?? 0;
  return {
    textContrast,
    buttonContrast,
    accentContrast,
    isTextAccessible: textContrast >= 4.5,
    isButtonAccessible: buttonContrast >= 4.5,
    isAccentAccessible: accentContrast >= 3,
    isAccessible: textContrast >= 4.5 && buttonContrast >= 4.5 && accentContrast >= 3,
  };
}

/**
 * Ensures persisted source colors cannot leave a form with an unreadable body
 * or CTA. It only adjusts a foreground when the proposed pair fails; the
 * selected background/button color is left intact.
 */
export function ensureAccessibleFormTheme(source: FormThemeSource): Pick<FormTheme, 'backgroundColor' | 'textColor' | 'buttonColor' | 'buttonTextColor'> {
  const backgroundColor = formHex(source.backgroundColor, DEFAULT_FORM_THEME.backgroundColor);
  const buttonColor = formHex(source.buttonColor, DEFAULT_FORM_THEME.buttonColor);
  const requestedText = formHex(source.textColor, DEFAULT_FORM_THEME.textColor);
  const requestedButtonText = formHex(source.buttonTextColor, DEFAULT_FORM_THEME.buttonTextColor);
  const accessibleButtonColor = (contrastRatio(buttonColor, backgroundColor) ?? 0) >= 3
    ? buttonColor
    : bestContrastingColor(backgroundColor);

  return {
    backgroundColor,
    buttonColor: accessibleButtonColor,
    textColor: (contrastRatio(requestedText, backgroundColor) ?? 0) >= 4.5
      ? requestedText
      : bestContrastingColor(backgroundColor),
    buttonTextColor: (contrastRatio(requestedButtonText, accessibleButtonColor) ?? 0) >= 4.5
      ? requestedButtonText
      : bestContrastingColor(accessibleButtonColor),
  };
}
