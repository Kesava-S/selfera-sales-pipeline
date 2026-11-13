import { setPhoneDefaults } from '@/lib/contact'
import { beforeAll, describe, it, expect } from 'vitest';
import {
  ALL_FIELDS,
  MATCH_FIELDS,
  TEMPLATE_HEADERS,
  autoMap,
  buildRow,
  clean,
  guessTier,
  isValidUkPostcode,
  parseBranches,
  parseRating,
  parseServices,
} from '@/lib/importFields';
import { DEFAULT_LISTS } from '@/lib/lists';

// The app reads numbers without a country code as the default country from Settings
beforeAll(() => setPhoneDefaults('GB'))

describe('CSV lead import field parsers and validators (src/lib/importFields.ts)', () => {
  describe('TEMPLATE_HEADERS & MATCH_FIELDS', () => {
    it('contains exactly the 5 target match columns with required flags', () => {
      expect(TEMPLATE_HEADERS).toEqual([
        'business_name',
        'business_email',
        'business_whatsapp',
        'postcode',
        'owner_name',
      ]);
      expect(MATCH_FIELDS.map(f => f.key)).toEqual([
        'business_name',
        'business_email',
        'business_whatsapp',
        'postcode',
        'owner_name',
      ]);
      expect(MATCH_FIELDS.filter(f => f.required).map(f => f.key)).toEqual([
        'business_name',
        'business_email',
        'business_whatsapp',
      ]);
      expect(MATCH_FIELDS.find(f => f.key === 'postcode')?.required).toBeFalsy();
      expect(MATCH_FIELDS.find(f => f.key === 'owner_name')?.required).toBeFalsy();
    });
  });

  describe('autoMap', () => {
    it('maps diverse CSV header synonyms to normalized internal field keys', () => {
      const headers = ['Company Name', 'Business Email', 'WhatsApp', 'Post code', 'Owner Name'];
      const mapped = autoMap(headers);

      expect(mapped.business_name).toBe('Company Name');
      expect(mapped.business_email).toBe('Business Email');
      expect(mapped.business_whatsapp).toBe('WhatsApp');
      expect(mapped.postcode).toBe('Post code');
      expect(mapped.owner_name).toBe('Owner Name');
    });

    it('maps extended fields when ALL_FIELDS is provided', () => {
      const headers = ['Company Name', 'Web', 'Category', 'Pitch'];
      const mapped = autoMap(headers, ALL_FIELDS);

      expect(mapped.business_name).toBe('Company Name');
      expect(mapped.website).toBe('Web');
      expect(mapped.business_type).toBe('Category');
      expect(mapped.services).toBe('Pitch');
    });

    it('ensures each header is only used once', () => {
      const headers = ['business', 'owner_name'];
      const mapped = autoMap(headers);
      expect(mapped.business_name).toBe('business');
      expect(mapped.owner_name).toBe('owner_name');
    });
  });

  describe('clean', () => {
    it('normalizes internal spaces and trims string', () => {
      expect(clean('  Acme    Enterprises   Ltd  ')).toBe('Acme Enterprises Ltd');
    });

    it('cleans out placeholder dummy values to empty strings', () => {
      expect(clean('n/a')).toBe('');
      expect(clean('N/A')).toBe('');
      expect(clean('none')).toBe('');
      expect(clean('none found')).toBe('');
      expect(clean('not searched')).toBe('');
      expect(clean('unknown')).toBe('');
      expect(clean('tbc')).toBe('');
      expect(clean('-')).toBe('');
      expect(clean('\u2014')).toBe('');
      expect(clean('?')).toBe('');
    });
  });

  describe('guessTier', () => {
    it('detects hotel / venue star tier categories', () => {
      expect(guessTier('1 star luxury')).toBe('1-2 star');
      expect(guessTier('2 stars hotel')).toBe('1-2 star');
      expect(guessTier('3 star boutique')).toBe('3 star');
      expect(guessTier('4 star premium')).toBe('4-5 star');
      expect(guessTier('5 stars resort')).toBe('4-5 star');
      expect(guessTier('Unrated')).toBeNull();
    });
  });

  describe('postcode validation', () => {
    it('accepts valid UK postcodes with and without spaces', () => {
      expect(isValidUkPostcode('SW1A 1AA')).toBe(true);
      expect(isValidUkPostcode('ec1a1bb')).toBe(true);
      expect(isValidUkPostcode('M1 1AA')).toBe(true);
      expect(isValidUkPostcode('B33 8TH')).toBe(true);
      expect(isValidUkPostcode('W1A 0AX')).toBe(true);
    });

    it('accepts valid 6-digit Indian PIN codes', () => {
      expect(isValidUkPostcode('600001')).toBe(true);
      expect(isValidUkPostcode('560 001')).toBe(true);
    });

    it('rejects invalid postcode formats', () => {
      expect(isValidUkPostcode('12345')).toBe(false);
      expect(isValidUkPostcode('ABCDEFG')).toBe(false);
      expect(isValidUkPostcode('')).toBe(false);
      expect(isValidUkPostcode(null)).toBe(false);
    });
  });


  describe('parseBranches', () => {
    it('parses semicolon and pipe-separated branch definitions', () => {
      const raw =
        'Camden Branch | 10 High St | NW1 0AB; Soho Store | 25 Oxford St | W1D 2DL';
      const branches = parseBranches(raw);

      expect(branches).toHaveLength(2);
      expect(branches[0]).toEqual({
        name: 'Camden Branch',
        address: '10 High St',
        postcode: 'NW1 0AB',
      });
      expect(branches[1]).toEqual({
        name: 'Soho Store',
        address: '25 Oxford St',
        postcode: 'W1D 2DL',
      });
    });

    it('returns empty array for empty inputs', () => {
      expect(parseBranches('')).toEqual([]);
      expect(parseBranches(null)).toEqual([]);
    });
  });

  describe('parseRating', () => {
    it('extracts rating float and review count from compound string', () => {
      expect(parseRating('4.8 (1,230)')).toEqual({ rating: '4.8', reviews: '1230' });
      expect(parseRating('5.0')).toEqual({ rating: '5.0', reviews: '' });
      expect(parseRating('3 (45)')).toEqual({ rating: '3', reviews: '45' });
    });

    it('returns empty strings for unparseable input', () => {
      expect(parseRating('No reviews yet')).toEqual({ rating: '', reviews: '' });
      expect(parseRating('')).toEqual({ rating: '', reviews: '' });
    });
  });

  describe('parseServices', () => {
    it('identifies known pitched services and separates unknown entries', () => {
      const known = ['Web Design', 'SEO', 'Social Media Ads'];
      const raw = 'Web design; Branding / Logo; SEO';

      const result = parseServices(raw, ['Web Design'], known);
      expect(result.services).toEqual(['Web Design', 'SEO']);
      expect(result.unknown).toEqual(['Branding', 'Logo']);
    });

    it('falls back to default services when input is empty', () => {
      const fallback = ['Web Design'];
      const result = parseServices('', fallback, ['Web Design']);
      expect(result.services).toEqual(fallback);
      expect(result.unknown).toEqual([]);
    });
  });

  describe('buildRow Contact & Clean Data detection', () => {
    const baseMap = {
      business_name: 'Name',
      business_type: 'Category',
      services: 'Services',
    };

    it('detects valid business email and flags as clean data', () => {
      const raw = {
        Name: 'The Ivy Cafe',
        Category: 'Restaurants & Cafes',
        Services: 'SEO',
        Email: 'info@theivycafe.com',
      };
      const map = { ...baseMap, business_email: 'Email' };
      const row = buildRow(raw, map, {}, ['SEO'], 0, DEFAULT_LISTS);

      expect(row.emailInfo.hasEmail).toBe(true);
      expect(row.emailInfo.isValid).toBe(true);
      expect(row.emailInfo.email).toBe('info@theivycafe.com');
      expect(row.isCleanData).toBe(true);
    });

    it('detects valid WhatsApp mobile and flags as clean data', () => {
      const raw = {
        Name: 'Mayfair Boutique',
        Category: 'Retail',
        Services: 'Web Design',
        Phone: '07123456789',
      };
      const map = { ...baseMap, business_whatsapp: 'Phone' };
      const row = buildRow(raw, map, {}, ['Web Design'], 0, DEFAULT_LISTS);

      expect(row.phoneInfo.isWhatsApp).toBe(true);
      expect(row.emailInfo.hasEmail).toBe(false);
      expect(row.isCleanData).toBe(true);
    });

    it('flags lead as clean data when both WhatsApp and email are valid', () => {
      const raw = {
        Name: 'Grand Hotel',
        Category: 'Hotels',
        Services: 'Web Design',
        Phone: '+44 7987 654321',
        Email: 'reservations@grandhotel.co.uk',
      };
      const map = { ...baseMap, business_whatsapp: 'Phone', business_email: 'Email' };
      const row = buildRow(raw, map, {}, ['Web Design'], 0, DEFAULT_LISTS);

      expect(row.phoneInfo.isWhatsApp).toBe(true);
      expect(row.emailInfo.isValid).toBe(true);
      expect(row.isCleanData).toBe(true);
    });

    it('rejects invalid email format and does not count as clean data if no WhatsApp', () => {
      const raw = {
        Name: 'Corner Shop',
        Category: 'Retail',
        Services: 'Web Design',
        Email: 'not-an-email',
        Instagram: '@cornershop',
      };
      const map = { ...baseMap, business_email: 'Email', instagram: 'Instagram' };
      const row = buildRow(raw, map, {}, ['Web Design'], 0, DEFAULT_LISTS);

      expect(row.emailInfo.hasEmail).toBe(true);
      expect(row.emailInfo.isValid).toBe(false);
      expect(row.phoneInfo.isWhatsApp).toBe(false);
      expect(row.isCleanData).toBe(false);
    });

    it('marks lead as not clean data when only landline phone or social media exists', () => {
      const raw = {
        Name: 'City Accountants',
        Category: 'Services',
        Services: 'SEO',
        Phone: '020 7946 0991', // UK landline
        Facebook: 'facebook.com/cityaccountants',
      };
      const map = { ...baseMap, business_whatsapp: 'Phone', facebook: 'Facebook' };
      const row = buildRow(raw, map, {}, ['SEO'], 0, DEFAULT_LISTS);

      expect(row.phoneInfo.isWhatsApp).toBe(false);
      expect(row.phoneInfo.type).toBe('landline');
      expect(row.emailInfo.hasEmail).toBe(false);
      expect(row.isCleanData).toBe(false);
    });
  });

  describe('buildRow with 5 limited match columns', () => {
    it('properly extracts the 5 fields and marks lead for background completion', () => {
      const raw = {
        'Business Name': 'The Grand Hotel',
        'Business Email': 'reservations@thegrandhotel.co.uk',
        'Business WhatsApp': '+44 7123 456781',
        'Postcode': 'SW1A 1AA',
        'Owner Name': 'Sarah Jenkins',
      };
      const map = autoMap(Object.keys(raw));
      const row = buildRow(raw, map, {}, [], 0, DEFAULT_LISTS);

      expect(row.isCannotImport).toBe(false);
      expect(row.data.business_name).toBe('The Grand Hotel');
      expect(row.data.email).toBe('reservations@thegrandhotel.co.uk');
      expect(row.data.whatsapp_number).toBe('+447123456781');
      expect(row.data.postcode).toBe('SW1A 1AA');
      expect(row.data.contact_name).toBe('Sarah Jenkins');
      expect(row.isCleanData).toBe(true);
      expect(row.isMissingData).toBe(true);
      expect(row.data.business_type).toBe('Hotel');
      expect(row.problems).toContain('service');
    });
  });
});
