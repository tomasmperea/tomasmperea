# Brief de iteración 3 — Adjuntar

**Escribe:** Product Owner
**Estado:** cerrado el 14/09 con alcance recortado
**Consumen este brief:** diseño UX/UI, motor, frontend, QA, auditoría

Contrato de la iteración. Todo se valida contra los criterios de acá abajo.

---

## Qué se entregó y qué no

| Historia | Estado |
|---|---|
| VAL-57 · Que la confirmación del correo entre sin tipear | **NO entregada.** Pasa a la iteración 4, primera prioridad. |
| VAL-58 · El documento queda adjunto y se puede descargar | Entregada. |
| VAL-59 · La tarjeta de embarque se desprende de un vuelo | Entregada. |
| VAL-60 · Un lote sale en una sola llamada al modelo | Entregada. El formato nunca lo contestó un modelo real. |

**Por qué se cierra sin VAL-57.** QA lo reportó como bloqueante (H3 de
`docs/qa/2026-09-14-iteracion-3.md`) y tiene razón: es P0 y este mismo brief lo llama
más abajo "la prueba que define el éxito". El PO recomendó construirlo antes de
publicar. **El PM decidió cerrar la 3 sin VAL-57 y publicar**, para poner en el teléfono
las dos mejoras que sí están probadas antes de seguir construyendo encima. Queda escrito
que la iteración 3 cierra sin responder su propia pregunta.

**Hallazgo que queda abierto a propósito:** H4, menor. El motor expone
`presupuestoDeLaBase()` y la interfaz nunca la llama, así que no hay aviso de cupo antes
de que la base se llene. El error reactivo sí existe y está bien traducido. Va al backlog.

---

## El objetivo

Que el documento no se interprete y se tire, sino que quede.

La iteración 2 logró que un PDF con texto se cargue solo. Pero se queda a mitad de
camino en dos sentidos: **la mayoría de las confirmaciones llegan por correo sin PDF
adjunto**, y el documento original —el que importa tener a mano en el aeropuerto—
se descarta después de leerlo.

**Pedido del PM, textual:** *"hay muchas confirmaciones que vienen por correo sin un
PDF adjunto y necesito que la funcionalidad sea capaz de interpretar la captura de
pantalla del correo"*.

---

## VAL-57 · Que la confirmación del correo entre sin tipear — P0 · REPLANTEADA

**El planteo original era leer la captura de pantalla reconociendo el texto en el
teléfono. El paso cero lo descartó:** el motor de reconocimiento carga, pero el
diccionario del idioma no baja de ningún host que el visor permita. Cuatro orígenes
probados, ninguno funciona. El detalle está en
`docs/investigacion/paso-cero-leer-una-foto.md`.

**Y al mirarlo de nuevo, el problema estaba mal planteado.** La necesidad no es la
captura: es que la confirmación esté en el cuerpo de un correo. La captura era el medio
que se le ocurrió al PM para traerla.

Para eso ya hay un camino que funciona hoy: **copiar el texto del correo y pegarlo.** Y
es estrictamente mejor que fotografiarlo — no hay error de lectura, no hay librería de
varios megas, no hay espera, y funciona sin señal. Un reconocedor de imagen sobre una
captura de pantalla es la peor versión de algo que el correo ya entrega en texto
perfecto.

Lo que falta no es tecnología: es que **la app no te lleva a esa vía.** Está ahí, abajo,
como si fuera el plan de contingencia.

- Pegar el texto de una confirmación deja de ser el camino de escape y pasa a ser uno de
  los dos caminos principales, a la par de subir el PDF.
- Se explica en una línea cómo traer un correo que no tiene adjunto, sin tecnicismos y
  sin dar por sentado qué teléfono usa la persona.
- Si la única fuente es una captura, se dice que el propio teléfono sabe sacarle el texto
  y cómo. **No lo reimplementamos peor que el sistema operativo.**
- El texto pegado se interpreta con la misma calidad que un PDF: mismo motor, mismas
  reglas, misma pantalla de revisión.
- Varias reservas pegadas juntas se separan solas. Ya funciona; hay que verificarlo con
  correos reales del PM, que es lo que nunca se hizo.

**Lo que NO se hace, y por qué:** no se empotra el diccionario del idioma dentro de la
app. Serían unos 3 MB más de descarga inicial para todos, este entorno no puede
conseguir el archivo para probarlo, y resolvería peor un problema que el copiar y pegar
ya resuelve bien. Queda anotado como apuesta posible si la vía A resulta incómoda en la
práctica.

**Si algún día la plataforma acepta imágenes,** la lectura de la foto se suma como
camino preferido por precisión y esto queda como respaldo. No depende de nosotros.

## VAL-58 · El documento original queda en la reserva y se puede descargar — P0

Como viajero quiero que el archivo que subí quede guardado en la reserva que creó, para
tenerlo a mano cuando lo necesite.

**Pedido del PM, textual:** *"que no solamente interprete el documento que sea (ahora
PDF y próximamente imagen) sino que lo deje adjunto en la reserva la cual se crea y
disponible para descargar ya que esto es muy útil, por ejemplo, para tener una tarjeta
de embarque a mano"*.

- El archivo que se importó queda guardado junto a la reserva que generó.
- Se puede abrir y descargar desde la reserva, sin depender del correo original.
- Una reserva cargada a mano también acepta que se le adjunte un documento después.
- Se dice cuánto ocupa y cuántos documentos caben, porque el almacenamiento tiene tope.
- Si el documento no se pudo guardar, la reserva se guarda igual: el dato vale por sí
  mismo.

**El contrato, leído antes de diseñar y no después.**

**No hay capacidad de almacenamiento de archivos disponible para esta cuenta.** Las
capacidades habilitadas son las que ya usamos y algunas más, pero ninguna guarda
archivos. El documento tiene que vivir en la misma base que el resto de los datos,
codificado como texto.

Y esa base tiene un techo duro: **un documento de más de 256 KiB se rechaza.** Codificar
un archivo como texto lo infla un tercio, así que el archivo crudo más grande que entra
es de unos **190 KB**. Medido contra los documentos reales del PM:

| Archivo | Tamaño | Codificado | ¿Entra? |
|---|---|---|---|
| Voucher de micro (Lobos Bus) | 20 KB | 28 KB | **Sí**, de sobra |
| Pasaje de Aerolíneas | 123 KB | 164 KB | **Sí**, con margen |
| Foto típica de cámara | ~3 MB | ~4 MB | **No**, hay que recomprimir |

**Corrección del 13/09:** el tope que escribí primero, 192 KB, sale de dividir 256 KiB por cuatro tercios y
**deja cero bytes** para los nombres de campo del propio documento. El motor lo detectó midiendo el cuerpo
serializado en vez de confiar en la cuenta. **El número bueno es 190 KB**, con 2,7 KB de margen.

**Y el cupo de la base ya no es una pregunta abierta:** el contrato dice **5.000 documentos** en total por
artifact, y cuando se llena, crear uno más falla con un error no transitorio. Cada adjunto cuesta un documento.

Consecuencias para el diseño, que dejan de ser sorpresas:

- **La mayoría de los vouchers y tarjetas de embarque entran.** Los dos casos reales del
  PM entran, y son representativos: un PDF de aerolínea rara vez pasa los 200 KB.
- **Una foto de cámara no entra tal cual.** Hay que reducirla y recomprimirla en el
  navegador antes de guardarla, y **decirle a la persona que se guardó en menor
  calidad**, no hacerlo en silencio.
- **Un PDF grande de varias páginas no entra ni recomprimido.** Ahí no se guarda, se dice
  por qué, y la reserva se guarda igual: el dato vale por sí mismo.
- Partir el archivo en varios documentos es posible pero gasta el cupo de documentos de
  la base. **No se hace en esta iteración**; si aparece la necesidad, se decide con datos.
- Para devolver el archivo sí hay capacidad de descarga disponible, la misma que usa el
  PDF del resumen.

## VAL-59 · La tarjeta de embarque se desprende de un vuelo — P0

Como viajero quiero que la tarjeta de embarque complete mi vuelo, y que si ese vuelo no
está cargado la app me lo diga y me ofrezca crearlo, en vez de inventar una reserva
suelta.

**Pedido del PM, textual:** *"identifico que las tarjetas de embarque las interpreta como
reserva 'vuelo' pero en realidad, debería estar incluido dentro de una reserva previa que
exista como vuelo o, sino, alertar que no existe vuelo asociado y dar la posibilidad de
crear uno. en definitiva, la tarjeta se desprende de una reserva de vuelo"*.

Es una corrección conceptual, no un bug. VAL-42 ya reconoce el vuelo por número y fecha
y lo completa; lo que está mal es el caso en que **no encuentra ninguno**: hoy crea una
reserva de vuelo a partir de la tarjeta, y una tarjeta de embarque no es un vuelo.

### El flujo, como lo especificó el PM

La regla que atraviesa los tres casos: **primero intentar el match, siempre. Después
preguntar. Nunca inventar.**

**Sin ningún vuelo cargado en el viaje**
- No hay con qué matchear. La app avisa que no hay vuelo asociado y **ofrece crearlo**.
- Si se acepta, la reserva de vuelo se crea **precargada con lo que la tarjeta aporta**
  (número, fecha, ruta, asiento, puerta, terminal, hora de embarque). Lo que la tarjeta
  no traiga queda vacío y se completa a mano después: un campo vacío nunca se rellena
  adivinando.
- La tarjeta queda **adjunta a ese vuelo** (VAL-58). Es de donde se desprende.
- Si se rechaza, no se guarda nada: ni reserva suelta ni documento huérfano.

**Con un vuelo cargado**
- Primero el match inteligente contra la tarjeta. Si coincide, **completa solo**, sin
  preguntar nada. Es el caso frecuente y tiene que ser invisible.
- Si no coincide, se pregunta: **asociarla a ese vuelo, o crear uno nuevo.** Las dos
  salidas explícitas. Que no coincida el número no significa que sea otro vuelo — puede
  ser que el número se leyó mal, o que la reserva se cargó a mano sin número.

**Con más de un vuelo cargado**
- Primero el match contra todos. Si coincide con uno solo, completa solo.
- Si no coincide con ninguno, o coincide con más de uno, **se pregunta contra cuál
  asociarla**, mostrando los vuelos con lo que los distingue: ruta, fecha y hora. Más la
  salida de crear uno nuevo.
- **Nunca se elige por la app.** Ya es la regla de VAL-42 y se mantiene.

### Criterios

- Un match exitoso no pregunta nada y deja registro de por qué coincidió.
- Ninguna rama crea una reserva de vuelo sin que la persona lo haya pedido.
- Ninguna rama descarta la tarjeta sin decirlo.
- La tarjeta siempre termina adjunta al vuelo con el que quedó asociada, nunca suelta.
- Lo que la tarjeta no traiga se queda vacío, visible, y se completa a mano.

## VAL-60 · Gastar menos por documento — P1 · UN TERCIO HECHO

Como equipo queremos que el límite de uso del visitante aparezca cada veinte documentos
y no cada cinco.

Sale de `docs/investigacion/cuota-de-la-capa-inteligente.md`. No rompe nada, y por eso
es P1, pero es desperdicio medible y nuestro.

**Estado al 12/09, corregido por la auditoría.** Yo encuadré el cambio de tier como
"lo último que quedaba abierto". Era falso: esta historia tiene tres criterios y sólo se
cumplió el primero. Queda anotado porque el que falta es **el que de verdad mueve el
número**.

- ~~El camino de texto deja de usar el tier más caro~~ · **HECHO** (publicado en la
  versión 13). El texto pide `default`; la lectura de imágenes y la sugerencia de
  equipaje se quedan en `complex`, y el tier de importación sale de las opciones que
  manda el motor, así que el día que se habiliten las fotos arranca arriba solo.
- **Un lote de varios documentos se resuelve en UNA llamada**, no una por archivo,
  conservando el progreso por fila. **PENDIENTE, y es la palanca principal**: el propio
  contrato pide *"prefer ONE call that returns a JSON array over one call per item"*.
  Subir cuatro documentos son hoy cuatro llamadas. El tier solo no baja la frecuencia
  del aviso de límite; esto sí.
- Se registra qué tier contestó de verdad. **NO SE PUEDE**, y está declarado:
  `modelTierApplied` viaja en lo que resuelve `sample()`, y la app usa `json()`, que
  resuelve con el JSON ya parseado. Verificado contra el contrato por el PO y por la
  auditoría. Lo que sí se registra: tier pedido, tarea, duración y código de error.

**Deuda de prueba que venía con esto — SALDADA el 14/09.**
`app/pruebas/tier-del-modelo.js` falló una aserción en una de siete corridas del PO; la
auditoría lo corrió diez veces más sin reproducirlo, y por inspección señaló el
sospechoso: tres esperas fijas después de tocar `#pk-build` y `#save`, en lugar de
esperar una señal real de que el recálculo terminó. Es el mismo patrón que ya tumbó otro
arnés.

Las tres esperas fijas se reemplazaron por esperar la señal: que la llamada del equipaje
haya llegado, y que después de guardar haya aparecido una llamada nueva. La espera no
afloja la exigencia —si la señal no llega, la aserción falla igual por tiempo— y se
comprobó con un control negativo: pidiendo `quick` en vez de `complex` para el equipaje,
las dos aserciones del tier fallan.

**La auditoría del 14/09 lo había marcado como promesa incumplida y sin retractar.** Tenía
razón: estuvo escrito acá como "se arregla en esta iteración" desde el 12/09 y no se
había tocado.

---

## Lo que sólo se puede comprobar en el teléfono

**Reauditado el 16/09, a pedido del PM.** La lista anterior tenía seis puntos y
cuatro de ellos no eran suyos: se los habíamos delegado por comodidad, no porque
no se pudieran hacer acá. Uno llegaba a pedirle que abriera la consola del
navegador en el teléfono. Se probaron los cuatro (ver "Lo que se probó acá" más
abajo) y quedan **tres**, que son los que dependen de tener el aparato en la mano.

Ninguno pide abrir nada raro. Son tres cosas que se tocan.

### 1. Elegir un archivo y quedarse mirando

Entrá a un viaje, tocá **Importar**, tocá **Archivo** y elegí un PDF cualquiera.
Quedate mirando la pantalla unos segundos después de que el archivo aparezca.

**Qué tiene que pasar:** el archivo se carga y no aparece ningún cartel de error.

**Si aparece "No se abrió el selector de archivos" con el archivo ya cargado,**
avisá. Significa que el arreglo del 14/09 no alcanzó en ese navegador. Es el
único punto donde el teléfono puede comportarse distinto a todo lo que se probó.

### 2. Adjuntar una foto sacada en el momento

En una reserva, tocá **Adjuntar** y **Sacar foto**. Sacá una foto de cualquier
papel y abrí el documento adjunto para verlo.

**Qué tiene que pasar:** la foto se ve.

**Si sale negra, en blanco, o no se ve,** avisá y decí qué teléfono es. En iPhone
hay dos límites del sistema —el tamaño máximo que puede procesar y el formato
HEIC— que sólo se manifiestan ahí. **El mensaje de error te va a hablar de
tamaño, y en ese caso va a estar mintiendo:** por eso hace falta que lo mires vos
y no que lo deduzcamos del mensaje.

### 3. Bajar el documento y abrirlo

En una reserva con un documento adjunto, abrilo y tocá **Descargar**. Después
buscá el archivo en el teléfono y abrilo.

**Qué tiene que pasar:** el archivo aparece donde caen tus descargas y se abre
bien.

**Si no aparece, o aparece roto,** avisá. Acá se prueba contra un doble que
registra lo que recibe, nunca contra el sistema de archivos real del teléfono.

---

## Lo que se probó acá, y que antes figuraba como imposible

Cuatro cosas salieron de la lista del PM porque se pudieron probar, no porque se
hayan dado por buenas:

**El lector de PDF real.** cdnjs está bloqueado en este entorno, pero la misma
librería —`pdfjs-dist` 3.11.174, la versión exacta que la app fija— se baja de
npm, que sí está permitido. Con eso se hacen dos cosas que no se podían:
servírsela a la app dentro del navegador en vez de bloquearla, y correr el motor
contra la librería de verdad. Resultado: la forma que el motor supone
(`{str, hasEOL}`) es la que devuelve pdf.js, y **el visor dibuja la página** —
9.884 píxeles con tinta, no una hoja en blanco—. El PDF tampoco es inventado: lo
genera jsPDF con los datos de una tarjeta de embarque. Arnés: `app/pruebas/pdf-real.js`.

**El formato de lote, contestado por un modelo real.** Era la trampa conocida:
el simulador devolvía lo que el prompt pedía porque estaba escrito contra el
mismo contrato. Se generó el prompt real de tres documentos y se le pasó a un
modelo que **no vio el parser ni un solo archivo del repositorio**. Contestó
bien: tres documentos, ningún dato cruzado entre ellos, el micro como traslado y
no como vuelo, y 13/9/2026 leído como 13 de septiembre. Su respuesta cruda quedó
guardada en `fixtures/respuesta-lote-modelo-real.json`. Arnés:
`app/pruebas/lote-modelo-real.js`. **Sigue sin probarse que el modelo del visor
del teléfono conteste igual** — es otro modelo — pero deja de ser cierto que
ninguno contestó nunca este formato.

**La base compartida.** Se simuló siguiendo el contrato, no la memoria, con el
mismo cuidado que `app/parts/db-mock.js`. Ejercita el rechazo real por 256 KiB
(`invalid_argument`, no reintentable), `quota_exceeded`, el fallo al traer el
archivo (D4) y **el borrado en cascada**: borrar la reserva y borrar el viaje
entero borran los cuerpos, que es lo que impide que cada documento quede
ocupando cupo de los 5.000 para siempre. Arnés: `app/pruebas/base-compartida.js`.

**Las tipografías reales y los dos temas.** `fonts.googleapis.com` sí es
alcanzable: las tres fuentes cargan de verdad y la jerarquía de color se sostiene
en claro y en oscuro, con capturas.

---

## Decisiones de producto cerradas

**Nada se guarda sin revisar.** Vale para lo interpretado de una captura igual que para
lo interpretado de un PDF.

**Un dato que no está, no se inventa.** Un reconocimiento de imagen pobre devuelve
campos vacíos, no adivinanzas. Esto importa más acá que en la iteración 2: leer una foto
es menos confiable que leer una capa de texto, y la tentación de rellenar es mayor.

**El documento original es del viajero.** Se guarda para que lo tenga, no para
procesarlo de nuevo. No se manda a ningún lado que no sea su propia valija.

**La tarjeta de embarque se desprende de un vuelo.** No es una reserva.

---

## Fuera de alcance

- Avisos por correo y buzón de reenvío. Siguen esperando servidor.
- Que la capa de visión de la plataforma lea las imágenes. No depende de nosotros; si se
  habilita, se suma como camino preferido y VAL-57 queda como respaldo.
- Mapas y detección de conflictos de agenda.

## Cómo se valida

Contra la app publicada, en el teléfono del PM, con documentos reales. Un criterio que
no se puede verificar así se considera no cumplido.

**La prueba que define el éxito:** tomar la confirmación de un correo sin adjunto,
traerla a la app sin tipear ningún dato, y que el documento —el que haya— quede adjunto a
la reserva y se pueda volver a abrir.

**El paso cero ya corrió y su resultado está incorporado arriba:** el reconocimiento de
texto en el teléfono no es viable dentro de la app. VAL-57 quedó replanteada en
consecuencia, no cancelada.

---

## Cierre de la iteración 3 — lo que la auditoría pidió que quede acá (17/09)

Dos auditorías seguidas señalaron que este brief, que es el contrato de trabajo, no decía nada del trabajo
de los días 16 y 17. Lo que pasó en esos dos días no cambia el alcance, pero cambia **qué se puede afirmar
de la entrega**, y eso pertenece al contrato.

### El defecto que definió la iteración

El PM adjuntó un PDF que le llegó por mail, desde su Android, y la app dijo **"Ese archivo está vacío: no
tiene nada adentro"**. No lo estaba. Lo vio por **dos gestos**: adjuntar directo a una reserva, e importar.
En la misma sesión una foto de la cámara entró perfecta y se recomprimió sola.

Se publicaron **tres arreglos y los tres fallaron**. No fue mala suerte: cada uno nació de una hipótesis
sobre ese teléfono, y el simulador para probarla se escribió *desde* esa misma hipótesis. Un simulador así
sólo puede darle la razón a quien lo escribió. El método está escrito en `CLAUDE.md`.

### Qué se entrega, y con qué respaldo cada cosa

| Cambio | ¿Depende de acertar la causa? | Dónde se probó |
|---|---|---|
| Leer el archivo por los tres caminos documentados, no por uno | **No** — agotar caminos vale sin saber cuál falla | `tres-caminos-de-lectura.js`, 5 escenarios |
| Un `size` de cero es "no sé", no "está vacío" | **No** — corrige un error de lógica | `archivo-sin-tamano.js` |
| El error dice qué observó, con la versión, en una línea que entra en una captura | **No** — es instrumentación | los dos gestos, en `tres-caminos-de-lectura.js` |
| `prepararAdjunto` no se escapa por un throw sincrónico | **No** — defecto reproducible acá | `preparar-no-lanza.js`, con control negativo de 7 fallas |
| Limpiar el campo al abrir el selector, no al elegir | Sí en el motivo, **no** en el efecto | `archivo-del-correo.js` — contra un simulador de la hipótesis |
| Leer el archivo una vez y reusar los bytes | Sí en el motivo, **no** en el efecto | `archivo-de-una-lectura.js` — ídem |

Las dos últimas se dejan porque son correctas igual: no hay momento en que convenga tocar el campo con un
archivo en uso, ni leer dos veces donde alcanza una. Lo que **no** se puede decir es que arreglen el defecto
del teléfono, porque el síntoma siguió después de publicar cada una.

### Criterio de validación, precisado

El brief ya decía que se valida contra la app publicada en el teléfono del PM. Se agrega la consecuencia que
las auditorías hicieron explícita: **una entrega sobre este defecto no puede declararse cumplida desde acá,
y tampoco tiene que quedarse sin publicar por eso.** Lo que se publica es lo que convierte la próxima ronda
en datos — la línea de observación y el sello de versión —, más los arreglos que no dependen de la causa.

El guion de la prueba del PM vive en `docs/qa/v20-como-lo-compruebo-en-el-telefono.md`: cuatro gestos, sin
consola, con lo que la entrega NO afirma en su propia sección. (Eran tres cuando se escribió esta línea; el
cuarto se sumó el 18/09 con el colapso de la caja de pegar el texto.)

### Lo que queda abierto al cerrar la iteración 3

- **El defecto original sigue sin confirmarse arreglado.** Es lo único que la ronda del PM puede decidir.
- **VAL-57** quedó fuera por decisión del PM el 17/09, con el desacuerdo del PO registrado.
- **`doc_repl`** (reemplazar un documento) no tiene escenario propio. Se cubrió por propiedad en vez de por
  escenario: `preparar-no-lanza.js` verifica que exista **una sola** llamada al motor y que esté blindada,
  lo cual alcanza a todo gesto presente y futuro. Si mañana aparece una segunda llamada, ese caso falla.


---

## La causa raíz, encontrada el 17/09 por la instrumentación que publicamos para encontrarla

La tabla de arriba decía, con razón, que dos de los arreglos dependían de acertar la causa y que ninguno
podía declararse cumplido desde acá. Lo que no decía —porque todavía no se sabía— es que **la causa no era
ninguna de las que habíamos supuesto, y no estaba en el teléfono del PM: estaba en nuestro código, desde el
primer commit del motor.**

### Qué la encontró

La línea de observación de la v18. Una sola captura del PM:

```
informa 123129 B · memoria 0 B · application/pdf · v18
```

Un intento, cero bytes, sobre un archivo que informa 123 KB. Los tres caminos de lectura no aparecen porque
nunca corrieron. **Cerró en una ronda lo que tres arreglos no movieron en tres.**

### Qué era

`leerBytesConDiagnostico` abría con un atajo: `if (file && file.bytes) { ...usar esos bytes...; return; }`.
`bytes` es el nombre de un método de Blob —`Blob.prototype.bytes()`, que existe en los navegadores nuevos y
no en el Chromium de este entorno—. En el teléfono del PM, entonces, `file.bytes` era una función:
verdadera, así que el atajo entraba, y normalizar una función da cero bytes. Todo archivo volvía vacío antes
de que existiera cualquier otro camino, y los tres arreglos anteriores tocaban código debajo de ese
`return`.

### Lo que corrige del propio brief

La tabla de arriba explicaba que la foto de la cámara entraba "porque el navegador es su dueño". **Era
falso**, y sobre eso se construyeron tres rondas de pruebas del PM. Entraba porque pesaba 2,7 MB: arriba
del tope de 190 KB un archivo se va por `rutaGrande`, que recomprime con canvas y nunca pasa por el lector.
Los PDF del PM pesaban 123 KB y 20 KB. **La diferencia era el tamaño, no el origen.**

### Qué se entrega ahora, y con qué respaldo

| Cambio | ¿Depende de acertar la causa? | Dónde se probó |
|---|---|---|
| El atajo exige bytes de verdad, no "verdadero" | **No** — rechaza cualquier valor que no sean bytes, sea o no el método nativo | `metodo-bytes-nativo.js`, los dos gestos |
| Y si no lo son, no devuelve: sigue a los tres caminos | **No** — una guarda que corta el camino convierte cualquier sorpresa en "archivo vacío" | ídem |
| El mensaje deja de decir "probé de tres formas" | **No** — era falso en el único caso que importaba | ídem |

**Y por primera vez el defecto se reproduce acá.** El arnés instala `bytes` donde lo pone el navegador
—`Blob.prototype`, devolviendo `Promise<Uint8Array>`—, leyendo el contrato de la plataforma y no la
hipótesis. Contra la v18 publicada da 9 fallas: 8 en los dos gestos, con el mismo texto que vio el PM, más
un chequeo directo al motor. Es lo que faltó las tres veces anteriores: un arnés capaz de decir que no.

### Lo que sigue abierto

- **Que en el teléfono del PM alcance.** El arreglo se sostiene sin acertar por qué `file.bytes` era
  verdadero ahí, pero puede haber más de una cosa rota. Si vuelve a fallar, la línea de observación va a
  decir algo distinto de `memoria 0 B`, y esa diferencia ya es el próximo dato.
- **Un cartel del sistema Android**, "Memoria insuficiente para completar la operación anterior", visible en
  la cuarta captura del 17/09. No es de la app y no se puede observar desde acá. Queda declarado sin
  conclusión, no como defecto.
- **VAL-57**, fuera por decisión del PM, con el desacuerdo del PO registrado.
- **`doc_repl`** sigue cubierto por invariante estructural y no por escenario propio bajo la condición
  exacta de este bug. La invariante (`preparar-no-lanza.js`: una sola llamada al motor en toda la app, y
  `doc_repl` pasa por ella) se corrió en verde en esta ronda.

---

## Iteración 3 — 18/09: el defecto cerrado, la iteración todavía no

**El PM validó las tres pruebas en su teléfono y anduvieron.** Adjuntar el PDF a una reserva, importarlo, y
la foto de la cámara. Es la primera vez desde el 16/09 que los tres gestos pasan en el entorno real, que es
la única definición de "verificado" que este proyecto acepta.

Con eso, el defecto que tuvo en vilo cuatro rondas queda cerrado, y la causa quedó determinada y escrita:
una guarda que preguntaba por "verdadero" sobre `file.bytes` —el nombre de un método de Blob— devolvía cero
bytes y cortaba el camino antes de los tres caminos de lectura. Nunca estuvo en su teléfono.

### Un cambio de alcance pedido en el cierre

El PM pidió, y se entregó en la v20: **que la caja de "pegar el texto del correo" arranque colapsada en la
pantalla de importar.** Su motivo: no es la funcionalidad principal.

Se implementó sacando `sinImagenes` de la condición que la abría. Sigue abriéndose sola cuando pegar es el
único camino que queda —el lector de PDF no cargó, o no hay ningún botón de archivo en pantalla— y cuando
ya hay texto pegado, que nunca se esconde.

**Esto revierte una decisión de diseño anterior, y está anotado como tal en `docs/backlog.md`, dentro de
VAL-57.** La historia pedía lo contrario: subir la caja a "uno de los dos caminos principales". La necesidad
de VAL-57 sigue en pie; la solución que daba por hecha quedó desmentida por el uso real. Quien construya
VAL-57 en la iteración 4 tiene que leer esa nota antes de reabrir la caja.

### ⚠️ Este cambio NO está verificado, y por eso la iteración todavía no está terminada

La validación del PM en su teléfono es real y es de las tres pruebas de adjuntar, importar y foto. **Es de
la v19, o sea de ANTES de este cambio.** El colapso de la caja es el único cambio de código de la v20 y
nadie lo vio todavía en el aparato.

Probado en: Chromium de escritorio, con los cuatro estados de la pantalla cubiertos por
`importar-sin-imagenes.js` e `importar-arranque.js`.

NO probado: el visor del teléfono del PM. La tabla de la sección "La palabra verificado" de `CLAUDE.md` dice
exactamente qué no cubre ese sustituto.

Entonces la v20 se publica **como candidata, con la brecha declarada**, y la iteración 3 queda cerrada
cuando el PM confirme una sola cosa: que al abrir Importar la caja aparece cerrada y se abre con un toque.
Son diez segundos, no una ronda de pruebas. El paso está en
`docs/qa/v20-como-lo-compruebo-en-el-telefono.md`.

Llamarla terminada antes de eso sería exactamente lo que este proyecto ya pagó cuatro veces: dar por
verificado algo que sólo se probó donde se puede mirar.

### Qué queda para la iteración 4

| | |
|---|---|
| **VAL-57** | Primera prioridad. Con la advertencia de arriba. |
| **VAL-62** | Avisar del cupo de la base antes de que falle un guardado (H4). |
| **`doc_repl`** | Sin escenario propio; cubierto por invariante estructural. |
| **El cartel de Android** | "Memoria insuficiente", visto el 17/09. Sin conclusión, no es defecto declarado. |
