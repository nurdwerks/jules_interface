
from playwright.sync_api import sync_playwright, expect
import os
import time

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1280, 'height': 800})

    page.on("console", lambda msg: print(f"Browser Console: {msg.text}"))

    # Go to app
    page.goto("http://localhost:9300")

    # Login
    # Wait for modal
    page.wait_for_selector("#login-modal")
    page.fill("#username-input", "admin")
    page.fill("#password-input", "passer")

    # Ensure listener is attached and WS is open
    time.sleep(2)
    page.click("#login-btn")

    # Wait for login to complete (modal hidden)
    page.wait_for_selector("#login-modal", state="hidden")

    # Check sidebar
    expect(page.locator("#sidebar")).to_be_visible()

    # Create Session
    page.click("#nav-create")

    # Wait for view-create to be visible
    page.wait_for_selector("#view-create")
    expect(page.locator("#view-create")).to_be_visible()

    page.fill("#prompt", "Visual Verification Session")

    # Wait for source options
    page.wait_for_selector("#source option[value='sources/github/nurdwerks/jules_interface']", state="attached")
    page.select_option("#source", "sources/github/nurdwerks/jules_interface")

    # Handle alert
    page.on("dialog", lambda dialog: dialog.accept())

    page.click("button[type='submit']")

    # Wait for session item in sidebar
    page.wait_for_selector("text=Visual Verification Session")

    # Click it to view details
    page.click("text=Visual Verification Session")

    # Wait for details view
    page.wait_for_selector("#view-details")
    expect(page.locator("#view-details")).to_be_visible()
    expect(page.locator("h2#session-title")).to_have_text("Visual Verification Session")

    # Send Message
    page.fill("#message-input", "Show me the visuals")
    page.click("#send-message-btn")

    # Wait for Agent Plan (Plan Generated bubble)
    page.wait_for_selector("text=Plan Generated:")

    # Wait for Approve Button
    page.wait_for_selector(".activity-item button:has-text('Approve Plan')")

    # Take screenshot
    os.makedirs("/home/jules/verification", exist_ok=True)
    page.screenshot(path="/home/jules/verification/verification.png")

    print("Verification screenshot taken.")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
