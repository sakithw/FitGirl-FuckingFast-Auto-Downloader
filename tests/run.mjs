import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
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
  const type = path.endsWith(".js") ? "text/javascript" : path.endsWith(".html") ? "text/html" : "text/plain";
  response.writeHead(200, { "Content-Type": `${type}; charset=utf-8` });
  response.end(readFileSync(path));
});

await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
const profile = mkdtempSync(join(tmpdir(), "ffad-test-"));
const url = `http://127.0.0.1:${server.address().port}/tests/browser/runner.html`;

try {
  const output = await new Promise((resolveRun, rejectRun) => {
    const child = spawn(chrome, [
      "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
      `--user-data-dir=${profile}`, "--virtual-time-budget=3000", "--dump-dom", url
    ], { windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => { child.kill(); rejectRun(new Error("Chrome test timed out")); }, 20000);
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
  console.log(`${result.passed} browser tests passed`);
  if (result.failures.length) {
    for (const failure of result.failures) console.error(failure);
    process.exitCode = 1;
  }
} finally {
  server.close();
  rmSync(profile, { recursive: true, force: true });
}
