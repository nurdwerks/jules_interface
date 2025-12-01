import time
from playwright.sync_api import sync_playwright, expect

def verify_session_list():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        page.goto("http://localhost:9300")
        page.wait_for_timeout(1000)

        # Force hide login modal and inject data
        mock_data_script = """
        (function() {
            document.getElementById('login-modal').classList.add('hidden');

            window.sources = [
                { name: 'SourceA' },
                { name: 'SourceB' }
            ];

            const now = new Date();
            const oneHourAgo = new Date(now.getTime() - (1000 * 60 * 60));
            const thirtyMinsAgo = new Date(now.getTime() - (1000 * 60 * 30));
            const twentyFiveHoursAgo = new Date(now.getTime() - (1000 * 60 * 60 * 25));

            window.sessions = [
                {
                    name: 'SessionRecent_SourceA',
                    prompt: 'Recent Source A',
                    state: 'RUNNING',
                    createTime: oneHourAgo.toISOString(),
                    updateTime: oneHourAgo.toISOString(),
                    sourceContext: { source: 'SourceA' }
                },
                {
                    name: 'SessionOld_SourceB',
                    prompt: 'Old Source B',
                    state: 'COMPLETED',
                    createTime: twentyFiveHoursAgo.toISOString(),
                    updateTime: twentyFiveHoursAgo.toISOString(),
                    sourceContext: { source: 'SourceB' }
                },
                {
                    name: 'SessionRecent_SourceB',
                    prompt: 'Recent Source B',
                    state: 'QUEUED',
                    createTime: thirtyMinsAgo.toISOString(),
                    updateTime: thirtyMinsAgo.toISOString(),
                    sourceContext: { source: 'SourceB' }
                }
            ];

            // Re-render
            populateSources();
            renderSessions();
        })();
        """

        page.evaluate(mock_data_script)

        # 1. Verify Default State (Recent only, All Sources)
        # Should show SessionRecent_SourceA and SessionRecent_SourceB.
        # Source B (30m ago) should be first (index 0). Source A (1h ago) second (index 1).
        page.wait_for_timeout(500)

        items = page.locator("#session-list-sidebar .session-item")
        expect(items).to_have_count(2)
        expect(items.nth(0)).to_contain_text("Recent Source B")
        expect(items.nth(1)).to_contain_text("Recent Source A")

        # 2. Uncheck 'Recent (<24h)'
        page.uncheck("#filter-recent", force=True)
        page.wait_for_timeout(500)
        expect(items).to_have_count(3)
        # Old session (25h ago) should be last.
        expect(items.nth(2)).to_contain_text("Old Source B")

        # 3. Filter by SourceA (and All Time)
        page.select_option("#filter-source", "SourceA")
        page.wait_for_timeout(500)
        expect(items).to_have_count(1)
        expect(items.first).to_contain_text("Recent Source A")

        print("Assertions passed.")
        browser.close()

if __name__ == "__main__":
    verify_session_list()
