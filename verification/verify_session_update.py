import time
from playwright.sync_api import sync_playwright

def verify_session_update():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        print("Navigating...")
        page.goto("http://localhost:9300")

        # 1. Login
        print("Logging in...")
        page.wait_for_selector("#login-modal")
        page.fill("#username-input", "admin")
        page.fill("#password-input", "passer")
        page.click("#login-btn")

        page.wait_for_selector("#login-modal", state="hidden")

        # 2. Wait for sessions to load
        # Wait for some content or just proceed
        # Since we might have no sessions, let's create one immediately

        # 3. Create a session
        print("Creating session...")
        page.click("#nav-create")
        page.wait_for_selector("#view-create")

        # Wait for source options to be attached (might not be visible if native select)
        page.wait_for_selector("#source option", state="attached")

        page.fill("#prompt", "Test Refresh Session")
        page.select_option("#source", index=0)

        # Handle alert
        page.on("dialog", lambda dialog: dialog.accept())

        page.click("button[type=submit]")

        # Wait for session list update
        # We check if a session item appears
        print("Waiting for session list...")
        page.wait_for_selector(".session-item")

        # Click the first session
        page.click(".session-item")

        # Wait for details view
        page.wait_for_selector("#view-details")
        page.wait_for_selector("#session-title")

        # 4. Trigger Manual Refresh
        print("Clicking refresh...")
        page.click("#refresh-session-btn")

        # Wait a moment for the refresh to happen (ws message)
        time.sleep(2)

        # Take screenshot of the details view
        page.screenshot(path="verification/session_details.png")
        print("Screenshot saved to verification/session_details.png")

        browser.close()

if __name__ == "__main__":
    verify_session_update()
