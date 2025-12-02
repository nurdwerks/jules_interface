
from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # 1. Login
        page.goto("http://localhost:9300")

        try:
            page.wait_for_selector("#login-modal", state="visible", timeout=3000)
            page.fill("#username-input", "admin")
            page.fill("#password-input", "password")
            page.click("#login-btn")
            page.wait_for_selector("#login-modal", state="hidden")
        except:
            print("Login modal not visible or login skipped")

        # Wait for data sync
        time.sleep(2)

        # 2. Create Session (since Mock DB is empty)
        # Click Create
        page.click("#nav-create")
        page.wait_for_selector("#create-session-form", state="visible")

        # Fill Form
        page.fill("#prompt", "Test Session for JSON Viewer")
        # Direct select (Playwright waits for option to attach)
        page.select_option("#source", index=0)

        page.click("button[type='submit']")

        # 3. Select the session
        page.wait_for_selector(".session-item", timeout=5000)
        page.click(".session-item:first-child")

        # 4. Wait for activities to load (initially empty)
        page.wait_for_selector("#message-input", state="visible")

        # Send a message
        page.fill("#message-input", "Hello World")
        page.click("#send-message-btn")

        # Now wait for activity
        page.wait_for_selector(".activity-item", timeout=5000)

        # 5. Check for Eye Icon
        page.wait_for_selector(".view-raw-btn")

        # Take screenshot of chat
        page.screenshot(path="verification/chat_view.png")

        # 6. Click Eye Icon and verify Modal
        page.locator(".view-raw-btn").first.click()

        # Wait for JSON modal
        page.wait_for_selector("#json-modal", state="visible")

        # Verify content
        content = page.text_content("#json-content")
        print(f"JSON Content: {content[:100]}...")

        # Take screenshot of modal
        page.screenshot(path="verification/json_modal.png")

        browser.close()

if __name__ == "__main__":
    run()
