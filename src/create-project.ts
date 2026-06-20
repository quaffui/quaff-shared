import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cleanup, render } from "cli-testing-library";
import { delay, stop } from "./process";

export async function createGeneratedProject(options: {
  createQuaffBin: string;
  projectDir: string;
  workRoot: string;
}) {
  const cli = await render(options.createQuaffBin, [], {
    cwd: options.workRoot,
    spawnOpts: { env: withoutCi(process.env) },
  });

  const answer = async (prompt: string, value: string) => {
    await cli.findByText(prompt, { exact: false, stripAnsi: true }, { timeout: 60_000 });

    console.log(`create-quaff: ${prompt} -> ${formatCliInput(value)}`);

    await cli.userEvent.keyboard(value, { delay: 1 });
  };

  try {
    await answer("What is the name of your project?", "Quaff Smoke[Enter]");
    await answer("Where should your project be created?", "app[Enter]");
    await answer("Pick a language", "[Enter]");
    await answer("Package name (package.json)?", "quaff-smoke[Enter]");
    await answer("Add a CSS preprocessor?", "[Enter]");
    await answer("Add optional features?", "[Enter]");
    await answer("Install dependencies now?", "[ArrowUp][Enter]");

    await waitForGeneratedProject(options.projectDir);
  } catch (error) {
    cli.debug(20_000);
    throw error;
  } finally {
    await stop(cli.process);
    await cleanup();
  }
}

function formatCliInput(value: string) {
  return value.replaceAll("[", "<").replaceAll("]", ">");
}

function withoutCi(env: NodeJS.ProcessEnv) {
  const next = { ...env };
  delete next.CI;

  return next;
}

async function waitForGeneratedProject(projectDir: string) {
  const MAX_RETRIES = 120;
  const DELAY_MS = 500;

  for (let curRetries = 0; curRetries < MAX_RETRIES; curRetries++) {
    if (await isProjectReady(projectDir)) {
      return;
    }

    await delay(DELAY_MS);
  }

  throw new Error("Generated project was not completed");
}

async function isProjectReady(projectDir: string): Promise<boolean> {
  try {
    const [packageJson, viteConfig, layout, page] = await Promise.all([
      readFile(join(projectDir, "package.json"), "utf8"),
      readFile(join(projectDir, "vite.config.ts"), "utf8"),
      readFile(join(projectDir, "src/routes/+layout.svelte"), "utf8"),
      readFile(join(projectDir, "src/routes/+page.svelte"), "utf8"),
    ]);

    return (
      packageJson.includes('"@quaffui/quaff"') &&
      viteConfig.includes("quaffCss()") &&
      layout.includes("Quaff.init()") &&
      page.includes("You've made it.")
    );
  } catch {}

  return false;
}
