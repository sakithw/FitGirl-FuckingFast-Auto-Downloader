import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const chrome = process.env.CHROME_PATH || [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium"
].find(existsSync);

if (!chrome) {
  console.error("Chrome not found. Set CHROME_PATH to a Chrome executable.");
  process.exit(1);
}

const server = createServer((request, response) => {
  const path = resolve(projectRoot, `.${decodeURIComponent(new URL(request.url, "http://localhost").pathname)}`);
  if (!path.startsWith(projectRoot + sep) || !existsSync(path)) {
    response.writeHead(404).end();
    return;
  }
  const type = path.endsWith(".js") ? "text/javascript" : path.endsWith(".html") ? "text/html" :
    path.endsWith(".css") ? "text/css" : path.endsWith(".png") ? "image/png" : "text/plain";
  response.writeHead(200, { "Content-Type": type === "image/png" ? type : `${type}; charset=utf-8` });
  response.end(readFileSync(path));
});

await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
const profile = mkdtempSync(join(tmpdir(), "ffad-test-"));
const url = `http://127.0.0.1:${server.address().port}/tests/browser/runner.html`;

try {
  const output = await new Promise((resolveRun, rejectRun) => {
    const child = spawn(chrome, [
      "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
      `--user-data-dir=${profile}`, "--virtual-time-budget=15000", "--dump-dom", url
    ], { windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => { child.kill(); rejectRun(new Error("Chrome test timed out")); }, 30000);
    child.stdout.on("data", (data) => { stdout += data; });
    child.stderr.on("data", (data) => { stderr += data; });
    child.on("error", (error) => { clearTimeout(timer); rejectRun(error); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) rejectRun(new Error(`Chrome exited ${code}: ${stderr.slice(-1000)}`));
      else resolveRun(stdout);
    });
  });
  const match = output.match(/<pre id="results">(\{[^<]*\})<\/pre>/);
  if (!match) throw new Error("Browser tests did not report results");
  const result = JSON.parse(match[1]);
  if (!Number.isInteger(result.registered) || result.registered !== result.executed ||
      result.executed !== result.passed + result.failed || result.failed !== result.failures.length ||
      result.skipped !== 0) throw new Error("Test accounting is incomplete or inconsistent");
  mkdirSync(join(projectRoot, "dist"), { recursive: true });
  writeFileSync(join(projectRoot, "dist", "test-results.json"), JSON.stringify(result, null, 2) + "\n");
  console.log(`Tests: registered=${result.registered}; executed=${result.executed}; passed=${result.passed}; failed=${result.failed}; skipped=${result.skipped}`);
  if (result.failures.length) {
    for (const failure of result.failures) console.error(failure);
    process.exitCode = 1;
  }
} finally {
  server.close();
  if (!resolve(profile).startsWith(resolve(tmpdir()) + sep) || !profile.split(sep).at(-1).startsWith("ffad-test-")) {
    throw new Error("Refusing to remove a profile outside the intended temporary directory");
  }
  rmSync(profile, { recursive: true, force: true });
}
