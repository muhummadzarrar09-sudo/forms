import { describe, expect, test } from 'bun:test';
import { contrastRatio } from '../src/lib/color-contrast';
import { deriveFormTheme, ensureAccessibleFormTheme } from '../src/lib/form-theme';
import { THEME_PRESETS } from '../src/lib/form-helpers';

describe('form theme accessibility', () => {
  test('every shipped preset has readable body and CTA pairs', () => {
    for (const preset of THEME_PRESETS) {
      expect(contrastRatio(preset.textColor, preset.backgroundColor)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(preset.buttonTextColor, preset.buttonColor)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(preset.buttonColor, preset.backgroundColor)).toBeGreaterThanOrEqual(3);
    }
  });

  test('repairs inaccessible user-selected foregrounds without changing their backgrounds', () => {
    const repaired = ensureAccessibleFormTheme({
      backgroundColor: '#FFFFFF',
      textColor: '#CCCCCC',
      buttonColor: '#FE9A00',
      buttonTextColor: '#FFFFFF',
      fontFamily: 'sans',
    });
    expect(repaired.backgroundColor).toBe('#FFFFFF');
    expect(contrastRatio(repaired.buttonColor, repaired.backgroundColor)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(repaired.textColor, repaired.backgroundColor)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(repaired.buttonTextColor, repaired.buttonColor)).toBeGreaterThanOrEqual(4.5);
  });

  test('derives readable secondary text and fields without element opacity', () => {
    const theme = deriveFormTheme({
      backgroundColor: '#FFFFFF',
      textColor: '#333333',
      buttonColor: '#1A1A1A',
      buttonTextColor: '#FFFFFF',
      fontFamily: 'sans',
    });
    expect(contrastRatio(theme.textSecondaryColor, theme.backgroundColor)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(theme.textTertiaryColor, theme.backgroundColor)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(theme.placeholderColor, theme.backgroundColor)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(theme.fieldBorderColor, theme.backgroundColor)).toBeGreaterThanOrEqual(3);
  });
});
