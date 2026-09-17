# Auditoría — v19, segunda ronda (commit `e5f41283f4687c7785a88f7a25fd24010b326f90`)

**Audita:** rol `auditor` · **Fecha:** 2026-09-17 · **Puntúa contra:** `docs/auditoria/rubrica.md`
**Árbol verificado quieto:** `git status --porcelain` vacío y `HEAD` en `e5f41283f4687c7785a88f7a25fd24010b326f90`,
comprobado al empezar y al terminar de escribir este archivo.

## Veredicto: PUBLICAR COMO CANDIDATO — 89/100

Sube de 75 a 89. Confirmé con `git diff --stat 388a697 e5f4128` que entre las dos rondas **no cambió una
sola línea de `app/`**: los tres archivos tocados son `docs/auditoria/2026-09-17-v19-causa-raiz.md` (mi
propio informe, commiteado tal cual lo escribí — lo diffeé contra lo que tengo en memoria de esta sesión y
es idéntico), `docs/briefs/adjuntar.md` y `docs/qa/v19-como-lo-compruebo-en-el-telefono.md`. Por eso no
repetí los 17 arneses: ya los corrí sobre este mismo código en la ronda anterior y el motor no se tocó. Sí
volví a correr el arnés puntual que motivó el veto, para no confiar en que "lo corregí" fuera cierto sin
comprobarlo de nuevo.

Los dos hallazgos del veto de 75 están cerrados, y bien cerrados:

1. **El número.** `docs/qa/v19-como-lo-compruebo-en-el-telefono.md` ahora dice "9 veces: 8 en los dos
   gestos...y una novena que es un chequeo directo al motor, fuera de los gestos." Volví a correr el arnés
   contra `/tmp/v18.html` (la misma v18 que usé la ronda pasada) y conté **9 FALLA** exactas, de las cuales
   8 pertenecen a los dos gestos y la novena es el chequeo de tamaño/tope. Coincide con la corrección,
   número por número. Además se agregó un párrafo que admite el error y por qué pasó ("no lo volví a contar
   antes de escribirlo"), en vez de pulir la cifra en silencio.
2. **El brief.** La referencia rota a `docs/qa/v18-como-lo-compruebo-en-el-telefono.md` se corrigió a
   `v19-...` (verificado: el archivo `v19-...` existe, el `v18-...` ya no). Se agregó un capítulo completo
   ("La causa raíz, encontrada el 17/09...") que además corrige una afirmación falsa que el propio brief
   tenía escrita desde el 17/09 ("la foto entraba porque el navegador es su dueño"), con la explicación
   correcta (el tamaño, no el origen).

No encontré ningún hallazgo nuevo que baje el puntaje por debajo de 85. Quedan dos observaciones menores,
ninguna bloqueante, anotadas más abajo.

---

## 1 · El número — recontado, no sólo releído

```
NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/metodo-bytes-nativo.js /tmp/v18.html
```

Conteo con un patrón más preciso que la vez pasada (`grep -c "FALLA "`, con el espacio final, para no
contar de nuevo la línea de resumen "N FALLARON" por contener la subcadena "FALLA"): **9**, exactas, las
mismas nueve que documenté en la ronda anterior, con la misma que cae fuera de "los dos gestos". El texto
nuevo del documento del PM dice "8 en los dos gestos...y una novena que es un chequeo directo al motor,
fuera de los gestos" — coincide exactamente con mi conteo, no es una cifra redondeada distinta escrita
de nuevo sin correr nada.

## 2 · El capítulo nuevo del brief — la clasificación de causa no se pasa de la raya

Leí el capítulo completo agregado a `docs/briefs/adjuntar.md`. La tabla clasifica los tres cambios como
"No depende de acertar la causa", con una razón distinta y propia para cada fila:

- Fila 1 y 2 (`bytesUtilizables` exige bytes de verdad; si no lo son, no corta el camino): la razón dada es
  que la función rechaza **cualquier** valor que no sean bytes utilizables, sea o no el método nativo de
  `Blob`. Es el mismo argumento que hice en la ronda anterior por mi cuenta, y sigue siendo cierto: revisé
  de nuevo `bytesUtilizables` y no depende de ninguna hipótesis sobre qué es exactamente `file.bytes` en el
  teléfono del PM, sólo de si lo que hay ahí sirve como datos. No se pasa de la raya.
- Fila 3 (el mensaje deja de decir "probé de tres formas"): la razón dada es distinta y también correcta —
  es una corrección de un enunciado falso ("dije tres, hice una"), no una apuesta sobre el Android del PM.
  Clasificarla como "No depende de la causa" es exacto por una razón diferente a las otras dos filas, y el
  brief no las mezcla ni usa el mismo argumento para las tres a la fuerza.

Donde el brief sí sigue dependiendo de una hipótesis —y lo dice, sin esconderlo— es en la afirmación de que
el defecto **es** el de la fila del guard (`if (file && file.bytes)`). Ese salto (de "así se ve exactamente
el síntoma" a "esto es lo que pasó en el teléfono del PM") sigue siendo una inferencia, no una certeza, y la
sección "Lo que sigue abierto" lo dice con las palabras correctas: "El arreglo se sostiene sin acertar por
qué `file.bytes` era verdadero ahí, pero puede haber más de una cosa rota." No encontré ninguna frase que
convierta esa inferencia en un hecho consumado.

## 3 · Barrido de referencias y cifras en los dos documentos tocados

```
grep -n "docs/qa/v1[0-9]\|\.md\`" docs/briefs/adjuntar.md docs/qa/v19-como-lo-compruebo-en-el-telefono.md
```

Cuatro referencias a archivos (`docs/qa/2026-09-14-iteracion-3.md`, `docs/investigacion/paso-cero-leer-una-foto.md`,
`docs/investigacion/cuota-de-la-capa-inteligente.md`, `docs/qa/v19-como-lo-compruebo-en-el-telefono.md`).
Las cuatro existen (`test -f`). Ninguna referencia rota nueva ni vieja quedó sin corregir.

Busqué también cualquier resto de "10 FALLA" o "10 veces" en `CLAUDE.md`, `docs/briefs/*.md` y
`docs/qa/*.md`: cero resultados. La cifra vieja no quedó en ningún otro lado además del que ya se corrigió
(el mensaje del commit `388a697`, que el coordinador decidió no reescribir por ya estar publicado — decisión
razonable: reescribir historia publicada genera más riesgo que el que evita, y la corrección donde importa
—el documento que lee el PM— está hecha).

No encontré ninguna otra afirmación numérica nueva en los dos documentos tocados que no haya podido
verificar contra el código o contra mi propia corrida de los arneses.

## 4 · Lo que no cambió, y sigue igual que en la ronda anterior

- El motor (`app/parts/adjuntos-engine.js`, `app/valija.html`) no se tocó: confirmado por
  `git diff --stat 388a697 e5f4128`. Todo lo que verifiqué sobre la causa raíz, el arreglo, el barrido de
  la clase y la identidad byte a byte del motor embebido sigue valiendo sin necesidad de repetirlo.
- `doc_repl` sigue cubierto por la invariante estructural (`preparar-no-lanza.js`) y no por un escenario
  propio bajo la condición exacta del `bytes()` nativo. Es una observación, no un hallazgo nuevo: ya estaba
  en la ronda anterior y el brief la sigue declarando en su propia sección de pendientes, sin maquillarla
  como resuelta.
- Nadie puede verificar desde acá que el arreglo alcance en el teléfono real del PM. Sigue siendo la única
  brecha estructural de esta entrega, y sigue declarada con precisión.

---

## Tabla de las seis dimensiones

| # | Dimensión | Peso | Puntaje | Por qué |
|---|---|---|---|---|
| 1 | Verificación en el entorno real | 30 | **20** | Sin cambios respecto de la ronda anterior: el motor no se tocó. Mismo sustituto fiel, misma brecha declarada con precisión, mismo guion accionable para el PM. Sigue en el piso del bucket porque sigue sin haber una pisada real de teléfono. |
| 2 | Diagnóstico de causa raíz | 15 | **14** | Sin cambios en la causa ni en el arreglo. Se mantiene la reserva de un punto: el argumento de causa raíz es sólido, pero la entrega ya demostró una vez que puede citar un número sin volver a correrlo, y esa reserva no desaparece del todo aunque esta vez sí lo haya corregido bien. |
| 3 | Honestidad de lo verificado | 15 | **14** | El número falso se corrigió con el motivo dicho explícitamente ("no lo volví a contar antes de escribirlo"), en el mismo lugar donde se había cometido, sin pulirlo en silencio. Falta un punto porque el patrón —afirmar sin volver a comprobar y que lo agarre la auditoría— ya se dio una vez en esta misma ronda; la corrección es ejemplar, pero llegó por señalamiento externo, no por autochequeo antes de publicar. |
| 4 | Cumplimiento del contrato | 15 | **14** | Los dos pendientes explícitos del veto de 75 están cerrados y verificados por mí, no sólo declarados: la referencia rota apunta ahora a un archivo que existe, y el brief incorpora el capítulo de la causa raíz, incluida la corrección de su propia afirmación falsa sobre la foto de la cámara. Falta un punto porque `doc_repl` sigue sin escenario propio bajo la condición exacta del bug (aceptado como riesgo bajo, declarado, pero sigue siendo una casilla sin marcar). |
| 5 | Calidad interna | 15 | **14** | Motor sin cambios y ya verificado idéntico byte a byte. Los dos documentos tocados están libres de referencias rotas y de cifras sin respaldo, verificado por barrido propio. Falta un punto por el mismo motivo de la dimensión 3: la ronda anterior mostró que un número puede llegar a un documento del PM sin haberse vuelto a contar, y aunque esta ronda lo corrigió bien, es una fragilidad de proceso que no desaparece con una corrección puntual. |
| 6 | Diseño y decisiones de producto | 10 | **9** | La clasificación "¿depende de acertar la causa?" está bien argumentada fila por fila, con razones distintas y propias en vez de una excusa genérica repetida tres veces, y no convierte una inferencia (qué pasó en el teléfono del PM) en un hecho. Corregir una afirmación falsa del propio brief en vez de dejarla control es la decisión correcta. |
| | **Total** | **100** | **89** | |

**Diferencia con la ronda anterior:** sube 14 puntos (75 → 89) por el cierre verificado de los dos
hallazgos concretos del veto, sin que aparezca ningún hallazgo nuevo que los compense a la baja.

---

## Afirmaciones verificadas en esta ronda, con comando y resultado

| Afirmación | Cómo la verifiqué | Resultado |
|---|---|---|
| "Entre `388a697` y `e5f4128` no cambió una línea de `app/`" | `git diff --stat 388a697 e5f4128` | **Cierto**, sólo tres archivos de `docs/`, ninguno en `app/` |
| "El archivo de auditoría anterior quedó commiteado sin editar" | `git show e5f4128:docs/auditoria/2026-09-17-v19-causa-raiz.md` comparado contra el archivo que yo mismo escribí | **Cierto**, sin diferencias |
| "El arnés da 9 fallas contra la v18, 8 en los dos gestos y una fuera" | Corrí `metodo-bytes-nativo.js` contra `/tmp/v18.html` de nuevo, con un patrón de conteo que no confunde "FALLA" con "FALLARON" | **Cierto**, 9 exactas, misma distribución que documenté la ronda anterior |
| "La referencia a `v18-como-lo-compruebo-en-el-telefono.md` se corrigió" | `grep` en el brief + `test -f` sobre ambos nombres | **Cierto**, ahora apunta a `v19-...`, que existe; `v18-...` ya no existe |
| "No quedan restos de '10 FALLAS' en la documentación" | `grep -rn "10 FALLA\|10 veces\|FALLAS" CLAUDE.md docs/briefs/*.md docs/qa/*.md` | **Cierto**, cero resultados |
| "Las demás referencias a archivos en los dos documentos tocados existen" | `grep` de rutas `.md` + `test -f` una por una | **Cierto**, las cuatro existen |
| "La clasificación de causa de las tres filas de la nueva tabla no se pasa de la raya" | Leí el capítulo completo y contrasté con el código de `bytesUtilizables` | **Cierto para las tres filas**, con razones distintas y propias; la sección "Lo que sigue abierto" mantiene la inferencia sobre el teléfono del PM como inferencia, no como hecho |
| "El árbol se mantuvo quieto durante esta auditoría" | `git status --porcelain` y `git rev-parse HEAD`, al empezar y al terminar | **Cierto**, sin cambios, siempre en `e5f4128` |

---

## Qué falta para dar la iteración por terminada (no para publicar como candidato, que ya se puede)

1. **La prueba real, en el teléfono del PM**, con los tres gestos de
   `docs/qa/v19-como-lo-compruebo-en-el-telefono.md`. Es lo único que puede cerrar esta saga; nada de lo
   corrido acá lo reemplaza.
2. Si se quiere cerrar `doc_repl` sin depender de la invariante estructural, agregar un tercer gesto a
   `metodo-bytes-nativo.js` que reemplace un documento ya adjunto bajo la condición exacta del `bytes()`
   nativo. Barato, ya identificado dos veces, sigue sin estar. No es requisito para publicar como
   candidato — la invariante alcanza para eso — pero sí para poder decir que los tres caminos de entrada de
   archivo se probaron bajo la condición exacta del bug, no sólo dos de tres.

## Lo que nadie puede verificar desde acá

Sin cambios respecto de la ronda anterior, porque el motor no se tocó y la brecha es la misma:

1. **Que la versión publicada sea realmente la `v19`.** Leer el archivo que sirve el Artifact y buscar
   `const VALIJA_VERSION = "19"` y el comentario de `bytesUtilizables` antes de pedirle nada al PM.
2. **Prueba 1 — adjuntar el PDF del mail a una reserva** (gestos de las capturas 2 y 3 del 17/09).
3. **Prueba 2 — el mismo PDF, importándolo** (gesto de la captura 1).
4. **Prueba 3 — que la foto de la cámara siga entrando y reduciéndose sola** (2,7 MB → ~112 KB).
5. **Si reaparece el cartel de Android "Memoria insuficiente para completar la operación anterior"**, que
   el PM lo reporte con esas palabras exactas y en qué paso apareció; nadie desde acá puede determinar si es
   ruido del sistema operativo o un segundo problema.
6. **El escenario `doc_repl` bajo la condición exacta del `bytes()` nativo**, como se detalla arriba.
