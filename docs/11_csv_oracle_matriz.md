# Matriz CSV -> Oracle (AuroraV2-oracle)

| Flujo | Antes (CSV) | Ahora (Oracle v2) | Estado |
|---|---|---|---|
| `GET /api/ppl` | `db/consolidado.repo.js` (`consolidado_ppl.csv`) | `services/pplService.js` + repos Oracle | Migrado |
| `GET /api/ppl/condenados` | `db/consolidado.repo.js` | `services/pplService.js` + repos Oracle | Migrado |
| `GET /api/ppl/:documento` | `db/consolidado.repo.js` | `services/pplService.js` + repos Oracle | Migrado |
| `GET /api/ppl/:documento/actuaciones` | `db/consolidado.repo.js` | `services/pplService.js` + repos Oracle | Migrado |
| `POST /api/ppl/:documento/actuaciones` | `db/consolidado.repo.js` | `services/pplService.js` + repos Oracle | Migrado |
| `PUT /api/ppl/:documento` | `db/consolidado.repo.js` | `services/pplService.js` + repos Oracle | Migrado |
| `POST /api/ppl/asignar-defensor` | `db/consolidado.repo.js` + `db/pag.repo.js` | Oracle para asignación + CSV para validación PAG | Híbrido |
| `GET /api/ppl/pag/:cedula/validar` | `db/pag.repo.js` (`PAG.csv`) | `db/pag.repo.js` | Temporal CSV |
| `GET /api/defensores` | `db/defensores.repo.js` (`defensores.csv`) | `db/defensores.repo.js` (catálogo) + Oracle para `source=condenados` | Híbrido |
| `POST /api/defensores` | `db/defensores.repo.js` | `db/defensores.repo.js` + validación en Oracle (`source=condenados`) | Híbrido |

## Archivos puente de compatibilidad
- `backend/db/oracleConsolidado.repo.js`: mantiene interfaz de `consolidado` consumida por rutas.
- `backend/routes/ppl.js`: mantiene shape de respuesta legacy, ahora con `await`.
- `backend/services/pplService.js`: adapter Oracle -> contrato frontend legacy.
