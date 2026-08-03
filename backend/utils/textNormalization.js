const MOJIBAKE_REPLACEMENTS = new Map([
  ['\u00c3\u0081', 'Á'],
  ['\u00c3\u00a1', 'á'],
  ['\u00c3\u2030', 'É'],
  ['\u00c3\u00a9', 'é'],
  ['\u00c3\u008d', 'Í'],
  ['\u00c3\u00ad', 'í'],
  ['\u00c3\u201c', 'Ó'],
  ['\u00c3\u00b3', 'ó'],
  ['\u00c3\u0161', 'Ú'],
  ['\u00c3\u00ba', 'ú'],
  ['\u00c3\u2018', 'Ñ'],
  ['\u00c3\u00b1', 'ñ'],
]);

function repairKnownMojibake(value) {
  let repaired = String(value ?? '');
  for (const [corrupted, replacement] of MOJIBAKE_REPLACEMENTS) {
    repaired = repaired.split(corrupted).join(replacement);
  }
  return repaired;
}

function normalizeWhitespace(value) {
  return String(value ?? '')
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSearchText(value) {
  return normalizeWhitespace(repairKnownMojibake(value))
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function normalizeComparisonText(value) {
  return normalizeSearchText(value).toLowerCase();
}

module.exports = {
  normalizeComparisonText,
  normalizeSearchText,
  normalizeWhitespace,
  repairKnownMojibake,
};
