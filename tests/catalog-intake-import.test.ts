import { describe, expect, test } from 'bun:test';
import { convertCatalogIntake } from '../src/lib/catalog-intake-import';

const fixture = {
  title: 'Catalog Website Intake Form',
  description: 'Tell us about your business.',
  welcomeScreen: { title: 'Let’s build', description: 'Take your time.', buttonText: 'Start' },
  endingScreen: { title: 'Thanks', description: 'We will be in touch.', buttonText: 'Done' },
  questions: [
    { id: 'category', section: 'Business Basics', type: 'multiple_choice', title: 'Category', required: true, options: ['Fashion', 'Other'], allowOther: true },
    { id: 'buy_or_browse', section: 'Store Functionality', type: 'multiple_choice', title: 'Buying', options: ['Direct buying', 'Browse'] },
    { id: 'payment_methods', section: 'Store Functionality', type: 'checkboxes', title: 'Payments', options: ['Card', 'Cash'], conditional: { showIf: 'buy_or_browse', equals: 'Direct buying' } },
    { id: 'logo_upload', section: 'Branding Assets', type: 'file_upload', title: 'Upload your logo' },
  ],
};

describe('Catalog Intake Import V2', () => {
  test('converts sections, multi-select, visibility, Other detail, and asset uploads safely', () => {
    const result = convertCatalogIntake(fixture);
    expect(result).not.toBeNull();
    expect(result?.form.welcomeTitle).toBe('Let’s build');
    expect(result?.form.endingTitle).toBe('Thanks');
    expect(result?.questions.find((question) => question.id === 'catalog_category')?.description).toContain('Select Other');

    const section = result?.questions.find((question) => question.type === 'statement');
    expect(section?.title).toBe('Business Basics');

    const category = result?.questions.find((question) => question.id === 'catalog_category');
    const otherDetail = result?.questions.find((question) => question.id === 'catalog_category_other_detail');
    expect(otherDetail?.required).toBe(true);
    expect(otherDetail?.settings.visibility?.questionId).toBe(category?.id);
    expect(otherDetail?.settings.visibility?.equals).toBe(category?.options.find((option) => option.label === 'Other')?.id);

    const payments = result?.questions.find((question) => question.id === 'catalog_payment_methods');
    expect(payments?.type).toBe('multiple_choice');
    expect(payments?.settings.allowMultiple).toBe(true);
    expect(payments?.settings.visibility?.questionId).toBe('catalog_buy_or_browse');

    const logo = result?.questions.find((question) => question.id === 'catalog_logo_upload');
    expect(logo?.type).toBe('website');
    expect(logo?.settings.requiresAssetContactSetup).toBe(true);
    expect(logo?.description).toContain('[your WhatsApp link]');
    expect(result?.warnings).toHaveLength(1);
  });

  test('returns null for a normal Forms JSON import', () => {
    expect(convertCatalogIntake({ title: 'Normal', questions: [] })).toBeNull();
  });
});
