# Valija inteligente — especificación de diseño

**Épica:** VAL-30 · **Escribe:** diseño UX/UI · **Estado:** listo para integración

Este documento describe el diseño que ya existe en `app/parts/packing-ui.html` (muestrario de componentes,
catorce estados). No propone un diseño nuevo: documenta las decisiones que ese archivo ya toma, para que
integración pueda incorporarlas a `app/valija.html` sin tener que interpretarlas de nuevo.

El motor de datos que alimenta esta interfaz es `app/parts/packing-engine.js`. Cada estado de este documento
indica con qué función y qué campo del motor se arma.

---

## 0 · Para quién es esto

**Qué tiene que poder hacer:** decidir qué tipo de viaje es, ver una lista concreta y agrupada, ir tildando
lo que guarda, sacar lo que no le sirve, agregar lo suyo, y confiar en que la próxima vez la lista va a venir
mejor sin tener que configurar nada.

**En qué momento y estado llega:** la noche anterior, o en el colectivo camino al aeropuerto. Apurada,
con una mano libre, en la cama o en la calle. No es el momento de leer, es el momento de tildar rápido y
tomar dos o tres decisiones puntuales (qué tipo de viaje es, si esa campera entra o no).

**El camino más corto:** de la pantalla del viaje a la lista tildable hay un solo toque. De la lista al
detalle de por qué un ítem está ahí, otro toque, opcional. Nunca hace falta entender el motor para usar la
lista: la explicación está siempre un nivel más abajo de lo que hace falta ver primero.

---

## 1 · El flujo, de punta a punta

```
Pantalla del viaje (Itinerario / Pendientes)
   │
   ├─ Tira "Valija" (estado 00, cuatro variantes según cómo viene el viaje)
   │     │
   │     ├─ Sin fechas en el viaje ──────────────► 03 · pantalla bloqueada, pide cargar fechas
   │     │                                              └─ vuelve a la ficha del viaje a cargarlas
   │     │
   │     ├─ Con fechas, sin lista generada ──────► 01 · elegís el tipo de viaje (con historial)
   │     │        └─ elegís otro tipo distinto al propuesto ─► 02 · aviso del costo, sin bloquear
   │     │        └─ tocás "Armar la lista" ─────► 04 · la base aparece ya, el ajuste por destino
   │     │                                                carga encima (o no: ver abajo)
   │     │                    ├─ ajuste OK ───────► 07 · aviso de qué se agregó, ítems marcados
   │     │                    └─ ajuste falla/no disponible ► 08 · aviso franco, lista base entera
   │     │
   │     └─ Con lista generada ──────────────────► 06 · la lista viva (05 documenta sus tres estados)
   │              │
   │              ├─ tocás una fila ─────────────► 11 · hoja de detalle del ítem (estado, cantidad, origen)
   │              ├─ tocás la "i" del encabezado ─► 12 · hoja de transparencia (de dónde sale todo)
   │              ├─ sin pendientes ──────────────► 09 · "valija lista", categorías plegadas
   │              └─ sos sólo lectura ────────────► 10 · misma lista, sin controles de edición
   │
   └─ (VAL-34) alguien más carga en el viaje ─────► 13 · ítems del grupo, con quién los empacó
```

Ningún estado es un callejón sin salida: desde cualquier pantalla de la valija se vuelve al viaje con el
botón de atrás del encabezado, que es el mismo `.iconbtn` con la flecha que ya usa el resto de la app.

---

## 2 · Los catorce estados

Numeración y títulos, tal como están en el muestrario.

### 00 · Ubicación — La entrada, en la pantalla del viaje
**Cuándo aparece:** siempre que se está viendo un viaje, arriba del segmentado Itinerario/Pendientes.
**Qué muestra:** una tira `.vj-entry` de ancho completo, con una banda de color a la izquierda (4px) y una
flecha a la derecha. Cuatro variantes, según el estado del viaje:

| Variante | Banda | Título | Cuerpo |
|---|---|---|---|
| Por defecto | gris (`--ink-3`) | "Valija" | "Armá la lista de lo que llevás" |
| `due` (viaje cerca, sin lista) | ámbar (`--flap`) | "Valija" + chip `soon` "salís en 2 días" | "Todavía no armaste la lista" |
| `live` (lista en curso) | azul de acento (`--accent`) | "Valija" | barra de progreso: "**12** de 32 · faltan 18" |
| `done` (sin pendientes) | verde (`--ok`) | "Valija lista" | barra llena: "**29** de 32 · 3 descartados" |

Debajo sigue el segmentado de siempre, sin cambios.

### 01 · Estado vacío — Sin lista generada
**Cuándo aparece:** el viaje tiene fechas pero todavía no se generó una lista (`buildPackingList` no
corrió, o no hay documento `trips/{tripId}/packing/lista`).
**Qué muestra:** los chips de contexto (`MAD` · `12 – 18 oct` · `6 días` · `2 personas`), un bloque de
estado vacío explicando qué va a hacer la app, el selector de tipo de viaje de 6 opciones en grilla de 3×2
(cada botón con ícono, nombre y la cantidad de viajes de ese tipo: "2 viajes", "5 viajes", "—" si no hay
ninguno), una leyenda debajo del selector que explica la propuesta, y el botón primario "Armar la lista".

### 02 · Consistencia del tipo — Cuando elegís otro tipo
**Cuándo aparece:** dentro del mismo selector del estado 01, en el momento en que se toca un tipo distinto
al propuesto por la app.
**Qué muestra:** el mismo selector con la nueva selección marcada, y un `.notice.warn` que compara el
historial del tipo elegido contra el tipo propuesto, con un botón de acción para volver al propuesto sin
perder el tacto ("Usar Ciudad"). Nada se bloquea: se puede seguir con el tipo elegido.

### 03 · Estado vacío bloqueado — El viaje no tiene fechas
**Cuándo aparece:** el viaje no tiene `startDate`/`endDate` cargadas. Las cantidades del motor dependen de
los días (`ctx.days`), así que sin fechas no hay una lista real que mostrar.
**Qué muestra:** un bloque de estado vacío que explica por qué hace falta la fecha, y un único botón
primario "Cargar las fechas" que lleva a editar el viaje. No hay selector de tipo ni botón de generar: no se
ofrece un camino que termine en una lista de mentira.

### 04 · Generando — La lista base ya está; el ajuste por destino llega después
**Cuándo aparece:** justo después de tocar "Armar la lista", mientras `enrichWithDestination` está en
vuelo.
**Qué muestra:** el progreso ya arrancado en 0 de N (la barra existe desde el primer instante), un
`.notice` con spinner ("Buscando lo específico de Madrid en octubre…"), las categorías de la capa 1 ya
completas y tildables (Documentación con sus ítems reales), y al final una categoría "Específicos de Madrid"
con filas esqueleto (`.pk-row.loading`, shimmer) en lugar de contenido. Nunca hay una pantalla en blanco:
lo que ya se puede usar, se usa ya.

### 05 · Los tres estados — Pendiente, empacado, descartado
**Cuándo aparece:** es una lámina de referencia dentro del muestrario, no una pantalla real de la app; se
incluye para dejar explícitos los tres estados de una fila uno al lado del otro, más una fila a mitad de
gesto de deslizar.
**Qué muestra:** cuatro filas de la categoría Ropa. "Remeras ×7" pendiente (cuadrado vacío, fila a
contraste pleno). "Campera liviana" empacada (cuadrado lleno verde con tilde, nombre tachado). "Camisa de
vestir" descartada (cuadrado punteado con raya, fila compacta de una línea, sin motivo, con botón "volver").
"Buzo" a mitad de un deslizamiento hacia la izquierda, con el panel "Descartar" asomando detrás. Cierra con
un `.notice` que explica los dos gestos (deslizar y tocar) y que ambos objetivos táctiles miden 44px.

### 06 · Con datos, interactivo — La lista
**Cuándo aparece:** hay una lista generada con al menos un ítem. Es la pantalla principal de la feature.
**Qué muestra:** encabezado con el progreso (`pk-prog` en el `hdr-sub`), categorías `pk-cat` plegables cada
una con su ícono, nombre, contador "d de total" o el chip "listo" si no queda nada pendiente, filas de ítem
dentro, un pie "Agregar a [categoría]" en cada una, y un FAB "Agregar ítem". Es el único estado interactivo
del muestrario: tocar el cuadrado marca, tocar el círculo de la derecha descarta, deslizar hace lo mismo con
menos precisión requerida, tocar el texto abre el detalle (estado 11), y una categoría sin pendientes se
pliega sola (pero se puede reabrir a mano, y ese estado manual se respeta hasta que vuelve a cambiar algo
adentro).

### 07 · Ajuste por destino, resuelto — Llegó lo específico del lugar
**Cuándo aparece:** `enrichWithDestination` devolvió `capaInteligente.estado === "ok"` con ítems nuevos.
**Qué muestra:** un `.notice.ok` cerrable ("Agregué 4 cosas por Madrid en octubre. Ver cuáles"), y la
categoría "Específicos de Madrid" con las filas nuevas marcadas con la clase `.fresh` (una animación de 2.6s
que las tiñe de ámbar suave y se disuelve, para que se vea que llegaron sin sorprender ni desplazar el
dedo). Cada una lleva el chip `soon` "por Madrid" y su motivo.

### 08 · Degradado — Sin la capa de ajuste por destino
**Cuándo aparece:** `capaInteligente.estado` es `"no-disponible"` o `"error"`. La capa de reglas (capa 1)
generó igual y es usable.
**Qué muestra:** el chip "sin ajuste por destino" al lado del progreso, y un `.notice.warn` que **no se
puede cerrar** (a diferencia del aviso ok del estado 07): "Armé la lista con las reglas de siempre. No pude
ajustarla a Madrid en octubre, así que puede faltarte algo del lugar. Probar de nuevo". No pide disculpas,
dice la consecuencia concreta y ofrece reintentar.

### 09 · Completa — Valija lista
**Cuándo aparece:** `pendientes === 0` (todo lo vivo está empacado o descartado).
**Qué muestra:** un `.notice.ok` de cierre ("Valija lista. Los 3 que descartaste ya quedaron anotados para
tu próximo viaje de ciudad."), la barra de progreso llena con sus dos tramos (verde para empacado, gris para
descartado), y las categorías completas plegadas mostrando el chip "listo" en vez del contador. Sólo queda
abierta la categoría que tiene algo descartado, porque ahí sigue habiendo algo que mirar (el botón "volver").

### 10 · Sólo lectura — Quien mira sin permiso de edición
**Cuándo aparece:** `Store.canWrite === false` para este viaje (el mismo flag que ya usa el resto de la
app para deshabilitar altas y bajas de reservas).
**Qué muestra:** la lista entera, con su progreso real, chip "sólo lectura" junto al progreso, y un
`.notice` neutro que explica la limitación. Lo que cambia respecto al estado 06: no están los botones de
marcar ni de descartar, no está el pie de "agregar", no está el FAB. No es que estén deshabilitados: no
están en el HTML. Nada invita a tocar algo que no va a responder.

### 11 · Hoja — Detalle del ítem
**Cuándo aparece:** se toca el texto de cualquier fila de la lista (estados 06, 08, 09, 10 en su variante
de sólo lectura sin este acceso interactivo, ya que ahí `pk-txt` tiene `cursor:default`).
**Qué muestra:** una `.sheet` con el nombre del ítem en el título, los tres estados como botones explícitos
(`pk-states`, con `aria-pressed`), el stepper de cantidad si el ítem tiene una, y la sección "De dónde sale"
con el chip de origen y la explicación completa. Es el camino accesible al descarte para quien no puede o no
sabe deslizar: teclado, lector de pantalla, o simplemente preferir tocar.

### 12 · Hoja — Transparencia, de dónde sale esta lista
**Cuándo aparece:** se toca el ícono de información (i) en el encabezado de la lista.
**Qué muestra:** los cuatro chips de contexto que usó el motor, la leyenda de qué significa cada chip de
origen (lista base / tus viajes / por Madrid / lo pusiste vos), una nota sobre cómo el descarte alimenta el
aprendizaje, y la declaración de que no hay nada comercial en la lista. El pie tiene dos acciones: "Cambiar
el tipo" y "Rehacer la lista".

### 13 · Compartida (VAL-34, P1) — Ítems del grupo
**Cuándo aparece:** el viaje tiene más de una persona con acceso y la lista tiene ítems marcados como del
grupo.
**Qué muestra:** una fila con el chip `accent` "del grupo" que, en vez de mostrar el motivo del ítem,
muestra quién lo empacó ("Lo empacó Ana"). Las demás filas de la misma categoría son personales, con su
origen normal (`lista base`). No hay una lista separada por persona: es la misma lista, con esa única
distinción visual en la línea de motivo.

---

## 3 · Decisiones de diseño y su porqué

### 3.1 La valija es una tira, no una tercera pestaña

El segmentado de la pantalla del viaje tiene hoy dos posiciones: Itinerario y Pendientes. La valija **no es
una tercera**. Vive en una tira aparte, arriba del segmentado, con cuatro variantes de estado (00).

**Por qué.** El segmentado alterna entre dos vistas de lo mismo: las reservas del viaje, miradas por fecha o
miradas por lo que falta completar. La valija no es una vista de las reservas, es una cosa distinta que
cuelga del viaje igual que ellas (así lo modela el motor: `trips/{tripId}/packing/lista`, hermano de
`trips/{tripId}/items`). Meterla como tercera pestaña la subordina a las reservas y la esconde detrás de un
toque adicional exactamente en el momento en que más se la necesita: la noche antes de viajar, es lo primero
que se quiere ver, no lo tercero.

La tira, en cambio, siempre está visible al entrar al viaje, cambia de color según el momento (gris cuando
no se generó, ámbar cuando el viaje está cerca y no hay lista, azul mientras se está armando, verde cuando
no queda nada pendiente), y funciona como un semáforo de una sola mirada sin necesitar texto largo.

**Qué se descartó:**
- **Tercera pestaña en el segmentado.** Además de subordinarla, un segmentado de tres no cabe cómodo en
  460px con etiquetas legibles, y la pestaña de Pendientes ya usa un contador (`.count`) que tendría que
  convivir con el de la valija generando ruido visual.
- **Icono suelto en el encabezado**, al lado de editar y compartir. Se descartó porque un ícono sin texto no
  puede comunicar las cuatro variantes de estado (no generada / por vencer / en curso / lista); se necesitaba
  espacio para al menos un título y una línea de estado.
- **Modal o hoja emergente** en vez de pantalla propia. Se descartó porque la lista puede tener 30 a 50
  ítems y usarse con las dos manos ocupadas cargando cosas: necesita el alto completo de la pantalla, no una
  hoja que compite con el resto del contenido del viaje detrás.

### 3.2 El selector de tipo de viaje muestra el historial y avisa el costo de romperlo

En el estado 01, cada uno de los seis tipos de viaje muestra cuántos viajes anteriores de la persona son de
ese tipo ("Playa · 2 viajes", "Ciudad · 5 viajes", "Montaña · —"). Si se elige un tipo con poco o ningún
historial habiendo uno con más historial y buen parecido al viaje actual, aparece un aviso que no bloquea
pero ofrece volver (estado 02).

**Por qué, la cadena completa.** El aprendizaje de VAL-32 (`learnFromHistory` en el motor) agrupa por tipo de
viaje: sólo mira listas de viajes anteriores cuyo `tipoViaje` coincide con el de la lista que se está
armando (`normalizeTripType(list.tipoViaje) !== tipo` descarta el resto). Promueve un ítem agregado a mano
cuando aparece en al menos `HISTORY_PROMOTE_AT` (2) viajes del mismo tipo, y suprime uno descartado dos
veces bajo la misma condición.

Si la misma clase de escapada de fin de semana se etiqueta "ciudad" una vez y "mixto" la vez siguiente, cada
tipo queda con una sola aparición. El umbral de dos nunca se cumple, en ningún tipo, para siempre: no es que
el aprendizaje tarde más, es que no arranca nunca. La causa no es un error del motor, es una elección de
etiqueta libre en cada viaje que fragmenta la muestra sin que la persona se dé cuenta de que lo está
haciendo.

La única defensa posible está en el momento de elegir el tipo, porque es el único lugar donde la persona
puede ver el costo antes de pagarlo. Por eso el número de viajes por tipo va al lado de cada botón (visible
sin tocar nada), y por eso el aviso del estado 02 no dice "elegiste mal": dice cuánto tiene acumulado el tipo
elegido contra cuánto tiene el tipo que más se parece a este viaje, y ofrece el atajo de vuelta con un solo
toque ("Usar Ciudad"). Nunca se bloquea la elección distinta, porque a veces es la correcta (un viaje de
playa real no debería forzarse a "ciudad" sólo porque ciudad tiene más historial); lo que se evita es que se
elija distinto **sin saber** que eso vacía el aprendizaje.

**Qué se descartó:** bloquear la elección de un tipo con poco historial, o esconder el número de viajes
hasta que se tocara el tipo. Los dos generaban más fricción de la que ahorran: la persona conoce mejor que la
app si el viaje es de un tipo o de otro, la app sólo puede avisar el costo de la inconsistencia, no decidir
por ella.

### 3.3 Un ítem tiene tres estados, y el descarte cuenta como progreso resuelto

Cada ítem vive en `pendiente`, `empacado` o `descartado` (`ESTADO` en el motor), nunca en un booleano. La
barra de progreso (`.pk-prog`) tiene dos tramos: uno verde para lo empacado y uno gris para lo descartado.
Los dos avanzan la barra. El contador dice "**29** de 32 · 3 descartados", nunca resta lo descartado del
total como si siguiera siendo trabajo por hacer.

**Por qué, la cadena completa.** El brief es explícito: "descartar es información valiosa y se guarda,
porque es lo que alimenta el aprendizaje" (VAL-32 depende enteramente de que la persona use el descarte, no
sólo el tildado). Si la barra de progreso tratara un ítem descartado como si siguiera pendiente, descartar
dejaría de mover la aguja: la persona vería "12 de 32" antes de descartar y "12 de 29" después, sin
sensación de haber avanzado nada, con el molesto efecto extra de que el total baja bajo el pulgar mientras se
usa la app. La consecuencia práctica es que la persona deja de descartar y empieza a ignorar lo que no
piensa llevar (o, peor, lo marca como "empacado" para que la barra avance, ensuciando el dato). En cualquiera
de los dos casos se pierde exactamente el insumo que el aprendizaje necesita para dejar de sugerir ese ítem
la próxima vez.

Por eso el diseño trata el descarte como una decisión tomada, no como una tarea pendiente: la fila descartada
se achica a una línea sin motivo (ya no hay nada que decidir ahí), la categoría se pliega si no le queda
nada pendiente aunque tenga descartados sin resolver, y la barra le da al descarte su propio tramo de color
en vez de restarlo. El costo de descartar tiene que sentirse igual de "resuelto" que el de empacar, porque
las dos acciones alimentan al motor por igual y la interfaz no puede premiar una y castigar la otra.

**Qué se descartó:**
- **Booleano empacado/no empacado**, sin descarte. Es la alternativa más simple pero colapsa "todavía no lo
  toqué" con "decidí que no va", que son cosas completamente distintas para el aprendizaje: la primera no
  dice nada, la segunda es la señal que hace que un ítem deje de aparecer.
- **El descarte no cuenta para el progreso** (la barra sólo mide empacado / total, y lo descartado queda
  fuera del cálculo pero visible en la lista). Se descartó porque deja la barra estancada mientras la persona
  sigue tomando decisiones reales, dando la sensación de que descartar no "cuenta" como trabajo hecho.
- **Borrar el ítem al descartarlo**, en vez de dejarlo en un estado visible con un "volver". Se descartó
  porque el motor necesita que el ítem exista con `estado:"descartado"` para que `mergeLists` no lo resucite
  al regenerar la lista y para que `learnFromHistory` lo pueda contar; borrarlo del documento sería borrar el
  dato que alimenta el aprendizaje.

### 3.4 Otras decisiones, más chicas pero no menores

- **Los tres estados se distinguen por forma, no sólo por color** (cuadrado vacío de borde entero / cuadrado
  lleno con tilde / cuadrado de borde punteado con raya). Es una decisión de accesibilidad: alguien con baja
  visión al color tiene que poder leer el estado igual.
- **Marcar y descartar son dos objetivos de 44px cada uno**, en los dos extremos de la fila, y el gesto de
  deslizar hace lo mismo sin necesitar puntería. El brief pide que descartar sea tan fácil como marcar
  ("Cada ítem sugerido se puede descartar"); si descartar pidiera más precisión que marcar, en la práctica se
  usaría menos, y el dato de descarte es justamente el que más le falta al aprendizaje al principio.
- **El motor híbrido se ve en la pantalla, no se esconde detrás de un spinner de pantalla completa**
  (estado 04). Es la traducción visual directa de "la lista base igual se genera y sirve": la persona puede
  empezar a tildar Documentación mientras el ajuste por destino todavía está en camino.
- **El aviso de "sin ajuste por destino" (08) no se puede cerrar**; el de "ajuste por destino resuelto" (07)
  sí. Uno es una advertencia sobre el contenido de la lista (puede faltar algo, sigue siendo relevante
  mientras se usa la lista) y el otro es una confirmación de un evento que ya pasó (deja de ser relevante en
  cuanto se leyó).
- **El modo de sólo lectura quita los controles del HTML, no los deshabilita.** Un botón deshabilitado sigue
  pareciendo un botón e invita a tocarlo para entender por qué no responde. Sacarlo directamente es más
  honesto con lo que se puede hacer ahí.
- **Los ítems nuevos del ajuste por destino se marcan con una animación de 2.6s que se disuelve sola**
  (`.fresh`), no con un badge permanente "nuevo". Es una sola vez, para que se vea la llegada; después el
  chip `soon` "por Madrid" ya deja constancia de su origen sin necesidad de recordar que llegó tarde.
- **Un ítem del grupo (13) no duplica la fila por persona.** Se pensó una lista separada por viajero y se
  descartó: el brief la deja fuera de alcance ("Listas por persona dentro del mismo viaje, más allá de la
  distinción de VAL-34") y además una sola valija compartida (un botiquín, un enchufe adaptador) es
  justamente el caso de uso real; la única información que hace falta agregar es quién la resolvió.

---

## 4 · Texto exacto de la interfaz

Todo en español rioplatense, voseo. Reproducido tal como está en `packing-ui.html`.

**Tira de entrada (00)**
- "Valija" / "Armá la lista de lo que llevás"
- "Valija" + chip "salís en 2 días" / "Todavía no armaste la lista"
- "Valija" / "**12** de 32 · faltan 18"
- "Valija lista" / "**29** de 32 · 3 descartados"

**Estado vacío (01)**
- "Todavía no armaste la valija"
- "Te propongo qué llevar según el destino, las fechas, los días que te quedás y lo que llevaste en viajes
  parecidos. Todo lo que sugiera lo podés sacar."
- Etiqueta del campo: "Tipo de viaje"
- Leyenda: "Te propongo **Ciudad**: es el que usaste en Barcelona y en Lisboa, que se parecen a este. Sobre
  esos 5 viajes ya sé qué llevás."
- Botón: "Armar la lista"

**Consistencia del tipo (02)**
- "Con **Mixto** arranco casi de cero: tenés 1 viaje mixto. En **Ciudad** ya tengo 5, y Madrid se parece
  bastante a Barcelona y a Lisboa." + botón "Usar Ciudad"

**Sin fechas (03)**
- "Necesito las fechas del viaje"
- "Las cantidades salen de los días que te quedás. Cargá la salida y el regreso y armo la lista."
- Botón: "Cargar las fechas"

**Generando (04)**
- "Buscando lo específico de Madrid en octubre…"

**Motivos de ítem, tal como aparecen en la lista de ejemplo:**
- "Vuelo internacional" (Pasaporte)
- "Segundo documento, por si perdés el pasaporte" (DNI)
- "6 días + 1 de repuesto" (Remeras, Ropa interior, Medias)
- "De noche baja a 11° en octubre" (Campera liviana)
- "Lo llevaste en 4 de tus 5 viajes de ciudad" (Buzo, Reserva del hotel impresa)
- "Las agregaste a mano en 3 viajes" (Tarjeta de débito y de crédito, Auriculares)
- "El centro de Madrid se recorre a pie" (Zapatillas de caminar)
- "Los agregaste a mano en 2 viajes de ciudad" (Zapatos para salir, Antiácido)
- "Madrid es seco: 45% de humedad en octubre" (Crema para labios)
- "España usa clavija redonda tipo F: la tuya no entra" (Adaptador de enchufe tipo F / Adaptador tipo F)
- "Días largos afuera, sin dónde enchufar" (Batería portátil)
- "Con la receta, por las dudas en migraciones" (Lo que tomás todos los días)
- "El metro no vende boletos sueltos: se carga en una tarjeta" (Tarjeta Multi del metro)
- "En octubre llueve unos 8 días del mes" (Paraguas plegable)
- "En los supermercados las bolsas se pagan aparte" (Bolsa de tela)
- "Hay fuentes de agua potable en toda la ciudad" (Botella recargable)
- "Viaje al exterior. Cuál va no lo sé sin el ajuste por destino" (Adaptador de enchufe ×2, en el estado
  degradado)

**Gestos (05)**
- "**Los gestos.** Deslizá una fila a la izquierda para descartarla y a la derecha para marcarla. Si
  preferís tocar, el cuadrado de la izquierda marca y el círculo de la derecha descarta: los dos son de
  44 px, ninguno pide puntería."
- Panel de deslizar: "Descartar"
- Botón de volver de un ítem descartado: "volver"
- Botón de agregar, al pie de cada categoría: "Agregar a [nombre de la categoría en minúscula]"

**Ajuste por destino resuelto (07)**
- "Agregué 4 cosas por Madrid en octubre." + botón "Ver cuáles"

**Degradado (08)**
- Chip: "sin ajuste por destino"
- "Armé la lista con las reglas de siempre. No pude ajustarla a Madrid en octubre, así que puede faltarte
  algo del lugar." + botón "Probar de nuevo"

**Completa (09)**
- "Valija lista. Los 3 que descartaste ya quedaron anotados para tu próximo viaje de ciudad."
- Chip de categoría completa: "listo"

**Sólo lectura (10)**
- Chip: "sólo lectura"
- "Estás viendo la valija de este viaje. Para marcar lo tuyo necesitás permiso de edición."

**Hoja de detalle (11)**
- Título: nombre del ítem, por ejemplo "Adaptador de enchufe tipo F"
- Etiqueta: "Estado" — opciones "Pendiente", "Empacado", "Descartado"
- Leyenda de estado: "Descartar no es lo mismo que dejarlo pendiente: me dice que este ítem no va. Si lo
  descartás en dos viajes de ciudad, dejo de sugerírtelo."
- Etiqueta: "Cuántos llevás", con botones "Uno menos" / "Uno más"
- Leyenda de cantidad: "Sugerí 2: uno por persona, así cargan los dos teléfonos a la vez."
- Etiqueta: "De dónde sale" — "Ajuste por destino: **Madrid, octubre**. España usa clavija redonda tipo F y
  la ficha de acá no entra. Sin esto no cargás nada."
- Pie: "Cancelar" / "Guardar"

**Hoja de transparencia (12)**
- Título: "De dónde sale esta lista"
- "Miro cuatro cosas de este viaje:" + chips "Ciudad" / "Madrid · octubre" / "6 días" / "5 viajes de ciudad
  anteriores"
- "Qué dice cada marca":
  - "lista base" — "Las reglas de siempre: documentación, electrónica y ropa por cantidad de días. Salen sin
    conexión."
  - "tus viajes" — "Lo que aprendí de vos. Si agregaste algo a mano en dos viajes del mismo tipo, la próxima
    ya te lo propongo."
  - "por Madrid" — "El ajuste por destino y época: clima, enchufes, costumbres del lugar. Es lo único que
    necesita conexión."
  - "lo pusiste vos" — "Lo que agregaste a mano en este viaje."
- "Lo que descartás también cuenta: si sacás lo mismo dos veces en viajes del mismo tipo, dejo de
  sugerírtelo."
- "Ningún ítem de esta lista tiene un negocio atrás. No hay links de compra ni marcas recomendadas, y no los
  va a haber."
- Pie: "Cambiar el tipo" / "Rehacer la lista"

**Compartida (13)**
- "Lo empacó Ana" (motivo de un ítem del grupo, en vez de la explicación habitual)
- Chip: "del grupo"

---

## 5 · Qué necesita `app/valija.html` para integrar esto

Esta sección es para el rol de integración. No se edita `valija.html` desde acá.

### 5.1 Motor
1. Incorporar el contenido de `app/parts/packing-engine.js` al `<script>` de `valija.html`. La convención
   del proyecto es un archivo único sin build (ver `CLAUDE.md`), así que no corresponde un `<script src=...>`
   a un archivo local: hay que pegar el módulo entero (es UMD, expone `PackingEngine` en el objeto global si
   no hay `module.exports`, así que también podría dejarse como IIFE propio antes del script principal; lo
   más simple es inlinearlo).
2. Conectar la capa de IA (VAL-33) con el mismo patrón que ya usa `sheetImport`: `claude.use("sample")` y
   `sample.json(prompt, opts)`. La función que pide el motor es `ask(prompt) -> objeto`, así que:
   ```js
   const sample = await claude.use("sample").catch(()=>null);
   const ask = sample ? (prompt) => sample.json(prompt, {modelTier:"complex"}) : null;
   ```
   Si `sample` es `null`, no pasar `ask` a `generatePackingList`: el motor ya contempla ese caso y devuelve
   la lista base con `capaInteligente.estado:"no-disponible"` (estado 08).

   **`"complex"` acá es a propósito y se revisó el 12/09/2026:** es el único lugar de la app donde hay
   razonamiento de verdad (cruzar una escala larga con un depto sin lavarropas). La importación desde texto
   sí bajó a `"default"`; esto no. Ver `docs/design/import-engine.md` § 4.9.

### 5.2 Store — persistencia de la lista
`packing-engine.js` documenta el modelo: un documento por viaje en `trips/{tripId}/packing/lista`, hermano
de `trips/{tripId}/items`. Hace falta agregar a `Store`:
- `Store.packing: new Map()` (tripId -> documento de lista), análogo a `Store.items`.
- `Store.watchPacking(tripId)`, análogo a `Store.watch(tripId)`: `onSnapshot` sobre
  `trips/{tripId}/packing/lista` si hay `db`, o lectura de `localStorage` si no.
- `Store.packingOf(tripId)` -> el documento o `null`.
- `Store.savePacking(tripId, list)` -> `db.doc(...).set(list)` completo (para generar/regenerar) y una
  variante de escritura parcial para marcar un solo ítem usando `PackingEngine.stateUpdatePatch(clave,
  estado)` con `db.doc(...).update(...)`, que es precisamente para lo que existe esa función: que dos
  personas marcando ítems distintos no se pisen.
- Persistencia local: sumar `packing` al objeto que ya arma `saveLocal()`/`loadLocal()` (hoy guarda `trips` e
  `items`; agregar `packing: {tripId: documento}`).

### 5.3 Ruteo — pantalla propia, no una pestaña
La valija no entra al `App.tab` (que hoy vale `"plan"` o `"todo"`). Se propone:
- Extender `App` con `view:"packing"` como tercer valor posible (hoy sólo `"home"`/`"trip"`), reusando
  `tripId`.
- Extender `readHash()` para reconocer `#/trip/{id}/valija` y setear `App.view="packing"`.
- En `render()`, agregar la rama `else if(App.view==="packing"){ renderPacking(trip); }`.
- El botón de "Volver" de las pantallas de valija hace `go(`#/trip/${trip.id}`)` (vuelve al viaje, no a
  home).
- Desde `renderTrip()`, la tira (estado 00) hace `go(`#/trip/${trip.id}/valija`)` al tocarla.

### 5.4 `renderTrip()` — dónde va la tira
En la función existente (línea ~881 de `valija.html`), agregar el render de la tira **entre** el bloque
`hdr-sub` que ya arma el encabezado y la construcción del `seg` (línea ~906), como parte del `$main.innerHTML`
antes del segmentado:
```js
$main.innerHTML = renderPackingEntry(trip, Store.packingOf(trip.id)) + seg + (App.tab==="plan" ? viewPlan(...) : viewTodo(...));
```
`renderPackingEntry(trip, list)` es una función nueva que decide cuál de las cuatro variantes de `.vj-entry`
mostrar:
- sin fechas o sin lista y el viaje está a más de un umbral de días (p. ej. `daysUntil >= 3` o `null`) →
  variante por defecto.
- sin lista y `daysUntil` bajo (p. ej. `< 3`, mismo criterio que ya usa `tripAlerts` para lo urgente) →
  variante `due`.
- con lista y `conteo.pendientes > 0` → variante `live`, con la barra calculada como se explica en 5.6.
- con lista y `conteo.pendientes === 0` → variante `done`.

### 5.5 Pantalla de la valija — `renderPacking(trip)`
Función nueva, misma forma que `renderTrip`: arma `$hdr` (con back, título "Valija", tag con destino y, si
ya hay tipo elegido, `· Tipo`, botón de información) y `$main` según el estado:
- sin `list` y sin fechas → estado 03.
- sin `list` y con fechas → estado 01 (con el selector de tipo; los conteos por tipo salen de recorrer
  `Store.tripList()` y contar cuántos tienen un documento de packing guardado con ese `tipoViaje`, sin
  incluir el viaje actual).
- generando (mientras la promesa de `generatePackingList` está en vuelo) → estado 04.
- con `list` y `capaInteligente.estado` en `"no-disponible"`/`"error"` → estado 08.
- con `list`, ajuste recién resuelto (se puede guardar un flag efímero en memoria, no en el documento, para
  mostrar el aviso 07 una sola vez tras generar) → estado 07 y después cae a 06.
- con `list` y `conteo.pendientes === 0` → estado 09.
- `!Store.canWrite` → variante de sólo lectura del mismo render (estado 10): se arma la misma función pero
  sin adjuntar los `onclick` de marcar/descartar/agregar, y sin el FAB.
- caso general con pendientes → estado 06.

El HTML de cada fila (`rowHtml` en el muestrario) se arma con `PackingEngine.groupByCategory(list)`, y el
`SRC` (chip de origen) se mapea de `origen` del motor a las clases del muestrario:
`regla→"lista base"`, `historial→"tus viajes"`, `destino→"por Madrid" (usar el destino real del viaje, no
"Madrid" fijo)`, `manual→"lo pusiste vos"`. Falta agregar un quinto caso para VAL-34: un ítem con
`compartido:true` (campo que hoy no existe en el modelo de datos del motor y habría que sumarlo) usa el
chip "del grupo" y su línea de motivo pasa a ser "Lo empacó {nombre}".

### 5.6 Cálculo de la barra de progreso (`pk-prog`)

El motor devuelve `conteo:{total, empacados, pendientes, descartados, resueltos, totalConDescartados, pct}`
donde `total` **excluye** los descartados, `resueltos = empacados` y `pct = empacados / total`, o 100 cuando
se descartó todo.

La barra es de un solo tramo, sobre lo que realmente queda por llevar:

```js
const pctPack = conteo.total ? conteo.empacados / conteo.total * 100 : 100;
// conteo.pct sirve tal cual para el porcentaje de avance
```

El texto de la interfaz muestra los números crudos: `empacados de total` y `faltan pendientes`, con los
descartados mencionados aparte.

**Por qué el descarte sale del total.** Es una corrección hecha con el producto en la mano, sobre una
decisión anterior de este mismo documento. La regla original sumaba el descartado al total, y el contador
quedaba trabado: descartabas algo y el "de 42" no bajaba nunca. Si alguien decidió que algo no va, dejó de
ser parte de su valija.

El motivo que había detrás de la regla anterior sigue cumpliéndose. Descartar tiene que hacer avanzar el
progreso, porque si no la persona deja de descartar y marca como empacado lo que no piensa llevar, y ahí se
pierden el insumo del aprendizaje y la confianza en lo que dice estar guardado. Con la regla nueva descartar
igual sube el porcentaje, pero achicando lo que falta en vez de sumar al numerador.

### 5.7 Sheets nuevas
Usan `openSheet(title, bodyHtml, footHtml)` tal como ya existe (línea ~1085), sin cambios a esa función:
- `sheetPackingItem(trip, list, clave)` → estado 11. Body con `.pk-states`, `.pk-qty`, sección "De dónde
  sale". El botón "Guardar" llama `PackingEngine.setItemState` / `setQty` y persiste con
  `Store.savePacking`.
- `sheetPackingInfo(trip, list)` → estado 12. Body estático con los chips de contexto (`base` del
  documento) y la leyenda de orígenes. Pie con "Cambiar el tipo" (vuelve al selector, estado 01/02 con el
  tipo actual preseleccionado) y "Rehacer la lista" (llama `generatePackingList` de nuevo con
  `input.previous` para no perder lo tildado, tal como garantiza `mergeLists`).

### 5.8 Íconos nuevos en el objeto `I`
`valija.html` ya define `back`, `plus`, `spark`, `share`, `pdf`, `x`, `edit`, `info`, `globe`, entre otros
(línea 442). Del set nuevo que usa `packing-ui.html`, hace falta sumar los que **no** están todavía:
`check`, `dash`, `ban`, `chev`, `chevd`, `check2`, `minus`, `doc`, `shirt`, `shoe`, `drop`, `plug`, `health`,
`beach`, `city`, `mountain`, `work`, `adv`, `mix`. (`globe` ya existe y se reutiliza tal cual para
"Específicos del destino".)

### 5.9 CSS
Copiar el Bloque C completo de `packing-ui.html` (líneas 192 a 344) al `<style>` de `valija.html`. Es CSS ya
resuelto para no reinventar: no usa ningún color literal, todo sale de los tokens de `:root` que ya existen
en la app. Incluye la variante `.notice.ok` que hoy no existe en `valija.html` (sólo están la neutra y
`.notice.warn`) y que hace falta para los estados 07 y 09.

### 5.10 PDF (VAL-35, P2)
El muestrario no incluye un estado para esto: no hay una decimocuarta lámina de "la valija en el PDF". Es
un hueco entre el brief y la entrega de diseño — lo dejo anotado en el reporte final en vez de improvisarlo
acá. Cuando se aborde, el punto de entrada en el código es `exportPDF(trip)` (línea ~1499 de `valija.html`),
después de la sección de itinerario y antes del cierre del documento; el dato ya está disponible vía
`Store.packingOf(trip.id)` y `PackingEngine.groupByCategory()`.

### 5.11 Cambios a texto existente
Ninguno. La tira (estado 00) se agrega sin tocar el `seg` existente ni sus etiquetas "Itinerario" /
"Pendientes".
