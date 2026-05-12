# Matriz CSV -> Oracle (AuroraV2-oracle)

| Flujo | Antes (CSV) | Ahora (Oracle v2) | Estado |
|---|---|---|---|
| `GET /api/ppl` | `db/consolidado.repo.js` (`consolidado_ppl.csv`) | `services/pplService.js` + repos Oracle | Migrado |
| `GET /api/ppl/condenados` | `db/consolidado.repo.js` | `services/pplService.js` + repos Oracle | Migrado |
| `GET /api/ppl/:documento` | `db/consolidado.repo.js` | `services/pplService.js` + repos Oracle | Migrado |
| `GET /api/ppl/:documento/actuaciones` | `db/consolidado.repo.js` | `services/pplService.js` + repos Oracle | Migrado |
| `POST /api/ppl/:documento/actuaciones` | `db/consolidado.repo.js` | `services/pplService.js` + repos Oracle | Migrado |
| `PUT /api/ppl/:documento` | `db/consolidado.repo.js` | `services/pplService.js` + repos Oracle | Migrado |
| `POST /api/ppl/asignar-defensor` | `db/consolidado.repo.js` + `db/pag.repo.js` | Oracle para asignación y validación PAG | Migrado |
| `GET /api/ppl/pag/:cedula/validar` | `db/pag.repo.js` (`PAG.csv`) | `repositories/oracle/pagRepository.js` (`DNDP.PAG`) | Migrado |
| `GET /api/defensores` | `db/defensores.repo.js` (`defensores.csv`) | `repositories/oracle/defensoresRepository.js` (`DNDP.DEFENSORES`) | Migrado |
| `POST /api/defensores` | `db/defensores.repo.js` | `repositories/oracle/defensoresRepository.js` (`DNDP.DEFENSORES`) | Migrado |

## Archivos puente de compatibilidad
- `backend/db/oracleConsolidado.repo.js`: mantiene interfaz de `consolidado` consumida por rutas.
- `backend/routes/ppl.js`: mantiene shape de respuesta legacy, ahora con `await`.
- `backend/services/pplService.js`: adapter Oracle -> contrato frontend legacy.
