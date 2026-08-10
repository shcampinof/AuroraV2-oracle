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
const SKIP_PATHS = new Set(['backend/public/app']);
const UTF8_FATAL = new TextDecoder('utf-8', { fatal: true });
const BROKEN_BYTES_RE = /[\u00C3\u00C2\u00E2\u0192]/u;

function collectTextFiles(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_PATHS.has(path.relative(ROOT, fullPath).split(path.sep).join('/'))) continue;
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

function decodeLatin1(bytes) {
  return Buffer.from(bytes).toString('latin1');
}

function decodeUtf8Strict(bytes) {
  return UTF8_FATAL.decode(bytes);
}

function latin1ToUtf8(text) {
  try {
    return decodeURIComponent(escape(text));
  } catch {
    return text;
  }
}

function countMatches(regex, text) {
  return (text.match(regex) || []).length;
}

function suspiciousScore(text) {
  let score = 0;
  score += countMatches(/[\u00C3\u00C2\u00E2\u0192]/g, text) * 2;
  score += countMatches(/\uFFFD/g, text) * 4;
  score +=
    countMatches(
      /\best(?<!\\)\?|\bavanzar(?<!\\)\?|(?<!\\)\?ltima|calificaci(?<!\\)\?n|decisi(?<!\\)\?n|actuaci(?<!\\)\?n|evaluaci(?<!\\)\?n|situaci(?<!\\)\?n|informaci(?<!\\)\?n|M(?<!\\)\?S|OPCI(?<!\\)\?N|AN(?<!\\)\?LISIS/gi,
      text
    ) * 3;
  return score;
}

function repairMojibakeByToken(text) {
  return text.replace(/\S+/g, (token) => {
    if (!BROKEN_BYTES_RE.test(token)) return token;
    const repaired = latin1ToUtf8(token);
    if (!repaired || repaired === token) return token;
    if (repaired.includes('\uFFFD')) return token;
    return suspiciousScore(repaired) <= suspiciousScore(token) ? repaired : token;
  });
}

function repairLostAccents(text) {
  return text
    .replace(/\best(?<!\\)\?/gi, 'est\u00E1')
    .replace(/\bavanzar(?<!\\)\?/gi, 'avanzar\u00E1')
    .replace(/(?<!\\)\?ltima/gi, '\u00FAltima')
    .replace(/Calificaci(?<!\\)\?n/g, 'Calificaci\u00F3n')
    .replace(/calificaci(?<!\\)\?n/g, 'calificaci\u00F3n')
    .replace(/Decisi(?<!\\)\?n/g, 'Decisi\u00F3n')
    .replace(/decisi(?<!\\)\?n/g, 'decisi\u00F3n')
    .replace(/Actuaci(?<!\\)\?n/g, 'Actuaci\u00F3n')
    .replace(/actuaci(?<!\\)\?n/g, 'actuaci\u00F3n')
    .replace(/Evaluaci(?<!\\)\?n/g, 'Evaluaci\u00F3n')
    .replace(/evaluaci(?<!\\)\?n/g, 'evaluaci\u00F3n')
    .replace(/Situaci(?<!\\)\?n/g, 'Situaci\u00F3n')
    .replace(/situaci(?<!\\)\?n/g, 'situaci\u00F3n')
    .replace(/Informaci(?<!\\)\?n/g, 'Informaci\u00F3n')
    .replace(/informaci(?<!\\)\?n/g, 'informaci\u00F3n')
    .replace(/M(?<!\\)\?S/g, 'M\u00C1S')
    .replace(/OPCI(?<!\\)\?N/g, 'OPCI\u00D3N')
    .replace(/AN(?<!\\)\?LISIS/g, 'AN\u00C1LISIS');
}

function normalizeText(text) {
  let out = text;
  out = repairMojibakeByToken(out);
  out = repairLostAccents(out);
  out = out.replace(/^\uFEFF/, '');
  return out;
}

function main() {
  const files = collectTextFiles(ROOT);
  const modified = [];
  const skipped = [];

  for (const file of files) {
    const bytes = fs.readFileSync(file);
    if (isBinaryLike(bytes)) {
      skipped.push(file);
      continue;
    }

    let decoded;
    let sourceEncoding = 'utf8';
    try {
      decoded = decodeUtf8Strict(bytes);
    } catch {
      sourceEncoding = 'latin1';
      decoded = decodeLatin1(bytes);
    }

    const normalized = normalizeText(decoded);
    const needsWrite = sourceEncoding !== 'utf8' || normalized !== decoded;
    if (!needsWrite) continue;

    fs.writeFileSync(file, Buffer.from(normalized, 'utf8'));
    modified.push({ file, sourceEncoding });
  }

  console.log(`Scanned ${files.length} text files`);
  console.log(`Modified ${modified.length} files`);
  for (const item of modified) {
    console.log(` - ${path.relative(ROOT, item.file)} (from ${item.sourceEncoding})`);
  }
  if (skipped.length) {
    console.log(`Skipped ${skipped.length} binary-like files`);
  }
}

main();
