import { test, expect } from '@playwright/test';

test.describe('Dashboard Smoke Tests (Authenticated)', () => {
  test('Home Dashboard (/dashboard) loads with greeting and pipeline status', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*dashboard/);

    // Key headings
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Hello/i);
    await expect(page.getByRole('heading', { name: 'Pipeline Status' })).toBeVisible();

    // Verify navigation sidebar is present
    await expect(page.locator('aside.sidebar')).toBeVisible();
  });

  test('Lead Management page (/dashboard/leads) loads with heading', async ({ page }) => {
    await page.goto('/dashboard/leads');
    await expect(page).toHaveURL(/.*dashboard\/leads/);

    await expect(page.getByRole('heading', { name: 'Lead Management' })).toBeVisible();
  });

  test('Lead Lookup page (/dashboard/lookup) loads with heading', async ({ page }) => {
    await page.goto('/dashboard/lookup');
    await expect(page).toHaveURL(/.*dashboard\/lookup/);

    await expect(page.getByRole('heading', { name: 'Lead Lookup' })).toBeVisible();
  });

  test('Client Audience page (/dashboard/audience) loads with heading', async ({ page }) => {
    await page.goto('/dashboard/audience');
    await expect(page).toHaveURL(/.*dashboard\/audience/);

    await expect(page.getByRole('heading', { name: 'Client Audience' })).toBeVisible();
  });

  test('Email Campaigns page (/dashboard/campaigns) loads with heading', async ({ page }) => {
    await page.goto('/dashboard/campaigns');
    await expect(page).toHaveURL(/.*dashboard\/campaigns/);

    await expect(page.getByRole('heading', { level: 1, name: 'Email Campaigns' })).toBeVisible();
  });

  test('WhatsApp Campaigns page (/dashboard/whatsapp-campaigns) loads with heading', async ({ page }) => {
    await page.goto('/dashboard/whatsapp-campaigns');
    await expect(page).toHaveURL(/.*dashboard\/whatsapp-campaigns/);

    await expect(page.getByRole('heading', { level: 1, name: 'WhatsApp Campaigns' })).toBeVisible();
  });

  test('Insights page (/dashboard/insights) loads with heading', async ({ page }) => {
    await page.goto('/dashboard/insights');
    await expect(page).toHaveURL(/.*dashboard\/insights/);

    await expect(page.getByRole('heading', { name: 'Insights' })).toBeVisible();
  });

  test('Templates page (/dashboard/templates) loads with heading', async ({ page }) => {
    await page.goto('/dashboard/templates');
    await expect(page).toHaveURL(/.*dashboard\/templates/);

    await expect(page.getByRole('heading', { name: 'Templates' })).toBeVisible();
  });

  test('Settings page (/dashboard/settings) loads with heading', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await expect(page).toHaveURL(/.*dashboard\/settings/);

    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  });
});
