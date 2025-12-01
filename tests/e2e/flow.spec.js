import { test, expect } from '@playwright/test';

test('End to End Flow', async ({ page }) => {
  // Go to app
  await page.goto('/');

  // Handle Login Modal
  await page.waitForSelector('#login-modal:not(.hidden)');
  await page.fill('#username-input', 'testuser');
  await page.fill('#password-input', 'testpass');
  await page.click('#login-btn');
  await page.waitForSelector('#login-modal', { state: 'hidden' });

  // Create Session
  await page.click('#nav-create');
  await page.fill('#prompt', 'E2E Test Session');
  // Wait for sources to load (option with value to be present)
  await page.waitForSelector('#source option[value="sources/github/example/repo"]', { state: 'attached' });
  await page.selectOption('#source', 'sources/github/example/repo');
  await page.click('button[type="submit"]');

  // Verify created in list
  await page.waitForSelector('text=E2E Test Session');

  // View Session (click the item)
  await page.click('text=E2E Test Session');

  // Verify details
  await page.waitForSelector('h2:has-text("E2E Test Session")');

  // Send Message
  await page.fill('#message-input', 'Hello Agent');
  await page.click('#send-message-btn');

  // Verify message appears
  await page.waitForSelector('text=Hello Agent');

  // NOTE: Plan approval testing requires backend simulation of agent response.
  // In pure Mock Mode without pollution, this doesn't happen automatically.
  /*
  await page.waitForSelector('.plan-card'); // Wait for plan
  await page.click('.activity-item button:has-text("Approve Plan")');
  await page.waitForSelector('p:has-text("State: IN_PROGRESS")');
  */
});
