import { existsSync } from "node:fs";
import { chromium, expect, type Page } from "@playwright/test";
import { delay, run, step, withServer } from "./process";

export async function runGeneratedProjectE2e(projectDir: string, options: { headed: boolean }) {
  await step("Install generated project dependencies", () => run("bun", ["install"], projectDir));
  await step("Type check generated project", () => run("bun", ["run", "check"], projectDir));

  if (!existsSync(chromium.executablePath())) {
    await step("Install Playwright Chromium", () =>
      run("bunx", ["playwright", "install", "chromium"])
    );
  }

  const browser = await launchChromium(options);
  const page = await browser.newPage();

  try {
    await step("Render generated project in dev server", () => {
      return withServer(projectDir, "dev", async (url) => {
        await assertGeneratedPage(page, url, options);
      });
    });

    await step("Build generated project", () => run("bun", ["run", "build"], projectDir));

    await step("Render generated project in preview server", () => {
      return withServer(projectDir, "preview", async (url) => {
        await assertGeneratedPage(page, url, options);
      });
    });
  } finally {
    await browser.close();
  }
}

async function assertGeneratedPage(page: Page, url: string, options: { headed: boolean }) {
  await gotoWhenReady(page, url);
  await expect(page.getByRole("heading", { name: /You've made it/ })).toBeVisible();
  await expect(page.getByText("successfully installed Quaff")).toBeVisible();
  await expect(page.locator(".q-field").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Click me" })).toBeVisible();
  await expect(page.locator(".q-field").first()).toHaveCSS("display", "flex");
  await expect(page.getByRole("button", { name: "Click me" })).toHaveCSS("border-radius", "20px");

  if (options.headed) {
    await delay(3_000);
  }
}

async function gotoWhenReady(page: Page, url: string) {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < 60_000) {
    try {
      await page.goto(url);
      return;
    } catch (error) {
      lastError = error;
      await delay(500);
    }
  }

  throw new Error(`Server did not render ${url}: ${String(lastError)}`);
}

async function launchChromium(options: { headed: boolean }) {
  return chromium.launch({ headless: !options.headed });
}
