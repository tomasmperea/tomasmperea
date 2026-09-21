# Auditoría VAL-72 — segunda ronda de confirmación, sobre `06f7d25` (v29)

**Commit auditado:** `06f7d2521acaceb151a14b47f90df9bb1feceadc` · **Rama:**
`claude/travel-planning-app-mvp-jag9be` · **Árbol:** limpio (`git status --porcelain` vacío,
`HEAD=06f7d25` antes y después de auditar, sin tocar nada). **Delta puntuado:**
`4bf6d7d..06f7d25`. Ronda anterior: **49/100 · NO PUBLICAR**.

## Veredicto: **NO PUBLICAR — 46/100**

Baja 3 puntos más, no por lo que se cerró —eso está bien cerrado, en general— sino por lo que
esta misma ronda vuelve a abrir en el mismo lugar. Los cinco puntos de la ronda anterior están
resueltos, y los verifiqué yo mismo antes de tocar nada (ver §1). Pero al hacer la pregunta que se
me pidió hacer —*"¿hay algún otro tipo de dato que la app deja cargar y que el prompt no ve?"*—
apareció un sexto tipo de reserva, **`note`**, que la propia app documenta como uno de los "seis
tipos disponibles" (`docs/PRD.md:45`, `docs/backlog.md:24`) y que `summarizeReservationsForAI`
**nunca procesó, ni antes ni después de este commit**. Y la documentación nueva que este mismo
commit escribió para explicar el resumen dice, en presente: *"Esta función resumía **cuatro de los
cinco** tipos de reserva que la app deja cargar"* (`docs/design/packing-engine.md:257`) — un conteo
falso, porque hay seis, no cinco, y el sexto sigue invisible para el modelo hoy.

Es exactamente la trampa que el título de este commit dice haber cerrado ("yo afirmé dos cosas
falsas"), reproducida una tercera vez, en la misma frase que explica por qué las otras dos ya no
van a pasar.

---

## 1 · Los cinco puntos de la ronda anterior — verificados, y ciertos

Antes de tocar nada corrí lo que se afirmaba y leí lo que se afirmaba haber escrito.

| # | Afirmación de la entrega | Cómo lo verifiqué | Resultado |
|---|---|---|---|
| 1 | `summarizeReservationsForAI` ahora procesa `transfer`, con `desde/hasta/origen/destino/notas` saneadas | Lectura de `packing-engine.js:1843-1850` + saboteé el bloque (lo borré en una copia de `app/valija.html`, que es de donde el arnés extrae el motor) y corrí `val72-las-reservas-mandan.js` contra esa copia | **Cierto, y el arreglo resiste sabotaje real**: sin el bloque, `resumen.length === 0` y el prompt vuelve a decir "no hay reservas cargadas" — 2 `FALLA` antes de que el arnés reviente en `resumen[0].tipo` (ver nota de calidad en §4) |
| 2 | Se agregó la aserción del traslado que faltaba en `CON_NOTAS`, más un bloque propio | `git show 06f7d25 -- app/pruebas/val72-las-reservas-mandan.js`: `ok(/andén 4/.test(promptNotas), ...)` y el bloque "un traslado ES una reserva" con 5 aserciones nuevas | **Cierto** |
| 3 | `act` entra a `LEE` con fixtures nuevos (el arnés no tenía ni una actividad) | Mismo diff: `ACTIVIDADES` con 3 fixtures (uno completo, uno sin fecha/notas, uno sin título) + `act: ["start","title","notes"]` en `LEE` | **Cierto** |
| 4 | `docs/design/packing-engine.md` se actualizó a `entre-vuelos`/`horasEnTierra` y ya no describe el formato viejo como actual | `grep -n '"escala"\|duracionHoras' docs/design/packing-engine.md app/parts/packing-engine.js` → las 4 apariciones restantes son narración en pretérito ("Esto **decía**...", "por lo que **costó**"), ninguna en presente | **Cierto para lo que dice cubrir** — pero ver §2: el mismo párrafo nuevo introduce una afirmación falsa distinta |
| 5 | La cita falsa sobre VAL-73/`tier-del-modelo` se corrigió, con lo que de verdad se sabe | `docs/backlog.md:638-661`: dos fallas en dos días, "no hay dato: hay dos ausencias de dato", sin llamarlo flake; la deuda de `waitForTimeout` sin migrar (429/431/454/459/461/480) queda anotada como pendiente propia | **Cierto** |

Nada de esto se rompió al tocar `summarizeReservationsForAI` otra vez: corrí los nueve arneses
declarados en verde, uno por uno (regla de `LEEME.md`, nunca en paralelo), y coinciden todos:

```
NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/las-dos-copias.js        → todo en verde
NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/val72-las-reservas-mandan.js → todo en verde
NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/motores-desde-html.js   → 39 pasaron, 0 fallaron
NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/valija-bloque-b.js      → 111 pasaron, 0 fallaron
NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/hallazgos-qa-bloque-b.js → 31 pasaron, 0 fallaron
NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/tier-del-modelo.js      → 42 pasaron, 0 fallaron
NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/val63-cambia-el-viaje.js → todo en verde
NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/val74-sin-tope-de-ocho.js → todo en verde
node app/pruebas/el-script-parsea.js                                            → todo en verde
```

(Nota metodológica: `valija-bloque-b.js`, `hallazgos-qa-bloque-b.js`, `tier-del-modelo.js` y
`val63-cambia-el-viaje.js` necesitan `NODE_PATH=/opt/node22/lib/node_modules` para encontrar
Playwright — sin eso fallan con `MODULE_NOT_FOUND`, no por el producto. `LEEME.md` lo documenta;
lo confirmé antes de contarlo como falla.)

**Las dos copias del motor**, con mi propia comparación (no confié en `las-dos-copias.js` solo):

```
· packing-engine.js contra su copia en el HTML
  ok    la cabecera entera es idéntica
  ok    ninguna función falta en el HTML
  ok    el HTML no tiene funciones de más
  info  50 idénticas · 1 con cola de más en parts · 0 realmente distintas
  ok    ninguna función divergió: las dos copias dicen lo mismo
```
Idénticas.

---

## 2 · El hallazgo nuevo: `note` es el sexto tipo, y sigue sin llegar al modelo

Se me pidió: *"Buscá otra vez la clase de error, no la instancia: ¿hay algún otro tipo de dato que
la app deja cargar y que el prompt no ve?"* La respuesta es sí.

**La app tiene seis tipos de reserva, no cinco.** No es una interpretación mía:

```
docs/PRD.md:45:      Carga manual por tipo de reserva. Vuelo, alojamiento, auto, traslado, actividad y nota.
docs/backlog.md:24:   Seis tipos disponibles: vuelo, alojamiento, auto, traslado, actividad y nota.
app/parts/import-engine.js:202:  var RESERVATION_TYPES = ["flight", "stay", "car", "transfer", "act", "note"];
app/valija.html:942:  note: {label:"Nota", icon:I.note, cls:"note", band:"note"}
```

`note` no es un tipo degradado o un descarte: tiene su propio ícono, su propia banda de color, su
propio botón en el selector de tipo de reserva (`sheetItem`, línea ~8708) y su propio placeholder de
título ("Anotación"). Se crea, se guarda y se lista exactamente igual que un vuelo o un traslado.

**`summarizeReservationsForAI` (línea 1767 de `packing-engine.js`) filtra `flight`, `stay`, `car`,
`transfer` y `act`. No hay ningún `items.filter(i => i.type === "note")` en toda la función**, ni
antes de este commit ni después. Lo comprobé leyendo la función entera y, empíricamente, corriendo
esto contra el motor extraído de `app/valija.html`:

```js
const SOLO_NOTA = [{ type:"note", title:"Recordatorio", start:"2027-04-02T09:00",
                      notes:"Llevar el certificado de vacunación de fiebre amarilla" }];
pe.summarizeReservationsForAI(EUROPA, SOLO_NOTA)   // → []
pe.destinationPrompt(pe.buildPackingList({ trip:EUROPA, items:SOLO_NOTA }))
  // → "...Reservas del viaje...: (todavía no hay reservas cargadas)"
```

Un viaje con **sólo** una nota cargada —el mismo síntoma exacto que describía el hallazgo central de
la ronda anterior para `transfer`— le dice al modelo que no hay reservas, teniendo una. Si la
persona usa "Nota" para algo que debería influir el equipaje ("llevar traje, es un casamiento",
"el hotel no tiene secador"), esa información no llega nunca a la capa de IA. No hay ningún
comentario en el código, ni una línea en `docs/design/packing-engine.md`, que declare esto como una
decisión ("las notas libres no se resumen para la IA porque...") — es la misma omisión sin
declarar que la ronda anterior encontró para `transfer`, ahora en el tipo vecino, sin tocar.

**Y lo más grave no es que exista el hueco — es que este commit escribió, esta misma ronda, una
frase que lo esconde con un número equivocado.** El párrafo nuevo de
`docs/design/packing-engine.md:257` dice:

> "Esta función resumía **cuatro de los cinco tipos de reserva** que la app deja cargar, y se
> salteaba el traslado desde VAL-44."

Cinco es falso: hay seis, y siguen siendo cinco procesados hoy (con transfer arreglado, `note` sigue
afuera). La frase da a entender que, arreglado `transfer`, el resumen ya cubre "todos salvo el
traslado" — exactamente la lectura que hace que nadie vuelva a mirar esto. Es una afirmación sin
respaldo, escrita en la misma ronda que se autodescribe como "cerrar dos afirmaciones falsas", sobre
el mismo archivo, en el mismo párrafo que explica el propio hallazgo que la generó.

**Por qué esto pesa como diagnóstico de causa raíz y no sólo como un bug nuevo:** `CLAUDE.md` ya
tiene escrita esta regla para esta misma historia — *"¿Qué caso vecino comparte la causa?"*— y el
propio `docs/backlog.md` (línea 876-881) cuenta que VAL-72 ya perdió dos rondas por no hacerse esa
pregunta sobre el cajón de al lado (traslado/auto sí, alojamiento no). Esta es la tercera vez que
pasa lo mismo en la misma historia: se arregló `transfer` y no se preguntó por `note`, que está a
seis líneas de distancia en el mismo `TYPES`/`RESERVATION_TYPES` y a una búsqueda de texto de
distancia en `summarizeReservationsForAI`.

---

## 3 · Sabotaje de las aserciones nuevas (pedido explícito)

Repliqué el sabotaje yo mismo sobre una copia de `app/valija.html` (que es de donde
`val72-las-reservas-mandan.js` extrae el motor, no de `app/parts/`):

```
$ python3 - <<'EOF'   # borra el bloque forEach de transfer, deja el comentario que lo explica
...
EOF
replacements: 1
$ node app/pruebas/val72-las-reservas-mandan.js /tmp/valija-sabotage.html
...
  ok    pero el traslado se manda igual: callarlo sería perder información     # (caso "hasta==destino", no toca el forEach nuevo)
  ...
  FALLA y la del traslado, que era la que faltaba
· un traslado ES una reserva, y hasta acá no llegaba al modelo
  info   resumen: []
  FALLA el traslado entra al resumen de reservas (0)
TypeError: Cannot read properties of undefined (reading 'tipo')
    at .../val72-las-reservas-mandan.js:582
```

**Las aserciones nuevas son reales**: sin el bloque que agrega `transfer`, fallan donde tienen que
fallar (2 `FALLA` capturadas antes de que el arnés corte por una excepción no atrapada al leer
`resumen[0].tipo` sobre un arreglo vacío). Es un hallazgo menor de calidad, no de honestidad: el
arnés no sigue reportando el resto de las aserciones después de esa línea porque revienta en vez de
devolver `undefined` con gracia — pierde cobertura de diagnóstico en un sabotaje real, aunque el
resultado (exit code 1, con `FALLA` visible) sigue señalando la regresión correctamente.

Restauré `app/parts/packing-engine.js` y borré la copia sabotada de `/tmp` antes de seguir; el árbol
quedó limpio (`git status --porcelain` vacío, confirmado).

---

## Afirmaciones verificadas

| Afirmación | Cómo la verifiqué | Resultado |
|---|---|---|
| `summarizeReservationsForAI` ahora procesa `transfer` | Lectura + sabotaje propio sobre copia de `valija.html` | **Cierto**, resiste el sabotaje |
| El recorte a 80 caracteres de `origen`/`destino` del traslado hace lo que dice | Lectura de `packing-engine.js:1846-1847`, mismo patrón que `titulo` de actividad (línea 1855, ya auditado antes) | **Cierto** |
| La nota del traslado se sanea igual que las demás | Lectura: usa `sanitizeNotesForAI(t.notes)`, la misma función que vuelo/alojamiento/auto/actividad; aserción propia del commit lo confirma (`"11 5555 4444"` no llega) | **Cierto** |
| La aserción del fixture `CON_NOTAS` para el traslado se agregó | `git show` del diff | **Cierto** |
| `act` entra a `LEE` con fixtures con-y-sin | `git show` del diff, corrida del arnés | **Cierto** |
| `docs/design/packing-engine.md` ya no describe `tipo:"escala"` como el formato actual | Lectura completa de las 4 menciones restantes, todas en pretérito | **Cierto** |
| La cita de VAL-73/`tier-del-modelo` se corrigió con datos reales | Lectura de `docs/backlog.md:638-661` | **Cierto** |
| Los nueve arneses declarados en verde lo están | Corridos uno por uno, `NODE_PATH=/opt/node22/lib/node_modules` | **Cierto**, todos los números coinciden |
| Las dos copias del motor siguen idénticas | `las-dos-copias.js` + lectura de su salida completa | **Cierto** |
| **"Esta función resumía cuatro de los cinco tipos de reserva que la app deja cargar"** (`docs/design/packing-engine.md:257`) | `docs/PRD.md:45`, `docs/backlog.md:24`, `RESERVATION_TYPES` en `import-engine.js`, `TYPES` en `valija.html` | **Falso** — hay seis tipos, no cinco; y hoy siguen procesándose cinco, no los "cuatro de cinco" que la frase implica arreglados |
| `summarizeReservationsForAI` cubre todos los tipos de reserva que la app deja cargar, tras este commit | Lectura completa de la función + prueba empírica con `type:"note"` | **Falso** — `note` nunca se procesa, ni la reserva ni sus notas llegan al modelo |
| `VALIJA_VERSION` está en "29", único árbol | `grep VALIJA_VERSION app/valija.html`, `git status --porcelain` | **Cierto** |
| "Lo publicado sigue siendo la v23" | No lo puedo comprobar desde acá (no tengo acceso al Artifact) | **No verificable — testimonio del agente que entrega, no confirmado por mí** |

---

## Tabla de las seis dimensiones

| # | Dimensión | Peso | Puntaje | Por qué |
|---|---|---|---|---|
| 1 | Verificación en el entorno real | 30 | **18** | Sin cambio de método respecto de rondas anteriores: sustituto fiel (motor extraído del HTML real, no copiado de memoria — confirmado con `las-dos-copias.js` y mi propia comparación), brecha del teléfono declarada explícitamente ("NO probado en el teléfono del PM"). Este delta es lógica de armado de prompt, no un gesto de UI nuevo, así que no aplica la resta de "tocar el control". |
| 2 | Diagnóstico de causa raíz | 15 | **5** | El arreglo de `transfer` en sí es textbook: reproducido empíricamente, causa identificada por lectura, y comprobado que el arreglo la elimina (mi propio sabotaje lo confirma). Pero la ronda entera nació de una lección de "buscar la clase de error, no la instancia" y no se aplicó esa lección a sí misma: `note` es un tipo de reserva de primera clase, listado en el mismo `RESERVATION_TYPES` y en el propio PRD, y nadie preguntó si comparte la causa. Es la misma pregunta que esta historia ya falló dos veces (backlog 876-881), ahora una tercera. |
| 3 | Honestidad de lo verificado | 15 | **5** | A favor: la autocorrección de las dos afirmaciones falsas de la ronda anterior es genuina y bien escrita, con la cita exacta de dónde estaba el error. En contra: el mismo commit introduce una tercera afirmación falsa ("cuatro de los cinco tipos"), sin verificarla contra el propio PRD/backlog del proyecto — exactamente el patrón que el commit dice haber corregido, no detectado por quien entrega. |
| 4 | Cumplimiento del contrato | 15 | **7** | De los cinco puntos de "lo que falta para llegar a 85" de la ronda anterior, cuatro están cumplidos de verdad (transfer, aserción de CON_NOTAS, `act` en `LEE`, cita de tier-del-modelo/VAL-73) y verificados por mí. El quinto (actualizar la documentación del resumen) se cumple para lo que pedía —sacar el `tipo:"escala"` stale— pero al hacerlo agrega una afirmación nueva y falsa sobre la cobertura de tipos, en el mismo párrafo. |
| 5 | Calidad interna | 15 | **6** | A favor: pruebas reales, verificadas con sabotaje propio, y las dos copias del motor siguen idénticas. En contra: el mecanismo `LEE` que debía prevenir justamente esto (un tipo de reserva sin cobertura) es una lista escrita a mano que hay que acordarse de extender — ya le faltó `transfer`, después `act`, y ahora falta `note`, sin que el propio mecanismo lo detecte porque no deriva su universo de tipos de `RESERVATION_TYPES`/`TYPES`, que es la fuente real. Y la documentación de diseño, en el mismo commit que la corrige, queda describiendo mal la cobertura actual. |
| 6 | Diseño y decisiones de producto | 10 | **5** | La forma que se le dio al traslado (mismos campos que los demás tipos, recorte a 80, saneado) es consistente y defendible. Pero la exclusión de `note` de la capa de IA —que puede ser una decisión de producto legítima (una anotación libre no siempre es información estructurada útil para equipaje) o puede ser el mismo bug que `transfer` era— no está argumentada en ningún lado: no hay una frase que diga "se excluye a propósito porque..." Es una decisión escondida, no declarada, sobre el mismo tema que esta ronda dice haber resuelto. |
| | **Total** | **100** | **46** | **NO PUBLICAR.** El único hueco real de la dimensión 1 es el entorno (declarado, con guion de prueba pendiente). Las otras cinco dimensiones bajan por hallazgos de lectura de código y documentación —el mismo patrón exacto que la rúbrica dice que no tiene piso de 70. |

---

## Lo que falta para llegar a 85, en orden

1. **Decidir sobre `note`, y decidirlo de las dos formas que ya se usaron para `transfer` o para
   la exclusión declarada.** O se agrega `summarizeReservationsForAI` para procesar `type:"note"`
   con el mismo patrón que los otros cinco (fecha si tiene, título recortado, notas saneadas), o se
   escribe explícitamente en `docs/design/packing-engine.md` por qué las notas libres no se resumen
   para la IA. Lo que no puede seguir es el silencio: es el mismo hallazgo central que hundió la
   ronda anterior, en el tipo vecino.
2. **Corregir `docs/design/packing-engine.md:257`.** "Cuatro de los cinco" tiene que decir lo que
   es cierto hoy — y una vez resuelto el punto 1, actualizarlo otra vez para que cuente los seis
   tipos y diga qué le pasa a cada uno.
3. **Agregar una aserción para `note`** en `val72-las-reservas-mandan.js`, con el mismo patrón que
   `SOLO_TRASLADO_CON_NOTA`: un viaje con sólo una nota, y comprobar qué hace el prompt con ella
   (que llegue, si se decide que llegue; que el prompt lo declare, si se decide que no).
4. **Hacer que `LEE` derive su universo de tipos de `RESERVATION_TYPES`/`TYPES`**, no de una lista
   escrita a mano. Es la misma regla que `CLAUDE.md` ya tiene para los fixtures ("cuando una regla
   se pueda convertir en una aserción, se convierte") aplicada al propio mecanismo que debía
   prevenir exactamente este hueco — y que ya lo dejó pasar tres veces.
5. Recién con 1-4 resueltos y verificados (no declarados), volver a correr el caso de éxito de
   VAL-72 (Europa MAD/CDG/FCO) para confirmar que nada de esto lo rompió, y entonces sí: **probar en
   el teléfono** el criterio central de la historia, que sigue pendiente desde la novena ronda.

---

## Lo que nadie puede verificar desde acá

1. **Cómo interpreta el modelo real un renglón `entre-vuelos`, y ahora también uno `traslado`.**
   Sigue siendo la premisa central de VAL-72 y de este agregado, y ninguna corrida en `node` ni en
   Chromium de escritorio la prueba. **Pasos para el PM, una vez publicado:** cargar el viaje Europa
   (EZE→MAD día 1, MAD→CDG día 6, CDG→FCO día 11) y confirmar que la sugerencia trata a Madrid y
   París como destinos, no como escalas; y cargar un viaje con un traslado con una nota relevante
   ("llevamos las bicis plegadas") y confirmar en el prompt (si hay forma de inspeccionarlo) o en el
   resultado sugerido que la nota influyó.
2. **El visor del teléfono en sí** — nada de este delta tocó DOM, permisos ni sandbox; sigue siendo
   la única razón por la que la dimensión 1 no puede subir de 18.
3. **Si lo publicado en el Artifact sigue siendo la v23.** No lo puedo comprobar desde acá: no
   tengo acceso al Artifact publicado. Lo que se me reportó ("sigue siendo v23, según mi lectura")
   queda anotado como testimonio del agente que entrega, no como verificado por mí. Dado que esta
   entrega no llega a candidato (46/100), tampoco hay todavía nada nuevo que pedirle al PM que
   pruebe.
4. **Si la intermitencia de `tier-del-modelo.js` (dos fallas sin capturar, 20/09 y 21/09) tiene una
   causa real o es ruido de máquina.** Sin la salida de la corrida que falló, ninguna de las dos se
   puede distinguir desde acá tampoco; el propio backlog ya lo deja así, sin inventar una causa.

---

## Archivos revisados

- `git show 06f7d25` completo (los tres archivos de código, `docs/backlog.md`,
  `docs/design/packing-engine.md`, y el archivo de auditoría que trae)
- `app/parts/packing-engine.js`: `summarizeReservationsForAI` completa (líneas 1767-1861), y su
  copia extraída de `app/valija.html`, comparadas de forma independiente
- `app/valija.html`: `TYPES` (línea 937-943), `RESERVATION_TYPES`/`sheetItem` (líneas 4100, 8677-8760)
- `app/parts/import-engine.js`: `RESERVATION_TYPES` (línea 202)
- `docs/PRD.md` (línea 45), `docs/backlog.md` (línea 24, y sección VAL-72 completa líneas 787-950,
  y VAL-73/VAL-74 líneas 530-661)
- `docs/design/packing-engine.md` (§4 completo, líneas 217-260)
- `app/pruebas/val72-las-reservas-mandan.js` completo, corrido, y con sabotaje propio sobre una
  copia de `app/valija.html` (no sobre `app/parts/`, porque el arnés extrae el motor del HTML)
- `app/pruebas/LEEME.md` (para el `NODE_PATH` correcto y la regla de correr de a uno)
- `docs/auditoria/2026-09-19-val72-confirmacion.md` (ronda anterior, para no repetir lo ya cerrado)
