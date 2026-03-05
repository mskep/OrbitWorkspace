import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const packageFiles = [
  'package.json',
  'apps/server/package.json',
  'apps/desktop/renderer/package.json',
];

function readVersion(relativePath) {
  const filePath = path.join(rootDir, relativePath);
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  return { relativePath, version: parsed.version };
}

try {
  const versions = packageFiles.map(readVersion);
  const expected = versions[0].version;

  const mismatches = versions.filter((entry) => entry.version !== expected);

  if (mismatches.length > 0) {
    console.error(`Version mismatch detected. Expected "${expected}" everywhere.`);
    for (const entry of versions) {
      console.error(` - ${entry.relativePath}: ${entry.version}`);
    }
    process.exit(1);
  }

  console.log(`Version consistency check passed (${expected})`);
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
