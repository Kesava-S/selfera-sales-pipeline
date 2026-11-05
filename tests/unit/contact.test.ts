import { describe, it, expect } from 'vitest';
import {
  parseAndValidatePhone,
  ukToInternational,
  isUkMobile,
  isIndianMobile,
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
  describe('parseAndValidatePhone', () => {
    it('returns valid: true with normalized: null for empty or whitespace inputs', () => {
      expect(parseAndValidatePhone(null)).toEqual({ valid: true, normalized: null });
      expect(parseAndValidatePhone(undefined)).toEqual({ valid: true, normalized: null });
      expect(parseAndValidatePhone('   ')).toEqual({ valid: true, normalized: null });
    });

    it('correctly normalizes UK phone numbers with +44 prefix', () => {
      const res = parseAndValidatePhone('+44 7123 456789');
      expect(res).toEqual({ valid: true, normalized: '+447123456789' });
    });

    it('strips domestic trunk zero from +44(0) format', () => {
      const res = parseAndValidatePhone('+44 (0) 7123 456789');
      expect(res).toEqual({ valid: true, normalized: '+447123456789' });
    });

    it('flags too short or too long UK numbers', () => {
      expect(parseAndValidatePhone('+44 7123')).toMatchObject({ valid: false });
      expect(parseAndValidatePhone('+44 7123 4567890123')).toMatchObject({ valid: false });
    });

    it('handles +0 prefix for national numbers', () => {
      const res = parseAndValidatePhone('+07123 456789');
      expect(res).toEqual({ valid: true, normalized: '+07123456789' });
    });

    it('validates international phone numbers with + or 00', () => {
      expect(parseAndValidatePhone('+91 98765 43210')).toEqual({
        valid: true,
        normalized: '+919876543210',
      });
      expect(parseAndValidatePhone('0091 98765 43210')).toEqual({
        valid: true,
        normalized: '+919876543210',
      });
    });

    it('normalizes UK domestic numbers starting with 0', () => {
      expect(parseAndValidatePhone('07123 456789')).toEqual({
        valid: true,
        normalized: '07123456789',
      });
    });

    it('rejects bare digits without country code', () => {
      const res = parseAndValidatePhone('7514 953005');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('must include country code');
    });
  });

  describe('ukToInternational', () => {
    it('converts UK phone formats to international digit string', () => {
      expect(ukToInternational('+44 7123 456789')).toBe('447123456789');
      expect(ukToInternational('07123 456789')).toBe('447123456789');
      expect(ukToInternational('+07123 456789')).toBe('447123456789');
      expect(ukToInternational('447123456789')).toBe('447123456789');
    });

    it('returns null for missing inputs', () => {
      expect(ukToInternational(null)).toBeNull();
      expect(ukToInternational('')).toBeNull();
    });
  });

  describe('isUkMobile', () => {
    it('returns true for UK mobile prefixes (+447, 07)', () => {
      expect(isUkMobile('+44 7123 456789')).toBe(true);
      expect(isUkMobile('07123 456789')).toBe(true);
      expect(isUkMobile('+07123 456789')).toBe(true);
    });

    it('returns false for UK landlines and invalid numbers', () => {
      expect(isUkMobile('020 7946 0991')).toBe(false);
      expect(isUkMobile('+44 161 496 0123')).toBe(false);
      expect(isUkMobile(null)).toBe(false);
    });
  });

  describe('isIndianMobile', () => {
    it('identifies valid Indian mobile numbers', () => {
      expect(isIndianMobile('+91 98765 43210')).toBe(true);
      expect(isIndianMobile('9876543210')).toBe(true);
      expect(isIndianMobile('7123456789')).toBe(true);
    });

    it('rejects numbers starting with digits < 6 or wrong length', () => {
      expect(isIndianMobile('5876543210')).toBe(false);
      expect(isIndianMobile('98765')).toBe(false);
      expect(isIndianMobile(null)).toBe(false);
    });
  });

  describe('getPhoneType & isWhatsAppCapable', () => {
    it('categorizes UK mobile numbers as whatsapp_mobile', () => {
      const type = getPhoneType('+44 7123 456789');
      expect(type.type).toBe('whatsapp_mobile');
      expect(type.isWhatsApp).toBe(true);
      expect(isWhatsAppCapable('+44 7123 456789')).toBe(true);
    });

    it('categorizes UK landlines as landline', () => {
      const type = getPhoneType('020 7946 0991');
      expect(type.type).toBe('landline');
      expect(type.isWhatsApp).toBe(false);
      expect(isWhatsAppCapable('020 7946 0991')).toBe(false);
    });

    it('categorizes empty numbers as empty', () => {
      const type = getPhoneType('');
      expect(type.type).toBe('empty');
      expect(type.isWhatsApp).toBe(false);
    });

    it('categorizes malformed numbers as invalid', () => {
      const type = getPhoneType('123');
      expect(type.type).toBe('invalid');
      expect(type.isWhatsApp).toBe(false);
    });
  });

  describe('link generators', () => {
    it('generates whatsapp links with optional message encoding', () => {
      expect(whatsappLink('+44 7123 456789')).toBe('https://wa.me/447123456789');
      expect(whatsappLink('+44 7123 456789', 'Hello Selfera')).toBe(
        'https://wa.me/447123456789?text=Hello%20Selfera'
      );
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

