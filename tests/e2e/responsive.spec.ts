import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

export const VIEWPORTS = [
  { id: 'small-mobile-360', label: 'Small mobile (360x640)', width: 360, height: 640, isMobile: true },
  { id: 'small-mobile-375', label: 'Small mobile (375x667)', width: 375, height: 667, isMobile: true },
  { id: 'large-mobile-390', label: 'Large mobile (390x844)', width: 390, height: 844, isMobile: true },
  { id: 'large-mobile-393', label: 'Large mobile (393x851)', width: 393, height: 851, isMobile: true },
  { id: 'tablet-portrait-768', label: 'Tablet portrait (768x1024)', width: 768, height: 1024, isMobile: true },
  { id: 'tablet-landscape-1024', label: 'Tablet landscape (1024x768)', width: 1024, height: 768, isMobile: false },
  { id: 'laptop-1366', label: 'Laptop (1366x768)', width: 1366, height: 768, isMobile: false },
  { id: 'desktop-1920', label: 'Desktop (1920x1080)', width: 1920, height: 1080, isMobile: false },
  { id: 'large-desktop-2560', label: 'Large desktop (2560x1440)', width: 2560, height: 1440, isMobile: false },
] as const;

export interface PageTarget {
  name: string;
  path: string;
  isPublic?: boolean;
}

export const PAGES: PageTarget[] = [
  // 1. Public & Auth
  { name: 'Login', path: '/login', isPublic: true },
  { name: 'Set Password', path: '/auth/set-password', isPublic: true },
  { name: 'Opt Out', path: '/opt-out', isPublic: true },
  { name: '403 Forbidden', path: '/403', isPublic: true },
  { name: '404 Not Found', path: '/404', isPublic: true },
  { name: '500 Server Error', path: '/500', isPublic: true },
  { name: 'Offline Fallback', path: '/offline', isPublic: true },

  // 2. Core Dashboard
  { name: 'Home Dashboard', path: '/dashboard' },
  { name: 'Lead Discovery', path: '/dashboard/discovery' },
  { name: 'Lead Discovery History', path: '/dashboard/discovery/history' },
  { name: 'Lead Management', path: '/dashboard/leads' },
  { name: 'Lead Lookup', path: '/dashboard/lookup' },

  // 3. Lead Detail & Thread
  { name: 'Lead Detail', path: '/dashboard/22eb84f5-34a2-4b7d-93c6-3f8579437629' },
  { name: 'Lead Thread', path: '/dashboard/22eb84f5-34a2-4b7d-93c6-3f8579437629/thread/e78e980a-06eb-411d-a4b0-8fdb982f0513' },

  // 4. Audience & Outreach
  { name: 'Client Audience', path: '/dashboard/audience' },
  { name: 'Client Audience Detail', path: '/dashboard/audience/b4eb7f92-715e-4a7b-bdb1-55ebf1b82c4a' },
  { name: 'Email Campaigns', path: '/dashboard/campaigns' },
  { name: 'Email Campaign Replies', path: '/dashboard/campaigns/replies' },
  { name: 'WhatsApp Campaigns', path: '/dashboard/whatsapp-campaigns' },
  { name: 'WhatsApp Campaign Replies', path: '/dashboard/whatsapp-campaigns/replies' },

  // 5. Administration & System
  { name: 'Insights', path: '/dashboard/insights' },
  { name: 'Templates', path: '/dashboard/templates' },
  { name: 'Template Slots', path: '/dashboard/templates/general/email' },
  { name: 'Settings', path: '/dashboard/settings' },
  { name: 'Notifications', path: '/dashboard/notifications' },
  { name: 'Integrations', path: '/dashboard/integrations' },
  { name: 'Status Needs Reply', path: '/dashboard/status/needs-reply' },
  { name: 'Status Interested', path: '/dashboard/status/interested' },
];

const baselineDir = path.resolve(process.cwd(), 'screenshots/desktop');
const resultsLogPath = path.resolve(process.cwd(), 'screenshots/responsive-results.json');

test.beforeAll(() => {
  if (!fs.existsSync(baselineDir)) {
    fs.mkdirSync(baselineDir, { recursive: true });
  }
});

test.describe('Responsive Design Suite across 9 Viewports', () => {
  test.setTimeout(60000);

  for (const pageTarget of PAGES) {
    test(`Page: ${pageTarget.name} (${pageTarget.path})`, async ({ page }) => {
      // Start with standard desktop
      await page.setViewportSize({ width: 1920, height: 1080 });

      // Navigate to target page
      await page.goto(pageTarget.path, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});

      // Verify viewport meta tag exists
      const viewportMeta = await page.$('meta[name="viewport"]');
      expect(viewportMeta, `Missing viewport meta tag on ${pageTarget.path}`).not.toBeNull();

      const viewportFailures: { viewport: string; reason: string; overflowing: string[] }[] = [];

      for (const vp of VIEWPORTS) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        // Allow reflow
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));

        // Check overflow
        const overflow = await page.evaluate((vpWidth) => {
          const docScroll = document.documentElement.scrollWidth;
          const bodyScroll = document.body ? document.body.scrollWidth : vpWidth;

          const overflowing: string[] = [];
          const all = document.querySelectorAll('*');
          for (const el of all) {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            if (
              style.display === 'none' ||
              style.visibility === 'hidden' ||
              style.opacity === '0' ||
              style.position === 'fixed' ||
              el.classList.contains('sidebar') ||
              el.classList.contains('sidebar-overlay') ||
              el.tagName === 'HTML' ||
              el.tagName === 'BODY'
            ) {
              continue;
            }

            // Report if elements visibly overflow beyond the viewport width
            if (rect.width > 0 && rect.right > vpWidth + 2) {
              const tag = el.tagName.toLowerCase();
              const cls = Array.from(el.classList).slice(0, 3).join('.');
              overflowing.push(`${tag}${cls ? '.' + cls : ''} (w:${Math.round(rect.width)}, r:${Math.round(rect.right)} vs vp:${vpWidth})`);
            }
          }

          return {
            hasOverflow: docScroll > vpWidth + 1 || bodyScroll > vpWidth + 1,
            docScroll,
            bodyScroll,
            overflowing: overflowing.slice(0, 4),
          };
        }, vp.width);

        // Check sidebar behavior for dashboard pages
        let navFailure = '';
        if (!pageTarget.isPublic) {
          if (vp.width <= 900) {
            const menuBtn = page.locator('header.topbar button[aria-label="Menu"]');
            const isMenuVisible = await menuBtn.isVisible().catch(() => false);
            if (!isMenuVisible) {
              navFailure = 'Mobile menu button is not visible below 901px';
            }
          } else {
            const sidebar = page.locator('aside.sidebar');
            const isSidebarVisible = await sidebar.isVisible().catch(() => false);
            if (!isSidebarVisible) {
              navFailure = 'Sidebar is not visible on desktop (> 900px)';
            }
          }
        }

        // Save desktop baseline screenshot
        if (vp.width === 1920 && vp.height === 1080) {
          const safeName = pageTarget.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          const shotPath = path.join(baselineDir, `${safeName}-desktop-1920.png`);
          await page.screenshot({ path: shotPath, fullPage: false });
        }

        if (overflow.hasOverflow || navFailure) {
          viewportFailures.push({
            viewport: vp.label,
            reason: [
              overflow.hasOverflow ? `Horizontal scroll: docScroll=${overflow.docScroll} vs viewport=${vp.width}` : '',
              navFailure,
            ]
              .filter(Boolean)
              .join(', '),
            overflowing: overflow.overflowing,
          });
        }
      }

      // Record result to log
      const logEntry = {
        page: pageTarget.name,
        path: pageTarget.path,
        failures: viewportFailures,
      };

      try {
        let existing: any[] = [];
        if (fs.existsSync(resultsLogPath)) {
          existing = JSON.parse(fs.readFileSync(resultsLogPath, 'utf8'));
        }
        existing = existing.filter((e) => e.path !== pageTarget.path);
        existing.push(logEntry);
        fs.writeFileSync(resultsLogPath, JSON.stringify(existing, null, 2));
      } catch {}

      expect(
        viewportFailures.length,
        `Page ${pageTarget.name} failed responsive checks on ${viewportFailures.length} viewports: ${JSON.stringify(viewportFailures, null, 2)}`
      ).toBe(0);
    });
  }
});
