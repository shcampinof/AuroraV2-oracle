# Diagnóstico y corrección del cálculo de estados

Fecha: 19 de octubre de 2026. Ambiente: base de datos de pruebas DNDPDEV.

## Causa

En Oracle, la cadena vacía se convierte en `NULL`. Comparar una respuesta
ausente con «Sí» o «No» produce un resultado desconocido; negarlo con `NOT`
también produce un resultado desconocido. Algunas ramas del cálculo de estado
no se ejecutaban y el caso terminaba en una etapa anterior.

Además, «Otras solicitudes a tramitar» se comparaba contra una lista que incluía
`''`. Para solicitudes distintas de las opciones de esa lista, la comparación
también resultaba desconocida, impidiendo reconocer una solicitud positiva.

## Preguntas y situaciones revisadas

| Pregunta o grupo | Inconsistencia y comportamiento corregido |
| --- | --- |
| Se presenta recurso: pregunta 54 de utilidad pública y 51 del trámite normal | Ante una decisión negativa y respuesta pendiente, corresponde «Presentar recurso». Un vacío no equivale a «No». Si se responde «Sí» y falta el resultado, corresponde «Pendiente de decisión»; con «No», se aplica la regla de cierre existente. |
| Actuación a adelantar: pregunta 40 | Si falta en un registro histórico, ya no impide reconocer las decisiones negativas o positivas del trámite normal. Las decisiones de utilidad pública siguen identificando ese flujo aunque no esté diligenciada la actuación. |
| Otras solicitudes a tramitar: pregunta 36 | Una solicitud positiva se reconoce aunque las procedencias 30–34 sean negativas. Con análisis completo corresponde entrevistar; con entrevista y demás requisitos del flujo, presentar solicitud. Una respuesta ausente no autoriza ese avance ni equivale a «Ninguna». |
| Procedencias: preguntas 30–34; decisión del usuario: 39; requisitos de utilidad pública: 44–45 | Las respuestas ausentes ya producen condiciones definidas. Se conservan las condiciones de cierre por respuestas negativas explícitas. |
| Resumen del análisis, entrevista, radicación, decisión, resultado del recurso y cierre | Se distinguen respuestas diligenciadas de campos con espacios, tabulaciones, espacios no separables y marcadores `-`/`--`. Una fecha de decisión sin sentido registrado mantiene la etapa pendiente correspondiente. |
| Flujo de sindicados: análisis 19–22, entrevista 23, audiencia 24–26 y recurso 28–31 | Se comprobaron análisis incompleto, entrevista pendiente, audiencia solicitada o realizada, decisión negativa, recurso pendiente y cierre. Un resumen o actuación compuesto únicamente por espacios no completa el análisis. |

El cambio se aplica al cálculo común del backend que usan el detalle, los
listados, los filtros por estado y los estados actuales de los reportes. Las
respuestas originales se conservan; no se necesita actualizar masivamente las
gestiones para que las consultas devuelvan el estado corregido.

## Impacto observado

Comparación mediante consultas de solo lectura sobre 4.363 casos con situación
vigente activa y gestión jurídica, seleccionando la gestión que usa el listado:

| Estado anterior | Estado corregido | Casos |
| --- | --- | ---: |
| Analizar el caso | Entrevistar al usuario | 94 |
| Analizar el caso | Presentar recurso | 20 |
| Pendiente de decisión | Presentar recurso | 4 |
| Analizar el caso | Caso cerrado | 9 |
| Entrevistar al usuario | Caso cerrado | 4 |
| Presentar solicitud | Caso cerrado | 1 |
| **Total con diferencia** | | **132** |

Las cantidades corresponden al momento de la revisión y pueden variar con los
registros posteriores. Expresan el resultado de las reglas de la aplicación.

El caso `1022990088`, con utilidad pública negada y respuesta del recurso
pendiente, corresponde a «Presentar recurso».

## Pruebas

- 58 escenarios compartidos entre formulario y Oracle.
- 406 comprobaciones en Oracle: cada escenario con siete variantes de respuestas ausentes (`NULL`, cadena vacía, espacios, tabulaciones/saltos de línea, espacio no separable, `-` y `--`). Son consultas `SELECT` sobre datos sintéticos; no insertan ni actualizan expedientes.
- 318 pruebas del frontend y sus 23 archivos de pruebas aprobados.
- 16 suites del backend aprobadas; lint y compilación aprobados.
- La imagen candidata pasó también las 406 comprobaciones con la configuración del servicio.
- 46 filtros comprobados con datos reales y validación del contrato de campos sobre 232 filas. No había casos reales representativos para los estados «Pendiente audiencia» y «Pendiente decisión de audiencia»; esas transiciones sí están cubiertas por la matriz sintética de Oracle.

Para repetir la matriz Oracle con las variables de conexión del ambiente:

```sh
RUN_ORACLE_INTEGRATION=true npm --prefix backend run test:oracle:state
```

En una instalación local con el archivo de configuración en la raíz, indicar
también `DOTENV_CONFIG_PATH` con la ruta absoluta de ese archivo.

## Publicación

La corrección quedó publicada por HTTPS en el puerto 443. El contenedor quedó
saludable, sin reinicios; el frontend, `/api/health` y `/api/health/db`
respondieron HTTP 200. Se verificó la correspondencia del código publicado con
el código probado y que el caso `1022990088` devuelve `PRESENTAR_RECURSO`
tanto en el detalle como en el listado filtrado por ese estado.

La publicación se construyó en una copia aislada y excluyó el cambio paralelo
del formulario que apareció durante el trabajo. Se conservó la imagen anterior
como `aurora-app:before-state-null-20261019` para permitir una reversión.
