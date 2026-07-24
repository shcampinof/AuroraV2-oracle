# AURORA/CELESTE - Historial de actuaciones

Fecha de actualización: 2026-07-24

## 1. Objetivo

Documentar el comportamiento del historial de actuaciones en formulario:

- carga de actuaciones,
- criterio de actuacion iniciada,
- comportamiento de botones de accion,
- reglas de creacion de nueva actuacion.

Archivos principales:

- `frontend/src/components/HistorialActuacionesPPL.jsx`
- `frontend/src/pages/FormularioAtencion.jsx`

---

## 2. Flujo de datos

1. Frontend consulta `GET /api/ppl/:documento/actuaciones`.
2. Backend devuelve arreglo `actuaciones` con `{ id, rowIndex, registro }`.
3. Frontend transforma cada fila para tabla:
   - numero de actuacion,
   - fecha de analisis,
   - resumen,
   - actuacion judicial,
   - accion/estado.

El componente mantiene la respuesta original del API como `actuacionesRaw` y normaliza las filas con `useMemo`. Si existe una `actuacionActivaId`, la fila activa se recalcula con el `registro` vivo del formulario. Esto permite que la columna `Accion a impulsar` cambie mientras el usuario diligencia campos, sin recargar la aplicación.

---

## 3. Criterio de actuacion iniciada

Una fila se considera iniciada si:

1. Tiene algun campo clave de avance diligenciado, o
2. Tiene algun campo no base diligenciado (bloques 3+).

Esto evita marcar como iniciada una fila que solo trae datos base (bloques 1-2).

---

## 4. Botones de acción

### 4.1 Etiqueta de accion principal

- La accion visible en historial usa texto:
  - **"Actualizar actuacion"**

### 4.2 Registro sin actuaciones

- Si el PPL existe pero el API no devuelve actuaciones, el historial agrega una fila virtual `Analizar el caso`.
- La fila virtual no se persiste ni consume un identificador Oracle.
- `Actualizar actuacion` abre el formulario sobre el registro cargado; la persistencia ocurre al guardar.

### 4.3 Boton "Crear nueva actuacion"

- Ahora siempre intenta crear una nueva actuacion y abrir formulario limpio (`abrirFormulario: true`).
- Ya no prioriza reutilizar pendiente desde este boton.

---

## 5. Restriccion para crear nueva actuacion (Aurora)

En `FormularioAtencion.jsx`:

- La primera actuación se puede iniciar cuando el historial real está vacío.
- Si ya existen actuaciones en el flujo condenado, no se permite crear una adicional mientras la última actuación real no tenga información diligenciada desde la pregunta 29.

Referencia funcional (campos minimos considerados):

- fecha de analisis,
- procedencias Q30-Q34,
- Q35,
- Q36,
- Q37.

---

## 6. Guardado y persistencia

1. `POST /ppl/:documento/actuaciones` crea fila nueva.
2. `PUT /ppl/:documento` guarda respuestas sobre actuacion activa (`actuacionId`).
3. El backend persiste cambios en Oracle.
4. Despues de guardar, el formulario incrementa `historialRefreshToken` para recargar desde Oracle y reconciliar la vista en memoria con la persistencia.
