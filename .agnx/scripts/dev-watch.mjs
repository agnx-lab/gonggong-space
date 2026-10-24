#!/usr/bin/env node
// 场景：共工空间胶水调试 — 改 .agnx/src 后重新打包并写 .agnx-debug-rev。
import { spawn } from "node:child_process";
import { watch } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const agnxDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appDir = path.resolve(agnxDir, "..");
const revPath = path.join(appDir, ".agnx-debug-rev");

let revision = 0;
let writing = false;
let building = false;

async function runBuild() {
  if (building) {
    return;
  }
  building = true;
  try {
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [path.join(agnxDir, "scripts/build.mjs")], {
        cwd: agnxDir,
        stdio: "inherit",
      });
      child.on("exit", (code) => {
        if (code === 0) {
          resolve(undefined);
        } else {
          reject(new Error(`build exit ${code}`));
        }
      });
    });
  } finally {
    building = false;
  }
}

async function bump(reason) {
  if (writing) {
    return;
  }
  writing = true;
  revision += 1;
  try {
    await runBuild();
    await writeFile(
      revPath,
      `${JSON.stringify({ revision, reason, at: new Date().toISOString() })}\n`,
      "utf8",
    );
    console.log(`[gonggong dev-watch] rev=${revision} (${reason})`);
  } catch (error) {
    console.error("[gonggong dev-watch] build failed", error);
  } finally {
    writing = false;
  }
}

await bump("start");
watch(path.join(agnxDir, "src"), { recursive: true }, (_event, filename) => {
  void bump(filename ? String(filename) : "src");
});
console.log("[gonggong dev-watch] 调试会话常驻。Ctrl+C 结束。");
