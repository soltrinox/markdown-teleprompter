import { test, expect } from "@playwright/test";

const script = "# Introduction\n\nOne two three four five six seven eight nine ten.\n\n## Second chapter\n\nAnother sentence for the second chapter.\n\nInline math: $x^2$.\n";

async function load(page, content = script, name = "script.md") {
  await page.locator("#file-input").setInputFiles({
    name, mimeType: "text/plain", buffer: Buffer.from(content),
  });
  await expect(page.locator("#content .prompter-word").first()).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("loads Markdown, math and outline without uploading the document", async ({ page }) => {
  const requests = [];
  page.on("request", (request) => {
    if (["fetch", "xhr"].includes(request.resourceType()) || request.method() !== "GET") {
      requests.push(request.url());
    }
  });
  await load(page);
  await expect(page.locator("#content h1")).toHaveText("Introduction");
  await expect(page.locator("#content .katex")).toHaveCount(1);
  await expect(page.locator("#outline .outline-link")).toHaveCount(2);
  expect(requests).toEqual([]);
});

test("plays, advances and stays paused", async ({ page }) => {
  await load(page);
  await page.locator("#btn-play").click();
  await expect(page.locator("#btn-pause")).toBeEnabled();
  await expect(page.locator(".prompter-phrase-last")).not.toHaveText("Introduction");
  await page.locator("#btn-pause").click();
  const highlighted = await page.locator(".prompter-phrase-last").textContent();
  await page.waitForTimeout(750);
  await expect(page.locator(".prompter-phrase-last")).toHaveText(highlighted);
  await expect(page.locator("#btn-play")).toBeEnabled();
});

test("adjusts speed, clamps at bounds and persists after reload", async ({ page }) => {
  await page.locator("#btn-speed-down").click();
  await expect(page.locator("#speed")).toHaveValue("550");
  await page.locator("#speed").fill("200");
  await page.locator("#speed").dispatchEvent("input");
  await expect(page.locator("#btn-speed-down")).toBeDisabled();
  await page.reload();
  await expect(page.locator("#speed")).toHaveValue("200");
  await page.locator("#speed").fill("2000");
  await page.locator("#speed").dispatchEvent("input");
  await expect(page.locator("#btn-speed-up")).toBeDisabled();
});

test("jumps to chapters and navigates sentences", async ({ page }, testInfo) => {
  await load(page);
  const mobile = testInfo.project.name === "mobile-chromium";
  if (mobile) await page.locator("details summary").click();
  const nav = page.locator(mobile ? "#outline-mobile" : "#outline");
  await nav.getByRole("link", { name: "Second chapter", exact: true }).click();
  if (mobile) await page.locator("details summary").click();
  await expect(page.locator(".prompter-phrase-last")).toHaveText("chapter");
  await expect(page.locator("#btn-play")).toBeEnabled();
  await page.locator("#btn-next").click();
  await expect(page.locator(".prompter-phrase-last")).toHaveText("for");
  await page.locator("#btn-prev").click();
  await expect(page.locator(".prompter-phrase-last")).toHaveText("chapter");
});

test("reads text and removes executable HTML from Markdown", async ({ page }) => {
  await load(page, "Plain text for reading.", "script.txt");
  await expect(page.locator("#content")).toHaveText("Plain text for reading.");
  await load(page, '# Safe\n\n<script>window.compromised = true</script>\n\n<a href="javascript:window.compromised=true" onclick="window.compromised=true">Unsafe link</a>');
  await expect(page.locator("#content script, #content [onclick], #content [href^='javascript:']")).toHaveCount(0);
  expect(await page.evaluate(() => window.compromised)).toBeUndefined();
});
