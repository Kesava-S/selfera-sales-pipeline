import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatDate,
  formatDateTime,
  todayLondon,
  dueLabel,
  stepLabel,
  nextStepLabel,
  formatWaiting,
} from '@/lib/format';

describe('format utilities (src/lib/format.ts)', () => {
  describe('formatDate', () => {
    it('formats YYYY-MM-DD date strings in London time', () => {
      expect(formatDate('2026-11-05')).toBe('5 Nov 2026');
      expect(formatDate('2026-01-01')).toBe('1 Jan 2026');
    });

    it('formats ISO datetime strings and Date instances', () => {
      const d = new Date('2026-06-15T10:00:00Z');
      expect(formatDate(d)).toBe('15 Jun 2026');
      expect(formatDate('2026-12-25T18:00:00Z')).toBe('25 Dec 2026');
    });

    it('returns empty string for null, undefined, or empty values', () => {
      expect(formatDate(null)).toBe('');
      expect(formatDate(undefined)).toBe('');
      expect(formatDate('')).toBe('');
    });

    it('returns empty string for invalid date strings', () => {
      expect(formatDate('not-a-date')).toBe('');
      expect(formatDate('2026-99-99')).toBe('');
    });
  });

  describe('formatDateTime', () => {
    it('formats datetime with 24-hour time in Europe/London', () => {
      expect(formatDateTime('2026-11-05T14:30:00Z')).toBe('5 Nov 2026, 14:30');
    });

    it('returns empty string for missing or invalid dates', () => {
      expect(formatDateTime(null)).toBe('');
      expect(formatDateTime(undefined)).toBe('');
      expect(formatDateTime('invalid')).toBe('');
    });
  });

  describe('todayLondon', () => {
    it('returns a valid YYYY-MM-DD date string', () => {
      const today = todayLondon();
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('dueLabel', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns "none" tone when date is missing', () => {
      expect(dueLabel(null)).toEqual({ text: 'Nothing due', tone: 'none' });
      expect(dueLabel(undefined)).toEqual({ text: 'Nothing due', tone: 'none' });
    });

    it('returns "overdue" tone for past dates', () => {
      const res = dueLabel('2026-05-10');
      expect(res.tone).toBe('overdue');
      expect(res.text).toContain('Overdue');
      expect(res.text).toContain('10 May 2026');
    });

    it('returns "today" tone when due on system date', () => {
      const res = dueLabel('2026-05-15');
      expect(res).toEqual({ text: 'Due today', tone: 'today' });
    });

    it('returns "later" tone for future dates', () => {
      const res = dueLabel('2026-05-20');
      expect(res.tone).toBe('later');
      expect(res.text).toBe('20 May 2026');
    });
  });

  describe('stepLabel', () => {
    it('returns "First contact" when step is 0 or status is Not contacted', () => {
      expect(stepLabel(0)).toBe('First contact');
      expect(stepLabel(2, 'Not contacted')).toBe('First contact');
    });

    it('returns expected label for standard outreach steps', () => {
      expect(stepLabel(1)).toBe('Follow-up 1');
      expect(stepLabel(2)).toBe('Follow-up 2');
      expect(stepLabel(3)).toBe('Final check');
    });

    it('returns "Final check sent" for step >= 4', () => {
      expect(stepLabel(4)).toBe('Final check sent');
      expect(stepLabel(5)).toBe('Final check sent');
    });
  });

  describe('nextStepLabel', () => {
    it('returns proper next step up to Final check', () => {
      expect(nextStepLabel(0)).toBe('First contact');
      expect(nextStepLabel(1)).toBe('Follow-up 1');
      expect(nextStepLabel(2)).toBe('Follow-up 2');
      expect(nextStepLabel(3)).toBe('Final check');
      expect(nextStepLabel(10)).toBe('Final check');
    });
  });

  describe('formatWaiting', () => {
    it('returns empty string if iso is missing', () => {
      expect(formatWaiting(null)).toBe('');
      expect(formatWaiting(undefined)).toBe('');
    });

    it('returns "Just now" if timestamp is in future', () => {
      const future = new Date(Date.now() + 60000).toISOString();
      expect(formatWaiting(future)).toBe('Just now');
    });

    it('formats minutes, hours, and days correctly', () => {
      const now = Date.now();
      const tenMinsAgo = new Date(now - 10 * 60000).toISOString();
      expect(formatWaiting(tenMinsAgo)).toBe('10m waiting');

      const fiveHoursAgo = new Date(now - 5 * 3600000).toISOString();
      expect(formatWaiting(fiveHoursAgo)).toBe('5h waiting');

      const twoDaysAgo = new Date(now - 2 * 86400000).toISOString();
      expect(formatWaiting(twoDaysAgo)).toBe('2d waiting');
    });
  });
});

