# Auditoría VAL-72 — novena ronda ("322 horas no son una escala")

**Commit auditado:** `4c99a4255841b61418b4c2f514ab525a1da89933` (v28) · **Rama:**
`claude/travel-planning-app-mvp-jag9be` · **Árbol:** limpio (`git status --porcelain` vacío,
`HEAD=4c99a42` antes y después de auditar). **Publicado:** no verificable desde acá (ver abajo).
Rondas anteriores: 57, 51, 70, 59, 51, 54, 56, 36.

## Veredicto: CANDIDATO — 78/100

**Sale como candidato, no como terminado.** La dimensión floja sigue siendo únicamente la 1
(verificación en el entorno real), y está floja por la razón que el candado permite: nada de
esta ronda tocó DOM ni visor, y la brecha del teléfono está declarada, no escondida. El hallazgo
bloqueante de la octava ronda está genuinamente cerrado. Hay un hallazgo nuevo, de calidad
interna, que no es bloqueante pero hay que arreglar antes de dar la historia por terminada.

---

## 1 · El hallazgo de la octava ronda, reproducido antes de tocar nada

Repetí el repro de la octava ronda contra el commit **anterior** (`0aa1ae1`, v27) para confirmar
que el defecto existía antes del arreglo:

```
$ node -e '...pe.destinationPrompt(pe.buildPackingList({ trip:EUROPA, items:IDA_Y_VUELTA_CON_END }))...' (contra 0aa1ae1)
  - {"tipo":"escala","ciudad":"MAD","duracionHoras":322.5}
```

Confirmado: 322,5 horas rotuladas `escala` sobre el único destino de la ida y vuelta, y dos de las
tres ciudades del multidestino del PM con el mismo rótulo falso, en `0aa1ae1`.

Contra el commit auditado (`4c99a42`):

```
$ NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/val72-las-reservas-mandan.js
  ok    ida y vuelta: 13 días en Madrid: ningún renglón se llama «escala»
  ok    ida y vuelta: 13 días en Madrid: MAD informa sus 322.5 horas, sin decir qué son
  ok    el multidestino del PM: ningún renglón se llama «escala»
  ok    el multidestino del PM: CDG informa sus 123 horas, sin decir qué son
  ok    las dos usan el mismo tipo: el rótulo no depende de la duración
  ok    y lo único que las distingue es el número, que es lo único que las distingue de verdad
```

**Cierto.** El renglón pasó de `{"tipo":"escala","ciudad":"MAD","duracionHoras":322.5}` a
`{"tipo":"entre-vuelos","ciudad":"MAD","horasEnTierra":322.5}`, y una espera de 2 h y una estadía
de 322,5 h salen ahora por el mismo camino, con el mismo `tipo`. Verificado leyendo el diff
(`app/parts/packing-engine.js:1783-1809`) y corriendo el arnés.

**El diagnóstico de causa raíz está bien hecho.** El arreglo no le pone un umbral al síntoma —que
habría sido el cuarto intento del mismo error ("rotular por encadenamiento", "rotular sólo con
duración medible", "N días ahí", y ahora un umbral en horas)— sino que **saca el sustantivo**, que
es lo único que mentía. Es la salida correcta y coherente con la lección que esta historia ya
pagó tres veces con la línea de destino.

## 2 · Las tres preguntas que pidió el entregador, atacadas

**¿Se pierde algo que "escala" aportaba?** No. Antes del arreglo, `tipo:"escala"` no tenía ningún
umbral —era el defecto, no una señal—, así que no había ninguna distinción real que sacar. Lo que
sí es cierto es que la corrección de esta ronda mueve la interpretación del código al modelo, y
**eso no se puede verificar localmente**: no hay forma de correr el prompt contra el modelo real
desde este entorno y confirmar que interpreta bien un `horasEnTierra:322.5` como estadía y un
`horasEnTierra:8` como escala. El texto nuevo del prompt da la heurística en abstracto ("ocho
horas son un cambio de avión... trescientas son dos semanas de estadía") sin afirmar nada sobre
el viaje concreto de nadie, así que no cruza la línea de "afirmar lo que el dato no dice". Pero
sigue siendo una apuesta de diseño no verificada: el punto 3 de la sección "Lo que nadie puede
verificar desde acá" ya lo señalaba en la octava ronda y sigue exactamente igual acá.

**¿Queda algún otro lugar que rotule por encadenamiento sin mirar duración?** Busqué la clase de
error, no la instancia: `grep -n "toUpperCase() === \|=== String(" app/parts/packing-engine.js` y
revisión manual de `destinosDelViaje` (la función que originó los tres vetos anteriores de esta
historia). No encontré otro lugar que infiera un tipo semántico ("escala", "destino", etc.) a
partir de que un campo A encadene con un campo B sin mirar una magnitud. `destinosDelViaje` sigue
resolviendo la pregunta por otro criterio (firme/pista, según si el dato es comparable), que ya
fue auditado en rondas 2 y 4 y no lo tocó este commit.

**¿El texto nuevo del prompt afirma algo que el dato no dice?** No para el caso puntual (no dice
"tu escala de Lima es de ocho horas" salvo cuando el dato real dice eso, en el ejemplo de la
regla de citar el dato concreto). Sí es una instrucción interpretativa general dada al modelo
("ocho horas... piden nada; trescientas... piden todo"), pero eso es guía de cómo razonar, no una
afirmación sobre un viaje específico — la distinción que importa acá.

## 3 · El arnés ahora mira el prompt entero

Confirmé que las nuevas aserciones fallan si el rótulo vuelve. Repetí el experimento del `git
stash`/reversión sobre la línea de código (no sobre el test) para confirmar que el control
detecta la regresión: revertí `tipo:"entre-vuelos"` a `tipo:"escala"` en una copia temporal del
motor extraído y corrí las aserciones nuevas del bloque "HALLAZGO DE LA OCTAVA RONDA" —
fallan (`ok(!/"tipo":"escala"/.test(p), ...)` da `FALLA`, como se espera). El control es real, no
decorativo.

También confirmé que la ronda anterior tenía razón: las aserciones viejas sólo miraban la línea
`^- Destino` (`.split("\n").find(l => /^- Destino/.test(l))`), nunca el bloque de reservas
completo. Las aserciones nuevas (`pe.destinationPrompt(...)` completo, sin `.split`) sí cubren
ese bloque.

**Zona sin cobertura que encontré, buscando la clase y no la instancia:** el mecanismo "de cada
campo que el motor lee hay un caso con y un caso sin" (líneas 561-580 del arnés) sigue angosto —
sólo cubre los campos que lee `destinosDelViaje`, no los que lee `summarizeReservationsForAI`
(el mismo hueco que señaló la octava ronda, hoy sin cerrar). No es un defecto nuevo de esta
ronda, pero tampoco se cerró: el arreglo puntual (agregar los dos fixtures de escala real/estadía
larga) resuelve el síntoma encontrado, no extiende el mecanismo genérico que lo habría prevenido.
Queda como hallazgo menor.

## 4 · La prueba de VAL-44 reescrita

Leí `app/parts/packing-engine.test.js:554-589`. La prueba vieja se llamaba "detecta una escala
larga" y afirmaba `tipo === "escala"` porque el código lo hacía, tal como advirtió la octava
ronda. La nueva se llama "informa cuántas horas hay entre dos vuelos, sin decir qué son" y agrega
el control pedido: "una estadía de trece días sale igual que una espera de ocho horas" —corrí
ambas, verdes (`68` y `69` en la salida de `packing-engine.test.js`, `69 pasaron, 0 fallaron`
en total).

## 5 · Documentación que quedó mintiendo — HALLAZGO NUEVO

Este commit renombró el campo (`tipo:"escala"` → `tipo:"entre-vuelos"`, `duracionHoras` →
`horasEnTierra`) pero **dejó dos comentarios que citan el formato viejo como si fuera el actual**,
en el mismo archivo, a pocas líneas del código que cambió:

- `app/parts/packing-engine.js:1712-1714` (y su copia en `app/valija.html:3100-3102`), dentro del
  bloque `/* ACÁ HABÍA UNA ANOTACIÓN DE TIEMPO... */` que **este mismo commit no tocó**:

  ```
  {"tipo":"escala","ciudad":"GRU","duracionHoras":2}
  ```

  Ese bloque explica por qué se sacó la anotación de tiempo de `destinosDelViaje`, apoyándose en
  "lo que el modelo ya recibe más abajo" — y describe ese "más abajo" con el formato que este
  commit acaba de borrar. Un lector que confíe en el comentario (el propio caso de esta historia:
  la octava ronda encontró el defecto siguiendo exactamente este razonamiento) va a buscar
  `tipo:"escala"` y no lo va a encontrar.

- `app/parts/packing-engine.js:1867-1872` (y su copia en `app/valija.html`), en `lineaDestinos`,
  el bloque justo arriba de la línea que el commit sí actualizó (`avisoEscala`): dice "un renglón
  por cada escala con su duración" cuando el renglón se llama `entre-vuelos` y el campo
  `horasEnTierra`, dos líneas más abajo, en el mismo archivo.

Es la trampa 4 del proyecto, literal, y con el agravante de que ocurre en el commit que arregla
un defecto de "afirmar algo que el dato no dice" — el propio commit deja una afirmación en
comentario que el código ya no dice. No afecta el comportamiento (son comentarios, no código
ejecutable, y no llegan al usuario ni al modelo), así que no es bloqueante, pero es exactamente
la clase de error que este proyecto ya pagó y sigue sin tener un mecanismo que lo detecte
automáticamente (a diferencia de la aserción "campo con/sin", acá no hay ningún `grep` en el
arnés que compare los ejemplos literales de los comentarios contra el código real).

## 6 · Los bloqueantes de rondas 2, 4, 5, 6, 7

Confirmé leyendo el diff completo (`git diff 0aa1ae1 4c99a42 -- app/parts/packing-engine.js`) que
esta ronda **no tocó `destinosDelViaje`**: los tres únicos cambios de lógica están en
`summarizeReservationsForAI`, la cadena de texto de `avisoEscala` dentro de `lineaDestinos`, y el
texto de `destinationPrompt`. `destinosDelViaje` —donde viven las correcciones de las rondas 2 y
4 (firme/pista, `vistos` separado para el destino escrito, `ordenConfiable`)— es carácter por
carácter el mismo antes y después de este commit. Corrí también los cuatro casos de las rondas
5/6/7 contra el commit auditado: los cuatro pasan (incluidos los dos que la octava ronda había
encontrado rotos en el bloque de reservas).

## 7 · Las dos copias del motor, comparación propia

No confié en `las-dos-copias.js` sin repetirlo. Extraje el cuerpo de `PackingEngine` de
`app/valija.html` (desde `const PackingEngine = (function () {\n"use strict";\n` hasta el primer
`\n})();` que cierra la IIFE) y el cuerpo equivalente de `app/parts/packing-engine.js` (desde el
`"use strict";` del wrapper UMD hasta el `\n});` final), y los comparé con Python carácter por
carácter:

```
len html body: 118250
len parts body: 118250
equal: True
```

**Idénticos, byte a byte, con una extracción independiente de la que usa el arnés propio.** También
corrí `node app/pruebas/las-dos-copias.js`: verde, con sus cuatro controles de sabotaje detectados.

## 8 · Corrida propia de los arneses declarados

Corrí uno por uno, con `NODE_PATH=/opt/node22/lib/node_modules` y la ruta absoluta del HTML donde
aplica:

| Arnés | Resultado propio | Coincide con lo declarado |
|---|---|---|
| `las-dos-copias.js` | verde, 4/4 sabotajes detectados | sí |
| `val72-las-reservas-mandan.js` | verde | sí |
| `motores-desde-html.js` | 39 pasaron, 0 fallaron | sí |
| `valija-bloque-b.js` | 111 pasaron, 0 fallaron | sí |
| `hallazgos-qa-bloque-b.js` | 31 pasaron, 0 fallaron | sí |
| `tier-del-modelo.js` | 42 pasaron, 0 fallaron | sí |
| `val63-cambia-el-viaje.js` | verde | sí |
| `val74-sin-tope-de-ocho.js` | verde | sí |
| `el-script-parsea.js` | verde | sí |
| `app/parts/packing-engine.test.js` | 69 pasaron, 0 fallaron (incluye las dos pruebas nuevas de VAL-44) | consistente (no declarado con número exacto en el mensaje, pero corre limpio) |

Todos los números coinciden con lo reportado.

## 9 · Sobre lo publicado

El entregador declaró que **él mismo** leyó el Artifact con su herramienta y obtuvo `v23`, sin
`destinosDelViaje` ni `"sacados de los vuelos"`, y con `cambioQueMueveLaValija` presente. Como en
la ronda anterior, **yo no puedo reconfirmar ni contradecir esto**: mi intento de leer la URL del
Artifact devuelve la shell SPA de claude.ai, no el archivo servido. Tomo la afirmación como
testimonio del entregador, no como verificado por mí — tal como el propio mensaje me pidió que lo
anotara.

---

## Afirmaciones verificadas

| Afirmación | Cómo la verifiqué | Resultado |
|---|---|---|
| El hallazgo de la octava ronda (322,5 h y multidestino rotulados «escala») estaba presente en `0aa1ae1` | Reproducido en Node contra el commit anterior | **Cierto** |
| El commit auditado lo cierra: mismo tipo (`entre-vuelos`) para escala real y estadía larga | Corrida del arnés + lectura del diff | **Cierto** |
| El arnés nuevo falla si el rótulo `"escala"` vuelve | Reversión manual del campo en una copia del motor extraído, corrida de las aserciones nuevas | **Cierto**, fallan como se espera |
| Ningún otro lugar del código rotula por encadenamiento sin mirar duración | `grep` de comparaciones de campos + lectura completa de `destinosDelViaje` | **Cierto**, no encontré otra instancia |
| El texto nuevo del prompt no afirma sobre un viaje concreto lo que el dato no dice | Lectura de `destinationPrompt` y `lineaDestinos` completos | **Cierto** para el caso puntual; la heurística general es una apuesta de diseño no verificable localmente |
| `destinosDelViaje` (bloqueantes rondas 2 y 4) no fue tocado por este commit | `git diff 0aa1ae1 4c99a42 -- app/parts/packing-engine.js`, revisión de los tres únicos hunks | **Cierto** |
| Los cuatro casos de rondas 5/6/7 siguen cerrados | Corrida del arnés | **Cierto** |
| Las dos copias del motor son idénticas | Comparación independiente en Python, byte a byte, 118.250 caracteres | **Cierto** |
| Los nueve arneses + `packing-engine.test.js` declarados en verde | Corridos uno por uno | **Cierto**, todos los números coinciden |
| `VALIJA_VERSION = "28"`, único árbol | `grep VALIJA_VERSION app/valija.html`, `git status --porcelain` vacío | **Cierto** |
| Dos comentarios (packing-engine.js:1712-1714 y 1867-1872, y sus copias en valija.html) citan el formato de campo viejo (`tipo:"escala"`, `duracionHoras`) que este mismo commit reemplazó | Lectura directa del código actual y del diff | **Cierto** — hallazgo nuevo, no bloqueante |
| "Lo publicado sigue siendo v23" | Intenté leer la URL del Artifact | **No verificable desde acá**, tomado como testimonio del entregador |
| Árbol quieto | `git status --porcelain` vacío, `HEAD=4c99a42` antes y después | **Cierto** |

---

## Tabla de las seis dimensiones

| # | Dimensión | Peso | Puntaje | Por qué |
|---|---|---|---|---|
| 1 | Verificación en el entorno real | 30 | **18** | Mismo patrón que la ronda anterior: sustituto fiel (motor extraído del HTML real vía `las-dos-copias`/`val72-las-reservas-mandan`), brecha del teléfono declarada sin usar "verificado" de más. No sube porque nada de esta ronda tocó DOM ni visor; no baja porque el hallazgo nuevo de esta ronda (comentarios stale) tampoco es del entorno. |
| 2 | Diagnóstico de causa raíz | 15 | **15** | Reproducido, causa identificada correctamente (rotular por encadenamiento, cuarta vez que ocurre en esta historia), y el arreglo elimina el sustantivo en vez de agregar un umbral — evita repetir el mismo error una quinta vez. Probado con los dos fixtures exactos que voltearon la octava ronda, ahora verdes. |
| 3 | Honestidad de lo verificado | 15 | **13** | El reporte distingue con precisión qué se probó (los dos casos concretos, byte a byte de las copias) de lo que no se puede probar acá (comportamiento real del modelo ante `entre-vuelos`, el teléfono). No encontré ninguna afirmación sin respaldo. Resta 2 por no mencionar que el mecanismo "campo con/sin" sigue sin cubrir `summarizeReservationsForAI`, un hueco que la propia octava ronda ya había nombrado y que este commit no cerró ni declaró como pendiente. |
| 4 | Cumplimiento del contrato | 15 | **13** | "El caso que define el éxito" (Europa MAD/CDG/FCO) ya no marca ninguna ciudad como escala, verificado en Node. El caso Bariloche (no romper el flujo simple) sigue verde. Resta 2 porque la corrección de la interpretación del modelo —la pieza que hace que "el modelo ya tiene el dato" sea cierto en la práctica y no sólo en el prompt— no se puede confirmar sin el teléfono, y es la premisa central de toda la decisión de sacar la anotación. |
| 5 | Calidad interna | 15 | **10** | A favor: pruebas verdes con aserciones que sí fallan si el defecto vuelve (verificado con reversión manual), dos copias idénticas confirmadas de forma independiente, el nuevo control "control: una escala de verdad y una estadía se ven IGUAL de rotuladas" es exactamente el control que hacía falta. En contra: dos comentarios quedaron citando el formato de campo que este mismo commit reemplazó (hallazgo 5 de arriba) — la trampa de la documentación que miente, en el commit que corrige un defecto de esa misma familia; y el mecanismo de fixtures "campo con/sin" sigue sin extenderse a la función que tuvo el defecto. |
| 6 | Diseño y decisiones de producto | 10 | **9** | La decisión de sacar el sustantivo en vez de agregar un umbral está bien argumentada y es la primera vez en cuatro intentos que la historia elige "no rotular" en lugar de "rotular mejor". El texto que le explica al modelo cómo interpretar el número es prudente (heurística general, no afirmación sobre un caso puntual). Resta 1 porque la apuesta de que el modelo interpreta bien el número sigue sin poder probarse acá, y eso no se declaró como riesgo de producto en el backlog (sí como brecha técnica del teléfono, pero no como riesgo de que el criterio central pueda fallar por cómo razona el modelo real). |
| | **Total** | **100** | **78** | **CANDIDATO.** La única dimensión que no llega al techo por el entorno es la 1; el resto está entre 9/10 y 15/15, sin ningún hallazgo que exija bajarlo por debajo del piso de 70. |

---

## Hallazgos vivos, ordenados por gravedad

1. **(Severo, no bloqueante)** Dos comentarios —`app/parts/packing-engine.js:1712-1714` y
   `:1867-1872`, y sus copias en `app/valija.html`— citan el formato de campo viejo
   (`{"tipo":"escala","ciudad":"GRU","duracionHoras":2}`, "un renglón por cada escala con su
   duración") que este mismo commit reemplazó por `entre-vuelos`/`horasEnTierra`. Es la trampa 4
   del proyecto, ocurrida dentro del commit que corrige un defecto de la misma familia.
2. **(Menor)** El mecanismo "de cada campo que el motor lee hay un caso con y un caso sin" sigue
   sin cubrir `summarizeReservationsForAI` — la función que tuvo el defecto de esta y la ronda
   anterior. Se agregaron los dos fixtures puntuales que hacían falta, pero no se extendió el
   mecanismo genérico que los habría exigido de entrada.
3. **(Menor, heredado de la octava ronda, sin puntuar aparte)** La deduplicación de un lugar
   visitado dos veces en `destinosDelViaje` sigue descartando la segunda aparición en silencio,
   sin que el comentario de `sumar` lo diga. No tocado por este commit, sin efecto visible
   verificado (según la octava ronda), pendiente de una limpieza de comentario.

---

## Lo que falta para llegar a 85, en orden

1. **Actualizar los dos comentarios stale** (`packing-engine.js:1712-1714` y `:1867-1872`, y sus
   copias en `valija.html`) para que digan `entre-vuelos`/`horasEnTierra`, no `escala`/
   `duracionHoras`. Es un cambio de texto, sin riesgo, y cierra el hallazgo 1.
2. **Extender el mecanismo "campo con/sin" a `summarizeReservationsForAI`**, o declarar
   explícitamente en el arnés por qué no aplica, para que la próxima función con este patrón no
   dependa de que una auditoría la encuentre por casualidad.
3. **Probar en el teléfono el caso que define el éxito de la historia**: cargar el viaje Europa
   (MAD día 1, CDG día 6, FCO día 11), tocar "Armar la lista" y confirmar que las sugerencias son
   específicas de Madrid y de París por igual, no como si fueran escalas. Esto es lo único que
   cierra la dimensión 1 y sube el puntaje de "candidato" a "terminado".
4. Documentar el resultado de ese paso en el backlog antes de dar la historia por cerrada.

---

## Lo que nadie puede verificar desde acá

1. **Cómo interpreta el modelo real un renglón `{"tipo":"entre-vuelos","horasEnTierra":322.5}`
   frente a uno con `horasEnTierra:8`.** Es la premisa central de esta ronda —que sacar el rótulo
   y dejar el número crudo con una heurística en el prompt es suficiente para que el modelo
   distinga escala de estadía— y no hay forma de confirmarla sin llamar al modelo real. **Pasos
   para el PM:** publicar, cargar un viaje "Europa" con vuelos EZE→MAD (día 1), MAD→CDG (día 6),
   CDG→FCO (día 11), tocar "Armar la lista", y confirmar que las sugerencias son específicas de
   Madrid y de París por igual, sin ningún indicio de que se las trató como escalas (por ejemplo,
   items pensados para una espera corta en un aeropuerto en vez de una estadía de varios días).
2. **El visor del teléfono en sí** — nada de esta ronda tocó DOM, permisos ni sandbox; la brecha
   sigue entera y es la única razón por la que la dimensión 1 no puede subir de 18.
3. **Si lo publicado en el Artifact sigue siendo la v23**, como declaró el entregador con su
   propia herramienta de lectura del Artifact. Intenté confirmarlo con `curl` a la URL pública y
   sólo obtuve la shell SPA de claude.ai (sin `VALIJA_VERSION` ni `destinosDelViaje`), no el
   archivo que efectivamente sirve la app. Queda como testimonio del entregador, no verificado
   por mí, ni como falso ni como cierto.
