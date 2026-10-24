import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', fullyParallel: false, workers: 1, timeout: 150000,
  expect: { timeout: 8000 },
  use: { baseURL: process.env.PLAY_URL || 'http://127.0.0.1:5174', channel: 'chrome', viewport: {width:1440,height:900}, screenshot:'only-on-failure', trace:'retain-on-failure' },
  webServer: process.env.PLAY_URL ? undefined : {command:'npm run dev -- --port 5174',url:'http://127.0.0.1:5174',reuseExistingServer:true},
  reporter: [['list']],
});
