// `output: "standalone"` does not copy public/ and .next/static/ next to server.js,
// so `node .next/standalone/server.js` served pages without CSS/JS/images.
// Runs after `next build`; works on Railway, Hostinger Node.js apps and locally.
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");
if (!fs.existsSync(standalone)) {
  console.log("[copy-standalone-assets] no .next/standalone (not a standalone build) — skipped");
  process.exit(0);
}
const copy = (from, to) => {
  if (!fs.existsSync(from)) return;
  fs.cpSync(from, to, { recursive: true, force: true });
  console.log(`[copy-standalone-assets] ${path.relative(root, from)} -> ${path.relative(root, to)}`);
};
copy(path.join(root, "public"), path.join(standalone, "public"));
copy(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"));
