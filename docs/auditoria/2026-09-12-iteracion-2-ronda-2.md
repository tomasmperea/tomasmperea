# Auditoría — Iteración 2, ronda 2: correcciones sobre mi propio informe del 12/09

**Escribe:** auditor · **Fecha:** 12 de septiembre de 2026 · **Alcance:** commits `caa418f` (rúbrica +
cierre de H1/H2) y `3a905a8` (arranque de `sheetImport` sin poder quedar mudo + detección de `pdf.js`),
sobre lo ya auditado en `docs/auditoria/2026-09-12-iteracion-2.md` (69/100).

---

## Los dos veredictos, por separado (la rúbrica ya no los mezcla)

### ¿Se puede publicar como candidato? **SÍ.**

Todo lo que se podía probar en este entorno está probado, con más rigor que la ronda anterior (esta vez con
control negativo). Ningún hallazgo de mi auditoría anterior sigue abierto sin una decisión escrita. Nada se
reporta como "verificado" sin serlo. El único hueco es el entorno real, y está declarado con guion de
pruebas (al final de este informe). Nada de esto lo bloquea.

### ¿Se puede dar la iteración por terminada? **NO.**

Dos razones, independientes entre sí:
1. Falta lo único que cierra la dimensión 1: correr esto en el Artifact publicado, en el teléfono del PM, con
   sus dos documentos reales. Nadie lo hizo todavía.
2. El puntaje total —calculado igual que siempre— da **80/100**, debajo del piso de 85 que exige "dar por
   terminada", con independencia de si se publicó o no.

## Puntaje total: 80 / 100

Sube 11 puntos sobre mi informe anterior (69). La mejora es real: el botón mudo (hallazgo A) está cerrado
con la prueba más rigurosa que vi en este proyecto —un control negativo que demuestra que la aserción
puede fallar—, el riesgo de `pdf.js` (hallazgo B) está mitigado y probado, los dos arneses que quedaban
sueltos ahora dejan rastro en pantalla, y el `docs/qa/valija-bloque-b.md` dejó de mentir sobre un
bloqueante que ya no existe. Lo que no sube: nada de esto corrió nunca fuera de Chromium de escritorio, y
aparece una afirmación nueva —el techo de 4 segundos es "una decisión sin medición"— que **a mí me llegó
dicha, no escrita**: no está en ningún comentario, commit ni documento de este repositorio.

---

## La tabla

| # | Dimensión | Peso | Obtenido | Por qué |
|---|---|---|---|---|
| 1 | Verificación en el entorno real | 30 | **20** | Techo del sustituto declarado, tal como predijo mi informe anterior. Sube de 16 a 20 porque el único déficit que bajaba la nota la vez pasada —un estado sin test, el botón mudo— ahora tiene la prueba más fuerte posible en este entorno: un control negativo que demuestra que la aserción puede fallar. Sigue en 20 y no en 30 porque cero minutos de esto corrieron en el Artifact o en un teléfono, y la pieza que de verdad importa (`pdf.js` real, `extractPdfText` contra el navegador real) sigue sin ejecutarse ni una vez, exactamente como la ronda anterior |
| 2 | Diagnóstico de causa raíz | 15 | **15** | Las dos causas de esta ronda están reproducidas, no supuestas: la del botón mudo, con el control negativo (falla contra la copia sin `renderPreparando()`); la de `pdf.js`, cruzando el antecedente real de VAL-50 (el mismo host, el mismo `<script src>` síncrono) en vez de tratarlo como una hipótesis nueva |
| 3 | Honestidad de lo verificado | 15 | **12** | Las declaraciones que ya existían siguen siendo honestas y se ampliaron bien (tres brechas explícitas en el encabezado de `importar-arranque.js`, sin que nadie las pidiera). Resta: la afirmación "el techo de 4 s es una decisión sin medición" que se me comunicó no está escrita en ningún lugar del entregable —ni en el comentario de `LIMITS_TECHO_MS`, ni en el commit, ni en un documento—, así que hoy nadie que lea el repo se entera de que es un número sin dato detrás. Y el cierre de H1/H2 en `docs/qa/valija-bloque-b.md` trae fecha pero no el hash del commit que pedí la vez pasada |
| 4 | Cumplimiento del contrato | 15 | **12** | Las seis tareas de "qué falta para llegar a 85" de mi informe anterior están cerradas cuatro de seis (cerrar el documento de QA, hacer que los arneses impriman, decidir y probar el timeout de `limits()`, escribir la relación VAL-50↔pdf.js); las otras dos —publicar y mirar la pestaña Red— no dependen de este rol. Pero el propio brief dice, textual, que "un criterio que no se puede verificar [contra la app publicada, en un teléfono] se considera no cumplido", y bajo esa vara ningún criterio de VAL-40 pasó todavía |
| 5 | Calidad interna | 15 | **13** | Los 496 casos que corrí (111+31+45+59+68+69+11+12) pasan de verdad, contra el `valija.html` de hoy, no contra una copia. Los dos arneses que integración declaró haber tocado (`importar-sin-imagenes.js`, `importar-botones.js`) los verifiqué por mi cuenta: son arreglos de arnés, no maquillaje de un defecto (ver más abajo). Resta un punto por la misma razón que en la dimensión 3: un número mágico sin su porqué escrito en ningún lado |
| 6 | Diseño y decisiones de producto | 10 | **8** | Reutiliza el patrón ya validado de `runInterpretation` (7 s, "está tardando", salida a mano) en vez de inventar uno nuevo, y el mensaje cuando faltan PDF e imágenes a la vez decide correctamente no repetir `caps.nota` (que hablaría de un PDF que tampoco funciona). Resta: el valor de `LIMITS_TECHO_MS` (4000) no dice qué se descartó ni por qué ese número y no otro, a diferencia de los umbrales de §3.3 de `import-engine.md`, que si están trazados a datos |
| | **Total** | **100** | **80** | |

---

## Las afirmaciones, verificadas una por una

### 1 · "El control negativo del arnés nuevo falla como debe" — **CIERTA, lo corrí yo mismo**

```
sed 's/^  renderPreparando();$//' app/valija.html > /tmp/sin-preparando.html
NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/importar-arranque.js /tmp/sin-preparando.html
```
Resultado: la primera aserción (`hubo un cambio visible en pantalla dentro de los 300 ms del toque`) da
**FALLA**, y de ahí en más el arnés se cae en cascada (timeouts esperando `.sheet-bd`, `#im-caps`,
`#imp-live`) porque, sin el estado de carga, la hoja no se dibuja hasta que resuelven las dos promesas de
plataforma. Es exactamente lo que tiene que pasar: la aserción del umbral **puede fallar**, así que medirla
en verde contra el HTML real dice algo.

### 2 · "Los 59 del arnés nuevo pasan, tocando el botón, no disparando el evento" — **CIERTA**

```
NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/importar-arranque.js
→ 59 pasaron, 0 fallaron
```
Leí el archivo completo antes de confiar: el cronómetro arranca en un listener de `pointerdown` puesto sobre
`#imp` y el gesto real es `page.locator("#imp").click()`; ningún caso dispara un evento interno a mano. Los
casos B (sin `pdf.js`) tocan `[data-pick="im_doc"]` y esperan el `filechooser` real, la misma disciplina que
`importar-botones.js` ya tenía.

### 3 · "Los 111, 31, 45 y los dos motores extraídos siguen en verde contra el `valija.html` de hoy" — **CIERTA, las cinco corridas**

```
NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/valija-bloque-b.js        → 111 pasaron, 0 fallaron
NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/hallazgos-qa-bloque-b.js  → 31 pasaron, 0 fallaron
NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/importar-sin-imagenes.js  → 45 pasaron, 0 fallaron
NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/motores-desde-html.js     → PackingEngine 68/68, ImportEngine 69/69
NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/importar-botones.js "$PWD/app/valija.html"            → 11 aserciones, verde
NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/importar-botones.js "$PWD/app/valija.html" bloquear   → 12 aserciones, verde
```
`hallazgos-qa-bloque-b.js` y `valija-bloque-b.js` ahora imprimen en la terminal de verdad —lo confirmé
leyendo el código (`log = m => { console.log(m); ... }`) y viéndolo en pantalla, no infiriéndolo del
`LEEME.md`—. Los dos motores extraídos del HTML no cambiaron: la única zona que tocó esta ronda
(`sheetImport`, línea ~6105 en adelante) está muy después de donde arrancan `PackingEngine` (línea 1278) e
`ImportEngine` (línea 3239), así que la identidad byte a byte que confirmé la ronda anterior sigue de pie
sin necesidad de repetir el `diff`/`md5sum` completo.

### 4 · "Los cuatro estados nuevos de la pantalla de importar no prometen algo que no cumplen" — **CIERTA, tocando controles en cada uno**

- **Preparando:** `renderPreparando()` se dibuja *antes* de cualquier `await`; la prueba mide con
  `performance.now()` desde el `pointerdown` real y confirma ≤1 ms de reacción, con spinner y un botón para
  cancelar (no es una espera sin salida).
- **Tardando (7 s):** aparece el aviso "está tardando" con la salida "cargar a mano", y **no** aparece antes
  de los 4 s (`assert(...count()===0, "a los 4 segundos todavía no molesta con nada")`), así que no compite
  con el techo de `limits()`.
- **Sin `pdf.js`:** el aviso sale antes de subir nada (`window.__CALLS__.length === 0`), el `accept` del
  input pierde `application/pdf` y el botón cambia su etiqueta a "foto o captura" — no ofrece algo que no
  puede cumplir.
- **Sin `pdf.js` y sin imágenes:** no queda ningún botón de archivo (`[data-pick]` cuenta 0) y sólo se ofrece
  pegar texto, abierto por defecto; probé además que ese camino funciona de punta a punta (interpretar y
  guardar) dentro del mismo caso.

### 5 · "Los dos arneses viejos que integración tuvo que tocar son arreglos de arnés, no maquillaje" — **CIERTA, reproduje el antes y el después**

Para `importar-sin-imagenes.js`: reconstruí la versión anterior (`paginas: cfg.paginasPdf || null`, en vez
de `cfg.sinPdfjs ? null : (cfg.paginasPdf || [""])`) y la corrí contra el `valija.html` **de hoy**:

```
27 pasaron, 9 fallaron
```
**9 de 9**, ni uno más ni uno menos que lo declarado. La causa es mecánica y verificable por lectura: la
mayoría de los casos no pasaban `paginasPdf`, así que antes de esta ronda `window.pdfjsLib` simplemente no se
inyectaba en esos casos, y con la detección nueva de `pdfEngineReady()` en `valija.html` eso ahora bloquea
el selector de PDF — el arnés simulaba una plataforma sin `pdf.js`, que ni el teléfono del PM ni la app
publicada tienen. No es una prueba tapando un defecto: es una prueba que había dejado de reflejar la
plataforma real.

Para `importar-botones.js`: corrí la versión sin el `page.route(...).abort()` contra el `valija.html` de hoy
y **pasó igual**, pero tardó 17.9 s contra 5.3 s con el corte de red — la diferencia es la app esperando que
resuelvan (o no) los `<script src="https://cdnjs...">` reales de la cabecera, que en este entorno cortado
nunca contestan. No vi una falla directa esta vez, pero el motivo que da integración (evitar que cada corrida
dependa de si la red externa cuelga o no) es real y medible, no un encubrimiento.

### 6 · "Integración declaró tres cosas que no pudo verificar" — **PARCIALMENTE CIERTA: dos están escritas, una no**

- **Que `pdf.js` real se comporte como el simulador documentado:** escrita en tres lugares (comentario de
  cabecera de `import-engine.md` §5, encabezado de `importar-arranque.js`, `LEEME.md`). **Escrita donde
  corresponde.**
- **Que Chromium de escritorio sobre `file://` no es el entorno real:** escrita en `CLAUDE.md`, `LEEME.md` y
  el encabezado de `importar-arranque.js`. **Escrita donde corresponde.**
- **Que el techo de 4 s (`LIMITS_TECHO_MS`) es una decisión sin medición:** busqué "techo", "4000",
  "medición", "sin medir", "arbitrari" en `app/valija.html`, `docs/`, y `app/pruebas/` — no aparece en
  ningún lado. El comentario que sí existe junto a la constante explica *por qué hay que esperar* (el
  contrato dice que `claude.use()` puede tardar hasta 10 s), pero nunca dice que el número **4000**
  específicamente es un valor puesto a criterio, sin medir cuánto tarda `limits()` en la práctica. **No está
  escrita.** Esto es justo lo que la rúbrica pide en la dimensión 3: una afirmación de "no pude verificar
  esto" vale más que el silencio, pero sólo si queda en el entregable, no en lo que se me dice a mí.

### 7 · "`docs/qa/valija-bloque-b.md` ya marca H1 y H2 como resueltos" — **CIERTA, con un detalle**

```
grep -n "RESUELTO" docs/qa/valija-bloque-b.md
→ 126: Gravedad: bloqueante. — RESUELTO el 11/09.
→ 136: #### H2 — [RESUELTO el 11/09, a favor del código] ...
```
Los dos hallazgos llevan fecha y una frase de qué se decidió (H1 con causa raíz; H2 dejando el código como
está y no la especificación, con la justificación escrita ahí mismo). Lo que falta, y que mi informe anterior
pedía textualmente ("marcar H1 y H2 como corregidos, **con el commit y la fecha**"), es el hash del commit:
sólo hay fecha. Menor, pero es exactamente el tipo de detalle que la rúbrica no deja pasar por comodidad.

### 8 · "VAL-50 sube a P1 con el cruce explícito" — **CIERTA**

`docs/backlog.md`, sección VAL-50: el título dice "SUBE A P1", y el cuerpo cruza explícitamente que el mismo
`<script src="cdnjs...">` que falló con `jsPDF` en el teléfono del PM es el mecanismo con el que se carga
`pdf.js`, y que "el mismo fallo que hoy sólo arruina la exportación deja sin importar nada". Verificado
leyendo el archivo completo, no un resumen.

---

## Qué falta para llegar a 85, en orden

1. **Escribir, en el propio comentario de `LIMITS_TECHO_MS` (o en `docs/design/import-engine.md`), que 4000
   ms es un valor elegido por criterio y no medido contra el tiempo real de `limits()` en el teléfono.** Es
   la corrección más barata de esta lista y la única que hoy vive sólo en una conversación, no en el
   repositorio. **+2 honestidad, +1 diseño**
2. **Agregar el hash del commit a la marca de "RESUELTO" en `docs/qa/valija-bloque-b.md`** (fecha ya está).
   **+1 honestidad**
3. **Medir, aunque sea una sola vez, cuánto tarda `sample.limits()` en resolver en la app publicada**, y
   ajustar `LIMITS_TECHO_MS` si el dato lo pide, o dejar 4000 con el número real al lado como justificación.
   **+1 diseño, +1 verificación**
4. **Correr el guion de abajo en el Artifact publicado, desde el teléfono del PM, con los dos documentos
   reales.** Es lo único que mueve la dimensión 1 más allá de 20, y es la única condición para "dar por
   terminada" además del puntaje. **+8 a +10**

Con 1 a 3 el puntaje llega a 84-85. El punto 4 es indispensable para el segundo veredicto de todas formas.

---

## Lo que nadie puede verificar desde acá

Sigue siendo la razón por la que esta ronda no cierra la iteración, aunque sí habilita publicar un candidato.

**Nada de lo nuevo de esta ronda —el arranque sin poder quedar mudo, la detección de `pdf.js`— corrió jamás
fuera de Chromium de escritorio sobre `file://`.** Y dentro de eso, la pieza que de verdad importa
(`extractPdfText` contra el `pdf.js` real de un teléfono) sigue sin ejecutarse ni una vez, exactamente igual
que la ronda anterior: `cdnjs` sigue bloqueado en este entorno de trabajo.

### Guion para el PM, en su teléfono, sobre el Artifact publicado

Con los dos PDF reales a mano (el voucher de micro y el de Aerolíneas). Diez pasos, contá el tiempo en los
primeros tres.

1. **Abrí la app publicada y tocá "Importar" con un cronómetro mental.** Tiene que abrirse la hoja al
   instante, con un texto de "Preparando la importación…" y un botón para cancelar. Si tarda más de uno o
   dos segundos en aparecer *algo*, eso ya es un problema — anotá cuánto tardó.
2. **En la consola del navegador:** `window.pdfjsLib && window.pdfjsLib.version` tiene que decir
   `"3.11.174"`. Si es `undefined` o la hoja de importar dice "el lector de PDF no cargó", pará acá: es el
   hallazgo B de mi informe anterior, ya mitigado en pantalla pero con la causa (por qué cdnjs no respondió)
   todavía sin diagnosticar.
3. **Si la hoja tarda en completarse:** a los 7 segundos tiene que aparecer "esto está tardando más de lo
   normal" con la opción de cargar la reserva a mano. Contá si aparece antes, después, o nunca.
4. **En la consola, antes de importar:** `await (await claude.use("sample")).limits()`. Anotá si trae
   `images` o no.
5. **Mirá la pantalla apenas se abre la hoja** (después de que termine de "preparar"): si `limits()` no
   trajo `images`, tiene que decírtelo ahí mismo, antes de subir nada, y no tienen que aparecer los botones
   "Sacar foto" ni "Galería" — sólo el del PDF.
6. **Subí el voucher de micro (el PDF con texto).** Tiene que aparecer la reserva con el código `LB0TKCV5`,
   origen, destino y los dos horarios, pase lo que pase con `images`. En la hoja de revisión tiene que decir
   que se leyó del texto del PDF.
7. **Subí el PDF de Aerolíneas (el escaneado).** Si `limits()` no trajo `images`: tiene que aparecer el
   error de "es un escaneo, cargala a mano", sin ningún pedido nuevo al modelo en la pestaña Red. Si sí trajo
   `images`: tiene que interpretarse igual que antes, por imagen.
8. **Repetí el caso más importante que sigue sin probarse en el teléfono, del guion de mi informe
   anterior:** armá una valija tipo Ciudad, agregá un auto, entrá a la valija, tocá "Ver qué agrego" →
   "Sumar 2", cerrá la app sin scrollear, volvé a abrirla y entrá a la valija: las dos filas nuevas tienen
   que seguir marcadas "nuevo".
9. **Con el aviso de "Ver qué agrego" todavía ofrecido, cambiá el tipo de viaje o tocá "Rehacer la lista"
   antes de aplicarlo** (el caso de H1): confirmá que no aparece ningún cartel de éxito falso ni se pierde lo
   ya marcado.
10. **Colapsá a mano una categoría con ítems pendientes, agregá una reserva que le sume ítems nuevos, y
    fijate que el chip "N nuevos" sea la única señal si no la volvés a abrir** (el caso de H2, ya decidido a
    favor del código): confirmá que salir de la valija limpia esa marca igual.

**Además, y por separado:** la base de datos compartida real (`claude.use("db")`) y dos personas empacando a
la vez siguen sin poder probarse acá — nada cambió en ese frente en esta ronda tampoco.
