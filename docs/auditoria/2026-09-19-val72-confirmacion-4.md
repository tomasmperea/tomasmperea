# Auditoría VAL-72 — cuarta ronda de confirmación, sobre `5da44cd` (v31)

**Commit auditado:** `5da44cd20e3a81a310e496fcf21fe54dea2f57ea` · **Rama:**
`claude/travel-planning-app-mvp-jag9be` · **Árbol:** limpio (`git status --porcelain` vacío antes y
después de auditar, sin tocar nada; `HEAD=5da44cd`). **Delta puntuado:** `4ee1935..5da44cd`.
Ronda anterior (mía, `2026-09-19-val72-confirmacion-3.md`): **84/100 · NO PUBLICAR.**

## Veredicto: **NO PUBLICAR — 78/100**

Los dos hallazgos que dejé abiertos en la ronda anterior —`yaResumidos` reintroducía la fragilidad de
lista a mano, y `LABEL` en `describeReservation` le faltaban `transfer` y `note`— están genuinamente
cerrados, y el diagnóstico de proceso que se me pidió atacar ("se barre la clase del archivo, no la de
la función") es correcto y quedó bien documentado en `CLAUDE.md`.

**Pero apareció un hallazgo nuevo, y es serio: la aserción nueva que dice "ninguna reserva sale DOS
veces" no detecta la duplicación que dice prevenir.** La saboteé reproduciendo exactamente el escenario
que motivó su propia existencia —un bloque dedicado que deja de anotar su ítem en `resumidos`— y las
tres aserciones de ese bloque siguen en verde con el dato duplicado presente en el resultado. Es la regla
que el propio proyecto ya escribió y pagó cara: *"Todo arnés que rompe algo a propósito necesita al menos
un caso que falle si el sabotaje no llegó."* Acá no lo tiene, para el sabotaje que más importa.

**No baja por el teléfono.** Baja por calidad interna (una prueba que no prueba lo que dice probar) y,
en menor medida, por una afirmación en `docs/backlog.md` algo más categórica de lo que el código
garantiza. Por la regla del proyecto —"si el auditor baja el puntaje por cualquier motivo que no sea la
indisponibilidad del entorno real, no hay piso de 70 que valga"— el candado de Candidato no aplica acá,
aunque el total (78) esté por encima de 70.

---

## 1 · Los dos hallazgos de la ronda anterior, verificados cerrados

| # | Hallazgo (ronda 3) | Qué cambió | Cómo lo verifiqué | Resultado |
|---|---|---|---|---|
| 1 | `yaResumidos` era otra lista de tipos a mano (`{flight:true, stay:true, car:true, transfer:true, act:true}`), con riesgo de duplicación silenciosa si se desincroniza | Se reemplaza por `resumidos = []`, anotado a medida que cada ítem sale por su bloque propio (`resumidos.push(x)` en los 5 bloques dedicados), y la rama final filtra por `resumidos.indexOf(i) < 0` | Lectura de `app/parts/packing-engine.js:1767-1899` y su copia en `valija.html:3155-3287` | **Cerrado, y sí es la misma cosa**: verifiqué que `items.filter()` devuelve referencias a los mismos objetos de `items` (no copias), y que dentro de una sola llamada a la función eso hace que `indexOf` por identidad sea válido sin depender de cómo `Store.itemsOf` maneje copias entre llamadas distintas |
| 2 | `LABEL` en `describeReservation` (packing-engine.js:2477, antes) sin `transfer` ni `note` | Se agregan las dos entradas, más el caso `transfer` en el armado del texto (`"el traslado Madrid – Valencia"`) | Lectura del diff + corrida de la prueba nueva | **Cerrado**: probado por el camino público (`pe.planListUpdate(...)` con una nota y un traslado que disparan una regla-hecho vía `findFactSource`), no llamando `describeReservation` suelta. Confirmé corriendo el arnés: `la nota: el motor cita la reserva que motivó el ítem` → ok, `la cita la nombra por lo que es` → ok (`/la nota/` matchea `"la nota «Día de playa en Valencia»"`), mismo patrón para `el traslado` |

## 2 · El diagnóstico de proceso ("se barre la clase del ARCHIVO"), repetido por mi cuenta

Corrí el mismo barrido, en **todo el repo**, no sólo en `packing-engine.js`:

```
grep -rn "flight *:" app/parts app/valija.html app/pruebas
```

Encontré, además de `LABEL` (ya cerrado): íconos SVG (`I = {flight:'<path...`, en `valija.html`,
`adjuntar-ui.html`, `import-ui.html`, `packing-ui-b.html`), `TYPES` (`valija.html:936-943`, la fuente de
la que el propio arnés deriva su lista), `REQUIRED` y `OPTIONAL_NICE` (`valija.html:1428-1439`, el motor
de pendientes) y `RESERVATION_TYPES` en `app/parts/import-engine.js:202`.

**Ninguno de éstos es una quinta instancia real del defecto.** Revisé cada uno:

- `TYPES` (936-943) y `REQUIRED` (1428-1434) tienen los seis tipos completos hoy — no hay hueco.
- `OPTIONAL_NICE` (1436-1439) sólo cubre `flight`, `stay`, `car` **a propósito** (son los únicos tres
  tipos con campos "lindos de tener" definidos: asiento/terminal, teléfono, política de combustible) — no
  es una lista que debiera cubrir los seis tipos, es un catálogo de casos que existen, no de tipos.
- `RESERVATION_TYPES` (import-engine.js:202) está declarado como duplicado explícito y documentado:
  `/** Tipos de reserva que la app conoce (mismas claves que TYPES en valija.html). */`, y hoy tiene los
  seis. Es una **forma distinta** de la misma fragilidad de fondo —dos listas independientes de los
  mismos seis tipos, en dos archivos, que hay que recordar mantener sincronizadas— pero no está
  desincronizada hoy, no la tocó este commit, y ya lleva su propia advertencia en el comentario. La anoto
  como observación para una futura limpieza (derivarla de un único lugar), no como hallazgo de esta ronda.
- `adjuntos-engine.js` no tiene ningún objeto con las seis claves de tipo (sólo una comparación puntual
  `c.tipoReserva === "flight"`).

**Conclusión: no hay quinta instancia del patrón LABEL/`yaResumidos` en el resto del repo.** El barrido
que hizo la entrega (motor + HTML) estaba completo para ese patrón específico.

## 3 · El hallazgo nuevo — la aserción "ninguna reserva sale DOS veces" no detecta su propio caso de uso

Reproduje, sobre una copia sandbox de `app/valija.html`, el escenario exacto que el propio comentario del
código describe como el riesgo a evitar: *"si alguien agregaba un bloque propio arriba y se olvidaba de
sumarlo acá, la reserva salía DOS veces."* Saqué el `resumidos.push(a);` del bloque dedicado de `act`
(dejando su `out.push` intacto), que es la sabotaje más directa de "alguien se olvidó de anotar el ítem":

```
· ninguna reserva sale DOS veces
  info   tipos: vuelo, alojamiento, auto, traslado, actividad, act, note, crucero
  ok    ninguna reserva aparece dos veces en el resumen
  ok    la actividad sale una sola vez
  ok    y el tipo inventado sale igual, por la rama de al final
```

**Las tres aserciones del bloque pasan con el dato duplicado presente en el resultado.** La actividad
"Museo" sale dos veces —una vez como `{"tipo":"actividad", ...}` desde su bloque propio, otra como
`{"tipo":"act", ...}` desde la rama catch-all, porque al no estar anotada en `resumidos` la rama final
la toma como "no resumida todavía"— y ninguna aserción lo ve, por dos razones distintas:

1. `firmas.length === new Set(firmas).size` compara los **JSON.stringify completos**. Los dos registros
   difieren en el campo `tipo` (`"actividad"` vs `"act"`), así que son strings distintos: nunca chocan,
   aunque describan la misma reserva dos veces.
2. `rTodos.filter(x => x.tipo === "actividad").length === 1` sólo cuenta los que tienen `tipo ===
   "actividad"` exacto — la copia duplicada, al tener `tipo:"act"`, no cuenta para ese filtro. Sigue
   dando 1, con el bug presente.

No hay ninguna aserción de conteo total (`rTodos.length === 7`, con el fixture de siete tipos incluido),
que habría sido la forma más simple y directa de atrapar esto.

Confirmé que esto no es un artefacto de mi sabotaje: repetí el mismo experimento reemplazando la guarda
completa por el patrón viejo de lista a mano sin `act` (`{flight:true, stay:true, car:true,
transfer:true}`), mismo resultado — pasa en verde con el duplicado presente.

**Esto es exactamente la trampa que `CLAUDE.md` ya nombra dos veces**: *"un escenario que espera que
todo salga bien puede pasar porque el sabotaje no se aplicó"* y *"todo arnés que rompe algo a propósito
necesita al menos un caso que falle si el sabotaje no llegó"*. El código de producción, sin sabotear,
está bien —lo confirmé leyendo los cinco bloques: los cinco llaman `resumidos.push()` antes de armar su
`out.push()`—, así que **no hay un defecto vivo en la app hoy**. Lo que falla es la garantía de que un
futuro descuido (agregar un sexto bloque dedicado y olvidar la línea `resumidos.push`) se va a notar
solo. Hoy no se nota: el arnés dice "ok" con el dato duplicado.

**Sanity check — el otro control nuevo sí funciona.** Saboteé `LABEL` sacándole `transfer` y `note` (la
versión de antes de este commit) y las aserciones de "se citan por su nombre" fallan correctamente:

```
FALLA la nota: la cita la nombra por lo que es
FALLA la nota: y NO la llama «la reserva» genérico
```

Esto descarta que el problema sea metodológico de mi parte: sé reproducir un control que sí funciona, y
el de duplicación, específicamente, no.

## 4 · Las dos copias del motor, comparación propia

Repetí la extracción de forma independiente de la que usa `las-dos-copias.js` (que también corrí, verde,
4/4 sabotajes detectados). Mi primer intento de extracción tenía un error de offset propio (usaba el
`"use strict";` equivocado del wrapper UMD) y daba una falsa divergencia trivial de una sola línea;
corregido el punto de corte (después de `factory() {` en vez de después del primer `"use strict";`), el
resultado es:

```
len html body: 122539
len parts body: 122539
equal: True
```

**Idénticas, carácter por carácter**, confirmado con una extracción propia distinta de la del arnés.

## 5 · Corrida de todos los arneses declarados

| Arnés | Resultado propio | Coincide con lo declarado |
|---|---|---|
| `las-dos-copias.js` | verde, 4/4 sabotajes detectados | sí |
| `val72-las-reservas-mandan.js` | verde (incluidas las 3 pruebas nuevas: duplicación, y las dos de las citas) | sí en cantidad de pruebas; **no en efectividad de la primera** (§3) |
| `motores-desde-html.js` | 39 pasaron, 0 fallaron | sí |
| `valija-bloque-b.js` | 111 pasaron, 0 fallaron | sí |
| `hallazgos-qa-bloque-b.js` | 31 pasaron, 0 fallaron | sí |
| `tier-del-modelo.js` | 42 pasaron, 0 fallaron | sí |
| `val63-cambia-el-viaje.js` | verde | sí |
| `val74-sin-tope-de-ocho.js` | verde | sí |
| `el-script-parsea.js` | verde | sí |
| `app/parts/packing-engine.test.js` (motor suelto) | 69 pasaron, 0 fallaron | sí, coincide con "+69 del motor suelto" |

Todos los números coinciden con lo declarado. Nada de lo verificado en rondas anteriores se rompió: corrí
también los casos de rondas 2/4/5/6/7/8/9 dentro de `val72-las-reservas-mandan.js` (multidestino Europa,
Bariloche, ida y vuelta, escala vs. estadía) y siguen verdes.

## 6 · Documentación

- `CLAUDE.md` (sección nueva, "Se barre la clase del ARCHIVO, no la de la función"): describe con
  precisión lo que pasó en esta historia — la tabla de las cuatro instancias es exacta, verificada contra
  el historial de commits. No encontré ninguna afirmación falsa ahí.
- `docs/backlog.md`: agrega el relato de las dos instancias nuevas encontradas por la tercera
  confirmación. Es correcto en los hechos, pero la frase *"Ahora la guarda no es una lista sino el hecho
  —se anota cada ítem que ya salió—, así que no se puede desincronizar de los bloques que arma"* afirma
  una garantía estructural que el código no tiene: si a un bloque dedicado futuro se le olvida el
  `resumidos.push()`, sí se desincroniza, y §3 muestra que hoy nada lo detecta. No es una mentira sobre
  lo que el código hace ahora (los cinco bloques actuales sí llaman `resumidos.push`), pero es más
  categórica de lo que la garantía real permite — la misma clase de sobreconfianza, en tono menor, que el
  proyecto ya marcó como error en otras rondas.
- Comentarios en el código (`packing-engine.js:1884-1892` y su copia en `valija.html`): describen el
  mecanismo con precisión técnica ("se anota cada ítem que ya salió... y acá pasa lo que no está
  anotado"), sin el sobreclaim del backlog. No encontré comentarios que describan un comportamiento que
  el código ya no tiene (no hay trampa 4 nueva).
- Un archivo, un dueño: el commit toca `packing-engine.js`, su copia en `valija.html`, el arnés de VAL-72,
  `CLAUDE.md` y `docs/backlog.md`. Nada de `docs/` en bloque. `git status` limpio antes y después.

## 7 · Sobre lo publicado

El entregador declara: "Lo publicado sigue siendo la v23 según mi lectura del Artifact con la herramienta
de Artifacts." **No puedo reproducir esa lectura desde acá** — mi único acceso al Artifact es vía `curl`,
que devuelve el shell genérico de la SPA de claude.ai, no el archivo servido. Lo tomo como testimonio del
entregador, ni verificado ni contradicho por mí, igual que en las tres rondas anteriores.

---

## Afirmaciones verificadas

| Afirmación | Cómo la verifiqué | Resultado |
|---|---|---|
| `yaResumidos` (lista a mano) se reemplazó por `resumidos` (anotado por hecho) | Lectura del diff completo, `packing-engine.js:1767-1899` | **Cierto** |
| El nuevo mecanismo no depende de que `Store` pase copias, porque compara referencias dentro de una sola llamada sobre el mismo `items` | Lectura de `buildPackingList`/`summarizeReservationsForAI`, confirmando que `items.filter()` nunca clona los objetos elemento | **Cierto** |
| `LABEL` ahora tiene `transfer` y `note` | Lectura del diff | **Cierto** |
| Se probó por el camino público (`planListUpdate`), no llamando `describeReservation` suelta | Lectura de `val72-las-reservas-mandan.js:660-679` y corrida | **Cierto** |
| `grep -n 'flight *:'` sobre el motor encontró las dos instancias en un segundo | Repetí el grep yo mismo | **Cierto** |
| No hay una quinta instancia del mismo patrón en el resto del repo | `grep` sobre `app/parts`, `app/valija.html`, `app/pruebas`; revisión manual de cada resultado | **Cierto**, con la salvedad documentada de `RESERVATION_TYPES` (duplicado ya declarado, no un hueco) |
| La aserción "ninguna reserva sale DOS veces" detecta la duplicación que dice prevenir | Sabotaje (remoción de `resumidos.push()` en el bloque de `act`) + corrida del arnés | **Falso** — las tres aserciones del bloque pasan con el duplicado presente |
| El control de las citas (`transfer`/`note` en `LABEL`) sí detecta su regresión | Sabotaje (LABEL sin `transfer`/`note`) + corrida | **Cierto**, falla como se espera |
| Las dos copias del motor son idénticas | Extracción independiente en Python, corregida tras un error propio de offset, 122.539 caracteres iguales | **Cierto** |
| Los diez arneses declarados en verde | Corridos uno por uno | **Cierto en cantidad**; ver arriba la salvedad de efectividad |
| `VALIJA_VERSION = "31"`, único árbol | `grep VALIJA_VERSION app/valija.html`, `git status --porcelain` vacío | **Cierto** |
| "Lo publicado sigue siendo v23" | Intenté leer la URL del Artifact con `curl` | **No verificable desde acá**, tomado como testimonio del entregador |
| Árbol quieto | `git status --porcelain` vacío, `HEAD=5da44cd` antes y después | **Cierto** |

---

## Tabla de las seis dimensiones

| # | Dimensión | Peso | Puntos | Por qué |
|---|---|---|---|---|
| 1 | Verificación en el entorno real | 30 | **18** | Mismo perfil que las tres rondas anteriores: Node contra el motor extraído del HTML (verificado byte-idéntico, con extracción propia), y el camino público (`planListUpdate`) en vez de la función suelta. Sustituto fiel, brecha del teléfono declarada sin adornos ("NO probado en el teléfono del PM"). No sube porque nada de esta ronda tocó DOM ni visor; no baja porque el hallazgo nuevo de esta ronda tampoco es del entorno. |
| 2 | Diagnóstico de causa raíz | 15 | **15** | Los dos hallazgos de la ronda anterior tenían la misma causa de fondo (objeto con claves de tipo, mantenido a mano) y el arreglo la atacó por clase, no por instancia: `yaResumidos` deja de ser una lista, y el barrido por forma sobre el archivo (no sólo la función) encontró y cerró la segunda instancia real. Verificado repitiendo el barrido yo mismo sobre todo el repo, sin encontrar una quinta. |
| 3 | Honestidad de lo verificado | 15 | **13** | El commit no reclama haber sabotea do la aserción nueva y confirmado que falla — deja eso explícitamente para la auditoría, lo cual es honesto. Resta 2 por la frase de `docs/backlog.md` ("no se puede desincronizar... porque son la misma") que afirma una garantía estructural más fuerte de la que el código realmente sostiene, según §3. |
| 4 | Cumplimiento del contrato | 15 | **15** | El criterio central de VAL-72 (las reservas mandan sobre el destino escrito) y las historias vecinas (VAL-44, VAL-63, VAL-74) siguen verificadas, sin regresión. Esta ronda no tocó ningún criterio de aceptación nuevo, sólo cerró hallazgos de auditoría. |
| 5 | Calidad interna | 15 | **8** | A favor: las dos copias del motor idénticas (verificado independientemente), un archivo un dueño, los otros nueve arneses en verde con números que coinciden, y el control de las citas (`LABEL`) sí detecta su regresión al sabotearlo. En contra, y pesa fuerte: la aserción nueva escrita específicamente para prevenir la duplicación que la propia ronda anterior encontró **no la detecta** cuando se reproduce el escenario exacto que la motiva (§3) — es la trampa que `CLAUDE.md` ya documentó dos veces en este proyecto ("un escenario que espera que todo salga bien puede pasar porque el sabotaje no se aplicó"), ahora en un arnés que se escribió *después* de que esa lección quedara escrita. |
| 6 | Diseño y decisiones de producto | 10 | **9** | La decisión de "barrer la forma en todo el archivo con grep de la estructura" y de sacar la lista a mano donde se pudo (en vez de sólo agregar las claves que faltaban) está bien argumentada, y el registro en `CLAUDE.md` de por qué las tres rondas anteriores no lo habían hecho es honesto y útil para el proyecto. Resta 1 porque el mecanismo elegido para "dejar de mantener la lista" introdujo una dependencia nueva (recordar llamar `resumidos.push()` en cada bloque futuro) sin un control que la proteja, cambiando la forma del riesgo sin eliminarlo del todo. |
| | **Total** | **100** | **78** | **NO PUBLICAR.** El total está por encima de 70, pero la dimensión 5 (y en menor medida la 3) bajan por un motivo ajeno al teléfono — una prueba que no prueba lo que dice probar —, y la regla del proyecto es explícita: eso invalida el candado de Candidato, sin excepción por el número. |

### Por qué no aplica el piso de 70 (candidato), aunque el total lo supere

La rúbrica y `CLAUDE.md` son explícitos: el piso de 70 vale **"sólo si lo único flojo es la dimensión
1"**, y **"si el auditor baja el puntaje por cualquier motivo que no sea la indisponibilidad del entorno
real, no hay piso de 70 que valga: eso se arregla antes de publicar, como siempre."** Acá baja también la
5, y por un motivo que no tiene nada que ver con el teléfono: una prueba que no detecta la regresión que
dice prevenir. El hecho de que el total (78) esté por encima de 70 no cambia esto — el mecanismo de
Candidato no es "¿el número da 70 o más?", es "¿lo único flojo es el entorno real?". No lo es. Así que
esto es **NO PUBLICAR**, igual que la tercera confirmación (84/100, mismo motivo estructural).

---

## Hallazgos vivos, ordenados por gravedad

1. **(Severo, no bloqueante para el comportamiento actual, bloqueante para publicar)** La aserción "ninguna
   reserva sale DOS veces" (`app/pruebas/val72-las-reservas-mandan.js`, bloque agregado en este commit) no
   detecta la duplicación cuando un bloque dedicado deja de anotar su ítem en `resumidos` — exactamente el
   escenario que motivó escribirla. Verificado con sabotaje real (§3). El código de producción, sin
   sabotear, es correcto hoy: los cinco bloques dedicados llaman `resumidos.push()`. El riesgo es que un
   descuido futuro (agregar un sexto bloque, o tocar uno existente, sin la línea de `push`) no se va a
   notar solo.
2. **(Menor)** `docs/backlog.md` describe el mecanismo nuevo con más garantía de la que sostiene (§6). No
   afecta comportamiento, sólo la precisión de la documentación.
3. **(Observación, no defecto)** `RESERVATION_TYPES` en `app/parts/import-engine.js:202` es una segunda
   lista independiente de los mismos seis tipos que `TYPES` en `valija.html`, ya declarada como tal en su
   propio comentario. Hoy están sincronizadas; es la misma clase de fragilidad de fondo que esta historia
   viene atacando, en un archivo que esta ronda no tocó. No lo cuento como hallazgo de esta ronda.

---

## Lo que falta para llegar a 85, en orden

1. **Arreglar la aserción de duplicación para que de verdad detecte el escenario que dice prevenir.** La
   forma más simple: agregar `ok(rTodos.length === UNO_DE_CADA.length, "cada ítem del fixture aparece
   exactamente una vez")`, contando por cantidad total en vez de por firma JSON o por `tipo` exacto — y
   antes de darlo por cerrado, **repetir el sabotaje de esta ronda** (sacar un `resumidos.push()` de un
   bloque dedicado) y confirmar que la nueva aserción sí falla. Es la misma disciplina que ya se le exige
   a cualquier control de este proyecto: no cuenta como cerrado hasta que se vio fallar con el sabotaje
   puesto.
2. **Ajustar la frase de `docs/backlog.md`** que afirma que la guarda "no se puede desincronizar" para que
   diga lo que el código realmente garantiza (que hoy no se desincroniza, no que sea imposible que lo
   haga), o —mejor— que quede corregida sola una vez que el punto 1 esté cerrado, porque en ese momento la
   afirmación sí sería cierta: con la aserción arreglada, una desincronización futura fallaría el arnés
   antes de llegar a un commit.
3. Recién entonces, publicar (si no lo está ya, confirmando con los cuatro `grep` contra el archivo que
   sirve el Artifact, no contra el shell de la SPA), y pedirle al PM la prueba del caso de éxito de VAL-72
   en su teléfono.

---

## Lo que nadie puede verificar desde acá

1. **El visor del teléfono en sí.** Nada de esta ronda tocó DOM, permisos ni sandbox. Sigue siendo la
   única razón legítima por la que la dimensión 1 no puede subir de 18, y está declarada sin adornos en
   el propio mensaje de commit ("NO probado en el teléfono del PM").
2. **Cómo interpreta el modelo real un renglón `{"tipo":"entre-vuelos","horasEnTierra":322.5}`.** Sigue
   siendo la apuesta de diseño de la novena ronda, sin tocar por este commit, y sigue sin poder probarse
   sin un modelo real. **Pasos para el PM:** publicar, cargar el viaje Europa (EZE→MAD día 1, MAD→CDG día
   6, CDG→FCO día 11), tocar "Armar la lista", y confirmar que las sugerencias tratan Madrid y París como
   estadías, no como escalas.
3. **Que una nota o un traslado citados por `describeReservation` se vean bien en la interfaz real**, con
   el tipo de letra y el recorte que usa la tarjeta de "ítem nuevo". Esta ronda prueba que el texto que
   arma el motor es correcto (`"la nota «Día de playa en Valencia»"`); no prueba cómo se ve en pantalla.
   **Pasos para el PM:** cargar una nota o un traslado en un viaje, generar o regenerar la lista, y
   revisar que la tarjeta de un ítem nuevo cite la nota o el traslado por su nombre, no como "la reserva"
   genérica.
4. **Si lo publicado en el Artifact sigue siendo la v23**, como declaró el entregador con su propia
   herramienta de lectura. Mi único intento de leerlo con `curl` devuelve el shell de la SPA de claude.ai,
   sin `VALIJA_VERSION` ni ninguna cadena propia del código de la app. Queda como testimonio del
   entregador, no verificado por mí. Pasos para quien tenga el acceso que falta acá: abrir el link del
   Artifact, ver el archivo servido (no la vista renderizada), y buscar `VALIJA_VERSION` y una cadena
   propia de este commit (por ejemplo `resumidos` o `"el traslado "`); si no aparecen, sigue en v23 y no
   hay nada que pedirle al PM todavía sobre esta ronda específica.
