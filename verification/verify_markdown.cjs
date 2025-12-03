
const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // Go to app
    await page.goto('http://localhost:9300');

    // Handle Login
    await page.waitForSelector('#login-modal');
    await page.fill('#username-input', 'admin');
    await page.fill('#password-input', 'password');
    await page.click('#login-btn');

    // Wait for login to complete (modal hidden)
    await page.waitForSelector('#login-modal', { state: 'hidden' });

    // Wait for sidebar content to load (sessions list) - BUT it might be empty!
    // Instead wait for the sidebar itself, which is always there.
    await page.waitForSelector('#sidebar');

    // Manually inject some mock session into the list if needed, or just proceed to inject activity.
    // The activity injection relies on `renderActivity` which is global.
    // But we need a place to put it. `activities-container` is in the DOM but might be hidden if `view-details` is hidden.
    // We need to show the details view first.

    await page.evaluate(() => {
        // Show details view
        document.querySelectorAll('.view').forEach(el => el.classList.add('hidden'));
        document.getElementById('view-details').classList.remove('hidden');

        const activity = {
            "name": "sessions/mock/activities/1",
            "createTime": "2025-12-03T03:39:41.630476Z",
            "originator": "agent",
            "agentMessaged": {
                "agentMessage": "This is a **bold** message with `code`.\n\n```javascript\nconsole.log('Hello');\n```"
            },
            "id": "1"
        };

        // Ensure marked is available
        if (typeof marked === 'undefined') {
            document.body.innerHTML = "MARKED NOT LOADED";
            return;
        }

        const html = renderActivity(activity);
        const container = document.getElementById('activities-container');
        if (container) {
            container.innerHTML = html;
        } else {
            document.body.innerHTML = "CONTAINER NOT FOUND";
        }
    });

    // Take screenshot
    await page.screenshot({ path: 'verification/verification.png' });

    await browser.close();
})();
