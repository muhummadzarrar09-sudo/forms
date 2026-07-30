import type { QuestionOption, QuestionSettings, QuestionType } from '@/types/form';

export interface CatalogImportQuestion {
  id: string;
  section?: string;
  type: string;
  title: string;
  description?: string;
  required?: boolean;
  options?: string[];
  allowOther?: boolean;
  conditional?: { showIf: string; equals: string };
}

export interface CatalogImportDocument {
  title: string;
  description?: string;
  welcomeScreen?: { title?: string; description?: string; buttonText?: string };
  questions: CatalogImportQuestion[];
  endingScreen?: { title?: string; description?: string; buttonText?: string };
}

export interface ImportedQuestion {
  id: string;
  type: QuestionType;
  title: string;
  description: string;
  required: boolean;
  order: number;
  options: QuestionOption[];
  imageUrls: string[];
  settings: QuestionSettings;
  logic: [];
  placeholder: string;
}

export interface CatalogImportResult {
  form: {
    title: string;
    description: string;
    welcomeTitle: string;
    welcomeMessage: string;
    endingTitle: string;
    endingMessage: string;
  };
  questions: ImportedQuestion[];
  warnings: string[];
}

const SECTION_DESCRIPTIONS: Record<string, string> = {
  'Business Basics': 'Start with the essentials so we can understand what you sell.',
  'Audience & Positioning': 'Help us understand who you want to reach and how your brand should feel.',
  'Product Catalog Details': 'Tell us what the catalog needs to showcase.',
  'Store Functionality': 'Choose how customers should browse, buy, and contact you.',
  'Branding Assets': 'Share the visual references and assets that will shape the site.',
  'Contact & Extras': 'Finish with contact details and any final requirements.',
};

// Respondent-facing guidance for the catalog intake. The source JSON stays
// concise while the imported form provides useful context at every step.
const FIELD_GUIDANCE: Record<string, { description?: string; placeholder?: string }> = {
  biz_name: { description: 'Use the exact name customers should see on the website.', placeholder: 'e.g. Noor Studio' },
  tagline: { description: 'A short, clear line that explains what you sell or why customers choose you.', placeholder: 'e.g. Everyday essentials, thoughtfully made' },
  category: { description: 'Choose the closest match. Select Other if none of these fit.' },
  biz_age: { description: 'This helps us recommend the right level of trust-building content.' },
  sell_where: { description: 'Choose the option that best reflects how customers currently buy from you.' },
  target_audience: { description: 'Include age range, location, lifestyle, buying habits, and anything else that matters.', placeholder: 'e.g. Women aged 20–35 in Lahore who like minimal everyday fashion' },
  brand_vibe: { description: 'Pick the closest direction. Select Other if your brand has a different personality.' },
  differentiator: { description: 'Optional, but useful. Mention quality, price, sourcing, speed, service, or anything customers choose you for.', placeholder: 'e.g. Handmade pieces, delivered within 24 hours' },
  customer_location: { description: 'Tell us where most of your customers live today.', placeholder: 'e.g. Pakistan, mainly Lahore and Islamabad' },
  bestseller: { description: 'Name the product, collection, or category customers ask for most.', placeholder: 'e.g. Signature tote bags' },
  product_count: { description: 'A rough estimate is enough. This helps us plan catalog navigation.' },
  has_variants: { description: 'Variants include options such as size, color, material, weight, or pack size.' },
  variant_details: { description: 'List the choices customers need to select before buying.', placeholder: 'e.g. Size, color, fabric, 250g / 500g' },
  price_range: { description: 'A rough range is enough for now. Use the same currency you normally sell in.', placeholder: 'e.g. PKR 1,500 to PKR 12,000' },
  has_photos: { description: 'This helps us decide whether to design around your real assets or placeholders.' },
  buy_or_browse: { description: 'Choose direct checkout only if you want payments/orders handled on the website.' },
  payment_methods: { description: 'Select every payment method you want customers to be able to use.' },
  delivery: { description: 'Optional, but delivery details make the catalog much more useful to customers.', placeholder: 'e.g. Nationwide delivery in 2–4 working days; same-day in Lahore' },
  inventory_needed: { description: 'Choose Not sure if you need help deciding during planning.' },
  has_logo: { description: 'A logo is helpful, but not required. We can create a polished text-led identity if needed.' },
  brand_colors: { description: 'Optional. Share HEX codes, color names, or leave this blank and we will recommend a palette.', placeholder: 'e.g. #1F2937, #F59E0B, cream' },
  reference_sites: { description: 'Share links, screenshots, or store names. Tell us what you like about them if you can.', placeholder: 'e.g. https://example.com — I like the clean product grid' },
  contact_info: { description: 'Include only the details you want customers to see publicly.', placeholder: 'e.g. WhatsApp +92…, hello@brand.com, @brandhandle' },
  extra_pages: { description: 'Select every extra page that would help customers trust, understand, or buy from you.' },
  final_notes: { description: 'Use this for deadlines, special requests, competitors, must-have features, or anything we should avoid.', placeholder: 'Anything else that will help us build the right site?' },
};

const safeId = (value: string) => `catalog_${value.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

function isCatalogDocument(value: unknown): value is CatalogImportDocument {
  return Boolean(
    value &&
    typeof value === 'object' &&
    Array.isArray((value as CatalogImportDocument).questions) &&
    typeof (value as CatalogImportDocument).welcomeScreen === 'object'
  );
}

function decodeHtml(value = ''): string {
  return value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

/**
 * Converts the supplied Catalog Website Intake JSON to the app's native import
 * payload. It intentionally uses statement screens and link fields instead of
 * pretending that file storage exists.
 */
export function convertCatalogIntake(value: unknown): CatalogImportResult | null {
  if (!isCatalogDocument(value)) return null;

  const source = value;
  const questions: ImportedQuestion[] = [];
  const warnings: string[] = [];
  const optionIds = new Map<string, Map<string, string>>();
  let currentSection = '';

  for (const sourceQuestion of source.questions) {
    const questionId = safeId(sourceQuestion.id);
    const sourceOptions = sourceQuestion.options || [];
    const options = sourceOptions.map((label, index) => ({
      id: `${questionId}_option_${index}`,
      label: decodeHtml(label),
    }));
    optionIds.set(sourceQuestion.id, new Map<string, string>(sourceOptions.map((label, index) => [label, options[index].id])));
  }

  for (const sourceQuestion of source.questions) {
    if (sourceQuestion.section && sourceQuestion.section !== currentSection) {
      currentSection = sourceQuestion.section;
      questions.push({
        id: safeId(`section_${currentSection}`),
        type: 'statement',
        title: decodeHtml(currentSection),
        description: SECTION_DESCRIPTIONS[currentSection] || 'Let’s continue with the next part of your catalog website intake.',
        required: false,
        order: questions.length,
        options: [],
        imageUrls: [],
        settings: {},
        logic: [],
        placeholder: '',
      });
    }

    const id = safeId(sourceQuestion.id);
    const options = (sourceQuestion.options || []).map((label, index) => ({
      id: `${id}_option_${index}`,
      label: decodeHtml(label),
    }));
    const settings: QuestionSettings = {};
    const guidance = FIELD_GUIDANCE[sourceQuestion.id] || {};
    let type: QuestionType;
    let title = decodeHtml(sourceQuestion.title);
    const sourceDescription = decodeHtml(sourceQuestion.description || '');
    let description = [sourceDescription, guidance.description]
      .filter((value, index, values) => Boolean(value) && values.indexOf(value) === index)
      .join(' ');
    let placeholder = guidance.placeholder || '';

    if (sourceQuestion.type === 'checkboxes') {
      type = 'multiple_choice';
      settings.allowMultiple = true;
    } else if (sourceQuestion.type === 'file_upload') {
      type = 'website';
      title = title.replace(/^Upload your /i, 'Share a link to your ');
      description = [
        'Share a viewable Google Drive, Dropbox, OneDrive, or public image link.',
        'Can’t share a link? Replace these placeholders before publishing: WhatsApp [your WhatsApp link] · Instagram [your Instagram profile].',
      ].join(' ');
      placeholder = 'https://drive.google.com/...';
      settings.requiresAssetContactSetup = true;
      warnings.push(`“${sourceQuestion.title}” was converted to a link field. Add your WhatsApp/Instagram fallback details before publishing.`);
    } else if (['short_text', 'long_text', 'multiple_choice', 'yes_no', 'website'].includes(sourceQuestion.type)) {
      type = sourceQuestion.type as QuestionType;
    } else {
      type = 'short_text';
      warnings.push(`Unsupported type “${sourceQuestion.type}” on “${sourceQuestion.title}” was converted to Short Text.`);
    }

    if (sourceQuestion.conditional) {
      const visibilitySource = sourceQuestion.conditional.showIf;
      const rawEquals = sourceQuestion.conditional.equals;
      const sourceOptions = optionIds.get(visibilitySource);
      settings.visibility = {
        questionId: safeId(visibilitySource),
        equals: sourceOptions?.get(rawEquals) || rawEquals,
      };
    }

    questions.push({
      id,
      type,
      title,
      description,
      required: Boolean(sourceQuestion.required),
      order: questions.length,
      options,
      imageUrls: [],
      settings,
      logic: [],
      placeholder,
    });

    if (sourceQuestion.allowOther) {
      const otherOption = options.find((option) => option.label.toLowerCase() === 'other');
      if (otherOption) {
        questions.push({
          id: safeId(`${sourceQuestion.id}_other_detail`),
          type: 'short_text',
          title: 'Please tell us more',
          description: 'You selected Other. Add a short detail so we can understand your answer.',
          required: true,
          order: questions.length,
          options: [],
          imageUrls: [],
          settings: { visibility: { questionId: id, equals: otherOption.id } },
          logic: [],
          placeholder: 'Type your answer…',
        });
      }
    }
  }

  return {
    form: {
      title: decodeHtml(source.title),
      description: decodeHtml(source.description || ''),
      welcomeTitle: decodeHtml(source.welcomeScreen?.title || source.title),
      welcomeMessage: decodeHtml(source.welcomeScreen?.description || ''),
      endingTitle: decodeHtml(source.endingScreen?.title || 'Thanks — you’re all set!'),
      endingMessage: decodeHtml(source.endingScreen?.description || ''),
    },
    questions,
    warnings,
  };
}
