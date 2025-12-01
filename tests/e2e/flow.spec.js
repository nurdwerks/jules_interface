import { test, expect } from '@playwright/test';

test('End to End Flow', async ({ page }) => {
  // Go to app
  await page.goto('/');

  // Handle Login Modal
  await page.waitForSelector('#login-modal:not(.hidden)');
  await page.fill('#api-key-input', 'default-secret-key');
  await page.click('#login-btn');
  await page.waitForSelector('#login-modal', { state: 'hidden' });

  // Create Session
  await page.click('#nav-create');
  await page.fill('#prompt', 'E2E Test Session');
  // Wait for sources to load (option with value to be present)
  await page.waitForSelector('#source option[value="sources/github/example/repo"]', { state: 'attached' });
  await page.selectOption('#source', 'sources/github/example/repo');
  await page.click('button[type="submit"]');

  // Wait for alert (browser dialog) - Playwright automatically dismisses dialogs but we might want to verify
  // app.js uses `alert('Session created!')`
  // We should handle the dialog
  // page.on('dialog', dialog => dialog.accept()); // Playwright defaults to dismiss, which is fine

  // Verify created in list
  // Note: listSessions is called after create.
  await page.waitForSelector('text=E2E Test Session');

  // View Session (click the item)
  await page.click('text=E2E Test Session');

  // Verify details
  await page.waitForSelector('h2:has-text("sessions/mock-session-")');

  // Send Message
  await page.fill('#message-input', 'Hello Agent');
  await page.click('#send-message-btn');

  // Verify message appears
  await page.waitForSelector('text=User: Hello Agent');

  // Approve Plan
  await page.click('#approve-plan-btn');

  // Verify plan approved status (Mock: state becomes IN_PROGRESS)
  // We need to reload or wait for update?
  // approvePlan calls viewSession -> apiCall -> updates DOM.
  await page.waitForSelector('p:has-text("State: IN_PROGRESS")');
});
