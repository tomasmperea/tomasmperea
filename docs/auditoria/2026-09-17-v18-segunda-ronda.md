# Auditoría — v18, segunda ronda (commit `f0e88b4`)

**Audita:** rol `auditor` · **Fecha:** 2026-09-17 · **Puntúa contra:** `docs/auditoria/rubrica.md`

## Veredicto: PUBLICAR COMO CANDIDATO — 86/100

Sube de 68 a 86. Los tres motivos concretos del veto anterior están cerrados, dos de ellos con
evidencia mejor que la que pedí, y el árbol se mantuvo quieto durante toda esta auditoría (lo
verifiqué al empezar y varias veces mientras corría pruebas: `git status --porcelain` vacío,
`HEAD` en `f0e88b4` en todo momento).

**"Publicar como candidato" es la decisión que habilita esta rúbrica, no "dar la iteración por
terminada".** El hueco de la dimensión 1 sigue siendo el mismo de siempre — nadie tocó el
teléfono del PM — pero ahora hay un documento propio de esta entrega, dirigido a él, con los
pasos exactos y con lo que la entrega no afirma. Eso es exactamente lo que el candado de la
rúbrica pide para poder publicar sin cantar victoria.

---

## 0 · El árbol se quedó quieto (verificado, no asumido)

Corrí `git status --porcelain` y `git rev-parse HEAD` al principio, después de cada tanda de
pruebas, y al final. Los tres dieron el mismo resultado: sin cambios sin commitear, `HEAD` en
`f0e88b4889a69a1e6752a3afcf7c6662c74bb994`. La promesa esta vez se cumplió. Lo dejo escrito
porque el hallazgo de la ronda pasada fue justamente este, y una auditoría que no vuelve a
mirarlo no puede acreditarlo.

---

## 1 · Los tres motivos del veto de 68, uno por uno

### 1.1 — El comentario falso sobre `opts.leerBytes`

**Lo que pedí:** o se demuestra que la rama `"no-se-pudo-leer"` se alcanza, o se admite que sigue
muerta.

**Lo que se hizo:** se escribió `app/pruebas/preparar-no-lanza.js` con cinco intentos reales de
llegar a esa rama y el comentario ahora dice, con esas palabras, que ninguno llegó y que dejarla
es una decisión, no un hecho demostrado. Lo corrí yo mismo:

```
NODE_PATH=/opt/node22/lib/node_modules node app/pruebas/preparar-no-lanza.js "$(pwd)/app/valija.html"
```

Resultado: los cinco intentos, ninguno con código `"no-se-pudo-leer"` (confirma que sigue siendo
una red, no un camino vivo — el comentario ya no miente). Volví a confirmar por mi cuenta, como en
la ronda anterior, que `opts.leerBytes` no se invoca desde ningún lugar de `app/valija.html` ni
`app/parts/` fuera de los propios arneses (`grep -rn "leerBytes:" app/valija.html app/parts/` sin
resultados fuera de pruebas). **Cierto**, y ahora dicho con la prueba que lo respalda.

**Lo que salió de ahí, y que auditè con la misma desconfianza que el resto:** dos de los cinco
intentos ("opts.leerBytes que LANZA sincrónico" y "file.bytes con un objeto hostil") lanzan
sincrónicamente, fuera de cualquier promesa. Fui a leer el motor para confirmarlo por mi cuenta,
no solo a creer el comentario: en `app/parts/adjuntos-engine.js`, `prepararDocumento` (línea 1050)
llama a `leerBytesConDiagnostico(file, opts)` de forma síncrona y esa función tiene una rama
(`if (file && file.bytes)`, línea 891) que llama a `normalizarBytes(file.bytes)` sin ningún
`try/catch` ni promesa de por medio. Un `file.bytes` cuyo `length` lanza escapa antes de que exista
ninguna promesa. Confirmado leyendo el código, no solo corriendo el arnés.

**El arreglo:** `prepararAdjunto` en `app/valija.html` pasó de
`AdjuntosEngine.prepararDocumento(file, opts).catch(...)` a
`Promise.resolve().then(()=> AdjuntosEngine.prepararDocumento(file, opts)).catch(...)`. Metí el
control negativo yo mismo, revirtiendo exactamente esa línea sobre una copia
(`valija-control.html`) y corriendo el mismo arnés:

```
  info   devolvió: {"lanzo":"Error: hostil","ok":null,"codigo":null,"mensaje":null}
  FALLA no lanzó: el throw sincrónico quedó adentro de la cadena
  FALLA volvió como resultado fallido (null)
  ...
  info   bloque del documento: "... / Preparando el archivo… / ..."
  FALLA no quedó colgado en "preparando": la app contestó algo
  info   botón Guardar: {"existe":true,"deshabilitado":true}
  FALLA "Guardar" quedó usable: la reserva no está secuestrada por el documento que falló
  FALLA y la reserva se guardó igual, sin el documento que no se pudo leer
  >> PAGEERROR: hostil
  7 FALLARON
```

**Exactamente los 7 fallos que el reporte dice**, con el bloque colgado en "Preparando el
archivo…" y "Guardar" deshabilitado — el mismo dato que el reporte afirma. **Cierto, verificado
con mi propio control negativo, no el que trae el commit.**

**Un matiz que sí importa para no sobreestimar el hallazgo:** revisé si ese `file.bytes` hostil
puede llegar por un gesto real, no sólo por el arnés. Los tres puntos de entrada de archivos
(`elegirAdjunto`, `reemplazar`, el lote de `sheetImport`) pasan objetos `File`/`Blob` reales o un
`Blob` reconstruido con `new Blob([r.bytes], ...)` (línea 9108); ninguno de los dos tiene una
propiedad `.bytes` propia en los navegadores que probé (confirmé en Chromium 141 vía Playwright
que `File.prototype.bytes` es `undefined`, no una función nativa que colisione con este nombre).
O sea: el defecto es real y el arreglo es correcto, pero **no tengo evidencia de que sea la causa
del bug que el PM reportó tres veces** — ni el commit lo afirma, lo cual es honesto. Es una
robustez genuina encontrada al comprobar un hallazgo de auditoría, no una cuarta hipótesis
disfrazada.

**Sobre si el arreglo está en el lugar correcto (la pregunta que se me hizo explícitamente):**
sí. Los tres call sites de `prepararAdjunto` (`elegirAdjunto` línea 8082, `reemplazar` línea 8535,
el lote de `sheetImport` línea 9955) llaman todos a la misma función envoltorio, y ninguno tiene
lógica propia entre la llamada y el resultado que pueda volver a lanzar sincrónico — a diferencia
del bug de Importar de la ronda anterior, donde sí había una capa propia (`leerUnaVez`,
`flagsDeArchivo`) arriba del motor compartido. Acá el punto de choque es genuinamente único, así
que arreglarlo ahí cubre los tres gestos sin necesitar un escenario por gesto. Alternativa
correcta también habría sido que `leerBytesConDiagnostico` no llame `normalizarBytes` fuera de una
promesa — ambas cierran el mismo agujero; la elegida es la de menor superficie de cambio y no deja
ningún llamador nuevo expuesto si mañana aparece un cuarto call site que no pase por
`prepararAdjunto`. Sin objeciones.

### 1.2 — El lenguaje de "CAUSA." sobre hipótesis no verificadas

Leí los tres comentarios completos, no solo el diff:

- `wireFilePick` (línea ~8203): ahora dice "La HIPÓTESIS por la que se movió —y es una hipótesis,
  no un hecho comprobado—", nombra la evidencia a favor (la foto de cámara entró) y la evidencia
  en contra (el síntoma siguió después de publicar este arreglo), y explica por qué se deja
  igual: "limpiar al abrir es correcto sin importar si la hipótesis es cierta". Es exactamente lo
  que pedí, con el matiz que pedí.
- `leerUnaVez` en `sheetImport` (línea ~9061): mismo tratamiento — "HIPÓTESIS, no hecho
  comprobado", con "el síntoma siguió después de publicar este arreglo" como evidencia en contra
  explícita, y la razón de fondo para conservarlo ("leer una vez y reusar los bytes es mejor que
  leer dos, sea cierta la hipótesis o no").
- "CERO NO ES VACÍO" en `prepararDocumento`: se aclaró **al revés**, como anuncia el mensaje de
  commit, y con razón: tratar `size:0` como "no sé" y caer a leer es una corrección de lógica
  válida en cualquier navegador, no depende de que la historia de `content://` sea cierta. Separar
  este caso de los otros dos no es un truco retórico — es la distinción correcta.

**Verifiqué la afirmación "el síntoma siguió después de publicarlas"** contra la propia narrativa
del repositorio: `CLAUDE.md` describe tres arreglos fallidos seguidos en septiembre sobre el mismo
síntoma, y el comentario viejo de "CERO NO ES VACÍO" (antes de este commit) decía textualmente "el
PM lo vio en su teléfono tres veces seguidas, con dos arreglos míos en el medio que apuntaban a
otra cosa" — esos dos arreglos previos son, con toda lógica, `wireFilePick` y `leerUnaVez`. La
afirmación encaja con el registro que ya existía antes de este commit, no es una invención nueva
para esta ronda.

### 1.3 — Ningún documento propio con el guion de verificación

`docs/qa/v18-como-lo-compruebo-en-el-telefono.md` es nuevo en este commit (91 líneas, confirmado
en el diff y leído completo). Cumple lo que pedí y un poco más:

- Tres gestos, en el orden en que el PM los vivió (adjuntar, importar, control de que no se
  rompió lo que andaba).
- Sin consola, con capturas de pantalla como único dato pedido.
- Un aviso sobre el error de versión del 16/09 (perder una ronda por probar contra un link viejo),
  que es un error real de este mismo proyecto.
- Una sección final, "Lo que NO te estoy diciendo", que dice explícitamente "que esto está
  arreglado. No lo sé, y no puedo saberlo desde acá" y explica en qué sentido preciso cambió la
  entrega (agotar los tres caminos, corregir un error de lógica, no inventar una causa) sin
  prometer que el bug esté resuelto. Es la definición exacta de la dimensión 3 de la rúbrica
  cumplida sin que se la pidan dos veces.

No hay ninguna frase en este documento que prometa más de lo que el código puede sostener. Es el
mejor documento de cara al PM de toda esta saga.

---

## 2 · Lo que quedó sin resolver (y no es nuevo)

**`docs/briefs/adjuntar.md` sigue sin tocarse.** Confirmé con
`git log --follow --oneline -- docs/briefs/adjuntar.md` que el último commit que lo modifica es
`e7a693a`, anterior a toda esta cadena de arreglos sobre el archivo vacío. Leí el archivo completo:
no menciona este defecto, ni los tres intentos, ni la v18, ni el documento de QA nuevo. Es el punto
4 del veto de 68 y sigue exactamente igual. La cobertura práctica para el PM la da el documento de
QA nuevo, así que el daño es menor que la vez pasada, pero un criterio pedido explícitamente dos
rondas seguidas y no resuelto pesa.

**El escenario de `doc_repl` (reemplazar documento) sigue sin agregarse** a
`tres-caminos-de-lectura.js` ni a `archivo-del-correo.js`. Ya lo marqué como riesgo residual bajo
en la ronda anterior porque no hay lógica propia entre `doc_repl` y el motor compartido, y sigue
siendo cierto para el defecto de esta ronda (ver 1.1). Sigue siendo barato de agregar y sigue sin
estar.

---

## 3 · Afirmaciones verificadas en esta ronda, con comando y resultado

| Afirmación | Cómo la verifiqué | Resultado |
|---|---|---|
| "Ninguno de los cinco intentos alcanza `no-se-pudo-leer`" | Corrí `preparar-no-lanza.js` contra `app/valija.html` sin tocar | **Cierto** |
| "Dos de los cinco escapan sincrónicamente" | Mismo arnés, más lectura de `leerBytesConDiagnostico` y `prepararDocumento` en el código fuente | **Cierto**, y confirmado por qué (línea 891, sin promesa ni try/catch) |
| "El control negativo da 7 fallas, con Guardar deshabilitado y el bloque colgado" | Revertí `Promise.resolve().then(...)` a la llamada directa sobre una copia y corrí el mismo arnés | **Cierto**, 7 FALLAS, mensajes idénticos a los citados en el commit |
| "`opts.leerBytes` no se usa en ningún lado del proyecto" | `grep -rn "leerBytes:" app/valija.html app/parts/` | **Cierto**, cero resultados fuera de `app/pruebas/` |
| "El motor embebido es idéntico al de `app/parts/adjuntos-engine.js`" | Extraje el cuerpo del IIFE de `AdjuntosEngine` en el HTML y el cuerpo de la factory UMD en `parts/`, con el mismo método de anclas que usa `motores-desde-html.js`, y comparé | **Cierto**, idénticos byte a byte (47.359 caracteres en mi medición; la cifra "47.343" del commit no coincide exactamente, mismo patrón de discrepancia menor que en la ronda anterior — el hallazgo de fondo, identidad, se sostiene) |
| "wireFilePick y leerUnaVez ahora dicen HIPÓTESIS, con el dato en contra" | Leí los comentarios completos en `app/valija.html` | **Cierto** |
| "CERO NO ES VACÍO se aclaró al revés, porque no depende de una hipótesis" | Leí el comentario completo y el código que corrige (`tam===0 → tam=null`) | **Cierto**, y la distinción es técnicamente correcta |
| "El síntoma siguió después de publicar los dos arreglos anteriores" | Contrasté contra `CLAUDE.md` (tres arreglos fallidos documentados) y el comentario viejo de "CERO NO ES VACÍO" (ya narraba "tres veces seguidas, con dos arreglos míos en el medio") | **Consistente con el registro del propio repositorio**, no es una afirmación nueva sin respaldo |
| "docs/qa/v18-como-lo-compruebo-en-el-telefono.md declara la brecha con honestidad" | Leí el archivo completo | **Cierto** |
| "15 arneses en verde" | Corrí 20 archivos de `app/pruebas/` (incluye los "tres cruces" y `auditoria-h1/h2`, no mencionados en la lista pero corridos igual) | **Cierto en todos los que corrí, sin discrepancias** — el número "15" es una cuenta agrupada imprecisa del mensaje de commit, no una cifra inflada: no encontré ningún arnés en rojo |
| "El árbol se mantuvo quieto durante esta auditoría" | `git status --porcelain` y `git rev-parse HEAD` al principio, en medio y al final | **Cierto**, sin cambios en ningún momento |
| "El campo `file.bytes` hostil puede colisionar con un archivo real de Android" (verificación propia, no una afirmación del reporte) | Revisé los tres puntos de entrada de archivos y probé en Chromium real (vía Playwright) si `File.prototype.bytes` existe como propiedad nativa | **Falso como riesgo de producción actual**: ni los `File` reales ni los `Blob` reconstruidos (`new Blob([r.bytes],...)`) tienen `.bytes` propio, y Chromium 141 no expone `Blob.prototype.bytes`. El defecto que se arregló es real pero sólo se demostró alcanzable con un objeto sintético en la prueba, no con un archivo real — el commit no afirma lo contrario, así que no hay brecha de honestidad acá, sólo una precisión que agrego |

---

## Tabla de las seis dimensiones

| # | Dimensión | Peso | Puntaje | Por qué |
|---|---|---|---|---|
| 1 | Verificación en el entorno real | 30 | **25** | Sustituto fiel (Playwright real, `File`/`Blob` reales o mínimamente parchados, motor idéntico verificado), los dos gestos que el PM reportó cubiertos con control negativo propio, y ahora existe un documento propio de la entrega, dirigido al PM, con pasos concretos y sin prometer más de lo comprobado — lo que faltaba en la ronda anterior. Resta: sigue sin haber pisada real de teléfono, y `doc_repl` sigue sin escenario propio aunque el riesgo es bajo. |
| 2 | Diagnóstico de causa raíz | 15 | **14** | El defecto del throw sincrónico tiene el ciclo completo: reproducido, causa leída en el código fuente (no sólo en el arnés), arreglo verificado con un control negativo que reproduje yo mismo. Las otras dos hipótesis del defecto de Android (`content://`, "una sola lectura") se mantienen explícitamente como hipótesis no confirmadas, con el dato en contra a la vista — no se sobreestima lo que no se puede probar acá. Resta un punto porque el defecto nuevo, aunque bien resuelto, no se demostró alcanzable por ningún camino real de archivo (sólo por un objeto sintético), y eso no queda dicho en ningún documento. |
| 3 | Honestidad de lo verificado | 15 | **14** | El comentario falso de la ronda anterior se corrigió admitiendo el error explícitamente ("inventé una justificación en vez de comprobarla"), con la prueba que lo respalda. Los comentarios de hipótesis distinguen ahora verificado / hipótesis / evidencia en contra, sin que haga falta pedirlo de nuevo. El documento de QA nuevo tiene una sección dedicada a decir qué NO se sabe. Resta un punto porque el patrón de fondo — afirmar sin comprobar y que lo agarre la siguiente auditoría — ya se repitió una vez en esta misma saga, y la corrección llegó por señalamiento externo, no por autochequeo. |
| 4 | Cumplimiento del contrato | 15 | **11** | VAL-58 sigue sirviéndose correctamente y las regresiones lo confirman. El documento de QA nuevo cubre en la práctica lo que el brief debería decir. Resta: `docs/briefs/adjuntar.md` sigue sin tocarse pese a pedirse explícitamente en la ronda anterior — un criterio pedido dos veces y no resuelto cuenta como no cumplido, no como cumplido por comodidad. |
| 5 | Calidad interna | 15 | **13** | El árbol se mantuvo quieto (verificado, no asumido). El motor embebido sigue idéntico al fuente. Toda la batería de regresión (20 archivos de `app/pruebas/`, no sólo los 15 citados) corre en verde, verificada por mí de a uno. El defecto nuevo se encontró, se documentó con honestidad sobre su propio origen, y se resolvió en el punto correcto del código con la menor superficie de cambio. Resta: `docs/briefs/adjuntar.md` desactualizado y `doc_repl` sin escenario propio. |
| 6 | Diseño y decisiones de producto | 10 | **9** | Dejar la rama `"no-se-pudo-leer"` como red documentada, con el costo y el beneficio escritos, es una decisión de diseño defendible y explícita, no escondida. La elección de arreglar en `prepararAdjunto` (el punto de choque único) en vez de en cada llamador está justificada y es la de menor riesgo. Ninguna decisión de esta ronda contradice el brief sin decirlo. |
| | **Total** | **100** | **86** | |

---

## Qué falta para dar la iteración por terminada (no para publicar como candidato, que ya se puede)

1. **Actualizar `docs/briefs/adjuntar.md`** para que registre esta saga: el defecto del archivo
   vacío, los tres intentos, cuál se pudo probar acá y cuál no, y un enlace al documento de QA
   nuevo. Es el mismo pedido de la ronda anterior, todavía abierto.
2. **Agregar un escenario de `doc_repl`** en `tres-caminos-de-lectura.js` o `archivo-del-correo.js`,
   barato y ya identificado dos rondas seguidas como pendiente.
3. **Que el documento de QA o el brief digan, en una línea, que el arreglo del throw sincrónico
   (`Promise.resolve().then(...)`) es un defecto genuino pero no confirmado como el que vive en el
   Android del PM** — hoy esa distinción vive sólo en el comentario del código y en esta auditoría,
   no en ningún documento que el PM vaya a leer.
4. **La prueba real, en el teléfono, con los tres gestos de `docs/qa/v18-como-lo-compruebo-en-el-telefono.md`.** Es lo único que puede cerrar esta saga; nada de lo que se corrió acá lo reemplaza.

## Lo que nadie puede verificar desde acá

Sin cambios respecto de la ronda anterior en lo sustantivo — sigue siendo el Android real del PM:

- **Si alguno de los tres caminos de lectura (`arrayBuffer`, `slice().arrayBuffer()`, `FileReader`)
  funciona de verdad en ese teléfono para el PDF que fallaba.** Sigue siendo la premisa de todo el
  arreglo de fondo.
- **Si la hipótesis de `content://`/"un solo préstamo" es correcta.** Sigue sin confirmarse, y esta
  ronda lo dice con más honestidad que la anterior, pero no lo puede resolver.
- **Si `size:0` sin proveedor de tamaño es lo que ese Android realmente informa.**
- **Si el throw sincrónico que se arregló en esta ronda alguna vez ocurrió con un archivo real
  del PM, o si fue un defecto que sólo existía en la superficie sintética que la propia prueba
  construyó.** Nadie lo puede saber desde Node ni desde Chromium de escritorio: hace falta que,
  si vuelve a aparecer la app "muda" (colgada en "Preparando el archivo…", con Guardar
  deshabilitado), el PM lo reporte con esas palabras exactas y no como "el archivo está vacío" —
  son síntomas distintos y esta auditoría no tiene forma de saber si ya se confundieron antes.

**Pasos para que el PM lo compruebe:** son los mismos tres de
`docs/qa/v18-como-lo-compruebo-en-el-telefono.md`, que audité arriba y encontré honestos y
completos. Agrego solo uno, no cubierto ahí: **si en algún momento la pantalla queda pegada
diciendo "Preparando el archivo…" y no cambia después de unos segundos, o el botón Guardar no
responde,** eso es un síntoma distinto al de "no pude leer ese archivo" y vale la pena que se
reporte por separado, con esas palabras — es el defecto nuevo de esta ronda, y ni el documento de
QA ni el brief se lo piden todavía (ver punto 3 de "qué falta para dar la iteración por
terminada").
