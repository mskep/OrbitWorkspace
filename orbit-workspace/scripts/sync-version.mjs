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

const requestedVersion = (process.argv[2] || '').trim();
const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function readJson(relativePath) {
  const filePath = path.join(rootDir, relativePath);
  const raw = fs.readFileSync(filePath, 'utf8');
  return { filePath, data: JSON.parse(raw) };
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function ensureSemver(version) {
  if (!semverPattern.test(version)) {
    throw new Error(`Invalid semver version: "${version}"`);
  }
}

try {
  const rootPackage = readJson(packageFiles[0]);
  const targetVersion = requestedVersion || rootPackage.data.version;
  ensureSemver(targetVersion);

  let changedCount = 0;

  if (rootPackage.data.version !== targetVersion) {
    rootPackage.data.version = targetVersion;
    writeJson(rootPackage.filePath, rootPackage.data);
    changedCount += 1;
  }

  for (let i = 1; i < packageFiles.length; i += 1) {
    const pkg = readJson(packageFiles[i]);
    if (pkg.data.version !== targetVersion) {
      pkg.data.version = targetVersion;
      writeJson(pkg.filePath, pkg.data);
      changedCount += 1;
    }
  }

  if (changedCount === 0) {
    console.log(`Version already consistent at ${targetVersion}`);
  } else {
    console.log(`Synchronized version to ${targetVersion} across ${changedCount} file(s)`);
  }
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
