# QA — Importar documentos (VAL-40, VAL-41, VAL-42)

**Alcance:** Bloque A del brief `docs/briefs/interpretar.md` (VAL-40, VAL-41, VAL-42), integrado en
`app/valija.html` (función `sheetImport`, líneas ~4264-4737) sobre `ImportEngine`
(`app/parts/import-engine.js`, embebido en `valija.html` líneas ~2437-2694). El Bloque B (VAL-43 a VAL-46)
no está integrado y no se prueba acá.

**Cómo se probó.** La app no tiene `doctype`/`html`/`body` (los agrega la plataforma), así que se envolvió
en un HTML mínimo y se corrió local con Chromium headless vía Playwright, controlado por script. Se sembraron
viajes y reservas directamente en `localStorage` (misma clave `valija.v1` que usa `Store`) y se reemplazó
`window.claude.use(...)` por un objeto propio que simula `"db"`, `"sample"` y `"downloads"` — mismo patrón que
usan las pruebas de motor existentes. Cada escenario se corrió de punta a punta haciendo clic real sobre los
botones de la hoja (no se llamó a funciones internas salvo donde se indica explícitamente), y se capturaron
capturas de pantalla y el estado de `Store` antes/después de cada acción.

Una restricción real del entorno terminó siendo parte de la prueba: **`cdnjs.cloudflare.com` está bloqueado
por el proxy de este entorno** (confirmado con `curl`, 403 en el túnel), así que `pdf.js`, `jsPDF` y las
tipografías de Google Fonts nunca llegan a cargar acá. Esto es exactamente el "sin pdf.js" que pide el brief
de QA, así que se aprovechó como caso real en vez de simularlo. La consecuencia colateral es que **no pude
verificar en vivo** que un PDF real (de varias páginas o escaneado) se interprete correctamente — sólo pude
verificar que, sin `pdf.js`, cada PDF degrada a un error propio sin romper el resto del lote. Lo digo
explícito más abajo en cada caso afectado.

Scripts, capturas y logs de esta corrida quedaron en
`/tmp/claude-0/-home-user-tomasmperea/4eb7ac20-1efe-58da-88bc-4e1a7f0fd447/scratchpad/qa/` (`run.js`,
`extra.js`, `extra2.js`, `extra3.js`, carpeta `shots/`) por si hace falta reproducir alguna corrida.

---

## 1 · Casos de prueba

### VAL-40 — Importar desde PDF

**CP-01. Subir un PDF desde la hoja de importar.**
Pasos: abrir "Importar" → botón "Archivo" → elegir un `.pdf`. Resultado esperado: aparece en la cola con su
miniatura y tamaño. **Verificado** (S4/S10): el archivo entra a la cola correctamente.

**CP-02. Un PDF de varias páginas se interpreta completo, no sólo la primera.**
**No verificado.** `pdf.js` nunca carga en este entorno (cdnjs bloqueado), así que ningún PDF real llega a
renderizarse. Por lectura de código: `ImportEngine.renderPdfPagesToImages` itera `pdf.numPages` de forma
secuencial y le pasa todas las imágenes juntas al modelo con una única instrucción explícita ("leelas todas
juntas antes de decidir cuántas hay"); `valija.html` etiqueta cada reserva con su página cuando
`reservas.length === paginas`. Es una inferencia de lectura, no una comprobación en vivo.

**CP-03. Un PDF escaneado, sin texto seleccionable, también se interpreta.**
**No verificado**, misma razón que CP-02. `renderPdfPagesToImages` no distingue si el PDF tiene texto: siempre
lo dibuja a canvas, así que por diseño debería funcionar igual — pero no se pudo correr con un PDF real.

**CP-04. Cada reserva encontrada se muestra para revisar antes de guardar.**
**Verificado** (S4, S6, S9): toda reserva interpretada (de imagen o, en el único PDF de la prueba, la que
hubiera si `pdf.js` funcionara) pasa por una tarjeta de revisión con campos editables antes de cualquier
escritura a `Store`.

**CP-05. Degradación sin `pdf.js` (caso real de este entorno).**
**Verificado** (S4): con `window.pdfjsLib` ausente, el PDF del lote cae con
`"No pude leer ese PDF. Probá con una foto del comprobante."` y botón "Reintentar", mientras las dos fotos del
mismo lote se interpretan con normalidad (una con reserva, una vacía). El lote no se corta ni se pierde nada.

### VAL-41 — Importar fotos y capturas

**CP-06. Aceptar PNG y JPG, varias a la vez.** **Verificado** (S4, S9B): dos y más imágenes en un mismo
`<input multiple>` se encolan y procesan todas.

**CP-07. Mezclar tipos en una misma carga (fotos + PDF).** **Verificado** (S4): dos fotos + un PDF en el mismo
lote, cada uno con su resultado independiente.

**CP-08. La app dice qué reconoció de cada archivo, no un resultado global.** **Verificado**: cada fila de
`.imp-files` lleva su propio estado (`en cola` / `leyendo…` / `listo · N reservas` / vacío / error), tanto
durante la lectura (estado 03) como en el resumen (04/05/10).

**CP-09. Un archivo que no se pudo interpretar se señala solo, sin invalidar los que sí funcionaron.**
**Verificado** (S4, y el escenario extra de error+vacío mixto): un archivo con error real se pinta en rojo
con "Reintentar"; uno vacío (se leyó bien, no había reserva) se pinta neutro, sin "Reintentar" — exactamente
la distinción de `docs/design/importar.md` sección 3.2 — y ninguno de los dos bloquea guardar lo que sí se
encontró en otros archivos del mismo lote.

### VAL-42 — Completar con la tarjeta de embarque

**CP-10. Puerta, terminal, asiento y hora de embarque completan un vuelo ya cargado.** **Verificado**: una
tarjeta con `gate:"B7", terminal:"2", seat:"14C", boardingTime:"06:10"` contra un vuelo ya cargado sin esos
datos produjo exactamente ese patch, mostrado en pantalla antes de guardar y aplicado al vuelo existente al
confirmar.

**CP-11. Reconoce el mismo vuelo por número y fecha, y lo completa en vez de duplicarlo.** **Verificado**: la
cantidad de reservas del viaje no cambió (2 antes, 2 después) tras completar; el vuelo existente (`f1`) quedó
con los campos nuevos y el resto de sus datos (título, horario, código de reserva) intacto.

**CP-12. Ante la duda, pregunta — sin preselección, botón deshabilitado hasta elegir.** **Verificado**: con
dos vuelos cargados el mismo día y una tarjeta sin número de vuelo, las dos opciones y "Ninguno de los dos"
aparecen con `aria-pressed="false"` los tres, y el botón de guardar aparece deshabilitado con el texto
"Elegí una opción".

**CP-13. Elegir "ninguno de los dos" crea una reserva nueva sin tocar las existentes.** **Verificado**: tras
elegir esa opción y guardar, se sumó exactamente una reserva nueva (con el asiento/hora de embarque leídos) y
los dos vuelos existentes quedaron sin ningún campo modificado.

**CP-14. Elegir un candidato completa ese vuelo sin duplicarlo.** **Verificado**: al elegir el primer
candidato, sólo ese vuelo (`f1`) recibió el patch (`seat`, `boardingTime`); el otro vuelo del mismo día (`f2`)
quedó sin tocar y no se creó ningún registro nuevo.

**CP-15. "Cargar como nuevo" desde el caso de coincidencia con certeza (la salida rara documentada en el
diseño).** **Verificado**: con una tarjeta que coincide con certeza por número+fecha, tocar "Cargar como
nuevo" (en vez de "Completar vuelo") agrega una reserva aparte con el mismo número de vuelo, y dejó la
reserva original sin ningún cambio — dos vuelos "iguales" a propósito, tal como permite el diseño para el caso
en que la persona sabe que en realidad son vuelos distintos.

**CP-16. Se muestra qué campos se van a completar antes de guardar.** **Verificado**: el bloque "Se completa
con" lista sólo los campos que realmente van a cambiar (puerta/terminal/asiento/embarque), nunca campos que
ya estaban completos en la reserva existente.

**CP-17. (Ver hallazgo F1, bloqueante).** Una tarjeta de embarque con sólo asiento y fecha, sin texto legible
de aerolínea ni ruta — el ejemplo que el propio diseño documenta como "el disparador más frecuente" (estado
07B) — nunca llega a la pregunta. Se pierde antes.

### Regresión de las ocho funciones existentes

**CP-18. Lista de viajes / entrada al viaje.** Smoke test: la app abre en la pantalla del viaje sembrado sin
errores de consola de aplicación (sólo los `ERR_TUNNEL_CONNECTION_FAILED` esperables por los recursos de CDN
bloqueados). **Verificado.**

**CP-19. Itinerario por día.** La pestaña "Itinerario" muestra los dos vuelos sembrados agrupados por fecha.
**Verificado.**

**CP-20. Pendientes.** La pestaña "Pendientes" cambia y renderiza sin errores. **Verificado** de forma
superficial (cambio de pestaña y render sin excepción); no se revisó a fondo la lógica de vencimientos porque
no es parte de esta iteración.

**CP-21. Alta y edición de reservas.** El botón "Agregar" sigue abriendo la hoja de alta manual normalmente.
**Verificado** (apertura de la hoja); no se probó el guardado completo del formulario manual porque no cambió
en esta iteración.

**CP-22. Valija inteligente.** La entrada a la valija (`#vjentry`) navega a la vista de packing sin error.
**Verificado** de forma superficial.

**CP-23. Exportar PDF.** Con `jsPDF` bloqueado por el mismo motivo que `pdf.js` (cdnjs), el botón no rompe la
app: cae al camino ya existente `if(!window.jspdf){ toast(...); return; }` (línea 4969). **Esto no es un
hallazgo de esta iteración** — el código ya contempla el caso y no lo tocó el trabajo de importar — pero lo
dejo registrado porque confirma que el entorno de prueba no permite validar la generación real del PDF.

**CP-24. Compartir.** La hoja "Compartir" abre con el link y el resumen de texto, sin relación con el cambio
de importar. **Verificado.**

**CP-25. Tema claro/oscuro.** Forzando `localStorage["valija.tema"]="oscuro"` antes de cargar, los tres
estados de importar más sensibles a color (07 ambiguo, 06 completar, 04 revisión con archivos sucios) se ven
con buen contraste y sin texto invisible. **Verificado visualmente** para las pantallas de importar
específicamente; no se recorrió el resto de la app en oscuro porque no es parte de este trabajo.

### La carga mixta y el orden de resolución

**CP-26. El motor resuelve primero las coincidencias de vuelo, después la revisión general.** **Verificado**:
con un lote de una tarjeta de embarque que matchea un vuelo cargado + un voucher de auto (reserva nueva), la
hoja mostró primero la pantalla de "Ya tenías cargado / Se completa con" (estado 06) y sólo después de resolver
esa pregunta pasó a la revisión general con la tarjeta del auto.

**CP-27. Cancelar en cualquier punto de un lote mixto no debería dejar la hoja en un estado a medias.**
**Falla** (ver hallazgo F2, importante): completar el match de vuelo escribe a `Store` de inmediato: si
después se cancela en la revisión general (antes de tocar "Guardar N reservas"), el vuelo ya queda modificado
mientras que la reserva nueva pendiente de revisión se descarta correctamente. No hay pérdida de datos ni
corrupción, pero el resultado no es "todo o nada".

### Cancelar y volver

**CP-28. Cancelar con archivos ya en cola no deja restos al reabrir.** **Verificado**: con dos archivos
puestos en la cola (antes de tocar "Interpretar"), cancelar y volver a abrir "Importar" mostró la cola vacía,
sin ningún archivo del intento anterior.

### Caminos degradados

**CP-29. Sin capa de inteligencia (`claude.use("sample")` resuelve `null`).** **Verificado**: la hoja muestra
directamente el estado 11 ("La lectura automática no está disponible en esta vista. Cargá la reserva a mano
desde Agregar.") con un único "Cerrar", sin ofrecer ningún selector de archivo.

**CP-30. Sin permiso de escritura (`Store.canWrite=false`).** **Verificado**: con la base de datos simulada
devolviendo `invalid_argument` en la escritura de sondeo, el botón "Importar" de la pantalla del viaje queda
deshabilitado, y forzando igual la apertura de `sheetImport` se llega al estado 12 correcto, con el chip
"sólo lectura" y un único "Cerrar".

**CP-31. Sin `pdf.js`.** Ver CP-05: verificado, degrada por archivo sin romper el lote.

**CP-32. Sin base de datos compartida (`claude.use("db")` resuelve `null`).** **Verificado** de forma
implícita en todos los demás escenarios (es el modo por defecto de la prueba): la app funciona en modo local
contra `localStorage`, `Store.canWrite` queda en `true`, y todo el flujo de importar (cola, interpretación,
match, guardado) funciona igual que con base de datos.

### Datos sucios

**CP-33. Nombre de archivo con comillas, ángulos y acentos.** **Verificado**: un archivo llamado
`foto "rara" <b>ñ</b> & cía'.jpg` se mostró como texto literal, sin ejecutar el markup, tanto en la cola (02)
como en el chip de origen de la tarjeta de revisión (04).

**CP-34. Un campo con comillas dentro del valor (código de reserva `A1"B2`).** **Verificado**: se mostró
correctamente dentro del `<input>` sin romper el atributo HTML — `esc()` escapa la comilla antes de ir al
`value="..."`.

**CP-35. Respuesta del modelo con campos de tipo incorrecto** (`type:42`, `title:12345`, `from:['EZE']`,
`provider:true`, `flightNumber:3040`, `notes:{a:1}`, etc.). **Verificado, sin crash**: no se registró ningún
error de JavaScript no controlado. El archivo terminó marcado como "vacío" (ver hallazgo F1 — es el mismo
mecanismo: campos no-string se vacían y, si título y proveedor quedan ambos vacíos, la reserva entera se
descarta antes de llegar a la revisión).

**CP-36. Archivo de 0 bytes.** **Verificado, sin crash**: un PNG de 0 bytes se encoló y procesó con
normalidad (en esta prueba, con un modelo simulado; no se probó contra un modelo real con un archivo vacío de
verdad, que podría comportarse distinto ante una imagen sin contenido).

---

## 2 · Hallazgos

### F1 — BLOQUEANTE. Una tarjeta de embarque con datos reales pero sin título/proveedor legible se descarta en silencio, nunca llega a preguntar

**Qué pasa.** `ImportEngine.sanitizeReservation` (`app/parts/import-engine.js`, función que arranca en la
línea 345) tiene esta regla:

```js
// Sin título ni proveedor no hay nada que mostrarle a la persona para revisar.
if (!out.title && !out.provider) return null;
```

Esto se aplica a **cualquier** tipo de reserva, incluidos los vuelos. Pero el propio
`docs/design/importar.md`, en la sección del estado **07B** — que describe explícitamente como "el disparador
más frecuente" del caso ambiguo de VAL-42 — dice: *"No pude leer el número de vuelo en esta tarjeta... Sólo
el asiento se ve: 3C."* Es decir: el escenario que el diseño documenta como el más común en la práctica es
exactamente uno donde el modelo puede devolver una reserva de vuelo con `title` y `provider` vacíos, y sólo
`seat`, `boardingTime` y `start` (la fecha) con datos reales. Esa reserva **nunca llega a
`ImportEngine.matchAgainstExisting`**: se descarta en el sanitizador antes de eso, y el archivo se le muestra
a la persona como si no hubiera encontrado nada ("Se leyó bien, pero no encontré ninguna reserva ahí").

**Cómo reproducirlo.** Con el viaje de prueba (dos vuelos cargados el 20/9: `G31234` a las 06:40 y `G35678` a
las 11:00), simular que el modelo devuelve, para una foto de tarjeta de embarque, exactamente:

```json
{"items":[{"type":"flight","title":"","provider":"","flightNumber":"","seat":"3C",
           "start":"2026-09-20T06:00","end":"","from":"","to":"","confirmation":"",
           "terminal":"","gate":"","boardingTime":"","address":"","phone":"","cost":"",
           "currency":"","notes":""}]}
```

1. Abrir "Importar", subir esa foto (cualquier imagen sirve, la respuesta la controla el modelo simulado).
2. Tocar "Interpretar 1 archivo".

**Qué pasa:** la hoja pasa directo al estado "No conseguí ninguna reserva de este archivo", con el detalle
"Se leyó bien, pero no encontré ninguna reserva ahí. Puede ser una foto borrosa o un documento que no es de
viaje." Nunca aparece la lista de candidatos ni la pregunta "¿A cuál corresponde?".

**Qué debería pasar.** Según VAL-42 ("Ante la duda pregunta a cuál corresponde, no adivina") y el propio
diseño (estado 07B), esa misma tarjeta debería llegar a `matchAgainstExisting`, que con esos datos (fecha
20/9, sin número, dos vuelos cargados ese día) devuelve correctamente `resultado:"ambiguo"` con los dos vuelos
como candidatos — lo verifiqué llamando a `ImportEngine.matchAgainstExisting` directamente con el mismo objeto
(sin pasar por el sanitizador): da el resultado ambiguo esperado. El problema es exclusivamente que
`sanitizeReservation` la descarta antes.

**Por qué importa.** No es un caso de laboratorio: es, según el propio equipo de diseño, el caso más común.
Cualquier tarjeta de embarque donde el modelo no reconozca con confianza ni el nombre de la aerolínea ni una
ruta con formato de título (foto recortada, reflejo, ángulo raro) — pero sí lea el asiento y/o la hora de
embarque, que suelen estar en texto grande y claro — va a desaparecer del lote sin aviso, con la persona
creyendo que la foto no sirvió, cuando en realidad el motor tenía todo lo que necesitaba para completar el
vuelo. Esto compromete directamente VAL-42.

**Gravedad: bloqueante.** Defeatea el criterio de aceptación de VAL-42 para el escenario que el propio diseño
identifica como el más frecuente.

**Nota:** no repetí la prueba unitaria del motor (ya tiene 38 pruebas en verde) — esto lo encontré probando el
flujo completo de la app con clics reales sobre la hoja de importar, y lo confirmé también llamando
`sanitizeReservation` y `matchAgainstExisting` por separado desde la consola para aislar en cuál de las dos
funciones está el corte.

---

### F2 — IMPORTANTE. Cancelar a mitad de un lote mixto no deshace un match de vuelo ya completado

**Qué pasa.** `docs/design/importar.md`, sección 1, dice: *"Ningún estado es un callejón sin salida: la cruz
del encabezado y el botón 'Cancelar' cierran la hoja entera desde cualquier paso, sin guardar nada a medias —
el motor nunca escribe hasta que se toca 'Guardar'."* Pero en la integración (`app/valija.html`,
`renderMatchMismo`, botón `#im-complete`, línea ~4573), tocar "Completar vuelo" llama a `Store.saveItem` de
inmediato — antes de llegar a la pantalla final de revisión y su botón "Guardar N reservas". Si el lote mezcla
un match de vuelo con otras reservas nuevas, y la persona cancela en la pantalla de revisión general (que
viene después), el vuelo ya completado queda escrito, mientras que las reservas nuevas pendientes se
descartan.

**Cómo reproducirlo.**
1. Viaje con un vuelo cargado (`G31234`, 20/9, sin puerta/asiento).
2. Importar un lote con una tarjeta de embarque que matchea ese vuelo (mismo número y fecha, con
   `gate:"C3"`) **y** un voucher de auto (reserva nueva, tipo `car`).
3. En la pantalla "Ya tenías cargado / Se completa con", tocar **"Completar vuelo"**.
4. La hoja pasa a la revisión general con la tarjeta del auto. Tocar **"Cancelar"** ahí (no "Guardar").

**Resultado observado:** el vuelo queda con `gate:"C3"` guardado en `Store` (confirmado leyendo
`Store.itemsOf(...)` después de cerrar la hoja). El auto no se guardó — eso sí se descartó correctamente.

**Qué debería pasar según el diseño:** cancelar en cualquier punto debería dejar todo exactamente como estaba
antes de abrir la hoja, sin escrituras parciales.

**Matiz:** se puede argumentar que "Completar vuelo" es en sí misma una acción de guardado explícita y
consciente (la persona ya vio el patch y lo confirmó), así que no está claro que esto sea "guardar a medias" en
el sentido que preocupa al brief ("nada se guarda sin revisar" — acá sí se revisó, y se guardó a propósito).
Pero el texto del propio diseño es categórico y no hace esa excepción, y la experiencia real es que alguien
que cancela la hoja pensando "no quiero nada de esto" se puede llevar la sorpresa de que su vuelo cambió
igual. Lo marco como importante, no bloqueante, porque no hay pérdida ni corrupción de datos — el patch
aplicado es correcto y no duplica nada — sólo un desvío del contrato de "todo o nada" que el propio diseño
promete por escrito.

---

### F3 — IMPORTANTE. El campo "proveedor" de alojamiento y auto se guarda sin pasar nunca por la revisión

**Qué pasa.** `cardFieldsHtml` (`app/valija.html`, línea ~4171) no incluye un input para `provider` en las
tarjetas de revisión de tipo `stay` ni `car` (sólo lo muestra para `flight` como "Aerolínea" y para `transfer`
como "Proveedor"). Pero el modelo sí puede devolver ese campo para un alojamiento o un auto ("Booking.com",
"Localiza", el nombre del anfitrión), y `doSaveReview` (línea ~4702) lo guarda igual en el objeto final con
`Store.saveItem`, sin que la persona lo haya visto ni podido corregir en ningún momento de la hoja.

**Cómo reproducirlo.**
1. Importar una foto cuya respuesta simulada del modelo sea:
   `{"type":"stay","title":"Depto en Copacabana","provider":"Booking.com","address":"Rua X 123",
     "start":"2026-09-21T12:00","end":"2026-09-23T10:00","confirmation":"BK99"}`.
2. En la tarjeta de revisión que aparece, verificar los campos mostrados: sólo "Dirección", "Check-in",
   "Check-out" y "Código de reserva" — no hay ningún campo "Proveedor" ni forma de ver que el motor capturó
   "Booking.com".
3. Tocar "Guardar 1 reserva".
4. Consultar la reserva guardada: `provider` quedó en `"Booking.com"`, aunque nunca apareció en pantalla.

**Qué debería pasar.** El brief cierra el punto de forma explícita: *"Nada se guarda sin revisar. Ni una
reserva interpretada de un PDF... entra a los datos sin que la persona los vea antes."* El propio diseño
(`docs/design/importar.md`, estado 04) sólo exime de esa revisión a "costo, teléfono y notas" — el texto que
la hoja le muestra a la persona dice justamente eso, y "proveedor" no está en esa lista. Para alojamiento y
auto, el nombre del hotel/plataforma o de la rentadora debería tener su propio campo visible en la tarjeta (o,
como mínimo, no capturarse/guardarse si no se va a mostrar).

**Gravedad: importante.** No bloquea ningún criterio de aceptación del brief de forma literal (los campos que
si están explícitamente listados como "hay que revisar" sí se revisan), pero viola un compromiso de producto
cerrado y puede meter en la reserva un dato equivocado del modelo (una alucinación de proveedor, por ejemplo)
que la persona jamás tiene oportunidad de corregir en el momento de importar.

---

## 3 · Lo que no pude verificar

- **CP-02 y CP-03 (PDF de varias páginas, PDF escaneado):** no verificado en vivo. `cdnjs.cloudflare.com` está
  bloqueado en este entorno y `pdf.js` nunca llega a cargar, así que cualquier PDF real degrada antes de
  llegar al motor. Sólo pude confirmar la degradación (CP-05), no el camino feliz. Recomiendo repetir estos
  dos casos contra la app publicada, con un PDF real de más de una página y otro escaneado, apenas se pueda.
- **Interpretación real de un archivo de 0 bytes contra el modelo real** (CP-36): sólo lo probé con el modelo
  simulado, que siempre resuelve. No sé cómo se comporta la capa de IA real (`claude.use("sample")`) ante una
  imagen sin contenido — podría rechazarla con un código de error distinto a los que ya contempla
  `MODEL_ERROR_MESSAGES`.
- **Concurrencia (dos personas editando el mismo viaje durante una importación).** No lo probé: el arnés usado
  corre una sola pestaña por escenario. Por lectura de código, `sheetImport` no agrega ningún mecanismo nuevo
  de bloqueo ni de fusión — hereda el mismo modelo optimista de `Store` (escribe local al toque, sincroniza
  después) que ya usa el resto de la app. No debería ser peor que lo que ya existe, pero no lo comprobé
  corriendo dos clientes a la vez.
- **El aviso de "esto está tardando más de lo normal" y "Quedarme con lo que ya está listo" (estado 03).**
  Confirmé por lectura de código que el `setTimeout` de 7 segundos y la función `showSlowNotice` están bien
  encadenados con `finishRun`/`acceptPartial`, pero mi arnés de prueba acelera los timers largos para no
  esperar de más, y eso hizo que la carrera contra el timer del modelo simulado terminara siempre antes de
  que se dispare el aviso. No alcancé a verlo aparecer en vivo.
- **Tipografías y CDN de jsPDF/pdf.js/Google Fonts:** todos bloqueados en este entorno de prueba. No es un
  hallazgo de esta iteración (ya existía para jsPDF, y el manejo de ausencia de `pdf.js` es justamente lo que
  pide el brief), pero significa que el aspecto visual real de la app (tipografías Bricolage/Public
  Sans/DM Mono) no se pudo comprobar en las capturas: se ven con la tipografía por defecto del sistema.

---

## 4 · Veredicto

**No lo dejaría publicado tal como está.** El hallazgo F1 es bloqueante: descarta en silencio, sin ninguna
señal a la persona, exactamente el escenario que el propio equipo de diseño identificó como el más frecuente
del flujo VAL-42 (tarjeta de embarque sin texto legible de aerolínea/ruta, sólo asiento/hora/fecha). Alguien
sube la foto de su tarjeta de embarque, la app le dice "no encontré nada acá", y en realidad el motor tenía
lo necesario para preguntar cuál de sus vuelos completar. Es un corte entre `sanitizeReservation` (que exige
título o proveedor para no descartar la reserva) y la lógica de matching de vuelos (que no necesita ninguno
de los dos): conviene revisar si el sanitizador debería exceptuar de ese filtro a las reservas de tipo
`"flight"` cuando traen fecha, o algún otro campo identificable (número de vuelo, asiento, hora de embarque).

F2 y F3 son importantes pero no bloqueantes: no pierden datos ni los corrompen, sólo se apartan de promesas
explícitas de diseño/producto ("todo o nada" al cancelar; "nada se guarda sin revisar" para el campo
proveedor). Se pueden dejar para una vuelta rápida sin frenar la iteración, pero valdría la pena que quien
las herede confirme si son aceptables como están o si ameritan un ajuste antes de la próxima entrega.

El resto — VAL-40 (salvo lo no verificable por el bloqueo de `pdf.js`), VAL-41 completo, y VAL-42 en su
camino feliz (CP-10 a CP-16) — funciona como lo describen el brief y el diseño, incluida la regresión de las
ocho funciones existentes.
