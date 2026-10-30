import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

const root = resolve(import.meta.dirname, "..");
const version = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")).version;
if (version !== "1.0.0") throw new Error(`Expected manifest version 1.0.0, found ${version}`);
const files = [
  "manifest.json", "src/background/controller.js", "src/background/service-worker.js",
  "src/content/auto-click.js", "src/content/index.js", "src/content/observer.js",
  "src/hosts/fuckingfast.js", "src/popup/popup.css", "src/popup/popup.html", "src/popup/popup.js",
  "assets/icons/icon-16.png", "assets/icons/icon-32.png", "assets/icons/icon-48.png", "assets/icons/icon-128.png"
];
for (const file of files) if (!existsSync(join(root, file)) || !statSync(join(root, file)).isFile()) throw new Error(`Missing runtime file: ${file}`);
const outDir = join(root, "dist");
mkdirSync(outDir, { recursive: true });
const staging = mkdtempSync(join(tmpdir(), "ffad-release-"));
try {
  for (const file of files) {
    const target = join(staging, file);
    mkdirSync(resolve(target, ".."), { recursive: true });
    writeFileSync(target, readFileSync(join(root, file)));
  }
  const zip = join(outDir, `FitGirl-FuckingFast-Auto-Downloader-v${version}.zip`);
  if (existsSync(zip)) rmSync(zip, { force: true });
  execFileSync("powershell.exe", ["-NoProfile", "-Command", `Compress-Archive -Path '${staging}\\*' -DestinationPath '${zip}' -CompressionLevel Optimal`], { stdio: "inherit" });
  const sha256 = createHash("sha256").update(readFileSync(zip)).digest("hex");
  const report = { version, status: "published-release-candidate", zip: zip.replace(root + sep, ""), sha256, entries: files, extractedChromeUI: "NOT TESTED" };
  writeFileSync(join(outDir, "package-validation.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally {
  const tempRoot = resolve(tmpdir());
  if (!resolve(staging).startsWith(tempRoot + sep) || !staging.split(sep).at(-1).startsWith("ffad-release-")) throw new Error("Refusing to remove unexpected staging path");
  rmSync(staging, { recursive: true, force: true });
}
