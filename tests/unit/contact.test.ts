import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseAndValidatePhone,
  internationalDigits,
  checkNumber,
  setPhoneDefaults,
  countryName,
  getPhoneType,
  isWhatsAppCapable,
  whatsappLink,
  instagramLink,
  facebookLink,
  mailtoLink,
  telLink,
  websiteLink,
} from '@/lib/contact';

describe('contact & phone utilities (src/lib/contact.ts)', () => {
  // Default country comes from Settings; tests set it like the app does
  beforeEach(() => setPhoneDefaults('GB'));

  describe('checkNumber (any country)', () => {
    it('reads international numbers from any country', () => {
      expect(checkNumber('+44 7123 456789')).toMatchObject({ valid: true, e164: '+447123456789', country: 'GB', kind: 'mobile' });
      expect(checkNumber('+91 98765 43210')).toMatchObject({ valid: true, e164: '+919876543210', country: 'IN', kind: 'mobile' });
      expect(checkNumber('+1 202 555 0123')).toMatchObject({ valid: true, e164: '+12025550123' });
      expect(checkNumber('+49 151 12345678')).toMatchObject({ valid: true, country: 'DE', kind: 'mobile' });
      expect(checkNumber('0044 7123 456789')).toMatchObject({ valid: true, e164: '+447123456789' });
    });

    it('reads numbers without a country code as the default country', () => {
      expect(checkNumber('07123 456789')).toMatchObject({ valid: true, e164: '+447123456789', country: 'GB' });
      setPhoneDefaults('IN');
      expect(checkNumber('98765 43210')).toMatchObject({ valid: true, e164: '+919876543210', country: 'IN' });
    });

    it('accepts digits that already include a country code', () => {
      expect(checkNumber('917305395094')).toMatchObject({ valid: true, e164: '+917305395094', country: 'IN' });
      expect(checkNumber('447928750453')).toMatchObject({ valid: true, e164: '+447928750453' });
    });

    it('tells landlines from mobiles', () => {
      expect(checkNumber('+44 20 7946 0958').kind).toBe('landline');
    });

    it('rejects numbers that are not real', () => {
      expect(checkNumber('+44 12').valid).toBe(false);
      expect(checkNumber('hello').valid).toBe(false);
      expect(checkNumber('').kind).toBe('empty');
    });

    it('asks for a country code when there is no default country', () => {
      setPhoneDefaults(null);
      const c = checkNumber('07123 456789');
      expect(c.valid).toBe(false);
      expect(c.error).toMatch(/country code/i);
    });
  });

  describe('parseAndValidatePhone', () => {
    it('allows empty and returns valid numbers in international form', () => {
      expect(parseAndValidatePhone('')).toEqual({ valid: true, normalized: null });
      expect(parseAndValidatePhone('07123 456789')).toEqual({ valid: true, normalized: '+447123456789' });
      expect(parseAndValidatePhone('+91 98765 43210')).toEqual({ valid: true, normalized: '+919876543210' });
    });

    it('returns an error for invalid numbers', () => {
      const r = parseAndValidatePhone('+44 12');
      expect(r.valid).toBe(false);
    });
  });

  describe('internationalDigits', () => {
    it('gives digits with the country code', () => {
      expect(internationalDigits('07123 456789')).toBe('447123456789');
      expect(internationalDigits('+91 98765 43210')).toBe('919876543210');
      expect(internationalDigits(null)).toBeNull();
      expect(internationalDigits('nonsense')).toBeNull();
    });
  });

  describe('getPhoneType & isWhatsAppCapable', () => {
    it('marks mobiles as WhatsApp-ready, without naming a country', () => {
      const t = getPhoneType('+44 7123 456789');
      expect(t).toMatchObject({ type: 'whatsapp_mobile', isWhatsApp: true, normalized: '+447123456789' });
      expect(t.label).toBe('Mobile');
      expect(isWhatsAppCapable('+91 98765 43210')).toBe(true);
    });

    it('marks landlines, empty and invalid numbers', () => {
      expect(getPhoneType('+44 20 7946 0958')).toMatchObject({ type: 'landline', isWhatsApp: false });
      expect(getPhoneType('')).toMatchObject({ type: 'empty', isWhatsApp: false });
      expect(getPhoneType('+44 12')).toMatchObject({ type: 'invalid', isWhatsApp: false });
    });
  });

  describe('countryName', () => {
    it('names a country from its code', () => {
      expect(countryName('GB')).toBe('United Kingdom');
      expect(countryName('IN')).toBe('India');
      expect(countryName(null)).toBe('');
    });
  });

  describe('link generators', () => {
    it('generates whatsapp links with optional message encoding', () => {
      expect(whatsappLink('+44 7123 456789')).toBe('https://wa.me/447123456789');
      expect(whatsappLink('+44 7123 456789', 'Hello Selfera')).toBe(
        'https://wa.me/447123456789?text=Hello%20Selfera'
      );
      expect(whatsappLink('917305395094')).toBe('https://wa.me/917305395094');
      expect(whatsappLink(null)).toBeNull();
    });

    it('generates instagram links stripping @ symbol', () => {
      expect(instagramLink('@selfera_sales')).toBe('https://www.instagram.com/selfera_sales/');
      expect(instagramLink('selfera_sales')).toBe('https://www.instagram.com/selfera_sales/');
      expect(instagramLink(null)).toBeNull();
    });

    it('generates facebook links', () => {
      expect(facebookLink('selferapage')).toBe('https://www.facebook.com/selferapage');
      expect(facebookLink('https://www.facebook.com/selferapage')).toBe(
        'https://www.facebook.com/selferapage'
      );
      expect(facebookLink(null)).toBeNull();
    });

    it('generates mailto links with query parameters', () => {
      expect(mailtoLink('lead@example.com', 'Quick Question', 'Hi there')).toBe(
        'mailto:lead@example.com?subject=Quick%20Question&body=Hi%20there'
      );
      expect(mailtoLink(null)).toBeNull();
    });

    it('generates tel links', () => {
      expect(telLink('+44 7123 456789')).toBe('tel:+447123456789');
      expect(telLink(null)).toBeNull();
    });

    it('generates website links with https prefixing', () => {
      expect(websiteLink('example.com')).toBe('https://example.com');
      expect(websiteLink('http://example.com')).toBe('http://example.com');
      expect(websiteLink('https://example.com/demo')).toBe('https://example.com/demo');
      expect(websiteLink('invalid website')).toBeNull();
      expect(websiteLink('nodots')).toBeNull();
      expect(websiteLink(null)).toBeNull();
    });
  });
});

