#!/usr/bin/env node
// Blocks committed credentials. Zero dependencies. Never prints the secret itself, only file:line and the rule name.
// Real tokens live ONLY in Cloudflare (Workers -> Settings -> Variables and secrets) or GitHub Actions secrets.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");

const PATTERNS = [
  ["Meta/Facebook access token", /\bEAA[A-Za-z0-9]{40,}\b/],
  ["GitHub token", /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b/],
  ["GitHub fine-grained token", /\bgithub_pat_[A-Za-z0-9_]{40,}\b/],
  ["Anthropic API key", /\bsk-ant-[A-Za-z0-9_-]{20,}\b/],
  ["OpenAI-style API key", /\bsk-[A-Za-z0-9]{32,}\b/],
  ["Private key block", /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/],
  ["AWS access key id", /\bAKIA[0-9A-Z]{16}\b/],
  ["Cloudflare API token assignment", /\bCLOUDFLARE_API_TOKEN\s*[=:]\s*["']?[A-Za-z0-9_-]{30,}/],
  ["Generic secret assignment", /\b(?:META_TOKEN|ACCESS_TOKEN|SECRET_KEY|API_SECRET)\s*[=:]\s*["'][A-Za-z0-9_\-./+=]{16,}["']/],
];

const SKIP = /(?:^|\/)(?:pnpm-lock\.yaml|package-lock\.json)$|\.(?:png|jpe?g|webp|avif|gif|ico|woff2?|mp4|pdf|zip)$/i;

const tracked = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
})
  .split("\0")
  .filter(Boolean)
  .filter((file) => !SKIP.test(file));

const findings = [];
for (const file of tracked) {
  let text;
  try {
    text = readFileSync(resolve(root, file), "utf8");
  } catch {
    continue;
  }
  const lines = text.split("\n");
  lines.forEach((line, index) => {
    for (const [name, re] of PATTERNS) {
      if (re.test(line)) findings.push(`${file}:${index + 1}  ${name}`);
    }
  });
}

if (findings.length > 0) {
  console.error(`Possible secrets found (${findings.length}). Remove them, rotate the credential, and keep it in Cloudflare/GitHub secrets only:\n` + findings.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
console.log(`Secret scan passed (${tracked.length} files).`);
