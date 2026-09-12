# Auditoría — El tier del modelo baja a `"default"` para el camino de texto

**Qué se audita:** `app/valija.html`, commits `58193f8`, `43e2213` y el commit de reporte `c935573`
(HEAD). Decisión de negocio en `docs/design/import-engine.md` § 4.9, no rediscutida. Se audita
implementación, instrumentación y pruebas.

---

## Veredicto

| Decisión | Resultado |
|---|---|
| **Publicar como candidato** | **SÍ** — con las brechas de abajo declaradas al PM |
| **Dar la iteración (VAL-60) por terminada** | **NO** |

**Puntaje total: 65 / 100.**

No hay excepción por urgencia. El puntaje bajo no es por la dimensión 1 (el entorno real sigue siendo
el teléfono, y eso está bien declarado): es porque **VAL-60 no está terminado** — sólo uno de sus tres
criterios de aceptación se tocó en este cambio — y porque el arnés que respalda la afirmación central
(`tier-del-modelo.js`) tiene una falla intermitente sin diagnosticar que nadie volvió a perseguir antes
de commitear.

Publicar como candidato es correcto igual: todo lo que se podía verificar acá **se verificó** (yo mismo
terminé la caza de la intermitencia que quedó pendiente, ver abajo), ninguna afirmación se reportó como
"verificado" sin respaldo, y no hay un hallazgo de auditoría anterior relacionado con este cambio que
siga abierto sin decisión escrita.

---

## Las seis dimensiones

| # | Dimensión | Puntaje | Por qué |
|---|---|---|---|
| 1 | Verificación en el entorno real | **20 / 30** | Sustituto fiel (Chromium + Playwright, gestos reales, simulador de `sample`/`limits`/`pdf.js` escrito contra el contrato y verificado por mí contra `sample.d.ts`), y la brecha —nada de esto corrió en el teléfono— está declarada en el propio arnés, en `LEEME.md` y en el diseño. No hay overclaim. Falta el único tramo que sólo el teléfono da: 20 es el techo sin él. |
| 2 | Diagnóstico de causa raíz | **7 / 15** | La pregunta de `modelTierApplied` está bien resuelta (contrastada contra el contrato, no supuesta). Pero la intermitencia del propio arnés —el hallazgo más importante de esta ronda— se dejó con **una sola hipótesis sin confirmar y sin volver a correrla** antes de commitear, pudiendo hacerlo en el mismo entorno (lo hice yo en la auditoría, ver abajo). |
| 3 | Honestidad de lo verificado | **14 / 15** | Declaración sistemática y sin que se la pidan: qué prueba el arnés y qué no, por qué `modelTierApplied` no llega, la intermitencia con su sospecha, la brecha del CDN de cdnjs. Ninguna frase dice "verificado" donde debería decir "pedido". |
| 4 | Cumplimiento del contrato | **7 / 15** | VAL-60 tiene tres criterios en `docs/briefs/adjuntar.md`. Sólo el primero (bajar el tier de texto) está hecho y probado. El segundo (un lote, no una llamada por archivo) **no se tocó y no se menciona en esta entrega**. El tercero (registrar `modelTierApplied`) queda **honestamente declarado como imposible por esta vía**, pero sigue siendo un criterio del brief sin cumplir. Ver más abajo. |
| 5 | Calidad interna | **9 / 15** | Los dos motores embebidos son **bytes idénticos** a `app/parts/`. 383 aserciones de regresión, todas corridas por mí y en verde. Pero: el arnés nuevo tiene una falla intermitente sin cerrar, apoyada en varios `waitForTimeout` fijos que son exactamente el patrón que ya rompió `valija-bloque-b.js` antes; y el propio autor admite haber commiteado el árbol entero mientras otro agente trabajaba (violación de "un archivo, un dueño", autodeclarada). |
| 6 | Diseño y decisiones de producto | **8 / 10** | La decisión está en un solo lugar (`const TIER`), el call site no elige el tier (lo decide `tierDeImportacion` mirando las opciones), y `"quick"` se descartó con una razón concreta y un criterio explícito de cuándo reconsiderarlo. Bien defendida y con lo descartado a la vista. |
| | **Total** | **65 / 100** | |

---

## Afirmaciones verificadas

### 1. "El camino de texto pide `default`, el de imágenes `complex`, la valija sigue en `complex`" — **CIERTA**

Corrí el arnés real, no lo repetí de la descripción:

```
NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/tier-del-modelo.js
→ 42 pasaron, 0 fallaron
```

Leí `askJson()` en `app/valija.html` línea 987 y siguientes: arma `{modelTier: tier}` y sólo agrega
`images` si `extra.images` existe. Las tres llamadas del código (`equipaje-plan` línea 5047,
`equipaje-destino` línea 5370, `callModel` de `sheetImport` línea 6329) pasan por ahí. No hay una cuarta
llamada a `sample.json` en todo el archivo (`grep -n "sample.json" app/valija.html` da exactamente esas
tres). El gesto de imagen se toca de verdad: `tocarYElegir()` hace `click()` sobre `[data-pick="im_gal"]`
y espera el evento `filechooser` real de Playwright — no dispara ningún `change` a mano. Esto es
justamente la trampa 1 del proyecto, y acá no aparece.

### 2. "El control negativo funciona en los tres tiers" — **CIERTA**

Corrí los tres, generando las copias con `sed` exactamente como indica `app/pruebas/LEEME.md`:

```
sed 's/texto:"default"/texto:"complex"/' app/valija.html > /tmp/t1.html
NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/tier-del-modelo.js /tmp/t1.html
→ 37 pasaron, 5 FALLA   (declarado: 5 FALLA — coincide)

sed 's/imagenes:"complex"/imagenes:"default"/' app/valija.html > /tmp/t2.html
→ 41 pasaron, 1 FALLA   (declarado: 1 FALLA — coincide)

sed 's/equipaje:"complex"/equipaje:"quick"/' app/valija.html > /tmp/t3.html
→ 40 pasaron, 2 FALLA   (declarado: 2 FALLA — coincide)
```

Las tres cifras coinciden exactamente con lo escrito en `tier-del-modelo.js` y en `LEEME.md`. El arnés
puede fallar: no es una prueba de configuración que siempre da verde.

### 3. "`modelTierApplied` no se puede leer por el camino que usa la app" — **CIERTA**

Leí `sample.d.ts` 0.2.41 directamente (no el resumen del reporte):

- `function json<T = unknown>(input, options?): Promise<T>` — resuelve el valor JSON parseado, sin
  envoltorio.
- `interface SampleResult { text; truncated; modelTierApplied }` — es lo que resuelve `sample()`, no
  `sample.json()`.
- `grep -n "sample(" app/valija.html` (excluyendo `.json`/`.limits`) no encuentra ninguna llamada a
  `sample()` en todo el archivo: las tres llamadas de la app usan exclusivamente `.json()`.

No hay otra vía en el archivo por la que `modelTierApplied` pudiera llegar. La afirmación es correcta y
no hay atajo que se haya pasado por alto.

### 4. "Ninguna opción ajena al contrato llega a `sample.json()`" — **CIERTA**

Por código: `askJson()` construye `opciones = {modelTier: tier}` y sólo copia `extra.images` si existe.
`modo`, `archivo` y `paginas` —que sí viajan en el objeto `opts` que le pasa `ImportEngine`— nunca se
copian a `opciones`. Por prueba: `assertClavesLimpias()` en `tier-del-modelo.js` compara
`Object.keys(opts)` de la llamada real contra `["images", "modelTier"]` y las cuatro pruebas que la usan
(texto, PDF con texto, foto, equipaje) están en verde. Coincide el código con lo que la prueba mide.

### 5. "Todo lo anterior sigue en verde" — **CIERTA**, corrida por mí, no repetida del reporte

```
node app/parts/import-engine.test.js                    → 69 pasaron, 0 fallaron
NODE_PATH=... node app/pruebas/motores-desde-html.js     → 68 pasaron, 0 fallaron (PackingEngine)
                                                            69 pasaron, 0 fallaron (ImportEngine)
NODE_PATH=... node app/pruebas/valija-bloque-b.js        → 111 pasaron, 0 fallaron
NODE_PATH=... node app/pruebas/hallazgos-qa-bloque-b.js  → 31 pasaron, 0 fallaron
NODE_PATH=... node app/pruebas/importar-sin-imagenes.js  → 45 pasaron, 0 fallaron
NODE_PATH=... node app/pruebas/importar-arranque.js      → 59 pasaron, 0 fallaron
```

Además comparé bytes: extraje el cuerpo del IIFE de `PackingEngine` e `ImportEngine` de `app/valija.html`
y lo comparé con `app/parts/packing-engine.js` y `app/parts/import-engine.js` (descontando el
encabezado/UMD). `diff` no encuentra ninguna diferencia de contenido, sólo el salto de línea del borde de
extracción. **El motor embebido es byte a byte el mismo que el fuente**, no una copia que se desalineó.

---

## La intermitencia — lo que se pidió cazar

Corrí `tier-del-modelo.js` **diez veces**, cada una a un archivo separado, sin tubería:

```
for i in 1 2 3 4 5 6 7 8 9 10; do
  NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/tier-del-modelo.js > /tmp/t$i.txt 2>&1
done
grep -c FALLA /tmp/t*.txt   → 0 en las diez
grep pasaron /tmp/t*.txt    → "42 pasaron, 0 fallaron" en las diez
```

**No apareció.** Tal como pide el brief de esta auditoría: lo digo de frente, es un dato igual. Diez
corridas en verde no descartan la falla (una de cada siete, extrapolado, tendría ~21% de chance de no
aparecer en diez intentos independientes — nada raro), pero sí bajan la estimación de la tasa real: no es
tan alta como "una de cada siete" hace temer, o esta máquina está menos cargada que la que la vio fallar
el 12/09.

Lo que **sí** puedo aportar por lectura de código, ya que no pude reproducirla en vivo: el arnés apoya
varias de sus aserciones en esperas fijas, exactamente el patrón que el propio `LEEME.md` señala como
sospecha y que ya tumbó `valija-bloque-b.js` antes de esta iteración:

- `app/pruebas/tier-del-modelo.js:303` y `:318` — `await page.waitForTimeout(1200)` inmediatamente
  después de tocar `#pk-build`, y a continuación se leen `llamadas` y se cuenta
  `.pk-row[data-row]`. No hay ninguna espera sobre una señal real de "terminó" (no existe un
  `waitForSelector` sobre las filas ni sobre que `PK.generating` se apague): si la máquina está cargada y
  la generación tarda más de 1200 ms, la aserción de la cantidad de filas puede fallar antes de que la
  respuesta simulada del modelo (que sí resuelve rápido) termine de aplicarse al DOM.
- `app/pruebas/tier-del-modelo.js:330` — `await page.waitForTimeout(1500)` después de tocar `#save` para
  el auto, y después se cuenta cuántas `llamadas` nuevas hubo. Mismo patrón: un techo fijo antes de un
  recálculo asincrónico real (`recalcularPlanContra`).

No pude confirmar que sea **esta** la aserción que falló el 12/09 —la salida se perdió, como dice
`LEEME.md`—, así que esto queda como **hipótesis reforzada por inspección de código, no confirmada por
reproducción**. Es exactamente lo que corresponde reportar: no comprobado, no inventado.

---

## Lo que falta para llegar a 85, en orden

1. **Decidir por escrito el alcance real de VAL-60.** El brief (`docs/briefs/adjuntar.md` § VAL-60) tiene
   tres criterios: (a) bajar el tier de texto — hecho; (b) resolver un lote de documentos en una sola
   llamada, no una por archivo — **no tocado, no mencionado en esta entrega**; (c) registrar qué tier
   contestó de verdad (`modelTierApplied`) — **declarado imposible por este camino**, sigue sin cumplirse
   como criterio. Si el PO decide que (b) y (c) quedan para otra historia, hay que escribirlo — hoy nada
   lo dice, y el pedido de esta auditoría lo describe como "lo último que quedó abierto de VAL-60", que no
   es exacto. **+5 a +7 cumplimiento, y evita que la iteración 3 arranque sobre una base que se cree más
   cerrada de lo que está.**
2. **Reemplazar los `waitForTimeout` fijos de `tier-del-modelo.js` (líneas 303, 318, 330) por una espera
   sobre una señal real** (`waitForSelector(".pk-row[data-row]")`, o esperar a que `llamadas(page)` tenga
   la cantidad esperada con `waitForFunction`, en vez de un número de milisegundos). Mientras tanto, correr
   el arnés bajo carga (en paralelo con otra suite pesada) unas diez veces más para intentar forzar la
   falla y confirmar o descartar la hipótesis de arriba. **+4 a +6 calidad interna, +3 a +5 causa raíz.**
3. **Implementar o re-planificar explícitamente el lote de VAL-60(b).** Es la palanca que de verdad baja
   la frecuencia del aviso de límite de uso de "cada cinco" a "cada veinte" documentos (según
   `docs/investigacion/cuota-de-la-capa-inteligente.md` § 3.2); el cambio de tier solo, sin lote, reduce el
   costo por llamada pero no la cantidad de llamadas. **+5 cumplimiento.**
4. **Agregar el hash de commit a la instrumentación (`ValijaTier`) o a la propia entrega**, para que quede
   trazable qué versión del HTML corresponde a cada corrida guardada — detalle menor, heredado de un
   pendiente de la auditoría anterior sobre otra área del código (`docs/qa/valija-bloque-b.md`, "RESUELTO"
   sin hash), y que conviene cerrar de una vez ya que está señalado dos veces. **+1 honestidad.**

Con 1 y 2 el puntaje sube a 76-79. Con 1, 2 y 3 llega a 84-89. El punto 4 es housekeeping, no crítico para
esta entrega puntual.

---

## Lo que nadie puede verificar desde acá

Nada de esto corrió jamás fuera de Chromium de escritorio sobre `file://`, con `claude`, `sample.limits`
y `pdf.js` simulados. Es exactamente la brecha que el propio arnés declara, y coincide con lo que yo
comprobé al leerlo: no hay overclaim que corregir, sólo el tramo que falta.

**Guion para el PM, en el Artifact publicado, desde el teléfono** (una vez que se publique este cambio):

1. **Importar el voucher de micro de siempre** (pegando el texto, o subiendo el PDF si tiene capa de
   texto). Tiene que salir la misma reserva de siempre —código, origen, destino, los dos horarios—: el
   cambio es de costo, no de resultado. Si algo se lee distinto o peor que antes, es un hallazgo real.
2. **Ojo con la caché.** El contrato dice que una respuesta se reutiliza si `input`, `modelTier` e
   `images` coinciden. Como el tier de texto cambió de `"complex"` a `"default"`, **la primera vez que se
   importe un documento después de publicar, va a pedirle al modelo de nuevo aunque ya se hubiera
   importado ese mismo documento hace menos de cinco minutos con la versión vieja** — es lo esperado, no
   un bug. Para confirmar que la caché sigue funcionando bien con el tier nuevo: importar el mismo
   documento dos veces seguidas dentro de los cinco minutos: la segunda tiene que salir visiblemente más
   rápida (sin gastar cuota).
3. **En la consola del navegador, después de importar algo:** `ValijaTier.resumen()` tiene que mostrar una
   entrada con `pedido:default` para texto y (si se llegó a armar la valija) `pedido:complex` para
   equipaje, con `aplicado:no se sabe` — es la parte que la app no puede leer, declarada a propósito.
4. **Si la vista llega a aceptar imágenes en algún momento**, subir una foto y confirmar en
   `ValijaTier.log()` que esa llamada específica pidió `complex`, no `default` — hoy el teléfono del PM no
   tiene `images` en `limits()`, así que este paso no se puede ejercer todavía.
5. **Nada visible cambia en la pantalla.** Si aparece un texto, un botón o un estado nuevo que no estaba
   antes, es un efecto colateral no buscado de este cambio y hay que reportarlo aparte.

---

## Archivos revisados

- `app/valija.html` (diff de `58193f8`, `43e2213`; commit de reporte `c935573`)
- `app/pruebas/tier-del-modelo.js` (arnés completo, corrido diez veces + tres controles negativos)
- `app/pruebas/LEEME.md`, `docs/design/import-engine.md` § 4.9, `docs/investigacion/cuota-de-la-capa-inteligente.md`
- `docs/briefs/adjuntar.md` § VAL-60
- `sample.d.ts` 0.2.41 (`/tmp/claude-0/.../artifact-capabilities/0.2.41/sample.d.ts`), leído completo
- `app/parts/import-engine.js`, `app/parts/packing-engine.js` (comparados byte a byte contra la copia embebida)
- `docs/auditoria/2026-09-12-iteracion-2-ronda-2.md` (para hallazgos previos aún abiertos)
