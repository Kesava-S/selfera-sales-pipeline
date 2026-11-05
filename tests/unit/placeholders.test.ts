import { describe, it, expect } from 'vitest';
import { fillPlaceholders, missingPlaceholders } from '@/lib/placeholders';

describe('template placeholder utilities (src/lib/placeholders.ts)', () => {
  describe('fillPlaceholders', () => {
    it('interpolates business_name, sender_name, area, and contact_name', () => {
      const template =
        'Hi {contact_name}, I saw {business_name} in {area}. Best, {sender_name}.';
      const result = fillPlaceholders(template, {
        contact_name: 'John',
        business_name: 'Acme Cafe',
        area: 'Camden',
        sender_name: 'Sarah Connor',
      });

      expect(result).toBe('Hi John, I saw Acme Cafe in Camden. Best, Sarah.');
    });

    it('uses first name only for {sender_name}', () => {
      const template = 'Best regards, {sender_name}';
      const result = fillPlaceholders(template, { sender_name: 'Michael Scott' });
      expect(result).toBe('Best regards, Michael');
    });

    it('supports {business} alias for {business_name}', () => {
      const template = 'Checking in on {business}';
      const result = fillPlaceholders(template, { business_name: 'Starlight Bistro' });
      expect(result).toBe('Checking in on Starlight Bistro');
    });

    it('preserves placeholder tags when values are falsy or omitted', () => {
      const template = 'Hi {contact_name}, welcome to {business_name} in {area}.';
      const result = fillPlaceholders(template, {
        business_name: null,
        contact_name: '',
      });
      expect(result).toBe('Hi {contact_name}, welcome to {business_name} in {area}.');
    });

    it('handles empty or null text input gracefully', () => {
      expect(fillPlaceholders('', { business_name: 'Test' })).toBe('');
      expect(fillPlaceholders(null as any, { business_name: 'Test' })).toBe('');
    });
  });

  describe('missingPlaceholders', () => {
    it('detects unreplaced placeholders as unique list', () => {
      const text = 'Hello {contact_name}, {business_name} in {area}. Contact {contact_name}.';
      const missing = missingPlaceholders(text);
      expect(missing).toEqual(['{contact_name}', '{business_name}', '{area}']);
    });

    it('returns empty array when all placeholders are filled', () => {
      const text = 'Hello John, welcome to Camden.';
      expect(missingPlaceholders(text)).toEqual([]);
    });

    it('handles empty or falsy inputs', () => {
      expect(missingPlaceholders('')).toEqual([]);
      expect(missingPlaceholders(null as any)).toEqual([]);
    });
  });
});

