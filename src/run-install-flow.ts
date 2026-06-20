import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "./args";
import { createGeneratedProject } from "./create-project";
import { runGeneratedProjectE2e } from "./e2e";
import { installCreateQuaff, packCreateQuaff, packQuaff, patchQuaffDependency } from "./packages";
import { step } from "./process";

const options = parseArgs(process.argv.slice(2));
const workRoot = await mkdtemp(join(tmpdir(), "quaff-install-flow-"));
const projectDir = join(workRoot, "app");

try {
  let createQuaffPackage: string | undefined;
  let quaffPackage: string | undefined;

  if (options.createQuaffSource) {
    const sourceDir = options.createQuaffSource;

    createQuaffPackage = await step("Pack local create-quaff", () =>
      packCreateQuaff(sourceDir, workRoot)
    );
  }

  if (options.quaffSource) {
    const sourceDir = options.quaffSource;

    quaffPackage = await step("Pack local Quaff", () => packQuaff(sourceDir, workRoot));
  }

  const createQuaffBin = await step("Install create-quaff runner", () =>
    installCreateQuaff(workRoot, createQuaffPackage ? `file:${createQuaffPackage}` : undefined)
  );

  await step("Create generated project", () =>
    createGeneratedProject({ createQuaffBin, projectDir, workRoot })
  );

  if (quaffPackage) {
    await step("Use local Quaff package", () => patchQuaffDependency(projectDir, quaffPackage));
  }

  await runGeneratedProjectE2e(projectDir, { headed: options.headed });
  console.log(`Install flow e2e passed: ${projectDir}`);
} finally {
  if (options.keep) {
    console.log(`Kept smoke project: ${projectDir}`);
  } else {
    await rm(workRoot, { recursive: true, force: true });
  }
}
