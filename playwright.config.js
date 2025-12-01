import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  webServer: [
    {
      command: 'npx c8 --reporter=lcov --reporter=text --reporter=html --include="server/**/*.js" node server/server.js',
      port: 3000,
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
          MOCK_MODE: 'true',
          // Force coverage output folder to be distinct if needed, but default .nyc_output is fine
      }
    },
    {
      command: 'python3 -m http.server 8080',
      port: 8080,
      reuseExistingServer: false,
    }
  ],
  use: {
    baseURL: 'http://localhost:8080',
    headless: true,
  },
});
