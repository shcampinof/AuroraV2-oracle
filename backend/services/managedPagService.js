const pagRepo = require('../repositories/oracle/pagRepository');
const { normalizeRoles } = require('./authService');
const { listUsers } = require('./userDirectoryService');
const { isValidEmail } = require('./userCsvImportService');

function invalid(message, status = 400) {
  return Object.assign(new Error(message), { status, code: 'ADMIN_USER_PAG_INVALID' });
}

async function prepareManagedPag(payload, existing = null) {
  const next = { ...existing, ...payload };
  const isPag = normalizeRoles(next.roles, []).includes('pag');
  const wasPag = normalizeRoles(existing?.roles, []).includes('pag');
  const touchesPag = ['pagCedula', 'pagRegional', 'name', 'email'].some((key) => Object.hasOwn(payload, key));
  if (!isPag || (!touchesPag && wasPag)) return payload;

  const cedula = String(next.pagCedula || '').trim();
  if (!/^[1-9]\d{0,37}$/.test(cedula)) {
    throw invalid('Ingrese una cédula PAG válida, solo con dígitos y sin ceros iniciales.');
  }
  const email = String(next.email || '').trim().toLowerCase();
  if (!isValidEmail(email)) {
    throw invalid('Ingrese un correo PAG con formato válido.');
  }
  if (listUsers().some((user) => user.pagCedula === cedula && user.id !== existing?.id && user.email !== email)) {
    throw invalid('La cédula PAG ya está asociada a otro usuario.', 409);
  }
  const catalog = await pagRepo.findByCedula(cedula);
  if (catalog?.correo && catalog.correo.toLowerCase() !== email) {
    throw invalid('La cédula PAG ya está asociada a otro correo en DNDP.PAG.', 409);
  }
  const nombre = String(next.name || catalog?.nombre || '').trim();
  const requestedRegional = String(next.pagRegional || catalog?.regional || '').trim();
  const regionales = await pagRepo.listRegionales();
  const normalize = (text) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const regional = regionales.find((item) => normalize(item) === normalize(requestedRegional));
  if (!regional) throw invalid('Seleccione una regional PAG de la lista de regionales existentes.');
  if (!nombre || !regional) throw invalid('Indique el nombre y la regional para registrar el PAG.');
  if (nombre.length > 200 || regional.length > 80 || email.length > 200) {
    throw invalid('El nombre o correo supera 200 caracteres, o la regional supera 80.');
  }
  try {
    await pagRepo.saveManagedPag({ cedula, nombre, correo: email, regional });
  } catch (err) {
    if (/ORA-20004|ORA-00001/.test(String(err.message))) {
      throw invalid('La cédula PAG fue registrada por otro usuario. Actualice e intente nuevamente.', 409);
    }
    throw err;
  }
  return { ...payload, name: nombre, pagCedula: cedula, pagRegional: regional };
}

module.exports = { prepareManagedPag };
