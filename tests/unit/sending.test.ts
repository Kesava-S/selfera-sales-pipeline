import { describe, it, expect } from 'vitest';
import {
  hoursSince,
  getSendRule,
  needsPecrConfirm,
  parseApiPlatforms,
  REPLY_WINDOW_HOURS,
  HUMAN_AGENT_WINDOW_HOURS,
} from '@/lib/sending';

describe('sending rules & compliance logic (src/lib/sending.ts)', () => {
  describe('hoursSince', () => {
    it('returns Infinity for missing or null timestamp', () => {
      expect(hoursSince(null)).toBe(Infinity);
      expect(hoursSince(undefined)).toBe(Infinity);
    });

    it('calculates hours elapsed since given date', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString();
      const diff = hoursSince(twoHoursAgo);
      expect(diff).toBeGreaterThanOrEqual(1.99);
      expect(diff).toBeLessThanOrEqual(2.05);
    });
  });

  describe('getSendRule', () => {
    it('blocks outreach for opted out threads or "Do not contact" stage', () => {
      const rule1 = getSendRule({
        platform: 'Email',
        threadStatus: 'Opted out',
        stage: 'In outreach',
        apiPlatforms: ['Email'],
      });
      expect(rule1.mode).toBe('blocked');
      expect(rule1.windowOpen).toBe(false);

      const rule2 = getSendRule({
        platform: 'WhatsApp',
        threadStatus: 'New',
        stage: 'Do not contact',
        apiPlatforms: ['WhatsApp'],
      });
      expect(rule2.mode).toBe('blocked');
    });

    it('blocks closed leads (Went cold, No response, Declined)', () => {
      const cold = getSendRule({
        platform: 'Email',
        threadStatus: 'Follow-up',
        stage: 'Went cold',
        apiPlatforms: ['Email'],
      });
      expect(cold.mode).toBe('blocked');
      expect(cold.reason).toContain('closed');
    });

    it('always routes LinkedIn outreach to manual copy-paste mode', () => {
      const res = getSendRule({
        platform: 'LinkedIn',
        threadStatus: 'Open',
        stage: 'In outreach',
        apiPlatforms: ['LinkedIn'],
      });
      expect(res.mode).toBe('manual');
      expect(res.windowOpen).toBe(false);
      expect(res.reason).toContain('LinkedIn');
    });

    it('routes connected Email to api and disconnected to manual', () => {
      const connected = getSendRule({
        platform: 'Email',
        threadStatus: 'Open',
        stage: 'In outreach',
        apiPlatforms: ['Email'],
      });
      expect(connected.mode).toBe('api');
      expect(connected.windowOpen).toBe(true);

      const disconnected = getSendRule({
        platform: 'Email',
        threadStatus: 'Open',
        stage: 'In outreach',
        apiPlatforms: [],
      });
      expect(disconnected.mode).toBe('manual');
      expect(disconnected.windowOpen).toBe(true);
    });

    it('handles WhatsApp 24h reply window and fallback to template mode', () => {
      const recentInbound = new Date(Date.now() - 2 * 3600000).toISOString(); // 2 hours ago
      const insideWindow = getSendRule({
        platform: 'WhatsApp',
        threadStatus: 'Replied',
        stage: 'Engaged',
        lastInboundAt: recentInbound,
        apiPlatforms: ['WhatsApp'],
      });
      expect(insideWindow.mode).toBe('api');
      expect(insideWindow.windowOpen).toBe(true);

      const oldInbound = new Date(Date.now() - 30 * 3600000).toISOString(); // 30 hours ago
      const outsideWindow = getSendRule({
        platform: 'WhatsApp',
        threadStatus: 'Replied',
        stage: 'Engaged',
        lastInboundAt: oldInbound,
        apiPlatforms: ['WhatsApp'],
        whatsappTemplateName: 'selfera_custom_template',
      });
      expect(outsideWindow.mode).toBe('api-template');
      expect(outsideWindow.windowOpen).toBe(false);
      expect(outsideWindow.reason).toContain('selfera_custom_template');
    });

    it('supports 7-day extended window for Meta platforms when humanAgent is enabled', () => {
      const fourDaysAgo = new Date(Date.now() - 4 * 24 * 3600000).toISOString();

      const standardMeta = getSendRule({
        platform: 'Instagram',
        threadStatus: 'Replied',
        stage: 'Engaged',
        lastInboundAt: fourDaysAgo,
        apiPlatforms: ['Instagram'],
        humanAgent: false,
      });
      expect(standardMeta.mode).toBe('manual');
      expect(standardMeta.windowOpen).toBe(false);

      const extendedMeta = getSendRule({
        platform: 'Instagram',
        threadStatus: 'Replied',
        stage: 'Engaged',
        lastInboundAt: fourDaysAgo,
        apiPlatforms: ['Instagram'],
        humanAgent: true,
      });
      expect(extendedMeta.mode).toBe('api');
      expect(extendedMeta.windowOpen).toBe(true);
    });
  });

  describe('needsPecrConfirm', () => {
    it('returns true for Email to Sole traders and Partnerships (UK PECR)', () => {
      expect(needsPecrConfirm('Email', 'Sole trader')).toBe(true);
      expect(needsPecrConfirm('Email', 'Partnership')).toBe(true);
    });

    it('returns false for corporate entities or non-email platforms', () => {
      expect(needsPecrConfirm('Email', 'Limited company')).toBe(false);
      expect(needsPecrConfirm('WhatsApp', 'Sole trader')).toBe(false);
      expect(needsPecrConfirm('LinkedIn', 'Partnership')).toBe(false);
    });
  });

  describe('parseApiPlatforms', () => {
    it('splits comma-separated platform list and trims items', () => {
      expect(parseApiPlatforms('Email, WhatsApp, Instagram')).toEqual([
        'Email',
        'WhatsApp',
        'Instagram',
      ]);
    });

    it('handles empty or missing input gracefully', () => {
      expect(parseApiPlatforms('')).toEqual([]);
      expect(parseApiPlatforms(undefined)).toEqual([]);
    });
  });
});

