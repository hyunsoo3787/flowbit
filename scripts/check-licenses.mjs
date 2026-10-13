#!/usr/bin/env node
// Enforces the dependency license policy (docs/DECISIONS.md, D-013): every
// production dependency must be under a permissive license, except packages
// that were reviewed individually and are listed in REVIEWED_EXCEPTIONS.
import { execFileSync } from 'node:child_process';

const PERMISSIVE = new Set([
  '0BSD',
  'Apache-2.0',
  'BlueOak-1.0.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'CC-BY-4.0',
  'CC0-1.0',
  'ISC',
  'MIT',
  'MIT-0',
  'PostgreSQL',
  'Python-2.0',
  'Unlicense',
]);

/**
 * Weak-copyleft packages that are used unmodified, as separate files, and are
 * not linked into Flowbit's own code. Each entry needs a reason; add new ones
 * only after review.
 */
const REVIEWED_EXCEPTIONS = {
  elkjs:
    'EPL-2.0. Graph layout inside Prisma Studio, shipped unmodified with the Prisma CLI that runs migrations.',
  lightningcss:
    'MPL-2.0. CSS build tool pulled in through Vite/Vitest peer dependencies; not used at runtime.',
};
const EXCEPTION_PREFIXES = ['lightningcss-'];

function isPermissive(expression) {
  const cleaned = expression.replace(/[()]/g, '').trim();
  if (/ OR /i.test(cleaned)) return cleaned.split(/ OR /i).some(isPermissive);
  if (/ AND /i.test(cleaned)) return cleaned.split(/ AND /i).every(isPermissive);
  return PERMISSIVE.has(cleaned);
}

function isReviewed(name) {
  return (
    name in REVIEWED_EXCEPTIONS || EXCEPTION_PREFIXES.some((prefix) => name.startsWith(prefix))
  );
}

const output = execFileSync('pnpm', ['licenses', 'list', '--prod', '--json'], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
const byLicense = JSON.parse(output);

const violations = [];
let checked = 0;
for (const [license, packages] of Object.entries(byLicense)) {
  for (const pkg of packages) {
    checked += 1;
    if (isPermissive(license) || isReviewed(pkg.name)) continue;
    violations.push(`${pkg.name}@${pkg.versions.join(', ')}: ${license}`);
  }
}

if (violations.length > 0) {
  console.error(`License check failed for ${violations.length} package(s):`);
  for (const violation of violations) console.error(`  - ${violation}`);
  console.error('\nSee docs/DECISIONS.md (D-013) for the dependency license policy.');
  process.exit(1);
}
console.log(`License check passed (${checked} production packages).`);
