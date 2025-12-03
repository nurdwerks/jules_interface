import { test, expect } from '@playwright/test';

test('Prompt for login when session is invalid', async ({ page }) => {
  // 1. Initial Login
  await page.goto('/');
  await page.waitForSelector('#login-modal:not(.hidden)');
  await page.fill('#username-input', 'testuser');
  await page.fill('#password-input', 'testpass');
  await page.click('#login-btn');
  await page.waitForSelector('#login-modal', { state: 'hidden' });

  // Wait for initial load
  await page.waitForTimeout(1000);

  // 2. Invalidate Session locally
  await page.evaluate(() => {
    localStorage.setItem('sessionToken', 'invalid-token-123');
  });

  // 3. Reload Page
  await page.reload();

  // 4. Expect Login Modal to appear because token is invalid
  // Currently, the app hides the modal initially if a token exists, but fails later.
  // We want to verify that it eventually shows the modal.
  await page.waitForSelector('#login-modal:not(.hidden)', { timeout: 5000 });
});
