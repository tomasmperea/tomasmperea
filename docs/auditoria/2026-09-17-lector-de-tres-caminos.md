# Auditoría — commit `499fa22` "Dejar de adivinar: leer de las tres formas y decir qué se observó"

**Audita:** rol `auditor` · **Fecha:** 2026-09-17 · **Puntúa contra:** `docs/auditoria/rubrica.md`

## Veredicto: NO PUBLICAR — 45/100

Este commit no es una cuarta hipótesis sobre el Android del PM — en eso tiene razón, y se lo
acredito abajo. Pero sí contiene una asunción que no se declaró y que resultó falsa: que
arreglar la LECTURA de bytes alcanza para que la app deje de inventar una causa. **No alcanza.**
Reproduje, en el mismo sustituto que usa este mismo commit, el caso en que el archivo falla por
los tres caminos durante **Importar** (no durante Adjuntar) y la app dice:

> "Este PDF es un escaneo: no tiene texto adentro para leer, y esta vista no puede leer
> imágenes."

Eso es falso — el PDF no es un escaneo, es ilegible — y es exactamente la clase de afirmación
que este mismo commit prohíbe por escrito en `CLAUDE.md` ("nunca concluir de un dato lo que se
puede determinar leyendo", "el mensaje de error no inventa una causa"). Y no muestra la línea de
diagnóstico en ningún lado. Importar es uno de los DOS caminos que el propio proyecto ya tenía
documentados como reproducción del bug del PM (`app/pruebas/archivo-del-correo.js`, línea 26-28:
"Cubre los DOS caminos, porque el PM probó los dos"). Este commit sólo cierra uno.

---

## 1 · ¿Es una cuarta hipótesis disfrazada? — Respuesta: no, pero hay una asunción sin declarar

La estrategia central — agotar `arrayBuffer()`, `slice().arrayBuffer()` y `FileReader` en vez de
apostar a cuál falla — **no es una hipótesis sobre el teléfono**. Los tres son, en efecto,
prácticamente todas las formas documentadas de sacarle bytes a un `Blob` en un navegador; no hay
un cuarto camino escondido que yo haya podido encontrar. Esa parte del commit vale lo que dice
que vale.

Lo que sí se coló, sin decirlo, es una asunción distinta: **que arreglar cómo se leen los bytes
alcanza para que toda la app dependa del mismo diagnóstico**. Es falsa. El texto "El importador
usa el MISMO lector" es cierto sólo para el paso de leer bytes hacia la cola (`leerUnaVez`); no
es cierto para lo que pasa cuando ese lector agota los tres caminos y sigue sin poder leer:
en ese caso el `blob` que se le pasa a `ImportEngine.interpretFiles` sigue siendo el blob roto
original (`entrada.blob` no se reemplaza si `r.bytes.length` da cero — `app/valija.html:9031`),
y el motor de interpretación lo vuelve a leer por su cuenta, con su propio manejo de errores, que
este commit no tocó. Ver la reproducción en la sección 2.

## 2 · ¿El diagnóstico sirve de verdad? — No, tiene un hueco grave y lo reproduje

**Lo que sí funciona (verificado):** adjuntar un documento directo a una reserva
(`sheetItem` → `doc-block`), con los tres caminos rotos, muestra:

```
No pude leer ese archivo: probé de tres formas distintas y ninguna trajo nada. Si vino
por mail, bajalo al teléfono primero y después elegilo desde ahí.
informa 5166 B · arrayBuffer NotReadableError no se puede leer · slice 0 B ·
FileReader Error roto · application/pdf · v18
```

Entra en una captura, no inventa causa, y dice la versión. Corrí
`app/pruebas/tres-caminos-de-lectura.js` contra `app/valija.html` sin modificar y los cuatro
escenarios (arrayBuffer roto, arrayBuffer+slice rotos, además sin tamaño, los tres rotos) dan
**verde**, reproduciendo exactamente esa salida.

**Lo que NO funciona (verificado, no es un supuesto):** armé un arnés ad hoc
(`/tmp/importar-tres-rotos.js`, reutilizando la misma función `romper()` de
`tres-caminos-de-lectura.js` pero apuntada a la pantalla de **Importar** en vez de Adjuntar) y
con los tres caminos rotos sobre el mismo PDF real la pantalla dice:

```
No conseguí ninguna reserva de este archivo
No se pudo leer. El detalle de cada uno está abajo.
tarjeta-real.pdf
Este PDF es un escaneo: no tiene texto adentro para leer, y esta vista no puede leer
imágenes. Si tenés el comprobante original en texto (el PDF que manda la empresa, o el
mail), probá con ese; si no, cargá la reserva a mano.
```

Ni la línea de diagnóstico, ni la versión, aparecen en ningún lado. Y la causa que se afirma
("es un escaneo") es inventada: el archivo no es un escaneo, es ilegible por los tres caminos.
Confirmé además, con un control negativo sobre el código actual (revertí sólo el momento en que
se limpia `input.value`, sin tocar nada de este commit), que este mismo mensaje falso aparece
con `app/pruebas/archivo-del-correo.js` en su "camino 2 — importar": cuando el archivo llega
muerto por el lado de Importar, la pantalla dice literalmente "Este PDF es un escaneo…" en vez
de mostrar lo observado.

**Por qué pasa:** `prepareSource`/`extractTextFor`/`renderFor` (el motor de interpretación,
`ImportEngine`) reciben `file.blob` y lo leen por su cuenta —no a través de
`leerBytesConDiagnostico`—, y su manejo de errores no cambió en este commit. Si el blob que
llega ya está muerto (porque `leerUnaVez` agotó los tres caminos y no pudo reemplazarlo por uno
sano), la extracción de texto falla, cae al render de imágenes, también falla, y el código
preexistente concluye "es un escaneo sin capa de texto" — la misma clase de conclusión inventada
que costó tres rondas, ahora sobreviviendo en la mitad del código que este commit no tocó.

Este es precisamente el hueco que se pidió buscar, y es grave: si el próximo reporte del PM
vuelve a llegar por el camino de Importar (que ya pasó una vez, documentado en el propio
repositorio), la app va a volver a inventar una causa falsa y no va a traer el dato que cierra
el problema. Es otra ronda perdida, no distinta de las tres anteriores, sólo que por la otra
puerta.

## 3 · `tres-caminos-de-lectura.js`, auditado con desconfianza

- **Corrí el arnés tal cual**, contra `app/valija.html` sin tocar: 4 escenarios, todos en verde,
  reproduce lo que el commit dice.
- **Corrí el control negativo pedido**: reemplacé `leerBytesConDiagnostico` por una versión de
  un solo camino (sólo `arrayBuffer`, sin slice ni FileReader) y volví a correr el mismo arnés.
  Resultado: **7 FALLAS**, exactamente en las aserciones que importan ("el archivo se lee igual",
  "queda adjunto al guardar", "muestra lo que observó en los TRES caminos"). El sabotaje del
  arnés llega de verdad y el arnés reacciona. Confirmado, no asumido.
- **Revisé los otros tres arneses nuevos** (`archivo-sin-tamano.js`, `archivo-del-correo.js`,
  `archivo-de-una-lectura.js`) buscando el mismo vicio de cierre-por-closure. Ninguno lo tiene:
  los tres definen el sabotaje **enteramente dentro** de la función que le pasan a
  `page.addInitScript(() => {...})`, sin capturar variables externas, así que no dependen de que
  el closure cruce el borde de serialización — el defecto de origen no puede repetirse ahí tal
  cual está escrito.
- **Los corrí igual, sin tocar nada**: los tres dan verde (`archivo-sin-tamano.js`,
  `archivo-del-correo.js`, `archivo-de-una-lectura.js`).
- **Les hice mi propio control negativo a uno de los tres** para no confiar de más:
  `archivo-del-correo.js` mide `window.__SOLTADOS__` pero sólo lo **imprime** (`info`), nunca lo
  **asevera** (`ok`) — así que si el sabotaje nunca se disparara, el arnés no lo notaría solo.
  Revertí el arreglo que ese archivo dice probar (moví `input.value=""` de nuevo a `onchange`) y
  corrí el arnés: pasó de "0 verdes de más" a **4 FALLAS**, con `__SOLTADOS__` pasando de 0 a 1,
  así que el sabotaje sí llega y el arnés sí lo detecta — pero lo detecta por las aserciones de
  contenido, no por una aserción explícita sobre el propio sabotaje. Es una brecha menor de
  higiene (la regla nueva de CLAUDE.md pide un caso que falle "si el sabotaje no llegó"; acá
  ninguno de los tres arneses viejos tiene ese caso explícito), no un arnés mentiroso.

## 4 · Regresiones, corridas yo mismo, de a una

Todas confirmadas en verde, sin correr dos navegadores a la vez:

| Arnés | Resultado propio | Coincide con el commit |
|---|---|---|
| `motores-desde-html.js` | 68 + 101 + 39 pasaron | Sí |
| `valija-bloque-b.js` | 111 pasaron | Sí |
| `hallazgos-qa-bloque-b.js` | 31 pasaron | Sí |
| `tarjeta-y-lote.js` | 77 pasaron | Sí |
| `importar-arranque.js` | 59 pasaron | Sí |
| `importar-sin-imagenes.js` | 45 pasaron | Sí |
| `tier-del-modelo.js` | 42 pasaron | Sí |
| `importar-botones.js` | 12 aserciones, todo verde | Sí (botones, no eventos — confirmé que toca `#im_cam`/`#im_gal`/`#im_doc`) |
| `adjuntar-documento.js` | 81 pasaron | Sí |
| `base-compartida.js` | todo verde (incluido D4 y cascada) | Sí |
| `pdf-real.js` | todo verde, con pdf.js real | Sí |
| `lote-modelo-real.js` | 3 documentos, 1 llamada, modelo real | Sí |
| `cruce-adjunto-huerfano.js` | 4 pasaron | Sí |
| `cruce-archivo-dos-reservas.js` | 4 pasaron | Sí |
| `cruce-huerfano-al-fallar.js` | 5 pasaron | Sí |
| `auditoria-h1.js` / `auditoria-h2.js` | veredictos "corregido" / correcto | Sí |
| `archivo-sin-tamano.js` | todo verde | Sí |
| `archivo-del-correo.js` | todo verde | Sí |
| `archivo-de-una-lectura.js` | todo verde | Sí |
| `tres-caminos-de-lectura.js` | 4 escenarios verdes + control negativo en rojo | Sí, y verificado con control negativo propio |

**El número "111, 81, 77, 59, 45, 42, 31, 4, 4, 5" del commit es exacto**, verifiqué cada uno
contra el arnés correspondiente. No encontré ninguna cifra inflada.

**Código embebido vs. fuente:** comparé byte a byte `leerBytesConDiagnostico`, `detalleDeLectura`,
`prepararDocumento` y `errorInfo` entre `app/parts/adjuntos-engine.js` y `app/valija.html`
(descartando un `errorInfo` homónimo de otro motor que casi me hace reportar una diferencia
falsa) — **idénticos**. El bloque `ERRORES` también es idéntico.

## 5 · El mensaje al usuario

- `"archivo-vacio"` nuevo: "No pude leer ese archivo: probé de tres formas distintas y ninguna
  trajo nada. Si vino por mail, bajalo al teléfono primero y después elegilo desde ahí." — no
  afirma que esté vacío, dice qué se intentó y qué hacer, voseo correcto, sin disculpas ni culpa.
  **Verificado**, es el mensaje real que se ve en pantalla.
- El detalle técnico (`informa … · arrayBuffer … · slice … · FileReader …`) va aparte, en mono,
  chico y apagado — decisión de diseño defendible y documentada en el CSS (`.dato`). No compite
  con el mensaje humano.
- **El mensaje `"no-se-pudo-leer"` es código muerto.** `leerBytesConDiagnostico` está escrita para
  no rechazar nunca (cada camino atrapa su propio error y devuelve `null`), así que la rama
  `.then(..., function(e){...})` de `prepararDocumento` que produce ese mensaje no se alcanza en
  la práctica. No es grave por sí solo, pero es una imprecisión que nadie limpió.
- La afirmación del commit "`prepararDocumento` ya no decide nada mirando el tamaño informado.
  Siempre lee" es parcialmente inexacta: el camino 3 (el archivo informa un tamaño mayor al tope)
  sigue sin leer nada y decide directo por el tamaño informado. No es un bug — es una decisión
  razonable para no leer archivos grandes de más— pero el comentario la contradice.

## 6 · La regla nueva de `CLAUDE.md`

Es aplicable, no sólo una intención: da un algoritmo de cinco pasos concreto ("no se publica un
arreglo que dependa de acertar la causa", "se puede publicar un arreglo que no dependa de la
causa", "el mensaje no inventa una causa") y declara con honestidad su propio límite ("la
auditoría no cubre este caso — el auditor corre en el mismo entorno ciego"). Un agente que la lea
sabe qué puede publicar. Lo que la regla no dice, y que este commit expone, es qué hacer cuando
el mismo síntoma tiene **dos gestos de entrada** (adjuntar e importar): la regla habla en singular
("el mensaje de error no inventa una causa") y el commit la cumplió para un gesto y la incumplió
para el otro sin que nada en la regla lo hubiera evitado. Vale la pena que la próxima revisión de
`CLAUDE.md` diga explícitamente: "si el síntoma tiene más de un gesto de entrada conocido, el
arreglo y su prueba cubren todos, no el primero que se encuentra."

---

## Tabla de las seis dimensiones

| # | Dimensión | Peso | Puntaje | Por qué |
|---|---|---|---|---|
| 1 | Verificación en el entorno real | 30 | **12** | Sustituto fiel (Chromium + `File` reales parchados, no objetos inventados), brecha del entorno declarada con honestidad. Pero no se probó en el mismo sustituto un gesto ya conocido (Importar) que era trivial de probar acá — lo probé yo en минutos con el mismo arnés reutilizado. |
| 2 | Diagnóstico de causa raíz | 15 | **5** | La estrategia de agotar los tres caminos es legítima y no depende de acertar una causa — mérito real. Pero deja sin tocar la mitad del código que produce el síntoma (el motor de interpretación), así que el síntoma persiste intacto por esa puerta. |
| 3 | Honestidad de lo verificado | 15 | **5** | Honestidad genuina sobre el propio error del arnés (closure) y sobre el límite del auditor. Pero "el importador usa el MISMO lector" se afirma sin la salvedad de que el diagnóstico no llega a la interpretación — es una afirmación más fuerte de lo que se comprobó. |
| 4 | Cumplimiento del contrato | 15 | **5** | El contrato que el propio commit fija ("la app dice qué observó", "el mensaje no inventa causa") no se cumple en el camino de Importar, verificado, no supuesto. |
| 5 | Calidad interna | 15 | **11** | Motor embebido idéntico al fuente (verificado byte a byte), batería de regresión extensa y realmente en verde (verifiqué cada arnés), control negativo del arnés nuevo confirmado. Resta: rama de código muerta (`no-se-pudo-leer`), un comentario ("siempre lee") que no describe el camino 3, y los tres arneses viejos no tienen aserción explícita de que su sabotaje llegó. |
| 6 | Diseño y decisiones de producto | 10 | **7** | La separación visual mensaje humano / dato técnico está bien pensada y documentada. El sello de versión resuelve un problema real (16/09) con una solución simple. Ninguna decisión se esconde. |
| | **Total** | **100** | **45** | |

---

## Qué falta para llegar a 85, en orden

1. **Cerrar el hueco de Importar.** Cuando `leerUnaVez` agota los tres caminos y no consigue
   bytes, o bien no se manda ese archivo a `interpretFiles` (se declara "no legible" de entrada,
   con el mismo detalle de `entrada.intentos`), o bien `interpretFiles`/`prepareSource` reciben y
   propagan el mismo diagnóstico en vez de re-leer el blob roto por su cuenta y concluir "es un
   escaneo". Cualquiera de las dos cierra el hueco; hoy no está cerrado ninguno.
2. **Agregar al arnés la cobertura que falta.** `tres-caminos-de-lectura.js` sólo toca
   `[data-pick="doc_file"]` en `sheetItem`. Falta un escenario gemelo tocando `#imp` →
   `[data-pick="im_doc"]`, con los tres caminos rotos, que compruebe que la pantalla de Importar
   también muestra el detalle y no inventa "es un escaneo". Lo armé ad hoc para esta auditoría;
   vale la pena que quede en el repositorio, no en `/tmp`.
3. **Sacar o marcar el código muerto de `"no-se-pudo-leer"`**, o escribir el caso que sí lo
   alcance, para que no quede una rama de error que nunca se ejecuta.
4. **Corregir el comentario "siempre lee"** para que diga que el camino 3 (tamaño informado por
   encima del tope) sigue decidiendo por el tamaño, a propósito.
5. **Sumarles a `archivo-sin-tamano.js`, `archivo-del-correo.js` y `archivo-de-una-lectura.js`
   una aserción explícita de que el sabotaje se aplicó** (no sólo un `info()`), siguiendo la
   regla nueva que el propio `CLAUDE.md` acaba de escribir.

## Lo que nadie puede verificar desde acá

Todo lo que sigue depende del Android real del PM, no de este entorno, y esta auditoría no
puede saldarlo:

- **Si alguno de los tres caminos (`arrayBuffer`, `slice().arrayBuffer()`, `FileReader`) en
  verdad funciona en ese teléfono para el PDF que falla.** La premisa de todo el commit es que
  al menos uno de los tres anda; puede que ninguno ande, y en ese caso el usuario va a ver el
  mensaje de diagnóstico en vez del documento — mejor que antes, pero no soluciona nada.
- **Si el orden elegido (arrayBuffer → slice → FileReader) importa**, o si en ese Android
  específico el orden fuera al revés y agregara una demora perceptible antes de fallar del todo.
- **Si la línea de diagnóstico realmente entra en una sola captura de pantalla** en el tamaño de
  fuente real del teléfono del PM, sin recortarse.

**Pasos exactos para que el PM lo compruebe, si el bug vuelve a aparecer:**

1. Abrir el Artifact publicado desde el teléfono (no un link viejo — mirar que la cabecera diga
   `v18` o la versión que corresponda a esa publicación).
2. Repetir exactamente lo que hizo las tres veces anteriores: abrir el mail con el PDF, tocar
   "Adjuntar" (o "Importar", **probar los dos**, no sólo uno) y elegir ese archivo.
3. Si aparece el cartel de "No pude leer ese archivo…", **sacar captura de pantalla completa**
   asegurándose de que se vea la línea chica en mono debajo del mensaje (empieza con
   "informa … B"). Esa línea es el dato que le faltó a las tres rondas anteriores.
4. Si en cambio aparece cualquier otro mensaje —en particular algo sobre "escaneo" o "no tiene
   texto"— avisar igual, con foto: sería la confirmación de que el hueco de esta auditoría (punto
   2 de esta sección) es el que se está viendo, y no haría falta adivinar una quinta vez.
