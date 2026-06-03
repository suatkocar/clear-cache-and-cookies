import { createWriteStream, readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ZipArchive } from 'archiver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const distDir = join(rootDir, 'dist');
const releasesDir = join(rootDir, 'releases');

// Read version from manifest
const manifest = JSON.parse(readFileSync(join(distDir, 'manifest.json'), 'utf8'));
const version = manifest.version;

mkdirSync(releasesDir, { recursive: true });
const zipName = `clear-cache-cookies-v${version}.zip`;
const outputPath = join(releasesDir, zipName);
const output = createWriteStream(outputPath);
// archiver 8 is class-based (no default export); use the format-specific
// ZipArchive class (the generic Archiver wrapper doesn't wire up the module).
const archive = new ZipArchive({ zlib: { level: 9 } });

output.on('close', () => {
  console.log(`✓ Created ${archive.pointer()} bytes`);
  console.log(`✓ Extension package: releases/${zipName}`);
});

archive.on('error', (err) => {
  throw err;
});

archive.pipe(output);
archive.directory(distDir, false);
archive.finalize();
