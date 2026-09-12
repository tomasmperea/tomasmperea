# Importar documentos — especificación de diseño

**Épica:** VAL-40, VAL-41, VAL-42 (Bloque A de `docs/briefs/interpretar.md`) · **Escribe:** diseño UX/UI ·
**Estado:** listo para integración

Este documento describe el diseño que ya existe en `app/parts/import-ui.html` (muestrario de componentes,
catorce estados). No propone un diseño nuevo: documenta las decisiones que ese archivo ya toma, para que
integración pueda incorporarlas a `app/valija.html` sin tener que interpretarlas de nuevo.

El motor de datos que alimenta esta interfaz es `app/parts/import-engine.js`, documentado en
`docs/design/import-engine.md`. Cada estado de este documento indica con qué función y qué campo del motor se
arma. No repite lo que ya está ahí: lo asume leído.

---

## 0 · Para quién es esto

**Qué tiene que poder hacer:** elegir uno o varios archivos sin pensar de antemano por qué botón entran,
esperar sabiendo qué está pasando con cada uno, revisar y corregir lo que se entendió sin que corregir se
sienta como un formulario aparte, descartar lo que no sirve, y — el caso que más golpea — confirmar a cuál de
sus vuelos ya cargados corresponde una tarjeta de embarque, sin terminar con dos vuelos iguales por no haberlo
sabido.

**En qué momento y estado llega:** parada en el mostrador de embarque, con el pasaje en la otra mano, o recién
sentada en el avión revisando qué falta. Apurada, con el pulgar, con mala señal o ninguna. No es el momento de
tipear un formulario de doce campos: es el momento de sacar una foto y confiar en que alguien más lee lo que
ella no tiene tiempo de tipear.

**El camino más corto:** de tocar "Importar" a tener la reserva guardada hay tres pasos como máximo — elegir
archivo, esperar, confirmar — y ninguno pide un dato que ya está en la foto. Cuando hay ambigüedad (la tarjeta
de embarque que puede ser cualquiera de dos vuelos), el camino se alarga en un toque más, nunca en un
formulario: se pregunta con una lista de opciones, no con campos vacíos para completar de memoria.

---

## 1 · El flujo, de punta a punta

```
Botón "Importar" (sin cambios, ver estado 00)
   │
   └─ Se abre la hoja "Importar reservas"
        │
        ├─ Sin lectura automática disponible ──────────► 11 · aviso, cerrar y cargar a mano
        ├─ Sin permiso de edición ──────────────────────► 12 · aviso, sólo cerrar
        │
        └─ 01 · Elegir archivos (cámara / galería / archivo, o pegar texto)
              │
              └─ 02 · La cola (se puede seguir sumando o sacando antes de interpretar)
                    │  botón "Interpretar N archivos"
                    ▼
                 03 · Leyendo, archivo por archivo
                    │
                    ├─ Ninguno aportó nada ──────────────► 10 · sin resultados, detalle por archivo
                    │        └─ "Cargar a mano" ó "Reintentar" el que sí falló técnico
                    │
                    └─ Al menos una reserva ─────────────► 04 · revisión (05 si algún archivo no aportó)
                             │  por cada reserva de tipo "flight", ImportEngine.matchAgainstExisting():
                             │
                             ├─ "nuevo"   ──► se revisa como cualquier reserva nueva (04/05)
                             ├─ "mismo"   ──► 06 · completa un vuelo existente, no lo duplica
                             └─ "ambiguo" ──► 07 · pregunta a cuál corresponde (07B: variante sin
                                              número de vuelo legible, el disparador más frecuente)
                                                   │
                                                   ├─ elige un candidato ──► pasa a completarlo, como 06
                                                   └─ "ninguno de los dos" ► pasa a revisarse como nuevo,
                                                                             como 08
                             ▼
                          botón "Guardar N reservas"
                             │
                             ▼
                          09 · Guardado — el aviso dice explícito qué se completó
```

Ningún estado es un callejón sin salida: la cruz del encabezado y el botón "Cancelar" cierran la hoja entera
desde cualquier paso, sin guardar nada a medias — el motor nunca escribe hasta que se toca "Guardar".

---

## 2 · Los catorce estados

Numeración y títulos, tal como están en el muestrario.

### 00 · Ubicación — Sin cambios
**Cuándo aparece:** siempre, al pie de la pantalla del viaje, junto a "Agregar". No es parte de este trabajo:
documentado para que quede claro qué no cambia. Sin permiso de edición se deshabilita ahí mismo, antes de
llegar a la hoja (estado 12 es la red por si igual se entra).

### 01 · Elegir los archivos
**Cuándo aparece:** al tocar "Importar", primera pantalla de la hoja.
**Qué muestra:** tres botones de origen en una grilla de tres (`.tp.tp3`), cada uno un `<label>` que activa un
`<input type="file">` distinto: **Sacar foto** (`capture="environment"`, sólo la cámara), **Galería** (fotos y
capturas, admite varias), **Archivo** (PDF o imagen, admite varios). Los tres se pueden combinar en una misma
carga. Debajo, un `<details>` nativo "Pegar el texto en cambio" — el camino que ya existe hoy, ahora
secundario, para cuando no hay ni foto ni PDF a mano. El botón "Interpretar" arranca deshabilitado: no hay
nada para interpretar todavía.

### 02 · La cola, antes de interpretar
**Cuándo aparece:** en cuanto se elige al menos un archivo, dentro de la misma hoja.
**Qué muestra:** los mismos tres botones de origen arriba (se puede seguir sumando desde cualquiera de los
tres, mezclando cámara con galería con archivo), y debajo la lista `.imp-files` con cada archivo elegido: su
miniatura por tipo, nombre, tamaño (y páginas, si es PDF), y una cruz para sacarlo del lote sin tocar los
demás. Un archivo que pesa más de lo que el motor puede leer se marca ahí mismo, en rojo, con el motivo
explícito, y **no entra en la cuenta** del botón primario ("Interpretar 3 archivos" cuenta sólo los que sí se
van a mandar).

### 03 · Leyendo, archivo por archivo
**Cuándo aparece:** al tocar "Interpretar", mientras `ImportEngine.interpretFiles` está en vuelo.
**Qué muestra:** nunca un spinner ciego. Cada fila de `.imp-files` cuenta su propio progreso: `en cola`
(punto gris), `leyendo…` (spinner propio), o `listo · N reservas encontradas` (verde) en cuanto esa promesa
individual resuelve — no hace falta esperar a que terminen todas para ver que la primera ya funcionó. Si pasa
un tiempo (`>` un umbral, foto con poca luz o PDF pesado), aparece un `.notice.warn` que lo reconoce y ofrece
"Quedarme con lo que ya está listo", sin perder lo que sí se pudo leer mientras tanto.

### 04 · Revisión — Lo que encontró, antes de guardar
**Cuándo aparece:** `interpretFiles` resolvió con `resumen.reservas > 0`.
**Qué muestra:** una tarjeta `.imp-card` por reserva, con **campos de verdad**, no un resumen de sólo lectura:
corregir un dato mal leído es escribir encima del input, no un paso aparte. El chip debajo del título dice de
qué archivo salió (y de qué página, cuando un mismo PDF trae varias reservas — el voucher de ida y vuelta en
un solo PDF de dos páginas es el ejemplo del muestrario). La cruz de la cabecera (`.imp-discard`) saca esa
tarjeta del lote sin afectar a las demás. Un campo que el motor no pudo leer llega vacío con un `placeholder`
que lo dice ("No lo encontré"), nunca con un valor inventado — es la regla del brief ("un dato que no está, no
se inventa") hecha visible en el propio campo.

### 05 · Revisión con archivos que no aportaron
**Cuándo aparece:** junto al estado 04, cuando el lote mezcla archivos con reserva y archivos sin ella.
**Qué muestra:** la o las tarjetas que sí se entendieron, como en 04, y debajo la lista `.imp-files` con los
que no aportaron — pero **no todos con el mismo tratamiento**. Ver la sección 3.2: un archivo vacío (se leyó
bien, no había ninguna reserva ahí) se ve neutro y sin botón de reintentar; un archivo con error real (no se
pudo procesar) se ve en rojo y sí ofrece reintentar. Ninguno de los dos bloquea guardar lo que sí funcionó.

### 06 · Tarjeta de embarque — Caso 1: coincide con certeza
**Cuándo aparece:** `matchFlightReservation` devolvió `resultado:"mismo"`.
**Qué muestra:** una `.imp-card` de formato distinto a la de revisión (04): no es una reserva nueva para
corregir campo por campo, es una propuesta de completar. Un bloque "Ya tenías cargado" (`.imp-existing`,
fondo `surface-2`) repite el vuelo existente para que se reconozca de un vistazo, y un bloque "Se completa
con" (`.imp-diff`) muestra sólo los campos de `patch` — puerta, terminal, asiento, hora de embarque —
resaltados en acento. Una nota chica explica el porqué ("Coincide por número de vuelo y fecha con el vuelo que
ya tenías cargado"). El pie ofrece dos acciones simétricas, ninguna por defecto marcada como principal por
posición sino por color: **"Completar vuelo"** (primaria) y **"Cargar como nuevo"** (ghost, para el caso raro
de que la persona sepa que en realidad es un vuelo distinto pese a la coincidencia).

### 07 · Tarjeta de embarque — Caso 2: duda entre dos vuelos (interactivo)
**Cuándo aparece:** `resultado:"ambiguo"`, con dos o más `candidatos`. Es el único estado interactivo del
muestrario, y el más importante de diseñar bien — ver la sección 3.1 completa.
**Qué muestra:** un `.notice.warn` que dice, con los datos que sí se pudieron leer, por qué no se pudo decidir
solo, y una lista `.imp-choice` de botones tipo radio, uno por candidato (ruta + aerolínea + vuelo + hora de
salida), más una opción final explícita: **"Ninguno de los dos — es un vuelo nuevo, no lo tenía cargado"**. El
botón de guardar arranca deshabilitado con el texto "Elegí una opción"; al tocar un candidato se habilita y su
texto cambia según lo elegido ("Completar vuelo" o "Guardar como vuelo nuevo") — la acción se nombra según lo
que va a pasar, nunca un "Continuar" genérico.

### 07B · Tarjeta de embarque — Duda sin número de vuelo (el disparador más frecuente)
**Cuándo aparece:** mismo `resultado:"ambiguo"` que el 07, pero por el motivo que el motor señala como el más
común en la práctica: la tarjeta no trae un número de vuelo legible, y ese día hay más de un vuelo cargado (una
conexión, un viaje con varios tramos el mismo día). No hace falta que los dos vuelos compartan número — con
eso solo, sin ninguna otra coincidencia, ya cae en ambiguo.
**Qué muestra:** exactamente el mismo componente que 07 (mismo `.imp-choice`, mismo patrón de botones): sólo
cambia qué dice el aviso de arriba, porque cambia qué dato sí se pudo leer (acá, un asiento, ningún número de
vuelo) y los candidatos son dos tramos distintos de una conexión, no el mismo vuelo repetido. Se documenta
como estado propio porque es el que integración va a ver más seguido en la práctica, y porque confirma que el
mismo componente cubre los dos disparadores sin necesitar una variante nueva.

### 08 · Tarjeta de embarque — Caso 3: no encuentra ninguno
**Cuándo aparece:** `resultado:"nuevo"` para una reserva de tipo vuelo (ni el número ni la fecha coinciden con
nada cargado en el viaje).
**Qué muestra:** un `.notice` neutro que avisa el porqué ("No tenías este vuelo cargado. Lo agrego como una
reserva nueva.") y debajo la tarjeta de revisión editable, igual que en el estado 04 — con la diferencia de
que el origen dice "Tarjeta de embarque" en vez de "Vuelo", para que quede rastro de que salió de ahí. El pie
usa el lenguaje de guardar una reserva nueva ("Guardar vuelo" / "Descartar"), no el de completar.

### 09 · Guardado
**Cuándo aparece:** al confirmar "Guardar N reservas" y que la escritura resuelva.
**Qué muestra:** un `.notice.ok` que **nombra lo que pasó**, no un "listo" genérico: "Guardado. Agregué 4
reservas y completé el vuelo de vuelta con los datos de la tarjeta de embarque." Cuando hubo una tarjeta de
embarque de por medio, decirlo explícito es la diferencia entre confiar en que completó el vuelo correcto y
tener que ir a comprobarlo a mano.

### 10 · Sin nada que guardar — Total
**Cuándo aparece:** `resumen.reservas === 0` para todo el lote.
**Qué muestra:** un bloque de estado vacío grande (mismo `.empty` que usa el resto de la app) con el título
("No conseguí ninguna reserva de estos 3 archivos") y debajo el detalle `.imp-files` de cada uno — otra vez
distinguiendo vacío de error (sección 3.2), porque un cero final puede tener motivos distintos por archivo y
esa distinción no se pierde sólo porque el resultado global también sea cero. El pie ofrece "Cargar a mano"
(ghost, el escape que nunca falla) y "Reintentar N archivo(s)" contando sólo los que de verdad fallaron
técnico — nunca "reintentar todo" quijotesco sobre archivos que ya se leyeron bien y no tenían nada adentro.

### 11 · Sin lectura automática disponible
**Cuándo aparece:** `claude.use("sample")` no resolvió (mismo patrón que ya usa `sheetImport` hoy para el
texto pegado, ahora aplicado a toda la hoja).
**Qué muestra:** un `.notice.warn` único, sin ningún botón de elegir archivo detrás (no se ofrece un picker
que no va a funcionar), y el pie con un solo "Cerrar". La carga manual sigue estando, un botón más allá, en
"Agregar".

### 12 · Sólo lectura
**Cuándo aparece:** `!Store.canWrite`. En la práctica no debería llegarse hasta acá — el botón "Importar" ya
sale deshabilitado en la pantalla del viaje (estado 00) — pero es la red por si de todos modos se entra (un
link viejo, una carrera de carga del permiso al abrir la app).
**Qué muestra:** un `.notice` con el chip "sólo lectura" y una explicación corta de a quién pedirle permiso.
Un solo "Cerrar" en el pie. Ningún control de carga: no hay nada deshabilitado, directamente no está en el
HTML — mismo criterio que ya usa `docs/design/valija-inteligente.md` para su propio estado de sólo lectura.

---

## 3 · Decisiones de diseño y su porqué

### 3.1 El caso ambiguo (07 / 07B) es el que más se ve, y por eso es el que más cuidado pide

El motor es explícito: "una tarjeta de embarque sin número de vuelo legible, con vuelos cargados ese día,
siempre cae ahí" — y el brief pide, sin margen de negociación, que "ante la duda pregunta a cuál corresponde,
no adivina". Esas dos frases juntas definen todo el diseño de esta pantalla.

**Por qué es una lista de opciones y no un desplegable.** Un `<select>` esconde las diferencias entre
candidatos detrás de un toque adicional para abrirlo, y en un teléfono, de noche, con el pulgar, comparar dos
opciones que se parecen (mismo número de vuelo, mismo destino, sólo cambia la hora y la dirección del tramo)
exige verlas **las dos al mismo tiempo**. Por eso son dos tarjetas `.imp-choice` completas, una debajo de la
otra, cada una con ruta, aerolínea + número y hora de salida — los tres datos que alguien mirando su itinerario
in situ usa para decidir cuál es cuál, sin tener que abrir la reserva completa para comparar.

**Por qué "ninguno de los dos" es una tercera opción explícita, con su propio texto, y no un botón de
"cancelar" aparte.** Descartar la ambigüedad completa (la tarjeta no es de ninguno de los vuelos que el motor
propuso, es un vuelo nuevo) es una respuesta tan válida como elegir un candidato — el motor la modela como una
salida legítima, no como un error de la persona. Ponerla en la misma lista, con el mismo tratamiento visual que
las otras dos (radio, no un link aparte), evita que se lea como "me rindo" en vez de "esta es mi respuesta".

**Por qué el botón de guardar arranca deshabilitado con texto explicativo ("Elegí una opción") en vez de
apuntar a la primera opción por defecto.** Preseleccionar cualquiera de los dos candidatos —aunque sea el más
probable por orden cronológico— sería el motor decidiendo por la persona exactamente en el único momento en
que el brief dice que no puede. El costo de un toque extra es mucho menor que el costo de completar el vuelo
equivocado con la puerta y el asiento del otro tramo.

**Por qué el texto del botón cambia según lo elegido, en vez de un "Confirmar" fijo.** "Completar vuelo" y
"Guardar como vuelo nuevo" son acciones distintas con consecuencias distintas en los datos. Nombrar la acción
según lo que va a pasar reduce el margen de sorpresa en el único paso de esta hoja que escribe algo distinto
de lo que la persona vio en pantalla.

**Por qué existe 07B como estado aparte, si usa el mismo componente que 07.** Porque el motor documenta que
éste, no el de dos vuelos con el mismo número, es el disparador que más se repite: cualquier conexión o viaje
con más de un tramo el mismo día cae acá apenas la tarjeta pierde el número de vuelo (algo común: se corta en
el margen de la foto, o el reflejo lo tapa). Si el único ejemplo documentado fuera el de números repetidos
(07), alguien integrando podría asumir —equivocadamente— que la ambigüedad es un caso raro de aerolíneas que
reusan numeración, y subestimar cuánto va a aparecer esta pantalla en el uso real. Documentarlo aparte, con un
dato leído distinto (asiento, no número de vuelo) y candidatos que son tramos de una conexión y no el mismo
vuelo repetido, dispara la misma pantalla desde un dato de entrada completamente distinto — y confirma, con
dos ejemplos, que el componente no necesita saber *por qué* es ambiguo para funcionar: sólo necesita la lista
de candidatos que el motor ya arma.

**Qué se descartó:**
- **Elegir automáticamente el candidato más próximo en fecha/hora a la lectura de la tarjeta.** Se descartó
  de plano: es exactamente el "adivinar" que el brief prohíbe, y el motor ya devuelve `"ambiguo"` en vez de
  `"mismo"` para estos casos a propósito — inventarle una resolución automática en la interfaz sería deshacer
  esa decisión del motor por otra vía.
- **Mostrar los candidatos como una tabla comparativa de columnas** (candidato A / candidato B lado a lado).
  Se descartó por ancho: en 460px una tabla de dos columnas deja cada celda con 200px, insuficiente para
  "GOL G3 1234 · sale 27 sep 21:10" sin partir la línea de forma ilegible. Dos tarjetas apiladas, de ancho
  completo, se leen mejor en un teléfono aunque ocupen más alto.
- **Preguntar con un modal de "sí/no" por cada candidato, uno a la vez** ("¿Es el vuelo de las 06:40? Sí/No").
  Se descartó porque con dos candidatos ya son dos preguntas secuenciales (y con tres, tres), cuando mostrar
  la lista completa de una resuelve lo mismo en un solo vistazo y un solo toque.

### 3.2 Vacío no es error, y la interfaz no puede tratarlos igual

El motor separa tres estados por archivo, no dos: `ok`, `vacio` y `error` — y es explícito en su propio
comentario de cabecera: *"Un archivo vacío no es un error: es una foto borrosa o un documento que no es una
reserva, y no hace falta alarmar por eso."* La primera versión de este muestrario no respetaba esa distinción:
pintaba de rojo y ofrecía "Reintentar" tanto a un PDF dañado como a la foto de un comprobante de seguro que
nunca iba a tener una reserva adentro. Quedó corregido en esta entrega (estados 05 y 10).

**Por qué importa la distinción, en la práctica.** Reintentar un archivo con `error` (una imagen oscura, un
PDF corrupto) puede funcionar la segunda vez — el modelo puede tener una racha mala, la red puede haber
cortado a mitad de la respuesta. Reintentar un archivo `vacio` (un comprobante de seguro fotografiado por
error, un cartel) no cambia nada: es el mismo archivo con el mismo contenido, y va a volver a leerse bien y
seguir sin encontrar una reserva. Ofrecer "Reintentar" ahí es prometer una acción que no hace nada, y pintarlo
de rojo es alarmar por algo que ni siquiera es un problema del sistema.

**Cómo se resuelve, en concreto (nuevo en esta entrega — ver `C4b` en el CSS del muestrario):** un archivo
`vacio` usa la fila `.imp-file` **sin** el modificador `.err` (sin fondo rojo) y su texto usa la nueva clase
`.meta.info` — mismo tratamiento tipográfico de frase larga que `.meta.err`, pero en `--ink-2`, el mismo gris
que ya usa el resto de la interfaz para texto secundario. Ningún token de color nuevo: reutiliza uno que ya
existe. Su única acción es "Sacar" (la cruz), nunca "Reintentar". Un archivo `error` sigue con `.imp-file.err`,
texto en `--crit`, y ambas acciones: "Reintentar" y "Sacar".

**Qué se descartó:** dejar los tres estados con el mismo tratamiento visual (todo en rojo, como estaba antes
de esta corrección) por simplicidad de implementación. Se descartó porque le cuesta calma a la persona sin
necesidad — tres archivos en rojo un rato antes de embarcar, cuando en realidad sólo uno es un problema de
verdad, lee como "esto no funciona" cuando el sistema funcionó perfectamente en dos de los tres casos.

### 3.3 Corregir es escribir encima, nunca un paso aparte

Las tarjetas de revisión (04, 05, 08) usan `<input>` de verdad para cada campo, con el mismo valor que trajo
el motor precargado. No hay una vista de "esto es lo que se leyó" seguida de un botón "Editar" que lleve a
otra pantalla.

**Por qué.** El brief pide "cada reserva encontrada se muestra para revisar antes de guardar", y revisar en
una noche apurada, con una mano, significa corregir en el momento en que se nota el error, no memorizarlo para
un paso posterior. Si el motor leyó "GEG" en vez de "GIG" (una confusión de OCR entre letras parecidas), la
persona lo nota mirando el campo "Destino" y lo arregla ahí mismo, sin salir de la tarjeta.

**Qué se descartó:** una vista de sólo lectura con un ícono de lápiz que abre una hoja de edición aparte, como
en algunas apps de escaneo de recibos. Se descartó porque agrega un paso (abrir, corregir, volver) a lo que
el brief ya identificó como la fricción a eliminar — cargar un viaje debería dejar de ser trabajo, no
mudarse a otro lugar de la pantalla.

### 3.4 El título de la tarjeta de embarque (06/07/07B) no es un campo para llenar, es una descripción de qué se está mirando

En el estado 04, el título de cada tarjeta es un `<input>` editable ("Buenos Aires → Río de Janeiro"). En los
estados 06, 07 y 07B, el encabezado de la tarjeta de embarque es texto estático ("Vuelo G3 1234, 27 de
septiembre" / el aviso de ambigüedad): no hay nada que corregir todavía, porque todavía no se sabe si esto va
a completar un vuelo existente o crear uno nuevo. Recién cuando se resuelve la ambigüedad (o cuando el
resultado es `"nuevo"`, estado 08), la tarjeta pasa a tener campos editables como cualquier otra reserva
nueva.

**Qué se descartó:** mostrar los campos completos y editables desde el primer vistazo del caso ambiguo, con la
lista de candidatos abajo. Se descartó porque en el caso ambiguo el motor ni siquiera sabe con certeza cuáles
de esos campos van a completar un vuelo existente y cuáles van a ser una reserva nueva — mostrar un formulario
completo antes de esa decisión sugeriría que ya hay algo para guardar, cuando en realidad lo único que hace
falta en ese momento es una respuesta a una pregunta.

### 3.5 Otras decisiones, más chicas pero no menores

- **Los tres botones de origen de archivo conviven en la misma grilla, siempre.** Se pensó ocultar "Sacar
  foto" en escritorio (donde no hay cámara) y se descartó: el `<input type="file" capture="environment">`
  sin cámara disponible simplemente abre el selector de archivos del sistema, así que no hace falta detectar
  la plataforma para decidir qué mostrar — el propio navegador degrada solo.
- **Pegar texto sigue existiendo, pero detrás de un `<details>` nativo, no de un botón con JS.** Es
  deliberadamente menos vistoso que los tres botones de arriba: ya no es el único camino de importación (era
  el único hasta esta iteración), así que pasa a ser el respaldo para cuando no hay ni foto ni PDF a mano, sin
  competir visualmente con lo que ahora sí es el camino principal.
- **El chip de origen (`chip src`) siempre lleva un glifo, no sólo texto.** Cuando hay cuatro o cinco tarjetas
  de revisión juntas (un viaje con vuelo, alojamiento, auto y traslado, todo en un mismo lote), poder
  distinguir "salió de un PDF" de "salió de una foto" de un vistazo, sin leer el nombre de archivo completo,
  ayuda a entender rápido por qué un dato puede faltar (un PDF con texto seleccionable suele venir más
  completo que una foto de una pantalla).
- **El botón "Guardar N reservas" cuenta sólo lo que va a guardar, no el total del lote.** Si se descartó una
  tarjeta con la cruz, el número baja en el acto — nunca dice "Guardar 4" cuando en realidad hay 3 tarjetas
  visibles, porque esa discrepancia es exactamente el tipo de detalle que hace desconfiar de si el resto del
  número es correcto.

---

## 4 · Texto exacto de la interfaz

Todo en español rioplatense, voseo. Reproducido tal como está en `import-ui.html`.

**Elegir archivos (01)**
- "Sacale una foto al voucher, subí la captura del mail o el PDF del pasaje. Te muestro lo que encuentro antes
  de guardar nada."
- Botones: "Sacar foto · con la cámara" / "Galería · fotos y capturas" / "Archivo · PDF o imagen"
- "Podés elegir varios a la vez, y combinar fotos con PDF en la misma carga."
- `<details>`: "Pegar el texto en cambio" → etiqueta "Texto de la confirmación", "Podés pegar varias reservas
  juntas. Las separo yo."

**La cola (02)**
- Etiqueta: "Vas a interpretar"
- Error de tamaño: "Pesa 34 MB, más de lo que puedo leer (máx. 15 MB). Elegí otro archivo o sacá la foto de
  nuevo con menos calidad."
- Botón: "Interpretar 3 archivos" (el número cuenta sólo los que entran)

**Leyendo (03)**
- "Leyendo 3 archivos…"
- Por archivo: "Listo · 2 reservas encontradas" / "Leyendo…" / "En cola"
- Si tarda: "Che, esto está tardando más de lo normal. Las fotos con poca luz y los PDF pesados tardan más en
  leerse." + botón "Quedarme con lo que ya está listo"

**Revisión (04)**
- "Encontré 4 reservas en 3 archivos. Revisá los datos y corregí lo que haga falta antes de guardar."
- "Costo, teléfono y notas se completan después, abriendo la reserva ya guardada. Acá sólo lo que la lectura
  automática suele errar: fechas, rutas y códigos."
- Placeholder de un campo no encontrado: "No lo encontré"
- Botón: "Guardar 4 reservas"

**Revisión con problemas (05)**
- "Encontré 1 reserva en 3 archivos. Los otros dos no aportaron nada — mirá el detalle de cada uno más abajo."
- Archivo vacío: "Se leyó bien, pero no encontré ninguna reserva ahí. Puede ser un comprobante que no es de
  viaje."
- Archivo con error: "No pude leer esta imagen: se ve completamente oscura. Sacá la foto de nuevo con más
  luz."

**Tarjeta de embarque, coincide con certeza (06)**
- Etiquetas: "Ya tenías cargado" / "Se completa con"
- "Coincide por número de vuelo y fecha con el vuelo que ya tenías cargado."
- Botones: "Completar vuelo" (primario) / "Cargar como nuevo" (ghost)

**Tarjeta de embarque, duda entre dos vuelos (07)**
- "El reflejo de la foto tapó la fecha y la ruta. Sólo pude leer el vuelo **G3 1234** y el asiento **16A** — y
  tenés dos vuelos con ese número. ¿A cuál corresponde?"
- Opción: "Ninguno de los dos — Es un vuelo nuevo, no lo tenía cargado"
- Botón antes de elegir: "Elegí una opción" (deshabilitado)
- Botón al elegir un candidato: "Completar vuelo"
- Botón al elegir "ninguno": "Guardar como vuelo nuevo"

**Tarjeta de embarque, duda sin número de vuelo (07B)**
- "No pude leer el número de vuelo en esta tarjeta — el margen está cortado justo ahí. Sólo el asiento se ve:
  **3C**. Tenés dos vuelos cargados el 20 de septiembre, así que la fecha sola no alcanza para decidir. ¿A
  cuál corresponde?"

**Tarjeta de embarque, no encuentra ninguno (08)**
- "No tenías este vuelo cargado. Lo agrego como una reserva nueva."
- Botones: "Guardar vuelo" / "Descartar"

**Guardado (09)**
- "Guardado. Agregué 4 reservas y completé el vuelo de vuelta con los datos de la tarjeta de embarque."
- Toast: "4 reservas agregadas · vuelo de vuelta completado"

**Sin nada que guardar (10)**
- "No conseguí ninguna reserva de estos 3 archivos"
- "Uno no se pudo leer y los otros dos se leyeron bien pero no tenían pinta de reserva de viaje. El detalle
  de cada uno está abajo."
- Botones: "Cargar a mano" / "Reintentar 1 archivo"

**Sin lectura automática (11)**
- "La lectura automática no está disponible en esta vista. Cargá la reserva a mano desde **Agregar**."

**Sólo lectura (12)**
- Chip: "sólo lectura"
- "Quien mira este viaje sin permiso de edición no puede importar reservas. Pedile a quien te compartió el
  link que te dé permiso para cargar."

---

## 5 · Qué necesita `app/valija.html` para integrar esto

Esta sección es para el rol de integración. No se edita `valija.html` desde acá.

### 5.1 Reemplaza a `sheetImport`, no convive con ella
La función `sheetImport(trip)` de hoy (línea ~3386) pega texto y, si la vista soporta imágenes, hasta una
foto suelta, en un solo paso lineal. Este diseño la reemplaza por completo: no hace falta mantener las dos
rutas — el `<details>` de "Pegar el texto en cambio" del estado 01 cubre el mismo caso de uso que hoy resuelve
`sheetImport` sin archivo, y el resto de la hoja resuelve VAL-40/41/42, que `sheetImport` no cubre. Conserva
el mismo punto de entrada (el botón "Importar" del estado 00, línea ~2587: `im.onclick = ()=>
sheetImport(trip)` sigue apuntando al mismo nombre de función, sólo cambia su implementación).

### 5.2 Motor
1. Incorporar `app/parts/import-engine.js` al `<script>` de `valija.html`, igual que ya se hizo con
   `packing-engine.js` (UMD, se pega entero, expone `ImportEngine`).
2. Agregar las dos etiquetas de pdf.js antes del cierre de `</body>`, con la versión fija que documenta
   `docs/design/import-engine.md` sección 4.1 (`3.11.174`) — incluidas ahí las instrucciones de verificación
   en la app publicada, porque `cdnjs.cloudflare.com` está bloqueado en este entorno de trabajo.
3. Reusar el mismo patrón de conexión con la capa de IA que ya usa `sheetImport` y
   `generatePackingList`:
   ```js
   const sample = await claude.use("sample").catch(()=>null);
   const callModel = sample ? (prompt, opts) => sample.json(prompt, opciones(opts)) : null;
   ```
   **El `modelTier` ya no es `"complex"` en todos los caminos** (decisión del PO del 12/09/2026): el de
   texto pide `"default"` y el de imágenes `"complex"`. Lo decide `tierDeImportacion()` en `valija.html`, y
   el porqué está en `docs/design/import-engine.md` § 4.9. Y `opts` no se reenvía tal cual: `modo`,
   `archivo` y `paginas` son nuestros y se quedan del lado de la app.
   Si `sample` es `null`, no pasar `callModel`: cada archivo degrada solo a `estado:"error"` (estado 10 o, si
   la hoja recién se abre y todavía no se intentó nada, directo al estado 11 como hoy hace `sheetImport`).

### 5.3 Armar la lista de archivos desde los tres `<input type="file">`
Los tres botones del estado 01/02 (`f_cam`, `f_gal`, `f_doc`) escriben al mismo array en memoria de la hoja
abierta, sin importar por cuál entraron — un `Set` o array simple indexado por nombre+tamaño alcanza para
poder sacar uno con la cruz sin reconstruir todo. Cada `File` elegido se convierte en
`{ name:file.name, mimeType:file.type, blob:file }` (un `File` ya es un `Blob`). El botón "Interpretar" llama:
```js
const resultado = await ImportEngine.interpretFiles(files, {
  callModel,
  renderPdfToImages: (blob) => ImportEngine.renderPdfPagesToImages(blob),
  trip: { name:trip.name, destination:trip.destination, startDate:trip.startDate, endDate:trip.endDate }
});
```

### 5.4 Pintar por archivo — `estado` decide la clase, no un booleano
`resultado.archivos` ya trae el estado de cada uno. El mapeo a las clases de este muestrario:
- `"ok"` → fila `.imp-file` sin modificador, `.meta.ok` con "Listo · N reservas encontradas".
- `"vacio"` → fila `.imp-file` **sin** `.err`, `.meta.info` con un texto genérico armado por la interfaz (el
  motor no manda mensaje para este caso, `error` viene `null` a propósito — ver `docs/design/import-engine.md`
  sección 2.1 y la sección 3.2 de este documento). Sugerido: "Se leyó bien, pero no encontré ninguna reserva
  ahí. Puede ser una foto borrosa o un documento que no es de viaje." Sin botón "Reintentar".
- `"error"` → fila `.imp-file.err`, `.meta.err` con `error.mensaje` (ya en español, ya listo para mostrar). Con
  botón "Reintentar" que vuelve a llamar `interpretFiles` sólo con ese archivo.

### 5.5 El punto central — `matchAgainstExisting` antes de cada guardado de vuelo
Antes de guardar cada reserva de tipo `"flight"` de `resultado.reservas`, correr
`ImportEngine.matchAgainstExisting(reserva, Store.itemsOf(trip.id))` y ramificar por `resultado.resultado`:
- **`"nuevo"`** → se muestra y guarda como tarjeta de revisión común (estado 04/05/08), con
  `Store.saveItem(trip.id, {...})` igual que hoy hace `sheetImport`.
- **`"mismo"`** → arma el estado 06: el bloque `.imp-existing` con `resultado.existente` (título, aerolínea +
  número, hora de salida — los mismos campos que ya usa `pass-title`/`pass-when` en el resto de la app) y el
  bloque `.imp-diff` con `resultado.patch` (sólo `gate`, `terminal`, `seat`, `boardingTime`, los que
  `CAMPOS_COMPLETABLES` diga que estaban vacíos). Al confirmar "Completar vuelo", actualizar
  `resultado.existente.id` con esos campos vía `Store.saveItem` (no crear una reserva nueva).
- **`"ambiguo"`** → arma el estado 07/07B: el `.notice.warn` con los datos que sí se leyeron de la tarjeta
  (usar lo que venga en `candidato`: `flightNumber` y/o `seat`, omitiendo lo que venga vacío en vez de mostrar
  un campo en blanco) y la lista `.imp-choice` con `resultado.candidatos` (cada uno ya trae `id`, `title`,
  `start` — armar la segunda línea con aerolínea + número + hora igual que en el muestrario). Al elegir un
  candidato, se comporta como `"mismo"` contra ese `id` puntual (mismo patch de campos). Al elegir "ninguno de
  los dos", se comporta como `"nuevo"`.

### 5.6 El campo `boardingTime`
No existe hoy en el modelo de ítem de `Store`. Decisión de este diseño: **agregar el campo al esquema**
(`boardingTime:""`, igual que `gate` y `terminal` ya están) en vez de anexarlo a `notes`. Razón de diseño: el
bloque `.imp-diff` del estado 06 lo muestra como un campo propio con su propia etiqueta ("Embarque"), y
meterlo dentro de `notes` como texto libre (`"Embarque: 21:10"`) le impediría aparecer ahí de forma
estructurada — quedaría como una frase suelta que no se puede volver a leer ni actualizar por separado si la
hora de embarque cambia. `import-engine.md` deja las dos vías abiertas; ésta es la que este diseño necesita
para que el estado 06 se vea como está documentado.

### 5.7 Íconos nuevos en el objeto `I`
`valija.html` ya tiene `doc`, `cam`, `flight`, `stay`, `car`, `transfer`, `info`, `x`, `check2`, `spark`,
`plus`, `share`, `back` (línea 573) — se reutilizan tal cual, sin duplicar. Los dos que **no** existen todavía
y hay que sumar son los que usa el selector de origen de archivo y la miniatura genérica de foto:
`gallery` y `img` (definidos en el Bloque D del script de `import-ui.html`, listos para copiar).

### 5.8 CSS
Copiar el Bloque C completo de `import-ui.html` (siete grupos, comentados como `C1` a `C7`) al `<style>` de
`valija.html`. Ningún color literal, ningún token nuevo: todo sale de los mismos `:root` que ya existen. Incluye
la variante `.meta.info` (nueva en esta entrega, ver sección 3.2) que reutiliza `--ink-2` y `--f-body`, ninguno
de los dos un token nuevo.

### 5.9 Cambios de texto existente
Ninguno fuera de lo ya descrito: el botón "Importar" del estado 00 no cambia de texto ni de posición, sigue
siendo el mismo `im.onclick = ()=> sheetImport(trip)` de la línea ~2587. Lo único que cambia es el contenido
de la hoja que ese botón abre.
