#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const TEXT_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
  '.css',
  '.html',
  '.json',
  '.md',
  '.csv',
  '.svg',
  '.xml',
  '.ini',
  '.ps1',
  '.sh',
  '.sql',
  '.yml',
  '.yaml',
  '.env',
  '.txt',
]);

const TEXT_BASENAMES = new Set([
  '.gitignore',
  '.gitattributes',
  '.editorconfig',
  '.dockerignore',
]);

const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.vite']);
const UTF8_FATAL = new TextDecoder('utf-8', { fatal: true });

const MOJIBAKE_RE = /[\u00C3\u00C2\u00E2\u0192\uFFFD]/u;
const LOST_ACCENT_RE =
  /\b(?:Calificaci|calificaci|Decisi|decisi|Actuaci|actuaci|Evaluaci|evaluaci|Situaci|situaci|Informaci|informaci)(?<!\\)\?n\b|\bM(?<!\\)\?S\b|OPCI(?<!\\)\?N|AN(?<!\\)\?LISIS|(?<!\\)\?ltima/u;

function collectTextFiles(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectTextFiles(fullPath, out);
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (TEXT_EXTENSIONS.has(ext) || TEXT_BASENAMES.has(entry.name)) out.push(fullPath);
  }
  return out;
}

function isBinaryLike(bytes) {
  const sampleSize = Math.min(bytes.length, 8000);
  for (let i = 0; i < sampleSize; i += 1) {
    if (bytes[i] === 0) return true;
  }
  return false;
}

function hasMojibake(text) {
  return MOJIBAKE_RE.test(text) || LOST_ACCENT_RE.test(text);
}

function getMojibakeLines(text) {
  const lines = text.split(/\r?\n/);
  const hits = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!hasMojibake(lines[i])) continue;
    hits.push({ line: i + 1, text: lines[i].slice(0, 180) });
    if (hits.length >= 3) break;
  }
  return hits;
}

function main() {
  const files = collectTextFiles(ROOT);
  const invalidUtf8 = [];
  const mojibake = [];

  for (const file of files) {
    const bytes = fs.readFileSync(file);
    if (isBinaryLike(bytes)) continue;

    let text;
    try {
      text = UTF8_FATAL.decode(bytes);
    } catch {
      invalidUtf8.push(path.relative(ROOT, file));
      continue;
    }

    if (!hasMojibake(text)) continue;
    mojibake.push({
      file: path.relative(ROOT, file),
      hits: getMojibakeLines(text),
    });
  }

  if (!invalidUtf8.length && !mojibake.length) {
    console.log(`OK: ${files.length} text files are UTF-8 and no mojibake pattern was detected.`);
    process.exit(0);
  }

  if (invalidUtf8.length) {
    console.error('Files that are not valid UTF-8:');
    for (const file of invalidUtf8) console.error(` - ${file}`);
  }

  if (mojibake.length) {
    console.error('Files with mojibake-like patterns:');
    for (const item of mojibake) {
      console.error(` - ${item.file}`);
      for (const hit of item.hits) {
        console.error(`   L${hit.line}: ${hit.text}`);
      }
    }
  }

  process.exit(1);
}

main();
