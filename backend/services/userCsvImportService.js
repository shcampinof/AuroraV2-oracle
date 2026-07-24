const MAX_IMPORT_ROWS = Number(process.env.AUTH_USER_IMPORT_MAX_ROWS || 5000);

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, '_');
}

function isValidEmail(value) {
  const email = String(value || '');
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function detectDelimiter(text) {
  let commas = 0;
  let semicolons = 0;
  let quoted = false;
  for (const char of String(text || '')) {
    if (char === '"') quoted = !quoted;
    if (!quoted && (char === '\n' || char === '\r')) break;
    if (!quoted && char === ',') commas += 1;
    if (!quoted && char === ';') semicolons += 1;
  }
  return semicolons > commas ? ';' : ',';
}

function parseCsv(text) {
  const source = String(text || '').replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(source);
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let line = 1;
  let rowLine = 1;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (!quoted && char === delimiter) {
      row.push(field);
      field = '';
      continue;
    }
    if (!quoted && (char === '\n' || char === '\r')) {
      row.push(field);
      if (row.some((value) => String(value).trim())) rows.push({ line: rowLine, values: row });
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      line += 1;
      rowLine = line;
      row = [];
      field = '';
      continue;
    }
    if (char === '\n') line += 1;
    field += char;
  }

  if (quoted) {
    const err = new Error('El CSV contiene comillas sin cerrar.');
    err.status = 400;
    err.code = 'ADMIN_USER_CSV_INVALID';
    throw err;
  }
  row.push(field);
  if (row.some((value) => String(value).trim())) rows.push({ line: rowLine, values: row });
  return rows;
}

function analyzeUserCsv(buffer, existingUsers = []) {
  const rows = parseCsv(Buffer.isBuffer(buffer) ? buffer.toString('utf8') : buffer);
  if (!rows.length) {
    const err = new Error('El archivo CSV está vacío.');
    err.status = 400;
    err.code = 'ADMIN_USER_CSV_EMPTY';
    throw err;
  }

  const headers = rows[0].values.map(normalizeHeader);
  const emailIndex = headers.findIndex((header) => ['correo', 'email', 'correo_electronico'].includes(header));
  if (emailIndex < 0) {
    const err = new Error('La plantilla debe incluir la columna "correo".');
    err.status = 400;
    err.code = 'ADMIN_USER_CSV_HEADER_REQUIRED';
    throw err;
  }

  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_IMPORT_ROWS) {
    const err = new Error(`El CSV supera el máximo de ${MAX_IMPORT_ROWS} usuarios.`);
    err.status = 400;
    err.code = 'ADMIN_USER_CSV_TOO_LARGE';
    throw err;
  }

  const existing = new Set(
    existingUsers.flatMap((user) => [user?.email, user?.username]).map((value) => String(value || '').trim().toLowerCase()).filter(Boolean)
  );
  const seen = new Set();
  const entries = dataRows.map(({ line: rowNumber, values }) => {
    const email = String(values[emailIndex] || '').trim().toLowerCase();
    if (!email) return { line: rowNumber, email: '', status: 'invalid', message: 'El correo está vacío.' };
    if (!isValidEmail(email)) return { line: rowNumber, email, status: 'invalid', message: 'El correo no tiene un formato válido.' };
    if (seen.has(email)) return { line: rowNumber, email, status: 'duplicate', message: 'Está repetido dentro del CSV.' };
    seen.add(email);
    if (existing.has(email)) return { line: rowNumber, email, status: 'existing', message: 'Ya está registrado y no será modificado.' };
    return { line: rowNumber, email, status: 'ready', message: 'Listo para importar.' };
  });

  const count = (status) => entries.filter((entry) => entry.status === status).length;
  return {
    entries,
    emails: entries.filter((entry) => entry.status === 'ready').map((entry) => entry.email),
    summary: {
      totalRows: entries.length,
      ready: count('ready'),
      existing: count('existing'),
      duplicates: count('duplicate'),
      invalid: count('invalid'),
    },
  };
}

module.exports = { analyzeUserCsv, isValidEmail, parseCsv };
