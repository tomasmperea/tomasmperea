# Auditoría VAL-72 — quinta ronda de confirmación, sobre `618c679` (v32)

**Commit auditado:** `618c679fda7f86c92277e802e199a7ba31d7a1cc` · **Rama:**
`claude/travel-planning-app-mvp-jag9be` · **Árbol:** limpio (`git status --porcelain` vacío antes y
después de auditar; `HEAD=618c679`, sin tocar nada). **Delta puntuado:** `5da44cd..618c679` (dos commits:
`6cef7f5` y `618c679`).
Ronda anterior (auditor, `2026-09-19-val72-confirmacion-4.md`): **78/100 · NO PUBLICAR.**

## Veredicto: **82/100 · NO PUBLICAR** (no candidato tampoco)

El hallazgo demoledor de la ronda anterior —la aserción "ninguna reserva sale DOS veces" no detectaba la
duplicación que decía prevenir— **está genuinamente cerrado, y mejor de lo pedido**: no sólo se verificó el
sabotaje puntual que yo usé (quitar el `push` de `act`), sino que repetí el mismo sabotaje sobre los cinco
bloques dedicados (`flight`, `stay`, `car`, `transfer`, `act`) y los cinco lo hacen fallar (`8 de 7`). También
ataqué el filtro que excluye `entre-vuelos` del conteo con un ítem adversario tipado literalmente
`entre-vuelos`, y no esconde nada: el conteo sigue discrepando. La frase del backlog que afirmaba de más
("no se puede desincronizar") está corregida con precisión, diciendo exactamente lo que cambia y lo que no.

**Pero apareció un hallazgo nuevo, en la pieza que el propio entregador pidió que atacara:** el mecanismo de
autoguardado de `tier-del-modelo.js` ("el arnés se guarda a sí mismo") **falla en silencio exactamente en el
escenario que existe para prevenir** — pérdida total de la salida. Lo reproduje de dos formas independientes:

1. Si el archivo de registro no se puede escribir (ruta inexistente), `guardarRegistro()` devuelve `null` por
   su propio `catch`, y el aviso final (`if (fail && donde)`) **no se imprime nada**: ni el aviso de "quedó
   guardada", ni ningún indicio de que el guardado falló. La corrida termina diciendo sólo "N pasaron, M
   fallaron" — exactamente la pérdida de información que este mecanismo se escribió para evitar.
2. No hay ningún `try`/`catch` alrededor del IIFE completo. Una excepción que escapa por fuera de un `test()`
   —por ejemplo `browser.launch()` fallando— termina el proceso con una excepción no capturada, y
   `guardarRegistro()` nunca se llega a llamar: toda la salida acumulada en `LINEAS` se pierde, sin archivo y
   sin aviso.

Es la misma trampa de proceso que la ronda anterior —"el arreglo no recibe el mismo ataque que el defecto"—
en una pieza distinta: el fix de duplicación sí recibió el ataque completo esta vez (y lo pasó); el mecanismo
de autoguardado, no.

**Por qué no baja por el teléfono, y por qué el total no vale como piso de 70:** el candado de Candidato
exige que la única dimensión floja sea la 1. Acá también bajan la 3 y la 5, por motivos ajenos al entorno
real —una prueba de configuración que no cubrió sus propios casos vecinos—, así que la regla del proyecto
("si el auditor baja el puntaje por cualquier motivo que no sea la indisponibilidad del entorno real, no hay
piso de 70 que valga") aplica igual que en la ronda anterior.

---

## 1 · El hallazgo de la ronda 4, verificado cerrado — y más a fondo de lo que pedí

| Sabotaje | Qué hice | Resultado |
|---|---|---|
| Quitar `resumidos.push(f);` (flight) | `sed`/`perl` sobre una copia de `app/valija.html`, corrida de `val72-las-reservas-mandan.js` contra esa copia | **FALLA** `sale UNA entrada por reserva y ninguna de más: 8 de 7` |
| Quitar `resumidos.push(s);` (stay) | ídem | **FALLA** `8 de 7` |
| Quitar `resumidos.push(c);` (car) | ídem | **FALLA** `8 de 7` |
| Quitar `resumidos.push(t);` (transfer) | ídem | **FALLA** `8 de 7` |
| Quitar `resumidos.push(a);` (act) — el mismo sabotaje de la ronda 4 | ídem | **FALLA** `8 de 7` (y también falla la aserción de "la actividad sale una sola vez") |
| Ítem adversario con `type:"entre-vuelos"` literal (fixture de 8, no 7) | script Node aparte contra `summarizeReservationsForAI` extraída | El filtro que excluye `entre-vuelos` del conteo **no esconde el faltante**: `conVuelos.length` da 7 contra un fixture de 8, discrepa igual — la pregunta del entregador ("¿puede tapar algo?") se responde **no**, para este vector |

**Los cinco bloques dedicados están cubiertos, no sólo el que yo había saboteado.** Esto es justo lo que la
ronda anterior pedía y no había pasado: la aserción nueva ahora sí recibe el mismo ataque en todos sus
vecinos, y lo resiste en los cinco.

## 2 · La frase del backlog, verificada corregida

`docs/backlog.md` (línea ~1024-1032) ya no dice "no se puede desincronizar". Dice, textual: *"Sí se puede: si
mañana alguien agrega un bloque propio y se olvida del `push`, la reserva sale dos veces igual. Lo que
cambia es que el descuido queda a un renglón del código que lo causa (...) y que ahora hay una prueba que lo
agarra."* Es exactamente lo que el código garantiza hoy, ni más ni menos — coincide con lo que verifiqué en
§1.

## 3 · El hallazgo nuevo — el autoguardado de `tier-del-modelo.js` no se guarda a sí mismo en sus propios casos límite

### 3a. Falla en silencio si no puede escribir

```
$ sed 's#const REGISTRO = .*#const REGISTRO = "/no-existe-este-directorio/no-se-puede.txt";#' \
      app/pruebas/tier-del-modelo.js > /tmp/tdm-writefail2.js
$ NODE_PATH=/opt/node22/lib/node_modules node /tmp/tdm-writefail2.js /tmp/tdm-sabotage-app.html
  ...
====================================================
  37 pasaron, 5 fallaron
====================================================
```

Sin ningún aviso de "ESTA CORRIDA FALLÓ Y QUEDÓ GUARDADA EN...". La causa está en el propio código
(`app/pruebas/tier-del-modelo.js:96-99`):

```js
function guardarRegistro() {
  try { fs.writeFileSync(REGISTRO, LINEAS.join("\n") + "\n"); return REGISTRO; }
  catch (e) { return null; }
}
```

y más abajo (línea 512-517):

```js
const donde = guardarRegistro();
if (fail && donde) {
  console.log("  >>> ESTA CORRIDA FALLÓ Y QUEDÓ GUARDADA EN:");
  ...
}
```

Si `donde` es `null` (el `writeFileSync` reventó), la condición `fail && donde` es falsa y **no se imprime
nada sobre el fallo de guardado** — ni el motivo (`e.message` se descarta sin loguear), ni una alternativa.
Es precisamente la pérdida de información que el mecanismo se escribió para evitar, en el momento exacto en
que más hace falta: cuando la corrida falló.

### 3b. Pierde todo si una excepción escapa por fuera de un `test()`

```
$ sed 's#executablePath: "/opt/pw-browsers/chromium"#executablePath: "/opt/pw-browsers/NOEXISTE"#' \
      app/pruebas/tier-del-modelo.js > /tmp/tdm-crash.js
$ NODE_PATH=/opt/node22/lib/node_modules node /tmp/tdm-crash.js app/valija.html
node:internal/process/promises:394
    triggerUncaughtException(err, true /* fromPromise */);
browserType.launch: Failed to launch chromium because executable doesn't exist at /opt/pw-browsers/NOEXISTE
Node.js v22.22.2
```

Sin registro (`REGISTRO`) ni archivo. No hace falta que sea `browser.launch()` específicamente: cualquier
código entre llamadas a `test()` —incluido el `browser.close()` final o el primer `console.log`— que
lance una excepción produce el mismo resultado, porque el IIFE completo (líneas 272-521) no tiene ningún
`try`/`catch`/`finally` propio; cada `test()` atrapa sus propias excepciones, pero nada atrapa las de
afuera.

### Alcance del hallazgo

No es una regresión de VAL-72: `tier-del-modelo.js` no es un criterio de aceptación de esta historia, es una
pieza de infraestructura de pruebas que el entregador sumó por su cuenta y pidió explícitamente que se
atacara. La corrida normal (declarada y verificada por mí: 42/42, ver §4) funciona bien, y el caso que
motivó el mecanismo —una aserción que falla dentro de un `test()`— **sí queda registrado correctamente**
(lo comprobé con el mismo sabotaje del punto 3a, antes de romper la ruta de escritura: con ruta válida,
`fail=5` y `donde` no nulo, el aviso aparece y el archivo existe). El gap es específicamente en los dos casos
vecinos que nadie preguntó: ¿qué pasa si el guardado en sí falla?, ¿qué pasa si algo revienta afuera de un
`test()`? Las dos veces, la respuesta es "se pierde en silencio" — el mismo síntoma que costó tres fallas y
tres salidas perdidas antes de que existiera este mecanismo.

## 4 · Corrida de todos los arneses declarados

| Arnés | Resultado propio | Coincide con lo declarado |
|---|---|---|
| `las-dos-copias.js` | verde, 68 funciones idénticas en packing-engine, 51 en adjuntos-engine, 0 divergencias reales, 4/4 sabotajes detectados | sí |
| `val72-las-reservas-mandan.js` | verde, 170 líneas `ok`, 0 `FALLA` | sí |
| `motores-desde-html.js` | 39 pasaron, 0 fallaron | sí |
| `valija-bloque-b.js` | 111 pasaron, 0 fallaron | sí |
| `hallazgos-qa-bloque-b.js` | 31 pasaron, 0 fallaron | sí |
| `tier-del-modelo.js` | **42 pasaron, 0 fallaron** (una corrida propia; no repetí las 12 corridas del entregador, ver §5) | sí en la corrida puntual |
| `val63-cambia-el-viaje.js` | verde | sí |
| `val74-sin-tope-de-ocho.js` | verde | sí |
| `el-script-parsea.js` | verde | sí |

Todos los números coinciden con lo declarado. Nada de lo verificado en las cuatro confirmaciones anteriores
se rompió: `val72-las-reservas-mandan.js` sigue cubriendo el multidestino a Europa, Bariloche, ida y vuelta,
la marca de escala vs. estadía, y las citas por nombre de nota/traslado — los mismos casos que verifiqué en
rondas previas, todos en verde en esta corrida.

## 5 · Sobre "12 corridas más, todas 42/42"

No puedo verificar las 12 corridas del entregador (ocurrieron en su sesión, antes de este commit). Sí
verifiqué una corrida propia, fresca, sobre el árbol exacto de `618c679`: **42/42**, consistente con lo
declarado. La afirmación de "3 fallas en ~30 corridas, las tres salidas perdidas" es un dato histórico que
no puedo reproducir ni contradecir desde acá; la tomo como testimonio, igual que las rondas anteriores hacen
con datos de sesión que no dejan artefacto verificable.

## 6 · Las dos copias del motor

`las-dos-copias.js`, corrido por mí: 68 funciones de `packing-engine.js` comparadas contra su copia en
`valija.html`, **0 divergencias reales** (la única diferencia es la cola del cierre UMD, que no va al HTML,
correctamente excluida). Coincide con lo verificado en las cuatro rondas anteriores.

## 7 · Documentación y coordinación

- `docs/backlog.md`: la sección de VAL-72 describe con precisión lo que pasó esta ronda (§2). La sección de
  `tier-del-modelo` (línea ~652-665) también es honesta: dice "hecho el 21/09", cuenta el acumulado real (3
  fallas en ~30 corridas) y no inventa una causa ("no se la llama flake").
- Comentarios en el código: el comentario nuevo en `val72-las-reservas-mandan.js` (línea ~666-675) explica
  con precisión por qué se cambió a conteo, sin quedar mintiendo sobre el mecanismo anterior.
- Un archivo, un dueño: el delta de esta ronda toca `app/pruebas/val72-las-reservas-mandan.js`,
  `app/pruebas/tier-del-modelo.js`, `app/valija.html` (sólo `VALIJA_VERSION`), `docs/backlog.md` y el
  reporte de auditoría anterior. `git diff --stat 5da44cd..618c679` confirma exactamente estos cinco
  archivos, nada de `docs/` en bloque. `git status --porcelain` vacío antes y después de auditar.

## 8 · Sobre lo publicado

El entregador declara: "Lo publicado sigue siendo la v23 según mi lectura con la herramienta de Artifacts."
**No puedo reproducir esa lectura desde acá.** Lo tomo como testimonio, ni verificado ni contradicho, igual
que en las cuatro rondas anteriores.

---

## Afirmaciones verificadas

| Afirmación | Cómo la verifiqué | Resultado |
|---|---|---|
| La aserción de conteo (`conVuelos.length === UNO_DE_CADA.length`) falla con el sabotaje sobre `act` (el de la ronda 4) | Sabotaje propio + corrida | **Cierto** (`8 de 7`) |
| Lo mismo se sostiene para `flight`, `stay`, `car`, `transfer` (no probado por el entregador contra cada uno explícitamente) | Sabotaje propio sobre cada bloque + corrida | **Cierto**, los cinco fallan igual |
| El filtro que excluye `entre-vuelos` no esconde un ítem faltante | Fixture adversario con `type:"entre-vuelos"` literal, script Node aparte | **Cierto**, no esconde nada |
| La frase del backlog ya no afirma "no se puede desincronizar" de forma incondicional | Lectura de `docs/backlog.md:1024-1032` | **Cierto**, corregida con precisión |
| `tier-del-modelo.js` da 42/42 sobre este árbol | Corrida propia con Playwright/Chromium | **Cierto** |
| "El aviso aparece y el archivo queda" cuando el guardado sí funciona | Corrida propia con sabotaje de assertion + ruta de escritura válida | **Cierto**, para ese caso puntual |
| El mecanismo de autoguardado avisa siempre que la corrida falla | Sabotaje de la ruta de escritura (ENOENT) | **Falso** — no imprime ningún aviso de fallo de guardado |
| El mecanismo de autoguardado sobrevive a cualquier excepción de la corrida | `executablePath` inválido para forzar una excepción fuera de `test()` | **Falso** — pierde toda la salida acumulada, sin archivo ni aviso |
| Las dos copias del motor son idénticas | `las-dos-copias.js`, corrida propia | **Cierto**, 0 divergencias |
| `VALIJA_VERSION = "32"`, único árbol | `grep VALIJA_VERSION app/valija.html`, `git status --porcelain` vacío | **Cierto** |
| El delta de esta ronda toca exactamente 5 archivos, sin `docs/` en bloque | `git diff --stat 5da44cd..618c679` | **Cierto** |
| "Lo publicado sigue siendo v23" | Sin acceso al archivo servido del Artifact desde acá | **No verificable desde acá**, tomado como testimonio |

---

## Tabla de las seis dimensiones

| # | Dimensión | Peso | Puntos | Por qué |
|---|---|---|---|---|
| 1 | Verificación en el entorno real | 30 | **18** | Mismo perfil que las cuatro rondas anteriores: Node contra el motor extraído del HTML (verificado byte-idéntico) y Playwright sobre Chromium de escritorio con emulación táctil para `tier-del-modelo` — ninguno es el visor del teléfono. Brecha declarada sin adornos ("NO probado en el teléfono del PM"). No sube porque nada de esta ronda tocó el dispositivo real; no baja porque el hallazgo nuevo tampoco es del entorno. |
| 2 | Diagnóstico de causa raíz | 15 | **15** | El fix de conteo ataca la causa de clase (comparar por firma nunca detecta un duplicado con etiqueta distinta) y se verificó, por mí, contra los cinco bloques que comparten esa causa, no sólo el que había fallado. Reproducido antes de arreglar (según el propio commit) y confirmado eliminado en los cinco vecinos. |
| 3 | Honestidad de lo verificado | 15 | **13** | El backlog corrige con precisión la frase que afirmaba de más. El commit del autoguardado dice "comprobado con un sabotaje" — cierto, para ese sabotaje puntual — y no reclama más que eso; invita explícitamente a que se lo ataque más. Resta 2 porque no declaró, ni como pendiente, los dos casos límite obvios de cualquier mecanismo de "guardar cuando falla" (¿y si el guardado en sí falla? ¿y si algo revienta afuera del `test()`?), que es justo donde vive el gap que encontré. |
| 4 | Cumplimiento del contrato | 15 | **15** | El criterio central de VAL-72 y las historias vecinas (VAL-63, VAL-74) siguen verificados sin regresión. Esta ronda no tocó ningún criterio de aceptación nuevo. |
| 5 | Calidad interna | 15 | **12** | A favor, y pesa fuerte: la aserción que bloqueó la ronda anterior ahora es genuinamente robusta — verificado contra los cinco bloques y un vector adversario que el entregador ni pidió. Las dos copias del motor siguen idénticas, y los otros ocho arneses declarados están todos en verde con números que coinciden. En contra: el mecanismo de autoguardado sumado esta ronda —presentado como la solución a "tres salidas perdidas"— falla en silencio exactamente en los dos escenarios que reproducen esa misma pérdida (guardado que falla, excepción que escapa de `test()`). Es la misma clase de error de proceso que la ronda 4 encontró en la pieza anterior, ahora en una pieza distinta. |
| 6 | Diseño y decisiones de producto | 10 | **9** | La decisión de contar en vez de comparar firmas, y de excluir `entre-vuelos` del conteo por ser sintético y no 1:1 con una reserva, está bien argumentada y resistió el ataque del vector adversario. El diseño del autoguardado (envolver `console.log`, escribir a `os.tmpdir()`, no ensuciar el repo) es razonable; resta 1 por no incluir, ya en el diseño, el `try`/`finally` que hubiera cerrado los dos huecos de §3 sin que hiciera falta una auditoría más para encontrarlos. |
| | **Total** | **100** | **82** | **NO PUBLICAR**, y no aplica el piso de Candidato: bajan también la 3 y la 5, por un motivo ajeno al teléfono. |

### Por qué no aplica el piso de 70 (candidato)

Igual que en la ronda 4: el candado de Candidato exige que la única dimensión floja sea la 1. Acá también
bajan la 3 (honestidad, por los dos casos límite no declarados) y la 5 (calidad interna, por el gap real en
el autoguardado). El total (82) está por encima de 70, pero eso no habilita el candado — la regla del
proyecto es explícita: **"si el auditor baja el puntaje por cualquier motivo que no sea la indisponibilidad
del entorno real, no hay piso de 70 que valga."** Esto es **NO PUBLICAR**, ni siquiera como candidato.

---

## Hallazgos vivos, ordenados por gravedad

1. **(Moderado, no bloqueante para VAL-72 en sí, bloqueante para publicar por calidad interna)** El
   autoguardado de `app/pruebas/tier-del-modelo.js` no avisa cuando el guardado en sí falla (§3a), y pierde
   toda la salida acumulada si una excepción escapa por fuera de un `test()` (§3b) — los dos escenarios en
   los que más hace falta, porque reproducen exactamente el síntoma original ("salida perdida") que el
   mecanismo existe para evitar.
2. **(Cerrado)** La aserción de duplicación (hallazgo de la ronda 4) está genuinamente arreglada y verificada
   contra los cinco bloques que comparten la causa, más un vector adversario sobre el filtro de
   `entre-vuelos`. No queda nada pendiente de este hallazgo.
3. **(Cerrado)** La frase del backlog sobre "no se puede desincronizar" está corregida con precisión.

---

## Lo que falta para llegar a 85, en orden

1. **Cerrar el gap del autoguardado de `tier-del-modelo.js`.** Dos cambios concretos:
   - Si `guardarRegistro()` falla, que lo diga: capturar `e.message` en el `catch` y, en el bloque final,
     avisar SIEMPRE que `fail > 0` — con archivo si se pudo guardar, con el motivo del fallo de escritura si
     no. Hoy el `catch (e) { return null; }` descarta el error sin loguearlo, y `if (fail && donde)` deja el
     caso `donde === null` completamente mudo.
   - Envolver el cuerpo del IIFE (línea 272-521) en un `try`/`finally` (o registrar
     `process.on("uncaughtException"/"unhandledRejection")`) que llame a `guardarRegistro()` antes de
     terminar, para que una excepción que escape de un `test()` —`browser.launch()`, `browser.close()`,
     cualquier código entre pruebas— no se lleve puesta toda la salida acumulada.
   - Repetir, después del arreglo, los dos sabotajes exactos de esta ronda (ruta de escritura inválida;
     `executablePath` inválido) y confirmar que ahora sí avisan y guardan lo que se pueda.
2. **(Menor)** En el próximo mecanismo de este tipo, declarar de entrada los casos límite no probados —igual
   que ya se hace en otras partes de este proyecto (ver el bloque "LO QUE ESTE ARNÉS NO PRUEBA" del propio
   `tier-del-modelo.js`)— en vez de dejar que la auditoría los encuentre.
3. Recién entonces, publicar (confirmando con los cuatro `grep` contra el archivo que sirve el Artifact) y
   pedirle al PM la prueba del caso de éxito de VAL-72 en su teléfono.

---

## Lo que nadie puede verificar desde acá

1. **El visor del teléfono en sí.** Nada de esta ronda tocó el dispositivo real: `tier-del-modelo.js` usa
   Chromium de escritorio con viewport y `hasTouch` emulados, no el teléfono. Sigue siendo la única razón
   legítima por la que la dimensión 1 no sube de 18, y está declarada sin adornos en el commit
   ("NO probado en el teléfono del PM"). **Pasos para el PM, una vez publicado:** cargar el viaje Europa
   (EZE→MAD día 1, MAD→CDG día 6, CDG→FCO día 11), tocar "Armar la lista" y confirmar que las sugerencias
   tratan las tres ciudades, no "Europa"; después cargar un viaje a Bariloche con un único traslado al
   aeropuerto y confirmar que sigue sugiriendo para Bariloche (el caso de "no se rompió nada" del brief).
2. **Si lo publicado en el Artifact sigue siendo la v23**, como declaró el entregador con su propia
   herramienta de lectura. No tengo forma de leer el archivo servido desde acá. **Pasos:** abrir el link del
   Artifact, leer el archivo (no la vista renderizada), y buscar `VALIJA_VERSION`; si no dice `"32"`, sigue
   sin publicarse y no hay nada que pedirle al PM sobre esta ronda todavía.
3. **Las "12 corridas más, todas 42/42" y el acumulado de "3 fallas en ~30 corridas"** son datos de la
   sesión del entregador, sin artefacto que yo pueda inspeccionar desde acá (son corridas anteriores a este
   commit). Los tomo como testimonio, ni verificados ni contradichos.
