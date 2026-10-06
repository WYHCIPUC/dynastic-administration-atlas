import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const staticDir = join(root, '.next', 'static');
const target = join(root, '.next', 'standalone', '.next', 'static');

if (!existsSync(staticDir)) {
  console.error('Missing .next/static — run `next build` first.');
  process.exit(1);
}

let copied = 0;
function copyDir(from, to) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from)) {
    const source = join(from, entry);
    const dest = join(to, entry);
    if (statSync(source).isDirectory()) copyDir(source, dest);
    else { copyFileSync(source, dest); copied += 1; }
  }
}

copyDir(staticDir, target);
console.log(`Copied ${copied} files from .next/static into .next/standalone so \`npm start\` serves client assets.`);
