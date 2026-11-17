// T-SEC-2: after `next build`, fail if anything that looks like a secret reached the browser bundle.
// Run: npm run build && node scripts/check-client-bundle.mjs
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../.next/static/", import.meta.url));

// Shapes of the credentials this app uses. Values themselves are never read here.
const PATTERNS = [
  ["Google API key", /AIza[0-9A-Za-z_-]{30,}/],
  ["Google OAuth client secret", /GOCSPX-[0-9A-Za-z_-]{20,}/],
  ["Google refresh token", /1\/\/0[0-9A-Za-z_-]{30,}/],
  ["HubSpot key", /pat-(na|eu)\d-[0-9a-f-]{30,}/],
  ["Neon password", /npg_[0-9A-Za-z]{10,}/],
  ["Postgres URL", /postgres(ql)?:\/\/[^\s"']+@/],
  ["Hunter key name", /HUNTER_API_KEY/],
  ["Cron secret name", /CRON_SECRET/],
];

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (/\.(js|css|json|html|txt)$/.test(entry.name)) yield p;
  }
}

let files = 0;
const hits = [];
for await (const file of walk(ROOT)) {
  files++;
  const text = await readFile(file, "utf8");
  for (const [label, re] of PATTERNS) if (re.test(text)) hits.push(`${label} in ${file}`);
}

if (files === 0) {
  console.error("No client bundle found. Run `npm run build` first.");
  process.exit(1);
}
if (hits.length) {
  console.error(`Secret-like strings found in the client bundle:\n${hits.join("\n")}`);
  process.exit(1);
}
console.log(`Client bundle clean: ${files} files checked, no secrets.`);
