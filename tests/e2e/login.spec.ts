import { test, expect } from '@playwright/test';

// Login tests must run with a clean, unauthenticated session state
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication - Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display client-side validation errors for empty fields', async ({ page }) => {
    // Attempt submitting without entering email or password
    await page.getByRole('button', { name: /sign in/i }).click();

    // Verify inline field validation errors
    await expect(page.getByText('Email address is required.')).toBeVisible();
    await expect(page.getByText('Password is required.')).toBeVisible();
    await expect(page).toHaveURL(/.*login/);
  });

  test('should show error banner when submitting an invalid password', async ({ page }) => {
    const email = process.env.TEST_EMAIL || 'test.automation@selfera.co.uk';

    await page.getByLabel('Email Address').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('IncorrectPassword999!');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Expect server error banner indicating bad credentials
    await expect(
      page.getByText(/Invalid (credentials|login credentials|email or password)/i)
    ).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/.*login/);
  });

  test('should successfully log in and redirect to dashboard with valid credentials', async ({ page }) => {
    const email = process.env.TEST_EMAIL;
    const password = process.env.TEST_PASSWORD;

    expect(email).toBeTruthy();
    expect(password).toBeTruthy();

    await page.getByLabel('Email Address').fill(email!);
    await page.getByLabel('Password', { exact: true }).fill(password!);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Verify successful navigation to dashboard
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 15000 });
  });
});

