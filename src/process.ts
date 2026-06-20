import { type ChildProcess, spawn } from "node:child_process";
import net from "node:net";
import { join } from "node:path";

export async function step<T>(title: string, action: () => Promise<T>) {
  if (process.env.GITHUB_ACTIONS) {
    console.log(`::group::${title}`);
  } else {
    console.log(`\n--- ${title}`);
  }

  try {
    const result = await action();

    if (!process.env.GITHUB_ACTIONS) {
      console.log(`OK ${title}`);
    }

    return result;
  } catch (error) {
    if (!process.env.GITHUB_ACTIONS) {
      console.error(`FAIL ${title}`);
    }

    throw error;
  } finally {
    if (process.env.GITHUB_ACTIONS) {
      console.log("::endgroup::");
    }
  }
}

export function run(command: string, args: string[], cwd = process.cwd()) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, CI: "1" },
      stdio: "inherit",
    });

    child.once("error", reject);

    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} failed with ${signal ?? code}`));
      }
    });
  });
}

export async function withServer(
  cwd: string,
  script: "dev" | "preview",
  callback: (url: string) => Promise<void>
) {
  const port = await getOpenPort();

  const child = spawn(
    viteBin(cwd),
    [script, "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    {
      cwd,
      env: { ...process.env, CI: "1" },
      stdio: "inherit",
    }
  );

  try {
    await callback(`http://127.0.0.1:${port}/`);
  } finally {
    await stop(child);
  }
}

export function stop(child: ChildProcess) {
  return new Promise<void>((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }

    const timeout = setTimeout(() => child.kill("SIGKILL"), 5_000);

    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });

    child.kill("SIGTERM");
  });
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getOpenPort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();

    server.once("error", reject);

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      server.close(() => {
        if (address && typeof address === "object") {
          resolve(address.port);
        } else {
          reject(new Error("Could not allocate a local port"));
        }
      });
    });
  });
}

function viteBin(cwd: string) {
  const bin = process.platform === "win32" ? "vite.cmd" : "vite";
  return join(cwd, "node_modules", ".bin", bin);
}
