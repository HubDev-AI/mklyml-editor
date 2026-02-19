import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const outDir = join(process.cwd(), 'docs', 'snapshots');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

const source = [
  '--- use: core',
  '--- use: newsletter',
  '',
  '--- theme: newsletter/light',
  '--- preset: newsletter/editorial',
  '',
  '--- style',
  'text: #4f2c2c',
  'muted: #6a4a4a',
  '',
  '--- core/header',
  'title: Snapshot',
  '',
  '--- newsletter/featured',
  'title: Snapshot Featured',
  'image: https://images.unsplash.com/photo-1639322537228-f710d846310a?w=800&h=400&fit=crop',
  'source: Analysis',
  'author: The Pulse AI',
  'link: https://example.com',
  '',
  'Snapshot body text.',
].join('\n');

await page.goto('http://localhost:4321/?e2e', { waitUntil: 'networkidle' });
await page.locator('.cm-content').first().waitFor({ timeout: 15000 });
await page.evaluate((src) => {
  // @ts-ignore
  window.__editorStore.getState().setSource(src);
}, source);
await page.waitForTimeout(1200);

// Ensure inspector visible and show global pane context
const inspectorBtn = page.locator('button[title*="inspector"]').first();
const title = await inspectorBtn.getAttribute('title');
if (title?.includes('Show')) {
  await inspectorBtn.click();
  await page.waitForTimeout(200);
}
await page.evaluate(() => {
  // @ts-ignore
  window.__editorStore.getState().focusBlock(1, 'mkly', 'navigate');
});
await page.waitForTimeout(500);

await page.screenshot({
  path: join(outDir, 'global-pane-alignment.png'),
  clip: { x: 1460, y: 70, width: 440, height: 950 },
});

// Open style controls and capture style rows snapshot
const frame = page.frameLocator('iframe[title="Preview"]');
await frame.locator('.mkly-newsletter-featured').first().click();
await page.waitForTimeout(700);
await page.getByRole('button', { name: /Styles/i }).click();
await page.waitForTimeout(300);

await page.screenshot({
  path: join(outDir, 'style-row-consistency.png'),
  clip: { x: 1460, y: 70, width: 440, height: 950 },
});

await browser.close();
console.log('Saved snapshots to', outDir);
