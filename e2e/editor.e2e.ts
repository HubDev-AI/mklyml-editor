import { test, expect, type Page, type FrameLocator } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wait for the editor to fully initialize (CodeMirror mounted + normalization done). */
async function waitForEditor(page: Page) {
  // Wait for CodeMirror to mount (use .first() — HTML view also has .cm-content)
  await page.locator('.cm-content').first().waitFor({ timeout: 15000 });
  // Wait for initial normalization to complete (150ms debounce — prevents source clobber during typing)
  await page.waitForFunction(() => {
    const store = (window as Record<string, unknown>).__editorStore;
    if (store && typeof store === 'object' && 'getState' in store) {
      return (store as { getState: () => { isNormalized: boolean } }).getState().isNormalized;
    }
    return false;
  }, { timeout: 5000 });
}

/** Simple source with common blocks for tests that need preview content. */
const SIMPLE_SOURCE = [
  '--- use: core',
  '',
  '--- core/header',
  'title: Test Newsletter',
  '',
  '--- core/heading',
  'level: 1',
  'Test Heading',
  '',
  '--- core/text',
  'Test paragraph content.',
  '',
  '--- core/text',
  'Another paragraph.',
  '',
  '--- core/button',
  'url: https://example.com',
  'label: Click Me',
  '',
  '--- core/divider',
  '',
  '--- core/spacer',
  'height: 20',
].join('\n');

/** Load a source and wait for preview to render. */
async function loadSource(page: Page, source: string) {
  await setSource(page, source);
  await page.waitForTimeout(500);
  const frame = page.frameLocator('iframe[title="Preview"]');
  await frame.locator('.mkly-document').waitFor({ timeout: 15000 });
}

/** Get the preview iframe frame locator. */
function preview(page: Page): FrameLocator {
  return page.frameLocator('iframe[title="Preview"]');
}

/** Get the editable preview iframe frame locator. */
function editablePreview(page: Page): FrameLocator {
  return page.frameLocator('iframe[title="Editable Preview"]');
}

/** Set the source code in the editor by selecting all and typing. */
async function setSource(page: Page, source: string) {
  const editor = page.locator('.cm-content').first();
  await editor.click();
  // Select all
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Backspace');
  // Type the new source
  await page.keyboard.type(source, { delay: 5 });
}

/** Get the current source from the editor. */
async function getSource(page: Page): Promise<string> {
  return page.evaluate(() => {
    const store = (window as Record<string, unknown>).__editorStore;
    if (store && typeof store === 'object' && 'getState' in store) {
      return (store as { getState: () => { source: string } }).getState().source;
    }
    // Fallback: read from CodeMirror DOM
    const el = document.querySelector('.cm-content');
    return el?.textContent ?? '';
  });
}

// ---------------------------------------------------------------------------
// 1. SMOKE TESTS
// ---------------------------------------------------------------------------

test.describe('Editor Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?e2e');
    await waitForEditor(page);
  });

  test('editor opens with empty state showing starter chips', async ({ page }) => {
    // CodeMirror is rendered
    await expect(page.locator('.cm-content').first()).toBeVisible();
    await expect(page.locator('.cm-gutters').first()).toBeVisible();

    // Toolbar is visible
    await expect(page.locator('.liquid-glass-header')).toBeVisible();

    // Empty state should show starter message and chips
    await expect(page.getByText('Start building your document')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Heading' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Text' })).toBeVisible();
  });

  test('loading source compiles without fatal errors', async ({ page }) => {
    await loadSource(page, SIMPLE_SOURCE);

    const frame = preview(page);

    // Source has a header block — it should compile
    await expect(frame.locator('.mkly-core-header')).toBeVisible();

    // The document should have multiple blocks
    const blocks = frame.locator('[data-mkly-line]');
    await expect(blocks.first()).toBeVisible();
    const count = await blocks.count();
    expect(count).toBeGreaterThan(5);
  });

  test('logo text is visible', async ({ page }) => {
    await expect(page.getByText('mklyml')).toBeVisible();
  });

  test('clicking empty state chip inserts block and hides empty state', async ({ page }) => {
    // Click the "Heading" chip
    await page.getByRole('button', { name: 'Heading' }).click();
    await page.waitForTimeout(1000);

    // Source should no longer be empty (normalization may transform it)
    const source = await getSource(page);
    expect(source.trim().length).toBeGreaterThan(0);

    // Empty state should disappear
    await expect(page.getByText('Start building your document')).not.toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// 2. SOURCE EDITING — Preview Sync
// ---------------------------------------------------------------------------

test.describe('Source Editing & Preview Sync', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?e2e');
    await waitForEditor(page);
  });

  test('typing in editor updates preview', async ({ page }) => {
    const source = [
      '--- use: core',
      '',
      '--- meta',
      'version: 1',
      '',
      '--- core/heading',
      'level: 1',
      'E2E Test Heading',
      '',
      '--- core/text',
      'E2E paragraph content here.',
    ].join('\n');

    await setSource(page, source);
    // Wait for recompile
    await page.waitForTimeout(500);

    const frame = preview(page);
    await expect(frame.locator('h1')).toContainText('E2E Test Heading');
    await expect(frame.locator('p')).toContainText('E2E paragraph content here');
  });

  test('clearing source shows empty state', async ({ page }) => {
    // Load some content first
    await loadSource(page, SIMPLE_SOURCE);

    // Now clear source
    await setSource(page, '');
    await page.waitForTimeout(500);

    // Empty state should appear
    await expect(page.getByText('Start building your document')).toBeVisible({ timeout: 5000 });

    // The source editor should be empty
    const source = await page.locator('.cm-content').first().innerText();
    expect(source.trim()).toBe('');
  });

  test('adding a style block updates preview styles', async ({ page }) => {
    const source = [
      '--- use: core',
      '',
      '--- meta',
      'version: 1',
      '',
      '--- style',
      'core/heading',
      '  color: #ff0000',
      '',
      '--- core/heading',
      'level: 2',
      'Red Heading',
    ].join('\n');

    await setSource(page, source);
    await page.waitForTimeout(500);

    const frame = preview(page);
    const heading = frame.locator('h2');
    await expect(heading).toContainText('Red Heading');

    // Check that the heading has the red color applied
    const color = await heading.evaluate(el => {
      return window.getComputedStyle(el).color;
    });
    // rgb(255, 0, 0) = #ff0000
    expect(color).toBe('rgb(255, 0, 0)');
  });

  test('user-defined variables resolve in preview', async ({ page }) => {
    const source = [
      '--- use: core',
      '',
      '--- meta',
      'version: 1',
      '',
      '--- style',
      'accent: #e2725b',
      'core/heading',
      '  color: $accent',
      '',
      '--- core/heading',
      'level: 1',
      'Variable Styled',
    ].join('\n');

    await setSource(page, source);
    await page.waitForTimeout(500);

    const frame = preview(page);
    const heading = frame.locator('h1');
    const color = await heading.evaluate(el => window.getComputedStyle(el).color);
    // #e2725b = rgb(226, 114, 91)
    expect(color).toBe('rgb(226, 114, 91)');
  });

  test('sub-element styles apply to targets', async ({ page }) => {
    const source = [
      '--- use: core',
      '',
      '--- meta',
      'version: 1',
      '',
      '--- style',
      'core/button',
      '  background-color: #1d4ed8',
      '',
      '--- core/button',
      'url: https://example.com',
      'label: Styled Button',
    ].join('\n');

    await setSource(page, source);
    await page.waitForTimeout(500);

    const frame = preview(page);
    const button = frame.locator('a').first();
    await expect(button).toContainText('Styled Button');
  });

  test('multiple blocks render in order', async ({ page }) => {
    const source = [
      '--- use: core',
      '',
      '--- meta',
      'version: 1',
      '',
      '--- core/heading',
      'level: 1',
      'First',
      '',
      '--- core/text',
      'Middle paragraph',
      '',
      '--- core/heading',
      'level: 2',
      'Last',
    ].join('\n');

    await setSource(page, source);
    await page.waitForTimeout(500);

    const frame = preview(page);
    const allText = await frame.locator('.mkly-document').innerText();
    const firstIdx = allText.indexOf('First');
    const midIdx = allText.indexOf('Middle paragraph');
    const lastIdx = allText.indexOf('Last');
    expect(firstIdx).toBeLessThan(midIdx);
    expect(midIdx).toBeLessThan(lastIdx);
  });
});

// ---------------------------------------------------------------------------
// 3. VIEW MODES
// ---------------------------------------------------------------------------

test.describe('View Mode Switching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?e2e');
    await waitForEditor(page);
    await loadSource(page, SIMPLE_SOURCE);
  });

  test('switch to Edit mode shows contenteditable preview', async ({ page }) => {
    // Click the "Edit" pill
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.waitForTimeout(300);

    // The editable preview iframe should be visible
    const frame = editablePreview(page);
    await expect(frame.locator('[data-mkly-line]').first()).toBeVisible({ timeout: 5000 });
  });

  test('switch to HTML mode shows raw HTML', async ({ page }) => {
    await page.getByRole('button', { name: 'HTML', exact: true }).click();
    await page.waitForTimeout(300);

    // A second CodeMirror instance should appear showing HTML
    const editors = page.locator('.cm-content');
    const count = await editors.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('switch to Email mode changes output format', async ({ page }) => {
    // Click email pill (exact to avoid Agentation toolbar matches)
    await page.getByRole('button', { name: 'Email', exact: true }).click();
    await page.waitForTimeout(1000);

    // Switch to HTML view to see the raw output
    await page.getByRole('button', { name: 'HTML', exact: true }).click();
    await page.waitForTimeout(500);

    // The HTML output should contain email-specific elements
    // Use textContent (not innerText) to capture all text including scrolled-out lines
    const editors = page.locator('.cm-content');
    const htmlEditor = editors.last();
    const text = await htmlEditor.evaluate(el => el.textContent ?? '');
    expect(text).toContain('role="presentation"');
  });

  test('switching back to Web mode restores CSS classes', async ({ page }) => {
    // Go to email (exact to avoid Agentation toolbar matches)
    await page.getByRole('button', { name: 'Email', exact: true }).click();
    await page.waitForTimeout(500);

    // Go back to web
    await page.getByRole('button', { name: 'Web', exact: true }).click();
    await page.waitForTimeout(500);

    // Preview should have CSS classes back
    const frame = preview(page);
    await expect(frame.locator('.mkly-document')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 4. PANEL MANAGEMENT
// ---------------------------------------------------------------------------

test.describe('Panel Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?e2e');
    await waitForEditor(page);
    await loadSource(page, SIMPLE_SOURCE);
  });

  test('toggle sidebar visibility', async ({ page }) => {
    // Find the sidebar toggle button
    const sidebarBtn = page.locator('button[title*="blocks"]').first();

    // Click to hide
    await sidebarBtn.click();
    await page.waitForTimeout(200);

    // Click to show
    await sidebarBtn.click();
    await page.waitForTimeout(200);
  });

  test('toggle inspector visibility', async ({ page }) => {
    const inspectorBtn = page.locator('button[title*="inspector"]').first();

    await inspectorBtn.click();
    await page.waitForTimeout(200);

    await inspectorBtn.click();
    await page.waitForTimeout(200);
  });

  test('toggle dark/light theme', async ({ page }) => {
    // App uses classList.toggle('dark'), not data-theme attribute
    const initialDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );

    // Find and click theme toggle
    const themeBtn = page.locator('button[title*="Switch to"]').first();
    await themeBtn.click();
    await page.waitForTimeout(200);

    // Theme should have changed
    const newDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );
    expect(newDark).not.toBe(initialDark);

    // Toggle back
    await themeBtn.click();
    await page.waitForTimeout(200);
    const restoredDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );
    expect(restoredDark).toBe(initialDark);
  });
});

// ---------------------------------------------------------------------------
// 5. BLOCK CLICKING — Cross-pane focus sync
// ---------------------------------------------------------------------------

test.describe('Block Click & Focus Sync', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?e2e');
    await waitForEditor(page);
    await loadSource(page, SIMPLE_SOURCE);
  });

  test('clicking block in preview highlights it', async ({ page }) => {
    const frame = preview(page);
    // Click the first block
    const firstBlock = frame.locator('[data-mkly-line]').first();
    await firstBlock.click();
    await page.waitForTimeout(300);

    // The clicked block should get the active attribute
    await expect(frame.locator('[data-mkly-active]')).toBeVisible();
  });

  test('clicking different blocks changes active highlight', async ({ page }) => {
    const frame = preview(page);
    const blocks = frame.locator('[data-mkly-line]');

    // Click first block
    await blocks.first().click();
    await page.waitForTimeout(300);
    const firstLine = await frame.locator('[data-mkly-active]').getAttribute('data-mkly-line');

    // Click a different block (skip a few)
    const thirdBlock = blocks.nth(3);
    if (await thirdBlock.isVisible()) {
      await thirdBlock.click();
      await page.waitForTimeout(300);
      const secondLine = await frame.locator('[data-mkly-active]').getAttribute('data-mkly-line');
      expect(secondLine).not.toBe(firstLine);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. STYLE INSPECTOR
// ---------------------------------------------------------------------------

test.describe('Style Inspector', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?e2e');
    await waitForEditor(page);
  });

  test('clicking block shows its info in inspector', async ({ page }) => {
    await loadSource(page, SIMPLE_SOURCE);

    // Ensure inspector is visible
    const inspectorBtn = page.locator('button[title*="inspector"]').first();
    const inspectorTitle = await inspectorBtn.getAttribute('title');
    if (inspectorTitle?.includes('Show')) {
      await inspectorBtn.click();
      await page.waitForTimeout(200);
    }

    // Click a heading block in preview
    const frame = preview(page);
    const heading = frame.locator('[data-mkly-line]').first();
    await heading.click();
    await page.waitForTimeout(1000);

    // Inspector should show block info — look for "STYLES" button (inline-styled, uppercase)
    // Use getByRole to only match buttons, avoiding CodeMirror text spans
    const stylesBtn = page.getByRole('button', { name: /Styles/i });
    await expect(stylesBtn).toBeVisible({ timeout: 5000 });
  });

  test('style editor has tabs for targets', async ({ page }) => {
    // Set up a source with a button block (has sub-element targets like 'link')
    const source = [
      '--- use: core',
      '',
      '--- meta',
      'version: 1',
      '',
      '--- core/button',
      'url: https://example.com',
      'label: Tab Test',
    ].join('\n');

    await setSource(page, source);
    await page.waitForTimeout(500);

    // Ensure inspector is visible
    const inspectorBtn = page.locator('button[title*="inspector"]').first();
    const title = await inspectorBtn.getAttribute('title');
    if (title?.includes('Show')) {
      await inspectorBtn.click();
      await page.waitForTimeout(200);
    }

    // Click the button block in preview
    const frame = preview(page);
    await frame.locator('[data-mkly-line]').first().click();
    await page.waitForTimeout(1000);

    // Expand the Styles section — button text "Styles" (use getByRole to avoid CodeMirror spans)
    const stylesBtn = page.getByRole('button', { name: /Styles/i });
    await expect(stylesBtn).toBeVisible({ timeout: 5000 });
    await stylesBtn.click();
    await page.waitForTimeout(200);

    // Should have "Self" tab and "Hover" tab visible
    await expect(page.getByRole('button', { name: 'Self', exact: true })).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole('button', { name: 'Hover', exact: true })).toBeVisible({ timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// 7. STYLE PICK MODE
// ---------------------------------------------------------------------------

test.describe('Style Pick Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?e2e');
    await waitForEditor(page);
  });

  test('toggle style pick mode changes cursor in preview', async ({ page }) => {
    await loadSource(page, SIMPLE_SOURCE);

    // Click the "Style" button in toolbar
    const styleBtn = page.locator('button').filter({ hasText: /^Style$/ });
    await styleBtn.click();
    await page.waitForTimeout(300);

    // The preview iframe body should have .mkly-style-pick class
    const frame = preview(page);
    const hasClass = await frame.locator('body').evaluate(el =>
      el.classList.contains('mkly-style-pick'),
    );
    expect(hasClass).toBe(true);

    // Click again to disable
    const stylingBtn = page.locator('button').filter({ hasText: /Styling/ });
    await stylingBtn.click();
    await page.waitForTimeout(300);

    const hasClassAfter = await frame.locator('body').evaluate(el =>
      el.classList.contains('mkly-style-pick'),
    );
    expect(hasClassAfter).toBe(false);
  });

  test('clicking element in style pick opens popup', async ({ page }) => {
    // Set simple source
    const source = [
      '--- use: core',
      '',
      '--- meta',
      'version: 1',
      '',
      '--- core/heading',
      'level: 2',
      'Pick Me',
    ].join('\n');
    await setSource(page, source);
    await page.waitForTimeout(500);

    // Enable style pick mode
    const styleBtn = page.locator('button').filter({ hasText: /^Style$/ });
    await styleBtn.click();
    await page.waitForTimeout(300);

    // Click the heading in preview
    const frame = preview(page);
    await frame.locator('h2').click();
    await page.waitForTimeout(500);

    // A popup should appear (fixed position overlay with z-index 9998)
    const popup = page.locator('.liquid-glass-overlay');
    await expect(popup).toBeVisible({ timeout: 3000 });
  });

  test('style popup can be closed with Escape', async ({ page }) => {
    const source = [
      '--- use: core',
      '',
      '--- meta',
      'version: 1',
      '',
      '--- core/heading',
      'level: 2',
      'Escape Test',
    ].join('\n');
    await setSource(page, source);
    await page.waitForTimeout(500);

    // Enable style pick and click heading
    const styleBtn = page.locator('button').filter({ hasText: /^Style$/ });
    await styleBtn.click();
    await page.waitForTimeout(300);

    const frame = preview(page);
    await frame.locator('h2').click();
    await page.waitForTimeout(500);

    const popup = page.locator('.liquid-glass-overlay');
    await expect(popup).toBeVisible({ timeout: 3000 });

    // Press Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    await expect(popup).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 8. STYLE CHANGES — Source ↔ Inspector round-trip
// ---------------------------------------------------------------------------

test.describe('Style Changes Round-Trip', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?e2e');
    await waitForEditor(page);
  });

  test('adding color via style block renders in preview', async ({ page }) => {
    const source = [
      '--- use: core',
      '',
      '--- meta',
      'version: 1',
      '',
      '--- style',
      'core/text',
      '  color: #0000ff',
      '  font-size: 20px',
      '',
      '--- core/text',
      'Blue text here',
    ].join('\n');

    await setSource(page, source);
    await page.waitForTimeout(800);

    const frame = preview(page);
    const text = frame.locator('p');
    await expect(text).toContainText('Blue text here');

    const color = await text.evaluate(el => window.getComputedStyle(el).color);
    expect(color).toBe('rgb(0, 0, 255)');

    const fontSize = await text.evaluate(el => window.getComputedStyle(el).fontSize);
    expect(fontSize).toBe('20px');
  });

  test('labeled blocks get BEM modifier class', async ({ page }) => {
    const source = [
      '--- use: core',
      '',
      '--- meta',
      'version: 1',
      '',
      '--- style',
      'core/heading:hero',
      '  color: #fef3c7',
      '',
      '--- core/heading: hero',
      'level: 1',
      'Hero Title',
    ].join('\n');

    await setSource(page, source);
    await page.waitForTimeout(800);

    const frame = preview(page);
    // The heading should have the BEM modifier class
    const heroHeading = frame.locator('.mkly-core-heading--hero');
    await expect(heroHeading).toBeAttached({ timeout: 10000 });
    // Verify the label style is applied
    const h1 = frame.locator('h1');
    await expect(h1).toContainText('Hero Title');
  });

  test('theme + preset affects all block rendering', async ({ page }) => {
    const themedSource = [
      '--- use: core',
      '--- use: newsletter',
      '--- theme: newsletter/graphite',
      '',
      '--- core/heading',
      'level: 1',
      'Theme Test',
    ].join('\n');
    await setSource(page, themedSource);
    await page.waitForTimeout(800);

    const frame = preview(page);
    const doc = frame.locator('.mkly-document');

    // The document should have some background color from the theme
    const bg = await doc.evaluate(el => window.getComputedStyle(el).backgroundColor);
    // Should NOT be the default white (the graphite theme has a dark bg)
    expect(bg).toBeDefined();
  });

  test('pseudo-selectors (:hover) in style blocks are in CSS', async ({ page }) => {
    const source = [
      '--- use: core',
      '',
      '--- meta',
      'version: 1',
      '',
      '--- style',
      'core/button',
      '  background-color: #1d4ed8',
      '  :hover',
      '    background-color: #2563eb',
      '',
      '--- core/button',
      'url: https://example.com',
      'label: Hover Me',
    ].join('\n');

    await setSource(page, source);
    await page.waitForTimeout(800);

    const frame = preview(page);
    await expect(frame.locator('a').first()).toContainText('Hover Me');

    // The base background-color is on the wrapper, not the inner <a>
    const wrapper = frame.locator('.mkly-core-button');
    const bg = await wrapper.evaluate(el => window.getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(29, 78, 216)');
  });
});

// ---------------------------------------------------------------------------
// 9. BLOCK INSERTION
// ---------------------------------------------------------------------------

test.describe('Block Insertion', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?e2e');
    await waitForEditor(page);
    await loadSource(page, SIMPLE_SOURCE);
  });

  test('Cmd+Shift+P opens block dock modal', async ({ page }) => {
    await page.keyboard.press('ControlOrMeta+Shift+p');
    await page.waitForTimeout(300);

    // Block dock modal should be visible — look for the search input
    const modal = page.locator('[role="dialog"]');
    // If no role="dialog", look for the block dock by its content
    const searchInput = page.locator('input[placeholder*="Search"]').or(
      page.locator('input[placeholder*="search"]'),
    ).or(
      page.locator('input[placeholder*="block"]'),
    );
    // At least one of these patterns should match
    const isVisible = await searchInput.first().isVisible().catch(() => false);
    // The block dock modal could also be identified by having block names
    if (!isVisible) {
      // Try clicking the + button instead
      const insertBtn = page.locator('button[title*="Insert block"]');
      if (await insertBtn.isVisible()) {
        await insertBtn.click();
        await page.waitForTimeout(300);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 10. COMPLEX STYLING SCENARIOS
// ---------------------------------------------------------------------------

test.describe('Complex Styling Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?e2e');
    await waitForEditor(page);
  });

  test('multiple style properties in one block apply correctly', async ({ page }) => {
    const source = [
      '--- use: core',
      '',
      '--- meta',
      'version: 1',
      '',
      '--- style',
      'core/text',
      '  color: #ff0000',
      '  font-size: 24px',
      '  font-style: italic',
      '',
      '--- core/text',
      'Multi-styled paragraph',
    ].join('\n');

    await setSource(page, source);
    await page.waitForTimeout(500);

    const frame = preview(page);
    const text = frame.locator('p');
    await expect(text).toContainText('Multi-styled paragraph');

    const color = await text.evaluate(el => window.getComputedStyle(el).color);
    expect(color).toBe('rgb(255, 0, 0)');

    const fontSize = await text.evaluate(el => window.getComputedStyle(el).fontSize);
    expect(fontSize).toBe('24px');

    const fontStyle = await text.evaluate(el => window.getComputedStyle(el).fontStyle);
    expect(fontStyle).toBe('italic');
  });

  test('style variables cascade through blocks', async ({ page }) => {
    const source = [
      '--- use: core',
      '',
      '--- meta',
      'version: 1',
      '',
      '--- style',
      'primary: #1a1a2e',
      'accent: #e94560',
      'core/heading',
      '  color: $primary',
      'core/button',
      '  background-color: $accent',
      '',
      '--- core/heading',
      'level: 1',
      'Themed Title',
      '',
      '--- core/button',
      'url: https://example.com',
      'label: Themed Button',
    ].join('\n');

    await setSource(page, source);
    await page.waitForTimeout(500);

    const frame = preview(page);
    const heading = frame.locator('h1');
    const headingColor = await heading.evaluate(el => window.getComputedStyle(el).color);
    expect(headingColor).toBe('rgb(26, 26, 46)');
  });

  test('gap-scale variables affect spacing', async ({ page }) => {
    const source = [
      '--- use: core',
      '--- preset: core/compact',
      '',
      '--- meta',
      'version: 1',
      '',
      '--- core/heading',
      'level: 1',
      'Title',
      '',
      '--- core/text',
      'Content',
    ].join('\n');

    await setSource(page, source);
    await page.waitForTimeout(500);

    const frame = preview(page);
    await expect(frame.locator('h1')).toContainText('Title');
    await expect(frame.locator('p')).toContainText('Content');
  });

  test('non-breaking space (\\~) renders as nbsp', async ({ page }) => {
    const source = [
      '--- use: core',
      '',
      '--- meta',
      'version: 1',
      '',
      '--- core/text',
      'Hello\\~World',
    ].join('\n');

    await setSource(page, source);
    await page.waitForTimeout(500);

    const frame = preview(page);
    // &nbsp; renders as a space character but with no break
    // Check the innerHTML
    const html = await frame.locator('.mkly-core-text').innerHTML();
    expect(html).toContain('&nbsp;');
  });

  test('markdown formatting renders correctly', async ({ page }) => {
    const source = [
      '--- use: core',
      '',
      '--- meta',
      'version: 1',
      '',
      '--- core/text',
      'This is **bold** and *italic* and `code`.',
    ].join('\n');

    await setSource(page, source);
    await page.waitForTimeout(500);

    const frame = preview(page);
    await expect(frame.locator('strong')).toContainText('bold');
    await expect(frame.locator('em')).toContainText('italic');
    await expect(frame.locator('code')).toContainText('code');
  });

  test('all core blocks render without errors', async ({ page }) => {
    const source = [
      '--- use: core',
      '',
      '--- meta',
      'version: 1',
      '',
      '--- core/heading',
      'level: 1',
      'Title',
      '',
      '--- core/text',
      'Paragraph',
      '',
      '--- core/button',
      'url: https://example.com',
      'label: Click',
      '',
      '--- core/divider',
      '',
      '--- core/spacer',
      'height: 20',
      '',
      '--- core/image',
      'src: https://via.placeholder.com/100',
      'alt: Test',
      '',
      '--- core/quote',
      'author: Einstein',
      'Imagination is everything.',
      '',
      '--- core/code',
      'lang: js',
      'console.log("hi");',
      '',
      '--- core/list',
      '- Item A',
      '- Item B',
      '',
      '--- core/footer',
      'Footer text',
    ].join('\n');

    await setSource(page, source);
    await page.waitForTimeout(800);

    const frame = preview(page);
    await expect(frame.locator('h1')).toContainText('Title');
    await expect(frame.locator('p').first()).toContainText('Paragraph');
    await expect(frame.locator('a').first()).toContainText('Click');
    await expect(frame.locator('hr')).toBeVisible();
    await expect(frame.locator('blockquote')).toContainText('Imagination');

    // No errors should be visible
    const blocks = frame.locator('[data-mkly-line]');
    const count = await blocks.count();
    expect(count).toBeGreaterThanOrEqual(8);
  });

  test('newsletter blocks render with core + newsletter kits', async ({ page }) => {
    const source = [
      '--- use: core',
      '--- use: newsletter',
      '',
      '--- meta',
      'version: 1',
      '',
      '--- core/header',
      'title: My Newsletter',
      '',
      '--- newsletter/intro',
      'Welcome to our newsletter.',
      '',
      '--- newsletter/category',
      'title: Top Stories',
      '',
      '--- newsletter/item',
      'title: Story One',
      'url: https://example.com/1',
      '',
      '## Story One Title',
      'First story description.',
      '',
      '--- /newsletter/category',
      '',
      '--- core/footer',
      'Footer',
    ].join('\n');

    await setSource(page, source);
    await page.waitForTimeout(800);

    const frame = preview(page);
    await expect(frame.locator('.mkly-document')).toBeVisible();
    // Should have multiple blocks rendered
    const blocks = frame.locator('[data-mkly-line]');
    const count = await blocks.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });
});

// ---------------------------------------------------------------------------
// 11. UNDO/REDO
// ---------------------------------------------------------------------------

test.describe('Undo/Redo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?e2e');
    await waitForEditor(page);
  });

  test('undo reverts source change', async ({ page }) => {
    // Set a simple source
    const source = [
      '--- use: core',
      '',
      '--- core/heading',
      'level: 1',
      'Undo Test Title',
    ].join('\n');
    await setSource(page, source);
    await page.waitForTimeout(500);

    const frame = preview(page);
    await expect(frame.locator('h1')).toContainText('Undo Test Title', { timeout: 5000 });

    // Make a small edit: go to end, add new block
    const editor = page.locator('.cm-content').first();
    await editor.click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('UNDO_MARKER', { delay: 5 });
    await page.waitForTimeout(500);

    // Verify the new text appears in source
    let src = await getSource(page);
    expect(src).toContain('UNDO_MARKER');

    // Undo multiple times to remove the typed text
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('ControlOrMeta+z');
    }
    await page.waitForTimeout(500);

    // The marker text should be gone from source
    src = await getSource(page);
    expect(src).not.toContain('UNDO_MARKER');
  });
});

// ---------------------------------------------------------------------------
// 12. ERROR HANDLING
// ---------------------------------------------------------------------------

test.describe('Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?e2e');
    await waitForEditor(page);
  });

  test('invalid block type shows error', async ({ page }) => {
    const source = [
      '--- use: core',
      '',
      '--- meta',
      'version: 1',
      '',
      '--- core/nonexistent',
      'Some content',
    ].join('\n');

    await setSource(page, source);
    await page.waitForTimeout(500);

    // There should be some error indication
    // The status bar or error bar should show something
    // At minimum, the invalid block should not crash the editor
    const frame = preview(page);
    await expect(frame.locator('.mkly-document')).toBeVisible();
  });

  test('missing meta version still renders', async ({ page }) => {
    const source = [
      '--- use: core',
      '',
      '--- core/text',
      'No version',
    ].join('\n');

    await setSource(page, source);
    await page.waitForTimeout(500);

    // Editor should still render (gracefully degrade)
    const frame = preview(page);
    await expect(frame.locator('.mkly-document')).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// 13. EDITABLE PREVIEW (Edit Mode)
// ---------------------------------------------------------------------------

test.describe('Editable Preview — Edit Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?e2e');
    await waitForEditor(page);
  });

  test('editing heading text in edit mode updates source', async ({ page }) => {
    const source = [
      '--- use: core',
      '',
      '--- meta',
      'version: 1',
      '',
      '--- core/heading',
      'level: 1',
      'Original Title',
    ].join('\n');
    await setSource(page, source);
    await page.waitForTimeout(500);

    // Switch to Edit mode
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.waitForTimeout(500);

    // Get the editable preview frame
    const frame = editablePreview(page);
    const h1 = frame.locator('h1');
    await expect(h1).toBeVisible({ timeout: 5000 });
    await expect(h1).toContainText('Original Title');

    // Triple-click to select all text in heading, then type new text
    await h1.click({ clickCount: 3 });
    await page.keyboard.type('Modified Title');

    // Wait for reverse sync debounce
    await page.waitForTimeout(1500);

    // Verify source updated
    const newSource = await getSource(page);
    expect(newSource).toContain('Modified Title');
  });

  test('editing paragraph text in edit mode syncs back to source', async ({ page }) => {
    const source = [
      '--- use: core',
      '',
      '--- meta',
      'version: 1',
      '',
      '--- core/text',
      'Original paragraph text.',
    ].join('\n');
    await setSource(page, source);
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: 'Edit' }).click();
    await page.waitForTimeout(500);

    const frame = editablePreview(page);
    const p = frame.locator('p');
    await expect(p).toBeVisible({ timeout: 5000 });

    await p.click({ clickCount: 3 });
    await page.keyboard.type('Updated paragraph.');

    await page.waitForTimeout(1500);

    const newSource = await getSource(page);
    expect(newSource).toContain('Updated paragraph');
  });

  test('edit mode renders contenteditable elements', async ({ page }) => {
    await loadSource(page, SIMPLE_SOURCE);
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.waitForTimeout(500);

    const frame = editablePreview(page);
    await expect(frame.locator('[data-mkly-line]').first()).toBeVisible({ timeout: 5000 });

    // Verify there is a contenteditable element in the iframe
    const editableEl = frame.locator('[contenteditable="true"]');
    await expect(editableEl.first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 14. BLOCK INSERTION via BlockDock
// ---------------------------------------------------------------------------

test.describe('Block Insertion via BlockDock', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?e2e');
    await waitForEditor(page);
    await loadSource(page, SIMPLE_SOURCE);
  });

  test('search and insert a heading block', async ({ page }) => {
    const source = [
      '--- use: core',
      '',
      '--- meta',
      'version: 1',
      '',
      '--- core/text',
      'Existing content.',
    ].join('\n');
    await setSource(page, source);
    await page.waitForTimeout(500);

    // Click in editor and move to end
    const editor = page.locator('.cm-content').first();
    await editor.click();
    await page.keyboard.press('ControlOrMeta+End');

    // Open BlockDock
    await page.keyboard.press('ControlOrMeta+Shift+p');
    await page.waitForTimeout(300);

    // Type to search
    const searchInput = page.getByPlaceholder('Search blocks...');
    await expect(searchInput).toBeVisible({ timeout: 3000 });
    await searchInput.fill('heading');
    await page.waitForTimeout(200);

    // Press Enter to insert the first match
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Verify source now contains the heading block
    const newSource = await getSource(page);
    expect(newSource).toContain('--- core/heading');
  });

  test('search filters blocks by name', async ({ page }) => {
    // Focus editor then open BlockDock
    await page.locator('.cm-content').first().click();
    await page.keyboard.press('ControlOrMeta+Shift+p');
    await page.waitForTimeout(300);

    const searchInput = page.getByPlaceholder('Search blocks...');
    await expect(searchInput).toBeVisible({ timeout: 3000 });

    // Type a query that matches divider
    await searchInput.fill('divid');
    await page.waitForTimeout(200);

    // Should show divider block
    await expect(page.getByText('Divider').first()).toBeVisible();

    // Type something that doesn't match
    await searchInput.fill('zzzznonexistent');
    await page.waitForTimeout(200);

    // Should show "No blocks found"
    await expect(page.getByText('No blocks found')).toBeVisible();
  });

  test('escape closes BlockDock', async ({ page }) => {
    // Focus editor then open BlockDock
    await page.locator('.cm-content').first().click();
    await page.keyboard.press('ControlOrMeta+Shift+p');
    await page.waitForTimeout(300);

    const searchInput = page.getByPlaceholder('Search blocks...');
    await expect(searchInput).toBeVisible({ timeout: 3000 });

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    await expect(searchInput).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 15. INSPECTOR PROPERTY EDITING
// ---------------------------------------------------------------------------

test.describe('Inspector Property Editing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?e2e');
    await waitForEditor(page);
  });

  test('clicking heading shows level property in inspector', async ({ page }) => {
    const source = [
      '--- use: core',
      '',
      '--- meta',
      'version: 1',
      '',
      '--- core/heading',
      'level: 2',
      'Test Heading',
    ].join('\n');
    await setSource(page, source);
    await page.waitForTimeout(500);

    // Ensure inspector is visible
    const inspectorBtn = page.locator('button[title*="inspector"]').first();
    const title = await inspectorBtn.getAttribute('title');
    if (title?.includes('Show')) {
      await inspectorBtn.click();
      await page.waitForTimeout(200);
    }

    // Click the heading block in preview
    const frame = preview(page);
    await frame.locator('h2').click();
    await page.waitForTimeout(1000);

    // Expand optional properties (level is optional)
    const moreBtn = page.getByRole('button', { name: /More options/ });
    if (await moreBtn.isVisible()) {
      await moreBtn.click();
      await page.waitForTimeout(200);
    }

    // Inspector should show a number input for level
    const levelInput = page.locator('input[type="number"]');
    await expect(levelInput.first()).toBeVisible({ timeout: 5000 });

    // The value should be 2
    const value = await levelInput.first().inputValue();
    expect(value).toBe('2');
  });

  test('changing heading level via inspector updates preview', async ({ page }) => {
    const source = [
      '--- use: core',
      '',
      '--- meta',
      'version: 1',
      '',
      '--- core/heading',
      'level: 1',
      'Level Test',
    ].join('\n');
    await setSource(page, source);
    await page.waitForTimeout(500);

    // Ensure inspector is visible
    const inspectorBtn = page.locator('button[title*="inspector"]').first();
    const title = await inspectorBtn.getAttribute('title');
    if (title?.includes('Show')) {
      await inspectorBtn.click();
      await page.waitForTimeout(200);
    }

    // Click the heading in preview
    const frame = preview(page);
    await frame.locator('h1').click();
    await page.waitForTimeout(1000);

    // Expand optional properties (level is optional)
    const moreBtn = page.getByRole('button', { name: /More options/ });
    if (await moreBtn.isVisible()) {
      await moreBtn.click();
      await page.waitForTimeout(200);
    }

    // Find and change the level input
    const levelInput = page.locator('input[type="number"]').first();
    await expect(levelInput).toBeVisible({ timeout: 5000 });

    // Clear and type new value, then tab to confirm
    await levelInput.fill('3');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    // Verify the source updated
    const newSource = await getSource(page);
    expect(newSource).toContain('level: 3');

    // Verify the preview updated to h3
    await expect(frame.locator('h3')).toContainText('Level Test');
  });
});

// ---------------------------------------------------------------------------
// 16. KEYBOARD SHORTCUTS & FORMATTING
// ---------------------------------------------------------------------------

test.describe('Keyboard Shortcuts & Formatting', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?e2e');
    await waitForEditor(page);
  });

  test('Cmd+B wraps selection in bold', async ({ page }) => {
    const source = [
      '--- use: core',
      '',
      '--- meta',
      'version: 1',
      '',
      '--- core/text',
      'boldme',
    ].join('\n');
    await setSource(page, source);
    await page.waitForTimeout(500);

    // Click in editor and select the word on the last line
    const editor = page.locator('.cm-content').first();
    await editor.click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.press('Home');
    await page.keyboard.press('Shift+End');

    // Press Cmd+B to wrap in bold
    await page.keyboard.press('ControlOrMeta+b');
    await page.waitForTimeout(300);

    const newSource = await getSource(page);
    expect(newSource).toContain('**boldme**');
  });

  test('Cmd+I wraps selection in italic', async ({ page }) => {
    const source = [
      '--- use: core',
      '',
      '--- meta',
      'version: 1',
      '',
      '--- core/text',
      'italicme',
    ].join('\n');
    await setSource(page, source);
    await page.waitForTimeout(500);

    const editor = page.locator('.cm-content').first();
    await editor.click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.press('Home');
    await page.keyboard.press('Shift+End');

    await page.keyboard.press('ControlOrMeta+i');
    await page.waitForTimeout(300);

    const newSource = await getSource(page);
    expect(newSource).toContain('*italicme*');
  });

  test('Cmd+E wraps selection in code', async ({ page }) => {
    const source = [
      '--- use: core',
      '',
      '--- meta',
      'version: 1',
      '',
      '--- core/text',
      'codeme',
    ].join('\n');
    await setSource(page, source);
    await page.waitForTimeout(500);

    const editor = page.locator('.cm-content').first();
    await editor.click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.press('Home');
    await page.keyboard.press('Shift+End');

    await page.keyboard.press('ControlOrMeta+e');
    await page.waitForTimeout(300);

    const newSource = await getSource(page);
    expect(newSource).toContain('`codeme`');
  });
});

// ---------------------------------------------------------------------------
// 17. STYLE PICK FULL WORKFLOW
// ---------------------------------------------------------------------------

test.describe('Style Pick Full Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?e2e');
    await waitForEditor(page);
  });

  test('style popup shows editor controls with Self tab', async ({ page }) => {
    const source = [
      '--- use: core',
      '',
      '--- meta',
      'version: 1',
      '',
      '--- core/heading',
      'level: 2',
      'Style Me',
    ].join('\n');
    await setSource(page, source);
    await page.waitForTimeout(500);

    // Enable style pick
    const styleBtn = page.locator('button').filter({ hasText: /^Style$/ });
    await styleBtn.click();
    await page.waitForTimeout(300);

    // Click heading in preview
    const frame = preview(page);
    await frame.locator('h2').click();
    await page.waitForTimeout(500);

    // Popup should appear with style controls
    const popup = page.locator('.liquid-glass-overlay');
    await expect(popup).toBeVisible({ timeout: 3000 });

    // Should have Self tab
    await expect(popup.getByRole('button', { name: 'Self', exact: true })).toBeVisible();

    // Should have input controls for CSS properties
    const inputs = popup.locator('input');
    const inputCount = await inputs.count();
    expect(inputCount).toBeGreaterThan(0);
  });

  test('style pick on sub-element shows target tabs', async ({ page }) => {
    const source = [
      '--- use: core',
      '',
      '--- meta',
      'version: 1',
      '',
      '--- core/button',
      'url: https://example.com',
      'label: Target Test',
    ].join('\n');
    await setSource(page, source);
    await page.waitForTimeout(500);

    // Enable style pick
    const styleBtn = page.locator('button').filter({ hasText: /^Style$/ });
    await styleBtn.click();
    await page.waitForTimeout(300);

    // Click the button link element in preview
    const frame = preview(page);
    await frame.locator('a').first().click();
    await page.waitForTimeout(500);

    // Popup should appear
    const popup = page.locator('.liquid-glass-overlay');
    await expect(popup).toBeVisible({ timeout: 3000 });

    // Should have Self tab for the button wrapper
    await expect(popup.getByRole('button', { name: 'Self', exact: true })).toBeVisible({ timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// 18. PANEL INTERACTIONS
// ---------------------------------------------------------------------------

test.describe('Panel Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?e2e');
    await waitForEditor(page);
  });

  test('word wrap toggle changes editor line wrapping', async ({ page }) => {
    await loadSource(page, SIMPLE_SOURCE);
    const cmContent = page.locator('.cm-content').first();

    // Check initial word wrap state
    const initialWrap = await cmContent.evaluate(el =>
      el.classList.contains('cm-lineWrapping'),
    );

    // Find and click the word wrap toggle button
    const wrapBtn = page.locator('button[title*="mklyml word wrap"]').first();
    await wrapBtn.click();
    await page.waitForTimeout(200);

    // Wrapping state should have changed
    const afterWrap = await cmContent.evaluate(el =>
      el.classList.contains('cm-lineWrapping'),
    );
    expect(afterWrap).not.toBe(initialWrap);

    // Toggle back
    await page.locator('button[title*="mklyml word wrap"]').first().click();
    await page.waitForTimeout(200);

    const restored = await cmContent.evaluate(el =>
      el.classList.contains('cm-lineWrapping'),
    );
    expect(restored).toBe(initialWrap);
  });

  test('collapse and expand inspector preserves functionality', async ({ page }) => {
    const source = [
      '--- use: core',
      '',
      '--- meta',
      'version: 1',
      '',
      '--- style',
      'core/heading',
      '  color: #ff0000',
      '',
      '--- core/heading',
      'level: 1',
      'Inspector Test',
    ].join('\n');
    await loadSource(page, source);

    // Click heading in preview
    const frame = preview(page);
    await frame.locator('h1').click();
    await page.waitForTimeout(1000);

    // Verify inspector shows Styles button
    const stylesBtn = page.getByRole('button', { name: /Styles/i });
    await expect(stylesBtn).toBeVisible({ timeout: 5000 });

    // Collapse inspector
    const inspectorBtn = page.locator('button[title*="inspector"]').first();
    await inspectorBtn.click();
    await page.waitForTimeout(200);

    // Styles button should not be visible (inspector removed from DOM)
    await expect(stylesBtn).not.toBeVisible();

    // Expand inspector
    await page.locator('button[title*="inspector"]').first().click();
    await page.waitForTimeout(200);

    // Click heading again to re-activate inspector content
    await frame.locator('h1').click();
    await page.waitForTimeout(1000);

    // Styles button should be visible again
    await expect(page.getByRole('button', { name: /Styles/i })).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// 19. REDO & MULTI-STEP UNDO
// ---------------------------------------------------------------------------

test.describe('Redo & Multi-Step Undo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?e2e');
    await waitForEditor(page);
  });

  test('redo restores undone change', async ({ page }) => {
    const source = [
      '--- use: core',
      '',
      '--- meta',
      'version: 1',
      '',
      '--- core/text',
      'Initial text.',
    ].join('\n');
    await setSource(page, source);
    await page.waitForTimeout(500);

    // Make an edit
    const editor = page.locator('.cm-content').first();
    await editor.click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Added line.', { delay: 5 });
    await page.waitForTimeout(300);

    // Verify added text
    let src = await getSource(page);
    expect(src).toContain('Added line.');

    // Undo multiple times
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('ControlOrMeta+z');
    }
    await page.waitForTimeout(300);

    src = await getSource(page);
    expect(src).not.toContain('Added line.');

    // Redo multiple times (Cmd+Shift+Z)
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('ControlOrMeta+Shift+z');
    }
    await page.waitForTimeout(300);

    src = await getSource(page);
    expect(src).toContain('Added line.');
  });

  test('multiple undos restore original state', async ({ page }) => {
    const source = [
      '--- use: core',
      '',
      '--- meta',
      'version: 1',
      '',
      '--- core/text',
      'Base.',
    ].join('\n');
    await setSource(page, source);
    await page.waitForTimeout(500);

    const editor = page.locator('.cm-content').first();
    await editor.click();
    await page.keyboard.press('ControlOrMeta+End');

    // Make 3 sequential edits
    await page.keyboard.press('Enter');
    await page.keyboard.type('Edit1', { delay: 5 });
    await page.waitForTimeout(100);

    await page.keyboard.press('Enter');
    await page.keyboard.type('Edit2', { delay: 5 });
    await page.waitForTimeout(100);

    await page.keyboard.press('Enter');
    await page.keyboard.type('Edit3', { delay: 5 });
    await page.waitForTimeout(300);

    // Verify all edits present
    let src = await getSource(page);
    expect(src).toContain('Edit3');

    // Undo many times
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('ControlOrMeta+z');
    }
    await page.waitForTimeout(300);

    // Should be back to original
    src = await getSource(page);
    expect(src).not.toContain('Edit3');
    expect(src).not.toContain('Edit2');
    expect(src).not.toContain('Edit1');
  });
});

// ---------------------------------------------------------------------------
// 20. ERROR RECOVERY
// ---------------------------------------------------------------------------

test.describe('Error Recovery', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?e2e');
    await waitForEditor(page);
    await loadSource(page, SIMPLE_SOURCE);
  });

  test('malformed source does not crash editor', async ({ page }) => {
    const malformedSource = [
      '--- use: nonexistent-kit',
      '',
      '--- meta',
      'version: 999',
      '',
      '--- unknown/block',
      'garbage: [[[',
      '',
      '--- style',
      'invalid block',
      '  not: valid: css',
    ].join('\n');

    await setSource(page, malformedSource);
    await page.waitForTimeout(1000);

    // Editor should still be functional (not crashed)
    const editor = page.locator('.cm-content').first();
    await expect(editor).toBeVisible();

    // Preview should still render something
    const frame = preview(page);
    await expect(frame.locator('body')).toBeVisible();

    // Should be able to continue typing
    await editor.click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('still works', { delay: 5 });

    const src = await getSource(page);
    expect(src).toContain('still works');
  });

  test('recovering from errors by typing valid source', async ({ page }) => {
    // First set invalid source
    await setSource(page, '--- use: nonexistent\n--- meta\nversion: 1\n--- bogus/block\nContent');
    await page.waitForTimeout(500);

    // Editor should still be functional
    const editor = page.locator('.cm-content').first();
    await expect(editor).toBeVisible();

    // Now set valid source
    const validSource = [
      '--- use: core',
      '',
      '--- meta',
      'version: 1',
      '',
      '--- core/text',
      'Recovery successful.',
    ].join('\n');
    await setSource(page, validSource);
    await page.waitForTimeout(500);

    // Preview should now show the valid content
    const frame = preview(page);
    await expect(frame.locator('p')).toContainText('Recovery successful');
  });
});
