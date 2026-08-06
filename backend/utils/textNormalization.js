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

function displayTextScore(value) {
  const text = normalizeWhitespace(value);
  const repaired = repairKnownMojibake(text);
  const hasMojibake = text !== repaired;
  const diacritics = (repaired.normalize('NFD').match(/[\u0300-\u036f]/g) || []).length;
  return (hasMojibake ? -1000 : 0) + diacritics;
}

function choosePreferredDisplayText(current, candidate) {
  const currentText = normalizeWhitespace(repairKnownMojibake(current));
  const candidateText = normalizeWhitespace(repairKnownMojibake(candidate));
  if (!currentText) return candidateText;
  if (!candidateText) return currentText;

  const scoreDifference = displayTextScore(candidate) - displayTextScore(current);
  if (scoreDifference !== 0) return scoreDifference > 0 ? candidateText : currentText;
  return candidateText.localeCompare(currentText, 'es', { sensitivity: 'variant' }) < 0
    ? candidateText
    : currentText;
}

function homologateTextOptions(values) {
  const byNormalizedValue = new Map();
  for (const rawValue of Array.isArray(values) ? values : []) {
    const displayValue = normalizeWhitespace(repairKnownMojibake(rawValue));
    const key = normalizeSearchText(displayValue);
    if (!key) continue;
    byNormalizedValue.set(
      key,
      choosePreferredDisplayText(byNormalizedValue.get(key), displayValue)
    );
  }
  return Array.from(byNormalizedValue.values()).sort((a, b) =>
    a.localeCompare(b, 'es', { sensitivity: 'base' })
  );
}

function homologateIdentityOptions(options) {
  const byIdentity = new Map();
  for (const rawOption of Array.isArray(options) ? options : []) {
    const id = normalizeWhitespace(rawOption?.id);
    const label = normalizeWhitespace(repairKnownMojibake(rawOption?.label));
    if (!label) continue;
    const identityKey = id || `LABEL:${normalizeSearchText(label)}`;
    const previous = byIdentity.get(identityKey);
    byIdentity.set(identityKey, {
      id,
      label: choosePreferredDisplayText(previous?.label, label),
    });
  }
  return Array.from(byIdentity.values()).sort((a, b) =>
    a.label.localeCompare(b.label, 'es', { sensitivity: 'base' })
  );
}

module.exports = {
  choosePreferredDisplayText,
  homologateIdentityOptions,
  homologateTextOptions,
  normalizeComparisonText,
  normalizeSearchText,
  normalizeWhitespace,
  repairKnownMojibake,
};
