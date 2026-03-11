# AURORA - Data Flow y Almacenamiento (Backend)

## 1. Archivo fuente principal

- Archivo: `backend/data/consolidado_ppl.csv`
- Ruta usada por el backend: `CSV_PATH = path.join(__dirname, '..', 'data', 'consolidado_ppl.csv')`
- Alcance operativo actual: solo carga registros de `Antioquia`, `Norte de Santander`, `Cauca` y `Santander`.
- Modulo principal: `backend/db/consolidado.repo.js`

## 2. Carga lazy con `rawCache`

Estado interno del repositorio:

- `rawCache`: filas del CSV en memoria.
- `rawHeaders`: encabezados originales tal como vienen en el CSV (incluye vacios).
- `headers`: encabezados saneados/unicos usados como claves internas.
- `headerByNorm`: indice `header normalizado -> header saneado`.

Comportamiento:

1. `getRaw()` verifica `rawCache`.
2. Si `rawCache` es `null`, ejecuta `loadRaw()`.
3. `loadRaw()` lee el archivo completo (`fs.readFileSync`) y lo parsea.
4. Desde ese momento, las lecturas usan cache en memoria y no vuelven a leer disco automaticamente.

Parseo actual (`csv-parse/sync`):

- `bom: true`
- `skip_empty_lines: true`
- `relax_quotes: true`
- `relax_column_count: true`
- `columns: (h) => sanitizeHeaders(h)`

## 3. Normalizacion de headers

La normalizacion ocurre en varias capas:

## 3.1 Saneamiento estructural (`sanitizeHeaders`)

- `trim()` de encabezados.
- Si un header viene vacio, se reemplaza por `__extra_<indice>`.
- Si hay repetidos, se vuelve unico con sufijo `__2`, `__3`, etc.

## 3.2 Normalizacion para busqueda (`norm`)

- Intenta corregir mojibake (`maybeDecodeMojibake`).
- Quita tildes (NFD + remove diacritics).
- Colapsa espacios.
- Pasa a minusculas.

## 3.3 Indice de equivalencias (`buildHeaderIndex`)

Para cada columna, el modulo indexa:

- `norm(header_original) -> header_saneado`
- `norm(header_saneado) -> header_saneado`

Esto permite resolver claves aunque cambien acentos, mayusculas o algunos problemas de codificacion.

## 4. Busqueda por documento

Funcion principal: `getByDocumento(documento)`.

Proceso:

1. Normaliza solo con `trim()` el valor de entrada.
2. Resuelve la columna documento con `getDocumentoKey()`, que prueba en este orden:
   - `Número de identificación`
   - `Numero de identificacion`
   - `numeroIdentificacion`
3. Recorre `rawCache` y compara igualdad exacta de string (solo `trim()`), sin conversion numerica.
4. Retorna la primera fila que coincide o `null`.

## 5. Guardado: reescritura total del CSV

Funcion: `saveRaw(rows)`.

Comportamiento exacto:

1. Toma headers desde `rawHeaders` (no desde una reconstruccion parcial).
2. Serializa la cabecera completa en una linea.
3. Serializa cada fila usando el orden de `headers` saneados.
4. Escapa valores CSV con `csvEscape` (comas, saltos de linea, comillas).
5. Escribe todo el archivo de nuevo con `fs.writeFileSync(CSV_PATH, lines.join('\n'), 'utf8')`.

No hay append incremental: cada persistencia reemplaza el contenido completo del archivo.

## 6. Que pasa si se cambia manualmente `consolidado_ppl.csv`

## 6.1 Cambio manual antes de la primera lectura del proceso

- Si el backend aun no cargo `rawCache`, la siguiente llamada a `getRaw()` leerá el archivo ya modificado.

## 6.2 Cambio manual despues de que `rawCache` ya esta cargado

- El repositorio no tiene recarga automatica de archivo.
- Las lecturas seguiran usando la version en memoria (stale respecto al disco).
- Para reflejar el cambio manual, se requiere reiniciar el proceso backend (o reinicializar `rawCache`, cosa que no expone API publica).

## 6.3 Cambio manual mientras el backend sigue operando y luego guarda

- Si ocurre un `updateByDocumento`, `createActuacionByDocumento` o `assignDefensor` que dispare `saveRaw`, se reescribe el CSV completo desde la copia en memoria.
- En ese escenario, cambios manuales hechos solo en disco y no cargados en `rawCache` pueden perderse.

## 7. Notas de consistencia observables

- Cache de proceso unico (sin coordinacion entre multiples instancias).
- Sin bloqueo de archivo ni control transaccional.
- Las columnas faltantes pueden agregarse en runtime con `ensureColumn`, y quedan persistidas en la siguiente reescritura total.

## 8. Flujo de defensores (`defensores.csv`)

Archivos fuente:

- `backend/db/defensores.repo.js`
- `backend/routes/defensores.js`
- `backend/data/defensores.csv`

Comportamiento actual:

1. `GET /api/defensores` lee `defensores.csv`, normaliza a MAYUSCULA, elimina placeholders y deduplica en memoria.
2. `POST /api/defensores` valida `nombre` (obligatorio, solo letras y espacios).
3. Antes de crear, verifica duplicado tanto en `defensores.csv` como en defensores de condenados (`consolidado_ppl.csv`).
4. Si pasa validaciones, persiste reescribiendo `defensores.csv` completo.

Codigos de error observables:

- `400 INVALID_DEFENSOR_NAME`
- `409 DUPLICATE_DEFENSOR`
- `500 DEFENSOR_CREATE_ERROR`
