import { describe, it, expect } from 'vitest';
import {
  autoMap,
  clean,
  guessTier,
  isValidUkPostcode,
  isValidUkMobileDigits,
  parseBranches,
  parseRating,
  parseServices,
} from '@/lib/importFields';

describe('CSV lead import field parsers and validators (src/lib/importFields.ts)', () => {
  describe('autoMap', () => {
    it('maps diverse CSV header synonyms to normalized internal field keys', () => {
      const headers = ['Company Name', 'Web', 'Category', 'Post code', 'Pitch'];
      const mapped = autoMap(headers);

      expect(mapped.business_name).toBe('Company Name');
      expect(mapped.website).toBe('Web');
      expect(mapped.business_type).toBe('Category');
      expect(mapped.postcode).toBe('Post code');
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
      expect(clean('—')).toBe('');
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

  describe('isValidUkMobileDigits', () => {
    it('validates 11-digit UK mobile starting with 07 or 447', () => {
      expect(isValidUkMobileDigits('07123456789')).toBe(true);
      expect(isValidUkMobileDigits('447123456789')).toBe(true);
      expect(isValidUkMobileDigits('+44 7123-456-789')).toBe(true);
    });

    it('rejects non-mobile UK numbers', () => {
      expect(isValidUkMobileDigits('02079460991')).toBe(false);
      expect(isValidUkMobileDigits('442079460991')).toBe(false);
      expect(isValidUkMobileDigits(null)).toBe(false);
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
});
