const { execute } = require('../../db/oraclePool');

function normalizeCedula(value) {
  return String(value ?? '').replace(/\D+/g, '');
}

function mapPagRow(row) {
  if (!row) return null;
  const cedula = String(row.CEDULA ?? '').trim();
  if (!cedula) return null;
  return {
    cedula,
    nombre: String(row.NOMBRE_PAG ?? row.NOMBRE ?? '').trim(),
    correo: String(row.CORREO ?? '').trim(),
    regional: String(row.REGIONAL ?? row.DEPENDENCIA ?? '').trim(),
  };
}

async function findByCedula(cedula) {
  const normalized = normalizeCedula(cedula);
  if (!normalized) return null;

  const sql = `
    SELECT
      TO_CHAR(p.CEDULA_PAG) AS CEDULA,
      p.NOMBRE_PAG,
      p.CORREO,
      p.REGIONAL
    FROM DNDP.PAG p
    WHERE TO_CHAR(p.CEDULA_PAG) = :cedula
  `;

  const result = await execute(sql, { cedula: normalized }, { operation: 'pag.findByCedula' });
  const row = Array.isArray(result?.rows) ? result.rows[0] : null;
  return mapPagRow(row);
}

async function listRegionales() {
  const result = await execute(`
    SELECT DISTINCT TRIM(r.REGIONAL) AS REGIONAL
    FROM DNDP.REGIONALES r
    WHERE TRIM(r.REGIONAL) IS NOT NULL
    ORDER BY REGIONAL
  `, {}, { operation: 'pag.listRegionales' });
  return (result.rows || []).map((row) => String(row.REGIONAL).trim());
}

async function saveManagedPag({ cedula, nombre, correo, regional }) {
  // No cambia ENCARGADO ni elimina registros usados por asignaciones historicas.
  await execute(`
    BEGIN
      MERGE INTO DNDP.PAG p
      USING (SELECT :cedula AS CEDULA_PAG FROM dual) source
      ON (p.CEDULA_PAG = source.CEDULA_PAG)
      WHEN MATCHED THEN UPDATE SET
        p.NOMBRE_PAG = :nombre, p.CORREO = :correo, p.REGIONAL = :regional
        WHERE p.CORREO IS NULL OR LOWER(TRIM(p.CORREO)) = :correo
      WHEN NOT MATCHED THEN INSERT (CEDULA_PAG, NOMBRE_PAG, CORREO, REGIONAL, ENCARGADO)
        VALUES (:cedula, :nombre, :correo, :regional, 0);
      IF SQL%ROWCOUNT != 1 THEN
        RAISE_APPLICATION_ERROR(-20004, 'La cedula PAG ya esta asociada a otro correo');
      END IF;
    END;
  `, { cedula, nombre, correo, regional }, { autoCommit: true, operation: 'pag.saveManagedPag' });
}

module.exports = {
  findByCedula,
  listRegionales,
  normalizeCedula,
  saveManagedPag,
};
