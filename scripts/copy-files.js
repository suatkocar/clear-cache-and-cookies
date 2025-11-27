import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const distDir = join(rootDir, 'dist');
const publicDir = join(rootDir, 'public');

// Copy public files to dist
function copyDir(src, dest) {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }

  const entries = readdirSync(src);
  for (const entry of entries) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    const stat = statSync(srcPath);

    if (stat.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

// Copy content.js from public to dist
const contentJsSrc = join(publicDir, 'content.js');
const contentJsDest = join(distDir, 'content.js');

if (existsSync(contentJsSrc)) {
  copyFileSync(contentJsSrc, contentJsDest);
  console.log('✓ Copied content.js');
}

// Copy content.css to dist
const contentCssSrc = join(rootDir, 'src', 'content', 'content.css');
const contentCssDest = join(distDir, 'content.css');

if (existsSync(contentCssSrc)) {
  copyFileSync(contentCssSrc, contentCssDest);
  console.log('✓ Copied content.css');
}

// Copy icons folder
const iconsSrc = join(publicDir, 'icons');
const iconsDest = join(distDir, 'icons');

if (existsSync(iconsSrc)) {
  copyDir(iconsSrc, iconsDest);
  console.log('✓ Copied icons');
}

console.log('✓ Build files copied successfully!');
