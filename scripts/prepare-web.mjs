import { mkdirSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'app.html');
const webDir = join(root, 'www');

if (!existsSync(src)) {
  console.error(`prepare-web: missing ${src}`);
  process.exit(1);
}

rmSync(webDir, { recursive: true, force: true });
mkdirSync(webDir, { recursive: true });
copyFileSync(src, join(webDir, 'index.html'));

console.log(`prepare-web: app.html -> ${webDir}/index.html`);
