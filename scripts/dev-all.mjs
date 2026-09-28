import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadEnv } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = { ...loadEnv("development", root, ""), ...process.env };
const backend = path.resolve(
  root,
  env.LEDGER_BACKEND_DIR || "../hisabo-backend",
);
const windows = process.platform === "win32";
const wrapper = path.join(backend, windows ? "mvnw.cmd" : "mvnw");
const endpoint = new URL(env.BACKEND_URL || "http://127.0.0.1:8080");
if (!existsSync(wrapper)) {
  console.error(
    `Backend not found at ${backend}. Put both repositories next to each other, or set LEDGER_BACKEND_DIR.`,
  );
  process.exit(1);
}
if (!["localhost", "127.0.0.1"].includes(endpoint.hostname)) {
  console.error(
    "dev:all starts a local backend. Use a localhost BACKEND_URL, or start the frontend separately with npm run dev.",
  );
  process.exit(1);
}
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.pid) continue;
    try {
      if (windows)
        spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
          stdio: "ignore",
        });
      else process.kill(-child.pid, "SIGTERM");
    } catch {}
  }
  setTimeout(() => process.exit(code), 500).unref();
}
function start(command, args, cwd, extraEnv = {}) {
  const child = spawn(command, args, {
    cwd,
    env: { ...env, ...extraEnv },
    stdio: "inherit",
    detached: !windows,
  });
  children.push(child);
  child.on("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on("exit", (code) => {
    if (!stopping) stop(code ?? 1);
  });
  return child;
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop());
try {
  const already = await fetch(new URL("/api/health", endpoint), {
    signal: AbortSignal.timeout(1000),
  }).catch(() => null);
  if (already) {
    console.error(
      `Port ${endpoint.port || 8080} is already in use. Stop the running backend first, or use npm run dev to connect to it.`,
    );
    process.exit(1);
  }
  console.log("\nStarting Hisabo backend…\n");
  const args = ["spring-boot:run"];
  if (env.MAVEN_REPO_LOCAL)
    args.unshift(`-Dmaven.repo.local=${env.MAVEN_REPO_LOCAL}`);
  if (windows)
    start(
      env.ComSpec || "cmd.exe",
      [
        "/d",
        "/s",
        "/c",
        `""${wrapper}" ${args.map((a) => '"' + a + '"').join(" ")}"`,
      ],
      backend,
      { PORT: endpoint.port || "8080" },
    );
  else start(wrapper, args, backend, { PORT: endpoint.port || "8080" });
  let ready = false;
  for (let attempt = 0; attempt < 180 && !stopping; attempt++) {
    const response = await fetch(new URL("/api/health", endpoint), {
      signal: AbortSignal.timeout(1000),
    }).catch(() => null);
    if (response?.ok) {
      const health = await response.json();
      if (health.application === "Hisabo") {
        ready = true;
        break;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) {
    console.error(
      "Backend did not become ready. Check Java 25, JAVA_HOME, and the backend output above.",
    );
    stop(1);
  } else {
    console.log(
      "\nHisabo is ready at http://hisabo.localhost:5173. Opening your browser… Ctrl+C stops both apps.\n",
    );
    start(
      process.execPath,
      [path.join(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1"],
      root,
    );
  }
} catch (error) {
  console.error(error.message);
  stop(1);
}
