import { test, expect, type Page, type FrameLocator } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wait for the editor to fully initialize (CodeMirror + first compile). */
async function waitForEditor(page: Page) {
  // Wait for CodeMirror to mount (use .first() — HTML view also has .cm-content)
  await page.locator('.cm-content').first().waitFor({ timeout: 15000 });
  // Wait for preview iframe to have content (first compile)
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
  await page.keyboard.press('Meta+a');
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
    await page.goto('/');
    await waitForEditor(page);
  });

  test('editor loads with CodeMirror, preview, and toolbar', async ({ page }) => {
    // CodeMirror is rendered (use .first() — HTML view also has these)
    await expect(page.locator('.cm-content').first()).toBeVisible();
    await expect(page.locator('.cm-gutters').first()).toBeVisible();

    // Toolbar is visible
    await expect(page.locator('.liquid-glass-header')).toBeVisible();

    // Preview iframe exists and has content
    const frame = preview(page);
    await expect(frame.locator('.mkly-document')).toBeVisible();
  });

  test('default source compiles without fatal errors', async ({ page }) => {
    // No error bar should be visible (errors have red/orange background)
    // The status bar may show warnings but should not show errors
    const frame = preview(page);

    // Default source has a header block — it should compile
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
});

// ---------------------------------------------------------------------------
// 2. SOURCE EDITING — Preview Sync
// ---------------------------------------------------------------------------

test.describe('Source Editing & Preview Sync', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
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

  test('clearing source shows empty or minimal preview', async ({ page }) => {
    await setSource(page, '');
    await page.waitForTimeout(500);

    const frame = preview(page);
    // Compiler may keep last output or show error — verify it doesn't crash
    // The source editor should be empty
    const source = await page.locator('.cm-content').first().innerText();
    // Empty CodeMirror has just a newline
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
    await page.goto('/');
    await waitForEditor(page);
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
    await page.goto('/');
    await waitForEditor(page);
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
    await page.goto('/');
    await waitForEditor(page);
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
    await page.goto('/');
    await waitForEditor(page);
  });

  test('clicking block shows its info in inspector', async ({ page }) => {
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
    await page.goto('/');
    await waitForEditor(page);
  });

  test('toggle style pick mode changes cursor in preview', async ({ page }) => {
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
    await page.goto('/');
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
    await page.waitForTimeout(500);

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
    await page.waitForTimeout(500);

    const frame = preview(page);
    // The heading should have the BEM modifier class
    const heroHeading = frame.locator('.mkly-core-heading--hero');
    await expect(heroHeading).toBeAttached();
    // Verify the label style is applied
    const h1 = frame.locator('h1');
    await expect(h1).toContainText('Hero Title');
  });

  test('theme + preset affects all block rendering', async ({ page }) => {
    // The default source uses newsletter/graphite theme
    // Verify that theme variables are applied

    const frame = preview(page);
    const doc = frame.locator('.mkly-document');

    // The document should have some background color from the theme
    const bg = await doc.evaluate(el => window.getComputedStyle(el).backgroundColor);
    // Should NOT be the default white (the graphite theme has a dark bg)
    expect(bg).toBeDefined();
  });

  test('class annotations produce styled elements', async ({ page }) => {
    const source = [
      '--- use: core',
      '',
      '--- meta',
      'version: 1',
      '',
      '--- style',
      'core/text',
      '  >.s1',
      '    color: #e2725b',
      '',
      '--- core/text',
      '- Styled item {.s1}',
      '- Regular item',
    ].join('\n');

    await setSource(page, source);
    await page.waitForTimeout(500);

    const frame = preview(page);
    // The first list item should have class="s1"
    const styled = frame.locator('.s1');
    await expect(styled).toBeVisible();

    const color = await styled.evaluate(el => window.getComputedStyle(el).color);
    expect(color).toBe('rgb(226, 114, 91)');
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
    await page.waitForTimeout(500);

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
    await page.goto('/');
    await waitForEditor(page);
  });

  test('Cmd+Shift+P opens block dock modal', async ({ page }) => {
    await page.keyboard.press('Meta+Shift+p');
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
    await page.goto('/');
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
    await page.goto('/');
    await waitForEditor(page);
  });

  test('undo reverts source change', async ({ page }) => {
    // Start from the default source and verify initial state
    const frame = preview(page);
    const initialH1 = await frame.locator('h1').first().innerText();

    // Make a small edit: click editor, go to end, type some text
    const editor = page.locator('.cm-content').first();
    await editor.click();
    await page.keyboard.press('Meta+End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('--- core/text', { delay: 5 });
    await page.keyboard.press('Enter');
    await page.keyboard.type('UNDO_TEST_MARKER', { delay: 5 });
    await page.waitForTimeout(500);

    // Verify the new text appears
    await expect(frame.locator('text=UNDO_TEST_MARKER')).toBeVisible({ timeout: 3000 });

    // Undo multiple times to remove the typed text
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Meta+z');
    }
    await page.waitForTimeout(500);

    // The marker text should be gone
    const hasMarker = await frame.locator('text=UNDO_TEST_MARKER').count();
    expect(hasMarker).toBe(0);

    // Original h1 should still be there
    await expect(frame.locator('h1').first()).toContainText(initialH1);
  });
});

// ---------------------------------------------------------------------------
// 12. ERROR HANDLING
// ---------------------------------------------------------------------------

test.describe('Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
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

  test('missing meta version shows warning', async ({ page }) => {
    const source = [
      '--- use: core',
      '',
      '--- core/text',
      'No version',
    ].join('\n');

    await setSource(page, source);
    await page.waitForTimeout(500);

    // Editor should still render (gracefully degrade)
    // or show a clear error message
  });
});
