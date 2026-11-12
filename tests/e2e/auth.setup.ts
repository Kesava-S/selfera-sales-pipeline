import { test as setup, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const authDir = path.resolve(process.cwd(), 'playwright/.auth');
const authFile = path.join(authDir, 'user.json');

setup('authenticate', async ({ page }) => {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;

  if (!email || !password) {
    throw new Error('TEST_EMAIL and TEST_PASSWORD must be set in .env.test or environment variables');
  }

  // Ensure output directory exists
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Navigate to login page
  await page.goto('/login');

  // Fill credentials using accessible locators
  await page.getByLabel(/Email Address/i).fill(email);
  await page.locator('input#password').fill(password);

  // Submit login form
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for redirect to dashboard
  await expect(page).toHaveURL(/.*dashboard/, { timeout: 15000 });

  // Save authenticated storage state (cookies, local storage)
  await page.context().storageState({ path: authFile });
});
