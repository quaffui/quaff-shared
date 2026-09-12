import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { delay, run } from "./process";

export async function packQuaff(sourceDir: string, workRoot: string) {
  return await packSource({
    buildArgs: ["run", "build"],
    packDirName: "quaff-pack",
    sourceDir,
    workRoot,
  });
}

export async function packCreateQuaff(sourceDir: string, workRoot: string) {
  return await packSource({
    buildArgs: ["run", "prepublishOnly"],
    packDirName: "create-quaff-pack",
    sourceDir,
    workRoot,
  });
}

export async function installCreateQuaff(workRoot: string, packageSpec = "latest") {
  const runnerDir = join(workRoot, "create-quaff-runner");

  await mkdir(runnerDir, { recursive: true });
  await writeFile(
    join(runnerDir, "package.json"),
    JSON.stringify({ private: true, devDependencies: { "create-quaff": packageSpec } }, null, 2)
  );
  await run("bun", ["install"], runnerDir);

  return join(runnerDir, "node_modules/.bin/create-quaff");
}

export async function patchQuaffDependency(projectDir: string, quaffPackage: string) {
  const packageJsonPath = join(projectDir, "package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
    devDependencies?: Record<string, string>;
  };

  packageJson.devDependencies ??= {};
  packageJson.devDependencies["@quaffui/quaff"] = quaffPackage;

  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
  console.log(`@quaffui/quaff -> ${quaffPackage}`);
}

export async function waitForPublishedPackage(name: string, version: string) {
  const deadline = Date.now() + 10 * 60_000;
  const url = `https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, {
        headers: { "Cache-Control": "no-cache" },
        signal: AbortSignal.timeout(Math.max(1, Math.min(30_000, deadline - Date.now()))),
      });
      const metadata = (await response.json()) as { version?: string };

      if (response.ok && metadata.version === version) return;
    } catch {
      // Retry transient network and registry errors.
    }

    console.log(`Waiting for ${name}@${version} on npm...`);
    await delay(Math.max(0, Math.min(30_000, deadline - Date.now())));
  }

  throw new Error(`Timed out after 10 minutes waiting for ${name}@${version} on npm`);
}

async function packSource(options: {
  buildArgs: string[];
  packDirName: string;
  sourceDir: string;
  workRoot: string;
}) {
  const sourceDir = resolve(options.sourceDir);
  const packDir = join(options.workRoot, options.packDirName);

  await mkdir(packDir, { recursive: true });
  await run("bun", ["install", "--frozen-lockfile"], sourceDir);
  await run("bun", options.buildArgs, sourceDir);
  await run("bun", ["pm", "pack", "--destination", packDir], sourceDir);

  return await findNewestTarball(packDir);
}

async function findNewestTarball(packDir: string) {
  const files = await readdir(packDir);
  const tarballs = await Promise.all(
    files
      .filter((file) => file.endsWith(".tgz"))
      .map(async (file) => {
        const path = join(packDir, file);
        const info = await stat(path);
        return { path, mtime: info.mtimeMs };
      })
  );

  const newest = tarballs.sort((a, b) => b.mtime - a.mtime)[0];

  if (!newest) {
    throw new Error(`No package tarball found in ${packDir}`);
  }

  return newest.path;
}
