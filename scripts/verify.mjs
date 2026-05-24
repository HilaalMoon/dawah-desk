import { execSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();

const run = (command) => {
  execSync(command, {
    cwd: repoRoot,
    shell: true,
    stdio: "inherit",
  });
};

const fail = (message) => {
  console.error(`VERIFY FAILED: ${message}`);
  process.exit(1);
};

const walk = (dirPath, files = []) => {
  for (const entry of readdirSync(dirPath)) {
    const resolved = path.join(dirPath, entry);
    const stats = statSync(resolved);
    if (stats.isDirectory()) {
      walk(resolved, files);
    } else {
      files.push(resolved);
    }
  }
  return files;
};

const relative = (filePath) => path.relative(repoRoot, filePath).replace(/\\/g, "/");

run("npx.cmd tsc -b");

for (const filePath of [
  "server/index.js",
  "server/ai/service.js",
  "server/quranFoundation.js",
  "server/webFallback.js",
]) {
  run(`node --check "${filePath}"`);
}

const bannedPlaceholderPatterns = [
  {
    file: "server/ai/service.js",
    pattern: "Working English meaning:",
    reason: "server AI service still contains placeholder translation text.",
  },
  {
    file: "server/orchestrator.js",
    pattern: "Working English meaning:",
    reason: "server orchestrator still contains placeholder translation text.",
  },
  {
    file: "src/services/mockAi.ts",
    pattern: "Working English meaning:",
    reason: "frontend mock AI still contains placeholder translation text.",
  },
];

for (const check of bannedPlaceholderPatterns) {
  const contents = readFileSync(path.join(repoRoot, check.file), "utf8");
  if (contents.includes(check.pattern)) {
    fail(`${check.reason} (${check.file})`);
  }
}

for (const filePath of walk(path.join(repoRoot, "docs", "system-documentation"))) {
  const contents = readFileSync(filePath, "utf8");
  if (/\]\(\/C:/i.test(contents)) {
    fail(`system documentation still contains absolute local file links (${relative(filePath)})`);
  }
}

for (const filePath of [
  "server/defaults.js",
  "server/data/runtime-state.json",
  "src/services/backendApi.ts",
]) {
  const contents = readFileSync(path.join(repoRoot, filePath), "utf8");
  if (contents.includes("TODO:")) {
    fail(`unfinished production-facing TODO note remains in ${filePath}`);
  }
}

console.log("Verification passed.");
