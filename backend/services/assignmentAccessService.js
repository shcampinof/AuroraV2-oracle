const { normalizeRoles } = require('./authService');
const pagRepo = require('../repositories/oracle/pagRepository');

async function resolveAssignmentActor(user, cedula) {
  if (normalizeRoles(user?.roles, []).includes('dndp')) {
    const email = String(user.email || user.username || '').trim();
    const name = String(user.name || email || user.id || 'Usuario DNDP').trim();
    let nombre = `DNDP: ${name}${email && email !== name ? ` (${email})` : ''}`;
    while (Buffer.byteLength(nombre, 'utf8') > 200) nombre = nombre.slice(0, -1);
    return { tipo: 'dndp', cedula: '', nombre, correo: email, regional: '' };
  }
  return pagRepo.findByCedula(cedula);
}

module.exports = { resolveAssignmentActor };
