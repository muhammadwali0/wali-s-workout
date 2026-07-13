import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const privatePathPatterns = [
  /^docs\//,
  /^data\/program\//,
  /^\.codex-private\//,
  /\.pdf$/i,
];
const metadataTerms = [
  ['source', '_trace'].join(''),
  ['source', '_pdf'].join(''),
  ['raw', '_source', '_fields'].join(''),
  ['source', 'WeekId'].join(''),
  ['source', '_pages'].join(''),
  ['aff', 'iliate'].join(''),
  ['Phase1', '.pdf'].join(''),
  ['Phase2', '.pdf'].join(''),
  ['Phase3', '.pdf'].join(''),
];
const blockedTerms = [
  ['Jeff', ' Nippard'].join(''),
  ['Power', 'building'].join(''),
  ...readBlockedTerms(),
  ...metadataTerms,
];

const trackedFiles = gitFiles(['ls-files']);
const publicFiles = gitFiles(['ls-files', '-co', '--exclude-standard']);
const trackedPrivate = trackedFiles.filter((file) =>
  privatePathPatterns.some((pattern) => pattern.test(file)),
);

if (trackedPrivate.length > 0) {
  fail(`private files are tracked:\n${trackedPrivate.join('\n')}`);
}

const matches = [];
for (const file of publicFiles) {
  const text = readTextFile(file);
  if (text === null) continue;

  for (const term of blockedTerms) {
    if (text.toLowerCase().includes(term.toLowerCase())) {
      matches.push(`${file}: ${term}`);
    }
  }
}

if (matches.length > 0) {
  fail(`blocked public content found:\n${matches.join('\n')}`);
}

console.log('privacy verified');

function gitFiles(args) {
  return execFileSync('git', [...args, '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
}

function readBlockedTerms() {
  const path = '.codex-private/blocked-public-terms.txt';
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function readTextFile(path) {
  const buffer = readFileSync(path);
  if (buffer.includes(0)) return null;
  return buffer.toString('utf8');
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
