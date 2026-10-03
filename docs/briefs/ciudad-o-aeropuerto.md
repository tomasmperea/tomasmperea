# VAL-87 — escribís la ciudad, la app pone el código

Brief de trabajo. Lo que está acá se construye; lo que no está acá, no.

**P0**, por orden del PM el 02/10: va inmediatamente después de VAL-85.

---

## El pedido, textual

> *"traducir automáticamente la ciudad a su código IATA o viceversa en todo caso; que la UI no pida código
> IATA sino que como cualquier buscador de vuelos que existe hoy en el mercado, cuando vos empezás a escribir
> la ciudad, el motor de búsqueda te sugiere los aeropuertos que hacen match con la búsqueda; eso es UX pura"*

Y sobre el muestrario, también textual:

> *"está bien que Ezeiza en realidad sea ministro pistarini porque se llama así en realidad el aeropuerto;
> eso es justamente lo que necesito; que la búsqueda ejemplo: buenos aires me devuelva coincidencias como
> ministro pistarini o jorge newbery"*

**Sobre el número.** El muestrario se commiteó como "VAL-66" (`f2adcf3`, `25f7c01`) y fue un error mío de
rótulo. VAL-66 en el backlog es *que el motor sepa de verdad del destino*: documentación, visas y estación.
Esta historia es la pieza que VAL-66 y VAL-79 necesitan —saber que BRC es Bariloche—, pero no es ninguna de
las dos.

---

## Decisiones del PM, 02/10

| | Decisión |
|---|---|
| De dónde salen los aeropuertos | **Opción C: dos bases combinadas** (detalle abajo) |
| Origen y destino | **Uno debajo del otro**, no lado a lado |
| La ciudad debajo del código en la etiqueta del viaje | **Entra en esta historia** |
| La segunda línea de cada opción | **El nombre oficial del aeropuerto**, no el apodo |

### El dato (opción C)

Ya está construido en `app/parts/aeropuertos-dato.js`. **No se rehace.**

- **OurAirports**, dominio público, al día: qué aeropuertos hay —los que tienen código IATA y vuelos
  regulares, sin helipuertos ni bases de hidroaviones—, su nombre oficial, su país y sus palabras clave.
  4.008 aeropuertos.
- **OpenFlights**, licencia ODbL: la ciudad a la que sirve cada aeropuerto (OurAirports dice "Zaventem" para
  Bruselas) y la cantidad de rutas, que ordena la lista.
- Alias a mano: unas 90 ciudades en español y una docena de apodos de aeropuerto.

Lo que el PM aceptó al elegir C, y que no es un defecto:

- **La app pesa unos 180 KB más.** Medido al integrar: de 666 KB a 848 KB. Antes de integrar este brief decía
  "unos 160 KB": era una estimación, y la auditoría la midió.
- **"Acerca de" lleva una línea con la fuente.** La ODbL lo exige.
- **El dato no se actualiza solo.** Un aeropuerto que abre después no aparece hasta regenerarlo; mientras
  tanto, el código de tres letras se puede escribir igual.
- **Las ciudades que no tienen alias se ven en inglés** ("Umea").

---

## Lo que entra

### 1 · El campo de origen y destino del vuelo

En **las dos pantallas** donde hoy se escribe el código:

- el formulario manual de la reserva (`type==="flight"`, hoy `i_from` / `i_to`);
- la revisión de lo importado (hoy `data-f="from"` / `data-f="to"`).

Las dos usan **el mismo componente**. Si una se arregla y la otra no, es la historia del 17/09 otra vez: el
PM reportó por dos gestos y el arreglo cubrió uno.

| | Hoy | Con VAL-87 |
|---|---|---|
| Rótulo | "Origen (IATA)" | "Origen" |
| Placeholder | "EZE" | "Ciudad o aeropuerto" |
| Letra | DM Mono, mayúsculas forzadas | Public Sans, como se escribe |
| Disposición | lado a lado (`.f2`) | uno debajo del otro |

**Mientras se escribe** (desde 2 caracteres): hasta 5 opciones debajo del campo, y **empujan** el formulario
hacia abajo, no flotan. La versión flotante del muestrario salió recortada: `.sheet-bd` tiene scroll propio
y recorta lo que sale de él.

Cada opción dice ciudad, nombre oficial del aeropuerto, país y código. Lo que coincide con lo escrito va en
el acento.

**Al tocar una opción**: el campo muestra la ciudad, con el código como sello a la derecha. **Se guarda el
código.**

**Al salir del campo sin tocar ninguna**, se mira lo que quedó escrito:

| Lo que quedó | Qué se guarda | Qué se ve |
|---|---|---|
| Las tres letras de un código del dato ("eze") | ese código, en mayúsculas | la ciudad y el sello, como si se hubiera elegido |
| Tres letras que el dato no tiene ("toj") | en mayúsculas, como código | el código, el sello y la línea *"TOJ no está en mi lista de aeropuertos. Lo guardo como código igual."* |
| Cualquier otra cosa ("Villa La Angostura") | tal cual se escribió, sin mayúsculas forzadas | el texto y el aviso de VAL-80 con el texto nuevo (punto 4) |
| Nada | nada | el campo vacío, como hoy |

**Si se edita después de elegir**, se pierde la elección: se va el sello y se vuelve a la tabla de arriba.
Un campo que dice "Bariloch" no puede seguir guardando BRC en silencio.

**Una reserva que ya existe** abre como corresponde a lo que tiene guardado. Un código del dato abre con la
ciudad y el sello. Un texto ("SUECIA", de antes de VAL-80) abre con el texto y el aviso, y se corrige
buscando y eligiendo.

### 2 · El sentido inverso: la etiqueta del viaje

Debajo de cada código de la ruta (`.route`), la ciudad. Es el caso 9 del muestrario.

Un código que el dato no tiene **no inventa una ciudad**. Ese renglón queda vacío y se ve el código solo,
como hoy.

### 3 · "Acerca de"

Una línea con la fuente del dato: *"Datos de aeropuertos: OurAirports y OpenFlights (ODbL)."*

### 4 · El texto del aviso de VAL-80

Hoy dice *"y todavía no sé traducir el nombre de una ciudad"*. **Con esta historia eso pasa a ser falso**, y
una afirmación falsa en pantalla es un bloqueante. El texto nuevo dice qué pasó y qué hacer: que lo escrito
no es un aeropuerto de la lista, que se guarda como pista, y que para fijar el destino hay que elegir una
opción.

La **lógica** de VAL-80 no se toca: un `to` que no es un código sigue siendo pista. Sólo cambia el texto.

---

## Lo que NO entra

Cada cosa de esta lista es otra historia. Si alguna resulta necesaria para que esta funcione, se frena y se
le pregunta al PM antes de construirla.

- **El motor de la valija.** No recibe ciudades nuevas ni nombres de aeropuerto. Sigue leyendo códigos, como
  hoy. Que la valija razone mejor sobre el destino es VAL-66. Que compare el vuelo con el destino escrito es
  VAL-79. Las dos van a usar `porCodigo`, pero no en esta entrega.
- **El prompt de importación.** Sigue pidiéndole al modelo el código IATA. La revisión ya lo traduce para
  mostrarlo.
- **El traslado.** "Desde" y "Hasta" siguen siendo texto libre: ahí van direcciones, no aeropuertos.
- **El talón de la tarjeta de embarque** ("RUTA EZE → BRC"). No se cambia.
- **El orden por cercanía.** "bari" muestra Bari (Italia) antes que Bariloche, porque tiene más rutas. Que el
  orden sepa desde dónde viaja la persona es otra historia.
- **"nueva york" no trae Newark.** Su palabra clave está en inglés ("New York City"); con "new york" sí sale.
  Se anota, no se parcha.
- **Aeropuertos sin vuelos regulares** (TOJ). No están en la lista y se resuelven con la fila del cuadro de
  arriba, no agregándolos.

---

## Criterios de aceptación

Cada uno se prueba **con el gesto**: escribir con el teclado en el campo y tocar la opción. No vale
disparar el evento a mano ni setear el valor del campo.

1. En el formulario manual, escribir `bari` en Destino muestra Bariloche (BRC) entre las opciones. Tocarla
   deja "Bariloche" con el sello BRC, y al guardar la reserva queda `to: "BRC"`.
2. **Lo mismo en la revisión de lo importado**, con su propio gesto y su propia prueba.
3. `buenos aires` devuelve EZE "Ezeiza - Ministro Pistarini" y AEP "Aeroparque Jorge Newbery". `ezeiza`,
   `aeroparque` y `pistarini` encuentran cada uno el suyo.
4. `cordoba` y `Córdoba` devuelven lo mismo.
5. Las cuatro filas del cuadro "al salir sin tocar ninguna" se cumplen, cada una con una prueba propia.
6. Elegir y después editar el texto quita el sello, y lo guardado deja de ser el código elegido.
7. Una reserva guardada con `to: "MAD"` abre mostrando Madrid y el sello MAD. Una guardada con
   `to: "SUECIA"` abre mostrando SUECIA y el aviso.
8. En la revisión de lo importado, un vuelo que el modelo devolvió con `MAD` se ve como Madrid con el sello.
9. La etiqueta del viaje muestra la ciudad debajo de cada código. Un código fuera del dato muestra sólo el
   código.
10. Origen y destino van uno debajo del otro en las dos pantallas.
11. "Acerca de" lleva la línea de la fuente.
12. El aviso de VAL-80 ya no dice que la app no sabe traducir ciudades.
13. Funciona sin conexión: el dato va adentro de `valija.html` y no hay ningún `fetch` para buscarlo.
14. Se ve igual de bien en tema claro y oscuro, a 390 px de ancho. Cada opción tiene foco visible y un área
    táctil de al menos 44 px.

### Regresiones que tienen que seguir en verde

- `val80-el-codigo-del-vuelo.js`: la guarda del motor no cambia.
- Todo lo que hoy carga un vuelo a mano o importado.
- `las-dos-copias.js`, extendido. El dato y el motor de aeropuertos quedan **en dos lugares**
  (`app/parts/` y `valija.html`), igual que el motor de la valija, y el mismo arnés tiene que comprobar que
  son idénticos. **Una regla que se puede volver aserción, se vuelve aserción.**

### Fixtures

Un vuelo tiene origen, destino, **sale** y **llega**, y las fechas son `datetime-local`. Lo que cambia con
esta historia es que **`to` puede venir de cuatro formas**, y tiene que haber un caso de cada una:

| Forma | Ejemplo |
|---|---|
| Código del dato | `BRC` |
| Código fuera del dato | `TOJ` |
| Texto | `Villa La Angostura`, y `SUECIA` (de antes de VAL-80) |
| Vacío | `""` |

---

## Cómo se entrega

- Es un **candidato** cuando cumple los criterios en Chromium a 390 px y pasa la auditoría con 70 o más, con
  la brecha declarada: el teclado y el scroll del teléfono no se pueden probar acá.
- Está **terminado** con 85 y la prueba del PM en su teléfono.
- Va en la versión que siga a la de VAL-85.

**El guion del PM tiene que incluir escribir con el teclado del teléfono abierto.** Es lo único que acá no
se puede ver: si la lista queda tapada por el teclado, si el scroll la alcanza, y si el corrector
automático del teclado cambia lo escrito.

---

## Material

| Qué | Dónde |
|---|---|
| Muestrario (diez casos, cada lista sale del motor real) | `app/parts/aeropuerto-ui.html` |
| Dato | `app/parts/aeropuertos-dato.js` |
| Motor (`buscar`, `porCodigo`) | `app/parts/aeropuertos-motor.js` |
| CSS nuevo | bloque C del muestrario. El bloque D es andamiaje y no se copia. |
| Render de las opciones | bloque E del muestrario (`apListaHtml`, `marcar`). Son funciones puras. |
