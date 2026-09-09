# La valija razona sobre el viaje — especificación de diseño (bloque B)

**Épica:** VAL-44, VAL-45, VAL-46, VAL-43 · **Escribe:** diseño UX/UI · **Estado:** listo para integración

Esta especificación **se suma** a `docs/design/valija-inteligente.md` (iteración 1.5, estados 00 a 13) y no
la reemplaza. Todo lo que ese documento define sigue vigente tal cual: la tira de entrada, los tres estados
del ítem, el progreso, las categorías plegables, el aviso de ajuste por destino, la hoja de detalle y la de
transparencia. Acá se agregan **tres señales nuevas** sobre la misma pantalla, numeradas del 14 al 25 para
que las dos entregas se lean como una sola.

Los componentes están en `app/parts/packing-ui-b.html`, autónomo: se abre en el navegador y se ve completo,
en tema claro y oscuro, sin el resto de la app.

El motor que alimenta todo esto es `app/parts/packing-engine.js`, documentado en
`docs/design/packing-engine.md`. **No se inventa ni un campo:** cada estado de acá indica de qué función y
de qué propiedad del motor sale.

---

## 0 · Para quién es esto

**Qué tiene que poder hacer.** Enterarse de que la lista quedó vieja porque el viaje creció, decidir si la
actualiza o no, encontrar después lo que se sumó, y sacarse de encima lo que la app le pide de más. Cuatro
decisiones chicas, ninguna urgente.

**En qué momento llega.** En dos momentos distintos, y esa diferencia es la que ordena todo el diseño:

1. **Acaba de cargar una reserva.** Está en la pantalla del viaje, con la cabeza en la reserva, no en la
   valija. Le sobra atención pero no le sobra interés: no vino a hablar de equipaje.
2. **Está empacando.** Once de la noche, con la valija abierta en la cama, una mano en el teléfono y la otra
   doblando ropa. Le sobra interés pero no le sobra atención: está en medio de una secuencia de tildado y
   cualquier cosa que le mueva la lista bajo el pulgar le arruina el gesto.

**El camino más corto.** En el momento 1, avisar donde ya está mirando y no pedirle nada. En el momento 2,
no interrumpir nunca: entrar por abajo, ocupar una línea, y dejar todo el detalle a un toque de distancia.
La regla de la que cuelga la entrega entera: **si algo puede vivir en una hoja, vive en la hoja.** La lista
ya tenía mucho encima antes de esta iteración.

---

## 1 · El flujo, de punta a punta

```
Se agrega / edita / borra una reserva
   │
   └─ la app corre planListUpdateAsync() en segundo plano
        │
        ├─ plan.desactualizada === false ──────────► SILENCIO. No se muestra nada. (Estado vacío de A)
        │
        └─ plan.desactualizada === true
             │
             ├─ la persona NO está en la valija ───► 14 · la tira de entrada suma un chip
             │       └─ entra a la valija ─────────► 15 · el aviso arriba de la lista
             │
             └─ la persona SÍ está en la valija ───► 16 · el aviso entra por abajo, no mueve la lista
                     │
                     ├─ "Ver qué agrego" ──────────► 17 · hoja: lo que se suma, agrupado por reserva
                     │      ├─ "Sumar 3" ──────────► 18 · aplicada. Ítems marcados. Aviso de confirmación
                     │      │                            └─ marcas limpiadas cuando las vio (§ 4.3)
                     │      └─ "Ahora no" ─────────► 19 · aplazada. Queda en la hoja de transparencia
                     └─ "Ahora no" ────────────────► 19

Corrió la capa de IA y algún ítem quedó con sugerenciaQuitar
   │
   └─ 20 · la lista, con el botón de descartar teñido en esos ítems
        ├─ aviso "hay 2 que capaz no necesitás" ──► 21 · hoja: una tarjeta por propuesta
        │        ├─ "Sacarlo"  → dismissItem + clearRemovalSuggestion
        │        └─ "Dejarlo"  → clearRemovalSuggestion
        └─ tocás la fila ─────────────────────────► 22 · la propuesta dentro de la hoja del ítem (11)

Cualquier ítem con nuevo:true ──────────────────► 23 · su hoja dice cuándo llegó y por qué
Store.canWrite === false ───────────────────────► 24 · las tres señales, sin una sola acción
Varias señales a la vez ────────────────────────► 25 · un solo aviso arriba, el resto en la hoja 12
```

Ningún estado es un callejón sin salida. Lo que se aplaza queda siempre a un toque en la hoja de
transparencia (estado 12), que pasa a ser el único lugar donde no se esconde nada.

---

## 2 · Los estados nuevos

### 14 · La tira de entrada avisa
**Cuándo aparece:** `plan.desactualizada === true` y hay `plan.nuevos.length > 0` para un viaje con lista
guardada, y todavía no se aplicó ni se aplazó.
**Qué muestra:** la variante `live` de la tira `.vj-entry` que ya existe, con dos cambios: el título suma el
chip `soon` "3 cosas nuevas" y el subtítulo pasa de la barra de progreso a "Agregaste el auto (Europcar)",
usando `plan.nuevos[0].reserva` (o `plan.motivo` si no hay ninguna reserva rastreable).
**Por qué acá:** cuando se guarda una reserva, la persona está en esta pantalla. No hay nada que
interrumpir. Es el único aviso que aparece sin que nadie lo pida.
**La banda sigue azul.** No pasó nada malo: la valija está en curso. Amber sería alarma y esto no es una
alarma.
**Si no hay lista guardada,** no hay nada que actualizar y la tira no cambia: sigue en su variante de
siempre.

### 15 · El aviso, arriba de la lista
**Cuándo aparece:** se entra a la pantalla de la valija y hay un plan pendiente que no se aplazó.
**Qué muestra:** un `.notice` neutro (acento) con el ícono `spark`, una línea que nombra la reserva y la
cantidad en mono, y **dos acciones separadas**: "Ver qué agrego" y "Ahora no". No hay botón de cerrar: las
dos salidas están explícitas, un `x` sería una tercera salida ambigua.
**Texto:** "Agregaste **el auto (Europcar)**. Tengo **3** cosas para sumarle a la valija."
**Por qué azul y no ámbar.** El ámbar del sistema (`--flap`) señala advertencia y ya lo usan el estado
degradado (08) y las propuestas de sacar (20). Esto no es una advertencia: es una novedad con una acción
disponible. El acento azul es el color de señalética de la app y es el que corresponde.
**Nunca aparece de golpe con la pantalla abierta.** Si el plan resuelve mientras la persona ya está en la
valija, no se inyecta acá: entra por el estado 16.

### 16 · El aviso que no interrumpe
**Cuándo aparece:** el plan resuelve —o llega un cambio de otra persona del viaje por `onSnapshot`— mientras
la pantalla de la valija ya está abierta.
**Qué muestra:** el mismo aviso, mismo texto y mismas dos acciones, dentro de un `.pk-dock`: fijo abajo,
encima del FAB, entrando desde abajo en 260 ms.
**Por qué:** insertar un bloque arriba de la lista corre todo lo que hay debajo entre 60 y 80 píxeles.
Alguien que está tildando la cuarta remera termina tildando una campera. Es el escenario que el brief
prohíbe explícitamente ("no puede interrumpir a alguien que está empacando") y la única forma de
garantizarlo es que el aviso **no ocupe espacio en el flujo del documento**.
**No roba el foco** ni bloquea nada. La lista sigue siendo tocable detrás.
**Con `prefers-reduced-motion`,** la animación de entrada se apaga (regla global de la app) y el aviso
simplemente está. No se pierde nada: la información es el aviso, no el movimiento.

### 17 · Hoja — Lo que le sumo a la valija
**Cuándo aparece:** se toca "Ver qué agrego", desde el estado 15, el 16, el 19 o la hoja de transparencia.
**Qué muestra:** los ítems de `plan.nuevos` **agrupados por la reserva que los motivó** (`n.reserva`), un
grupo por reserva, más un grupo final para los que vienen con `reserva: null`. Cada ítem: ícono de su
categoría, nombre, cantidad si tiene, y su `motivo` completo.
**Los encabezados de grupo:**

| Grupo | Cuándo | Encabezado |
|---|---|---|
| Por reserva | `n.reserva` tiene texto | "Porque agregaste **el auto (Europcar)**" |
| Sin reserva, `origen:"destino"` | límite conocido del motor, § 7 de `packing-engine.md` | "Mirando el viaje entero, con el auto adentro" |
| Sin reserva, `origen:"historial"` | promoción de la capa 3 | "Porque lo llevaste en viajes parecidos" |

**Por qué agrupado por reserva y no por categoría.** La pregunta que la persona se está haciendo no es "qué
me agregás", es "**por qué** me agregás algo ahora si la lista ya estaba". El grupo es la respuesta: el
encabezado nombra la causa y adentro están las consecuencias. Agrupar por categoría contestaría la pregunta
equivocada y obligaría a leer tres motivos para reconstruir el mismo dato.
**Los ítems con `origen:"destino"` no tienen `reserva`** (límite documentado del motor: para esos ítems la
cita del dato concreto está adentro del texto de `motivo`, no en un campo aparte). Por eso su grupo se titula
por el razonamiento y no por una reserva puntual, y **su motivo se muestra entero**, que es donde está la
cita.
**Pie:** "Ahora no" (fantasma) y "Sumar **3**" (primario, con el número en mono). El número está en el botón
a propósito: es el compromiso exacto que se está aceptando.
**Al pie del cuerpo, una línea de garantía:** "Nada de lo que ya marcaste se toca: lo empacado sigue
empacado y lo descartado no vuelve." Es literalmente lo que garantiza `mergeLists`, y es la duda que frena a
alguien que ya tildó veinte cosas.

### 18 · Aplicada — los ítems nuevos, marcados
**Cuándo aparece:** se tocó "Sumar 3". La app guarda `plan.listaPropuesta` y vuelve a la lista.
**Qué muestra:**
- Un `.notice.ok`: "Sumé **3** cosas por **el auto (Europcar)**. Quedan marcadas hasta que las mires." con
  la acción secundaria "Listo, ya las vi" y un botón de cerrar.
- Cada ítem con `nuevo:true` lleva **una barra ámbar de 3 px al filo izquierdo de la fila** (`box-shadow`
  interior, cero costo de layout) y la palabra **nuevo** en mono, en la línea de motivo, antes del chip de
  origen.
- Cada categoría que tiene ítems nuevos suma un chip `soon` "2 nuevos" al lado de su contador, **también
  cuando está plegada**, y se abre sola en la primera visita después de aplicar.
- Además, y sólo una vez, la animación `.fresh` de 2,6 s que ya existía para la llegada de ítems del ajuste
  por destino.

**Por qué barra + palabra y no un chip.** La fila ya tiene chip de origen y motivo. Un chip más ensucia la
línea y compite con el origen, que es información permanente. La barra no ocupa lugar y la palabra "nuevo"
en mono, 10 px, pesa menos que un chip pero se lee con lector de pantalla y con baja visión al color. La
marca desaparece sola cuando se limpia el flag; el chip de origen se queda para siempre. Son dos cosas
distintas y tienen que verse distintas.
**Por qué el chip en la categoría.** Es el único mecanismo por el que alguien encuentra tres filas ámbar en
una lista de cuarenta ítems repartidos en ocho categorías, sin scrollear a ciegas. La barra es el
localizador fino; el chip de categoría es el grueso.
**Cuándo se limpia la marca:** § 4.3. Es la decisión más delicada de esta entrega.

### 19 · Aplazada — "Ahora no"
**Cuándo aparece:** se tocó "Ahora no", en el aviso o en el pie de la hoja.
**Qué muestra:** el aviso se reemplaza por uno neutro, de una sola visita: "Listo, no toco nada. Las **3**
cosas del auto quedan guardadas en **De dónde sale esta lista**, arriba a la derecha, por si después las
querés." con la acción "Verlas igual".
**Qué NO muestra:** nada más. No queda un badge, ni un punto, ni la tira insistiendo. El aviso aplazado no
vuelve solo.
**Dónde queda el rastro permanente:** la hoja de transparencia (estado 12) suma arriba de todo una sección
"Novedades sin sumar" con la cantidad y el botón "Ver qué agrego". Es el único lugar, y siempre está a dos
toques desde cualquier estado de la valija.
**Cuándo vuelve a ofrecerse solo:** § 4.2.

### 20 · La propuesta de sacar, en la lista
**Cuándo aparece:** `capaInteligente.estado === "ok"` y al menos un ítem tiene `sugerenciaQuitar`.
**Qué muestra:**
- Un `.notice.warn` con el ícono `ban`: "Hay **2** cosas de la lista que capaz no necesitás en Madrid." +
  "Ver cuáles". Cerrable.
- En cada ítem propuesto, **la única marca es el círculo de descartar teñido de ámbar** (`.pk-drop.sug`:
  disco `--flap-soft`, ícono `--warn`). Nada más: el ítem sigue en su categoría, en su estado, con su
  cantidad, su chip de origen y su motivo original intactos.

**Por qué la marca va sobre el botón de descartar.** Porque ese botón **es** la aceptación de la propuesta:
aceptar es `dismissItem`, el descarte de siempre. Poner la marca ahí significa que quien ya entendió de qué
se trata resuelve con un toque, en el mismo objetivo de 44 px que ya sabía usar, sin abrir nada. Y para
quien no entendió, el `aria-label` del botón lleva el motivo completo ("Descartar Visa o autorización
electrónica. Te propongo sacarlo: con pasaporte argentino no necesitás visa para España").
**Por qué la fila no crece ni una línea.** Ese es el objetivo entero de esta entrega. Con dos propuestas
sobre cuarenta ítems, meter un bloque de texto en cada fila propuesta rompe el ritmo de la lista en dos
lugares al azar y obliga a leer donde se venía tildando. El texto vive en la hoja.
**Por qué el motivo original no se reemplaza.** "Por qué está" y "por qué capaz no va" son dos cosas
ciertas al mismo tiempo, y hacen falta las dos para decidir. Tachar la primera sería la app contradiciéndose
a sí misma en la misma línea.
**El piso no se ve porque no existe.** El DNI y el Pasaporte están en la misma categoría, sin marca: el
motor filtra en código las propuestas sobre ítems `critico:true` (`CRITICAL_CLAVES`). La interfaz no tiene
un caso especial para esto y **no debe tenerlo**: si mañana el motor deja pasar una, el bug se arregla en el
motor, no se tapa acá.

### 21 · Hoja — Lo que capaz no necesitás
**Cuándo aparece:** se toca "Ver cuáles" en el aviso del estado 20.
**Qué muestra:** una línea de encabezado ("Miré el destino, las fechas y lo que cargaste del viaje. Estas
**2** capaz no te hacen falta. Ninguna se saca sola.") y una tarjeta `.pk-prop` por propuesta: nombre del
ítem, `sugerenciaQuitar.motivo` completo, chips de su categoría y su origen, y **dos botones del mismo
peso**: "Dejarlo, lo llevo" y "Sacarlo".
**Por qué los dos botones pesan casi igual.** "Sacarlo" es primario sólo porque es la acción que la app
propone y la que la persona vino a evaluar; "Dejarlo" es un `.btn` normal del mismo ancho, no un enlace de
texto. La app no sabe cuál es la respuesta correcta —el caso que motivó todo esto es justamente la app
equivocándose— así que la interfaz no puede empujar.
**Se resuelven de a una, en cualquier orden.** Al resolver, la tarjeta no desaparece: se colapsa a una línea
apagada, borde punteado, con la confirmación en mono ("lo sacaste · queda descartado en la lista" / "lo
dejaste · no te lo vuelvo a proponer"). No hay salto de layout, y queda constancia de lo que se decidió sin
tener que cerrar y volver a abrir.
**Cuando no queda ninguna:** la hoja pasa a su estado vacío, "No queda ninguna", con la nota de que lo
sacado sigue recuperable con el botón `volver`, y el pie cambia a un único "Volver a la lista".

### 22 · La propuesta, dentro de la hoja del ítem
**Cuándo aparece:** se toca el texto de una fila que tiene `sugerenciaQuitar`. Es la hoja del estado 11, con
un bloque agregado.
**Qué muestra:** arriba de todo, un bloque `.pk-sug` en ámbar suave: rótulo mono "TE PROPONGO SACARLO", el
motivo completo, y los mismos dos botones. Debajo sigue la hoja 11 tal cual: los tres estados, la cantidad,
y "De dónde sale" **sin cambios**.
**Por qué arriba de todo:** es lo único nuevo que hay para decidir sobre ese ítem. Todo lo demás ya estaba
la última vez que se abrió esta hoja.

### 23 · Un ítem nuevo, en su hoja
**Cuándo aparece:** se toca el texto de una fila con `nuevo:true`.
**Qué muestra:** la hoja del estado 11 con dos cambios chicos: la palabra "nuevo" en mono al lado del título,
y en "De dónde sale", debajo del motivo, una línea gris: "Se sumó a la lista el 8 de octubre, cuando
agregaste **el auto (Europcar)**." La fecha sale de `item.agregadoEn`; la reserva, de `plan.nuevos` guardado
al aplicar (ver § 5, punto 6).
**Abrir esta hoja cuenta como haber visto el ítem** a los efectos de limpiar la marca (§ 4.3).

### 24 · Sólo lectura
**Cuándo aparece:** `Store.canWrite === false`, con cualquiera de las tres señales presentes.
**Qué muestra:**
- **El aviso de desactualizada, sí, pero sin acciones:** un `.notice` neutro, "Estás viendo la valija de este
  viaje. Quedó vieja: el viaje cambió después de que se armó, y hay **3** cosas sin sumar. Las puede sumar
  quien tenga permiso de edición." Se muestra porque cambia cuánto se puede confiar en lo que se está
  leyendo, que es exactamente lo que le importa a quien mira. No tiene ni "Ver qué agrego" ni "Ahora no":
  ninguna de las dos haría nada.
- **Los ítems nuevos siguen marcados,** barra y palabra. Son un dato del documento, no un control.
- **Las propuestas de sacar no se marcan en la fila,** porque en sólo lectura la fila no tiene botón de
  descartar y la marca vivía sobre ese botón. Se leen enteras en la hoja del ítem, sin los dos botones de
  resolverlas.
- **`clearNewFlags` no corre nunca sin permiso de escritura.** Limpiar la marca es una escritura sobre el
  documento compartido, y quien mira no escribe. Las marcas se quedan hasta que las limpie quien puede.

Se mantiene la regla del estado 10: los controles **no están en el HTML**, no están deshabilitados.

### 25 · Un solo aviso a la vez
**Cuándo aparece:** siempre. Es la regla de composición, no una pantalla.
**Qué muestra:** arriba de la lista se renderiza **exactamente un** `.notice`, el primero de esta lista que
aplique:

| # | Aviso | Condición | Variante |
|---|---|---|---|
| 1 | Sin ajuste por destino (08) | `capaInteligente.estado` es `no-disponible` o `error` | `.notice.warn` + `info` |
| 2 | La lista quedó vieja (15) | hay plan pendiente sin aplazar | `.notice` + `spark` |
| 3 | Sumé N cosas (18) | se aplicó recién y quedan marcas sin limpiar | `.notice.ok` + `check2` |
| 4 | Hay N que capaz no necesitás (20) | hay `sugerenciaQuitar` sin resolver | `.notice.warn` + `ban` |
| 5 | Valija lista (09) | `conteo.pendientes === 0` | `.notice.ok` + `check2` |

**Por qué ese orden.** El 1 habla de toda la lista (puede faltar cualquier cosa), así que condiciona la
lectura de todo lo demás. El 2 antes que el 3 porque una novedad sin decidir pesa más que la confirmación de
algo ya hecho. El 4 antes que el 5 porque "valija lista" con dos propuestas sin resolver es una foto
incompleta.
**Lo que no se muestra no se pierde:** la hoja de transparencia (12) lista siempre todo lo pendiente, y las
marcas en las filas (barra ámbar, círculo teñido) son independientes del aviso: están aunque el aviso que
las explica no se esté mostrando.
**Combinaciones imposibles, verificadas contra el motor:** el aviso 1 y el 4 nunca coexisten (el 4 necesita
`capaInteligente.estado === "ok"`, el 1 necesita que no lo sea), aunque los dos usen `.notice.warn`. El 2 y
el 3 tampoco (el 3 sólo existe después de aplicar, que es lo que hace desaparecer al 2).
**El caso 3 + 4 al mismo tiempo sí pasa,** y es común: `planListUpdateAsync` corre la capa de IA sobre la
lista propuesta y puede volver con ítems nuevos y propuestas de sacar en la misma pasada. Ahí el aviso 3
suma una segunda acción, "Y hay **2** que capaz no necesitás. Verlas", en vez de esperar a la próxima
entrada.

---

## 3 · Todos los estados de cada pantalla nueva

Lo que sigue cubre vacío, cargando, con datos, error y sin permiso de edición para las dos hojas nuevas y
para las tres señales. Varios de estos estados **no existen a propósito**, y esa es la información.

### 3.1 · El aviso de desactualizada (A)

| Estado | Qué pasa |
|---|---|
| **Vacío** | `plan.desactualizada === false` o `plan.nuevos.length === 0`: **silencio total**. Ni aviso, ni chip en la tira, ni rastro en la hoja 12. Es el caso más frecuente (editar el horario de un vuelo no cambia la lista) y tiene que costar cero atención. |
| **Cargando** | **No existe.** El aviso aparece cuando la promesa de `planListUpdateAsync` resolvió, nunca antes. No hay spinner en ningún lado: un cálculo que la persona no pidió no puede ocupar una barra de progreso. Si resuelve mientras la persona ya entró a la valija, entra por el dock (16). |
| **Con datos** | Estados 14, 15 y 16. |
| **Error** | **No existe como pantalla.** `planListUpdate` es sincrónica y no lanza; `planListUpdateAsync` degrada sola y devuelve el plan de las capas 1 + 3 si la capa de IA falla. La consecuencia visible es un plan más chico, no un error. Se documenta acá para que nadie diseñe una pantalla de error que el motor no puede producir. |
| **Falla al guardar** | Sí existe: si `Store.savePacking(plan.listaPropuesta)` rechaza, la hoja **no se cierra**, el botón "Sumar 3" vuelve de su estado ocupado y aparece un `.toast.err`: "No se pudo guardar. Fijate la conexión y probá de nuevo." Nada se aplicó a medias: el motor devuelve el documento completo y se guarda con un único `set`. |
| **Sin permiso** | Estado 24: aviso informativo, sin acciones, sin hoja. |

### 3.2 · Las propuestas de sacar (C)

| Estado | Qué pasa |
|---|---|
| **Vacío** | Sin `sugerenciaQuitar` en ningún ítem: no hay aviso ni círculos teñidos. También es el caso de `capaInteligente.estado === "vacio"` (la IA respondió y no tenía nada seguro, o todo lo que propuso era crítico y quedó filtrado): silencio, sin aviso de error, porque no hay nada que reintentar. |
| **Cargando** | **No existe.** Las propuestas ya están guardadas en el documento cuando se abre la pantalla. La única espera posible es la del estado 04 (generando), que ya está diseñada. |
| **Con datos** | Estados 20, 21 y 22. |
| **Error** | Si falla el guardado al resolver una propuesta, la tarjeta vuelve a su estado sin resolver y aparece el `.toast.err`. La propuesta sigue en el documento: no se pierde. |
| **Última resuelta** | La hoja pasa a su estado vacío "No queda ninguna" sin cerrarse sola: cerrar una hoja bajo el dedo es exactamente el gesto que hace tocar sin querer lo que hay detrás. |
| **Sin permiso** | Estado 24: sin círculos teñidos (no hay botón de descartar donde ponerlos), la propuesta se lee en la hoja del ítem sin los dos botones. |

### 3.3 · La marca de ítem nuevo (B)

| Estado | Qué pasa |
|---|---|
| **Vacío** | Ningún ítem con `nuevo:true`: la lista se ve exactamente como antes de esta iteración. |
| **Con datos** | Estados 18 y 23, más el chip de categoría. |
| **Ya vistos** | La marca se va (§ 4.3) y la fila queda idéntica a cualquier otra. El chip de origen se queda: es de dónde salió, no cuándo llegó. |
| **Sin permiso** | Se ven, no se limpian. |

---

## 4 · Las tres decisiones difíciles

### 4.1 · Por qué el aviso aparece en dos lugares distintos y no en uno solo

El aviso es el mismo: mismo texto, mismas dos acciones, misma hoja. Lo que cambia es de dónde entra, y
depende de un solo dato: **si la pantalla de la valija ya estaba abierta cuando el plan resolvió.**

- **No estaba abierta** (el caso normal: se guardó una reserva y se sigue en la pantalla del viaje). El
  aviso se renderiza arriba de la lista, en el primer render. No mueve nada porque no había nada todavía.
- **Sí estaba abierta** (el plan tardó, o alguien más del viaje cargó una reserva y llegó por `onSnapshot`).
  El aviso entra por abajo, fijo, sin ocupar espacio en el flujo.

**El descarte fue un solo lugar para los dos casos.** Si siempre entrara arriba, el segundo caso mueve la
lista bajo el pulgar en medio del tildado, que es lo que el brief prohíbe. Si siempre entrara abajo, el
primer caso paga un aviso flotante permanente que tapa la última fila y compite con el FAB, sin ninguna
necesidad: cuando se entra a la pantalla no hay ningún gesto en curso que proteger. Un componente con dos
anclajes cuesta doce líneas de CSS; la alternativa cuesta una de las dos cosas.

**También se descartó el modal.** Un modal de "el viaje cambió, ¿actualizo la lista?" es la lectura más
directa del ticket y es exactamente lo que el brief prohíbe: interrumpe, exige una decisión antes de seguir,
y llega en el peor momento posible. La palabra del brief es "ofrece", y una hoja modal no ofrece: exige.

### 4.2 · Qué pasa si se rechaza, y cuándo vuelve a ofrecerse

Rechazar ("Ahora no") **no descarta el plan**: lo aplaza. Concretamente:

1. Se guarda una **firma del plan**: `plan.nuevos.map(n => n.clave).sort().join("|")`.
2. Se guarda **en el dispositivo**, en `localStorage`, con la clave `valija.pk.aplazado.{tripId}`, junto con
   la fecha. **No en el documento compartido.**
3. Mientras la firma recalculada esté contenida en la firma aplazada, el aviso **no vuelve a aparecer solo**.
   Ni al entrar de nuevo, ni al recargar, ni nunca.
4. Si el viaje cambia otra vez y el plan nuevo trae **al menos una clave que no estaba en la firma
   aplazada**, el aviso vuelve, con el texto actualizado nombrando la reserva más reciente. La firma vieja se
   reemplaza por la nueva cuando se vuelve a aplazar.
5. **Siempre está disponible a pedido**, sin importar la firma: la hoja de transparencia (12) suma una
   sección "Novedades sin sumar · **3**" con el botón "Ver qué agrego".

**Por qué el aplazamiento va en el dispositivo y no en el documento.** Tres razones, en orden de peso:
- **Es una decisión personal, no del viaje.** Si Ana aplaza, Bruno no decidió nada y le corresponde que se
  le ofrezca a él también.
- **Quien mira sin permiso de edición también tiene que poder sacarse el aviso de encima**, y no puede
  escribir en el documento.
- Es estado de interfaz, no dato del viaje. El documento de la lista es el modelo que define el motor; no le
  agrego campos que el motor no conoce.

**El costo, declarado:** cambiar de teléfono, o limpiar el almacenamiento del navegador, hace que la oferta
vuelva a aparecer una vez. Es el peor caso y es un toque en "Ahora no". Lo contrario —guardarlo en el
documento— cuesta que una decisión de una persona silencie a las otras, que es peor y no tiene arreglo desde
la interfaz.

**Lo que se descartó:** volver a ofrecer el plan aplazado cuando falta poco para el viaje ("salís en 2 días
y todavía no sumaste esto"). Es tentador porque es el momento en que más importa, y está descartado porque
convierte un "ahora no" en un "después te vuelvo a preguntar igual", que es la definición de nagging. Si la
persona dijo que no, la app le cree. El rastro en la hoja 12 es el que sostiene el caso de que cambie de
idea.

### 4.3 · Cuándo exactamente se limpia la marca de "nuevo"

El riesgo que hay que evitar está en el brief: alguien acepta la actualización, cierra la app sin mirar, y
si la marca se limpió al aceptar, nunca supo cuáles eran los ítems nuevos. La marca dejó de cumplir su única
función.

**La regla: la marca se limpia cuando la persona las vio, no cuando las aceptó.**

Un ítem nuevo cuenta como **visto** si, durante una visita a la pantalla de la valija, pasa cualquiera de
estas tres cosas:

- su fila estuvo dentro de la ventana visible por lo menos 600 ms (`IntersectionObserver` con
  `threshold: 0.6`);
- se lo marcó como empacado o se lo descartó (actuar sobre algo es la prueba más fuerte de haberlo mirado);
- se abrió su hoja de detalle (estado 23).

**`clearNewFlags(list)` corre al salir de la pantalla de la valija** —botón de volver, cambio de hash, o
`pagehide`— **y solamente si todos los ítems con `nuevo:true` quedaron vistos en esa visita.** Si alguno
quedó afuera, los flags no se tocan y la marca sigue esperando en la próxima visita.

Consecuencias, que son las que hacen que la regla valga la pena:

- Aceptar y cerrar la app al instante: **ninguna fila estuvo en pantalla, nada se limpia.** La próxima vez
  que entre, las tres están marcadas. Es el caso que el brief pide resolver.
- Entrar, tildar dos cosas arriba y salir: se limpia sólo si las nuevas estaban visibles; si estaban abajo,
  siguen marcadas.
- Recorrer la lista entera: se limpian todas al salir, que es lo correcto — ya no son novedad.
- **Nunca se limpia sin permiso de escritura** (estado 24).
- Si la escritura falla, los flags se quedan como estaban. La operación es idempotente y se reintenta sola
  en la próxima salida.

**Lo que hace que la regla sea alcanzable, y no una promesa:** las categorías con ítems nuevos **se abren
solas** en la primera visita después de aplicar. Una fila adentro de una categoría plegada nunca puede
entrar en la ventana visible, y sin esto los flags no se limpiarían jamás. El chip "2 nuevos" en el
encabezado de la categoría, que se ve también plegada, es el otro medio camino.

**El atajo explícito:** el aviso de confirmación (18) tiene "Listo, ya las vi", que limpia todo en el acto.
Alguien que ya sabe qué se sumó porque acaba de mirar la hoja no tiene por qué recorrer la lista para que la
app se dé por enterada. Cerrar el aviso con el `x` hace lo mismo: cerrar la confirmación **es** confirmar.

**Degradación sin `IntersectionObserver`:** se cuentan las visitas a la pantalla desde que se aplicó y se
limpia al salir de la **segunda**. Peor que la regla buena —puede limpiar algo que no se llegó a mirar— pero
mucho mejor que limpiar al aceptar, y sostiene el caso del brief (cerrar la app enseguida no cuenta como una
visita completa). Es un `if` de tres líneas y no puede fallar.

**Límite conocido, para el Product Owner:** `nuevo` es una propiedad del ítem en un documento compartido, no
de cada persona. Si Ana recorre la lista y se limpian las marcas, Bruno entra después y no ve ninguna. Que
sea por persona pediría un campo que el motor no tiene (algo como `visto: {uid: fecha}`), y no lo invento
acá. Lo dejo anotado: es aceptable en esta iteración porque el permiso hoy es por valija y el caso de dos
personas empacando en paralelo es raro, pero deja de serlo cuando llegue el permiso por viaje de la
iteración 3.

### 4.4 · Cómo convive la propuesta de sacar con el ítem, sin ensuciar la lista

Tres reglas, en orden:

1. **La fila no crece.** Ni una línea, ni un chip, ni un bloque. La única diferencia visible es que un
   control que ya estaba ahí cambió de color.
2. **La marca va sobre el control que acepta la propuesta.** El círculo de descartar teñido no es un adorno:
   tocarlo resuelve. Aceptar es `dismissItem` (VAL-31, el mismo descarte de siempre), no una acción nueva
   que haya que aprender.
3. **Todo el texto vive en la hoja.** Con varias propuestas a la vez —que es el caso esperado— es la única
   forma de que se lean todas juntas, se comparen y se resuelvan en una sola sesión, en vez de ir a
   buscarlas de a una por la lista.

**Detalle de integración que no se puede saltear:** aceptar la propuesta desde la fila (tocar el círculo
teñido, o deslizar a la izquierda) tiene que hacer **`dismissItem` y `clearRemovalSuggestion` en la misma
escritura**. Si sólo se descarta, la propuesta queda viva en el documento, el contador del aviso sigue en 2
y la hoja muestra una propuesta sobre un ítem ya descartado — que además es un estado que el motor considera
inválido (regla 4 de `parseDestinationItems`: no propone sacar algo ya descartado).

**El aviso del estado 20 se cierra por visita, no para siempre.** A diferencia del aviso de actualización,
acá no hay aplazamiento persistente: las propuestas ya están guardadas en la lista y sus marcas están a la
vista en las filas. El aviso es un localizador, no una novedad. Cerrarlo lo saca de esa visita; resolver las
propuestas —dos toques cada una— lo saca para siempre. Si en la práctica esto molesta, es una línea de
código pasarlo al mismo esquema de firma del § 4.2; lo dejo anotado como algo a mirar en la validación.

**Lo que se descartó:**
- **Sacar el ítem solo y avisar después** ("saqué la visa, tocá para recuperarla"). Es la lectura literal de
  "la capa inteligente puede sacar ítems", y está descartada por la misma razón que el motor la descartó:
  contradice "nada se guarda sin revisar" y "la sugerencia se acepta o se rechaza, no se impone". El caso
  real que originó VAL-43 es la app equivocándose; una app que se equivoca y además actúa sola es peor que
  una que se equivoca y pregunta.
- **Mover los ítems propuestos a una sección aparte** ("Capaz no necesitás") al final de la lista. Se
  descartó porque saca al ítem de su categoría, que es donde la persona lo va a buscar cuando esté
  empacando el neceser, y porque duplica el ítem o lo mueve de lugar entre una visita y la siguiente.
- **Un chip "¿lo sacás?" en la línea de motivo.** Se descartó porque compite con el chip de origen, que es
  información permanente, y porque en una fila de 460 px la línea de motivo pasa a dos renglones con
  cualquier nombre largo.
- **Resolver todas las propuestas de una** ("Sacar las 2"). Se descartó porque son decisiones
  independientes, cada una con su motivo, y aceptar en bloque es exactamente la forma de aceptar sin leer.

---

## 5 · Qué necesita `app/valija.html` para integrar esto

No se edita `valija.html` desde acá. Esto es la lista para el rol de integración. Se apoya sobre lo que ya
pide `docs/design/valija-inteligente.md`, § 5.

1. **CSS.** Copiar el Bloque C completo de `app/parts/packing-ui-b.html` (CB1 a CB7) al `<style>`. Son
   siete grupos: acciones dobles en el `.notice`, el `.pk-dock`, la marca de ítem nuevo, la marca de
   propuesta sobre el botón de descartar, la hoja del plan, la hoja de propuestas y el bloque de propuesta
   en la hoja del ítem. **Ningún token nuevo** (§ 7).

2. **Un ícono nuevo en el objeto `I`:** `car`. Los demás que usa esta entrega (`spark`, `info`, `ban`,
   `check2`, `x`, `chev`, `chevd`, `globe`, `plus`) ya están o ya se pidieron en la entrega anterior.

3. **Disparar la verificación.** Cada vez que se guarda, edita o borra una reserva de un viaje que ya tiene
   lista, después de que la escritura resolvió:
   ```js
   const list = Store.packingOf(trip.id);
   if (list) {
     PackingEngine.planListUpdateAsync({
       list, trip, items: Store.itemsOf(trip.id),
       tipoViaje: list.tipoViaje, history: historialDePacking(), ask
     }).then(plan => { App.plan = plan.desactualizada ? plan : null; render(); });
   }
   ```
   `App.plan` es memoria, no se persiste: si se recarga la app se vuelve a calcular. En cada tecla no; al
   guardar la reserva, sí.

4. **La tira (estado 14).** En `renderPackingEntry(trip, list)`, antes de decidir entre `live` y `done`: si
   hay `App.plan` para ese viaje y no está aplazado, usar la variante `live` con el chip y el subtítulo del
   estado 14.

5. **El aplazamiento.** Dos funciones nuevas de tres líneas, contra `localStorage`, con la clave
   `valija.pk.aplazado.{tripId}`. Nada toca `Store` ni el documento compartido. Si `localStorage` no está
   disponible, el aplazamiento vale para la sesión en memoria y listo.

6. **Aplicar.** `Store.savePacking(trip.id, plan.listaPropuesta)` con un único `set`. **Guardar además, en
   memoria, el `plan.nuevos` que se aplicó**, indexado por clave: es de donde sale la línea "cuando
   agregaste el auto (Europcar)" de la hoja del estado 23. No hace falta persistirlo — si se pierde, la hoja
   muestra sólo el motivo, que ya está en el ítem.

7. **Las dos hojas nuevas,** con el `openSheet(title, bodyHtml, footHtml)` que ya existe, sin cambios a esa
   función:
   - `sheetPackingPlan(trip, plan)` → estado 17.
   - `sheetPackingRemovals(trip, list)` → estado 21.
   Y dos extensiones a hojas existentes: `sheetPackingItem` suma el bloque `.pk-sug` si el ítem tiene
   `sugerenciaQuitar` (estado 22) y la línea de "cuándo llegó" si tiene `nuevo:true` (estado 23);
   `sheetPackingInfo` suma arriba la sección "Novedades sin sumar" cuando hay un plan aplazado (§ 4.2).

8. **Aceptar una propuesta de sacar** desde la fila o desde cualquiera de las dos hojas:
   ```js
   let l = PackingEngine.dismissItem(list, clave);
   l = PackingEngine.clearRemovalSuggestion(l, clave);
   await Store.savePacking(trip.id, l);
   ```
   Las dos, siempre, en la misma escritura. Rechazar es sólo `clearRemovalSuggestion`.

9. **El seguimiento de "visto" y `clearNewFlags`** (§ 4.3). Un `IntersectionObserver` sobre las filas
   `.is-new` que va llenando un `Set` en memoria, y un `clearNewFlags` + `savePacking` en el punto donde la
   vista de valija se desmonta (la rama de `render()` que cambia de `App.view`, más un `pagehide`). Con
   `Store.canWrite === false`, no corre. Sin `IntersectionObserver`, contar visitas.

10. **La regla de un solo aviso** (estado 25). En `renderPacking`, una única función `packingNotice(trip,
    list, plan)` que devuelve el HTML del primer aviso que aplique, en el orden de la tabla. Que sea una
    sola función es lo que impide que la regla se rompa sola cuando alguien agregue el sexto aviso.

11. **El aviso del ajuste por destino (estado 07) cambia de texto** cuando la capa de IA además propuso
    sacar: "Agregué 4 cosas por Madrid en octubre y hay 2 que capaz no necesitás", con dos acciones. Es el
    único texto existente que esta entrega modifica.

---

## 6 · Texto exacto de la interfaz

Español rioplatense, voseo. Los números que van en `.mono` van marcados con `**`.

**Tira de entrada (14)**
- "Valija" + chip "3 cosas nuevas" / "Agregaste el auto (Europcar)"

**El aviso de que quedó vieja (15 y 16)**
- "Agregaste **el auto (Europcar)**. Tengo **3** cosas para sumarle a la valija."
- Si el cambio lo hizo otra persona: "Ana agregó **el auto (Europcar)**. Tengo **3** cosas para sumarle a la
  valija."
- Si es una sola: "Agregaste **el auto (Europcar)**. Tengo **una** cosa para sumarle a la valija."
- Si no hay reserva rastreable: "El viaje cambió y la lista quedó vieja. Tengo **3** cosas para sumarle."
- Acciones: "Ver qué agrego" · "Ahora no"

**Hoja del plan (17)**
- Título: "Lo que le sumo a la valija"
- Encabezados de grupo: "Porque agregaste **el auto (Europcar)**" · "Mirando el viaje entero, con el auto
  adentro" · "Porque lo llevaste en viajes parecidos"
- Nota al pie del cuerpo: "Nada de lo que ya marcaste se toca: lo empacado sigue empacado y lo descartado no
  vuelve. Si alguna de estas tres no va, la descartás de la lista con un toque y aprendo para la próxima."
- Pie: "Ahora no" / "Sumar **3**"

**Confirmación (18)**
- "Sumé **3** cosas por **el auto (Europcar)**. Quedan marcadas hasta que las mires."
- Acción: "Listo, ya las vi"
- Con propuestas de sacar en la misma pasada, segunda acción: "Y hay **2** que capaz no necesitás. Verlas"
- Marca en la fila: "nuevo"
- Chip en la categoría: "2 nuevos" (singular: "1 nuevo")

**Aplazada (19)**
- "Listo, no toco nada. Las **3** cosas del auto quedan guardadas en **De dónde sale esta lista**, arriba a
  la derecha, por si después las querés."
- Acción: "Verlas igual"
- En la hoja de transparencia (12): etiqueta "Novedades sin sumar" + "**3** cosas que aparecieron cuando
  agregaste el auto (Europcar)." + botón "Ver qué agrego"

**Propuestas de sacar (20)**
- "Hay **2** cosas de la lista que capaz no necesitás en Madrid."
- Acción: "Ver cuáles"
- `aria-label` del círculo teñido: "Descartar Visa o autorización electrónica. Te propongo sacarlo: con
  pasaporte argentino no necesitás visa para España."

**Hoja de propuestas (21)**
- Título: "Lo que capaz no necesitás"
- Encabezado: "Miré el destino, las fechas y lo que cargaste del viaje. Estas **2** capaz no te hacen falta.
  Ninguna se saca sola."
- Botones: "Dejarlo, lo llevo" / "Sacarlo"
- Resuelta: "lo sacaste · queda descartado en la lista" / "lo dejaste · no te lo vuelvo a proponer"
- Vacía: "No queda ninguna" + "Resolviste las dos. Lo que sacaste sigue en la lista, tachado, y lo podés
  recuperar con el botón *volver*." + "Volver a la lista"

**Hoja del ítem con propuesta (22)**
- Rótulo: "TE PROPONGO SACARLO"
- Motivo (ejemplo real, sale de `sugerenciaQuitar.motivo`): "Con pasaporte argentino no necesitás visa para
  España: entrás con el pasaporte por hasta 90 días."
- Segundo ejemplo: "El apart de Malasaña dice tener secador en el baño. Ocupa media valija."

**Hoja del ítem nuevo (23)**
- "Se sumó a la lista el 8 de octubre, cuando agregaste **el auto (Europcar)**."

**Sólo lectura (24)**
- "Estás viendo la valija de este viaje. Quedó vieja: el viaje cambió después de que se armó, y hay **3**
  cosas sin sumar. Las puede sumar quien tenga permiso de edición."

**Errores**
- "No se pudo guardar. Fijate la conexión y probá de nuevo."

Ninguno pide disculpas ni culpa a nadie. Todos dicen qué pasó y qué hacer.

---

## 7 · Color, temas y accesibilidad

**Ningún token nuevo.** Todo sale de los que ya están en `:root` de `app/valija.html`, y por lo tanto están
resueltos en los tres bloques (claro, oscuro por sistema, oscuro por elección):

| Señal | Tokens |
|---|---|
| Aviso de desactualizada | `--accent-soft` / `--accent` (el `.notice` neutro, sin cambios) |
| Confirmación | `--ok-soft` / `--ok` (`.notice.ok`, ya pedido en la entrega anterior) |
| Marca de ítem nuevo | `--flap` (barra) y `--warn` (palabra "nuevo"), sobre `--surface` |
| Chip "2 nuevos" | `.chip.soon`, ya existe: `--flap-soft` / `--warn` |
| Propuestas de sacar | `.notice.warn` y `.pk-sug`: `--flap-soft` / `--warn`; disco de la marca `--flap-soft` |
| Hojas nuevas | `--surface`, `--surface-2`, `--line`, `--line-2`, `--ink`, `--ink-2`, `--ink-3` |

Los dos usos que valía la pena verificar a mano, porque son los únicos que ponen texto o un trazo fino sobre
un fondo teñido, y funcionan en los dos temas: `--warn` sobre `--flap-soft` (`#A96400` sobre `#FBF0D8` en
claro, `#E9A93C` sobre `#2E2413` en oscuro) y la barra de `--flap` sobre `--surface` (`#E8A317` sobre
blanco, `#FFC24D` sobre `#121B2B`).

**Foco.** Todo lo interactivo es `<button>`, así que hereda el `:focus-visible` de 2,5 px del sistema. Los
dos botones de una propuesta y los dos del pie de la hoja son objetivos de 44 px de alto. El círculo teñido
del estado 20 conserva sus 44 px: el teñido es un `::before` decorativo de 30 px que no achica el objetivo.

**Movimiento.** Dos animaciones nuevas: la entrada del `.pk-dock` (260 ms) y nada más — `.fresh` ya existía.
Las dos caen bajo la regla global de `prefers-reduced-motion` que ya tiene la app. **Ninguna información
depende de una animación:** la marca de ítem nuevo es la barra y la palabra, que son estáticas; el `.fresh`
es decoración de llegada y se puede perder entero sin perder nada.

**Lector de pantalla.** La marca de nuevo se lee porque es texto ("nuevo"), no color. La propuesta de sacar
se lee entera en el `aria-label` del botón que la acepta. La hoja de propuestas tiene `aria-live="polite"`
en el cuerpo, así que resolver una anuncia el cambio sin mover el foco. El `.pk-dock` no roba el foco al
aparecer: alguien tildando con el teclado no pierde el lugar.

---

## 8 · Lo que descarté, en un solo lugar

- **Un modal al guardar la reserva.** Interrumpe y exige; el brief pide ofrecer. (§ 4.1)
- **Un solo anclaje para el aviso.** Arriba siempre rompe el tildado; abajo siempre tapa la lista sin
  necesidad. (§ 4.1)
- **Elegir de a uno qué ítem sumar,** con casillas en la hoja del estado 17. Tres razones: el motor aplica
  `plan.listaPropuesta` entera o nada, y no le voy a inventar una API parcial; un ítem que nunca se agregó no
  deja ningún rastro, mientras que uno agregado y después descartado alimenta el aprendizaje de VAL-32, que
  es lo que hace que la próxima lista venga mejor; y son tres decisiones más a las once de la noche cuando
  cada una cuesta un toque desde la lista.
- **Volver a ofrecer el plan aplazado cuando se acerca el viaje.** Convierte un "ahora no" en nagging. (§ 4.2)
- **Guardar el aplazamiento en el documento compartido.** La decisión de una persona silenciaría a las
  otras. (§ 4.2)
- **Limpiar la marca de nuevo al aceptar.** Es el bug que el brief anticipa. (§ 4.3)
- **Limpiar la marca al renderizar la pantalla.** Mismo problema con un paso más: renderizar no es mirar.
- **Un badge permanente "nuevo" que no se limpie nunca.** Deja de significar algo a la tercera reserva que
  se carga.
- **Sacar el ítem solo y avisar después.** (§ 4.4)
- **Mover los ítems propuestos a una sección aparte.** (§ 4.4)
- **Un chip "¿lo sacás?" en la línea de motivo.** (§ 4.4)
- **"Sacar las 2" de una.** Es la forma de aceptar sin leer. (§ 4.4)
- **Apilar los avisos.** Cinco pueden aplicar a la vez; la lista quedaría ilegible antes de empezar. (§ 25)

---

## 9 · Lo que no pude verificar y lo que le pido al Product Owner

**No verificado, pendiente de la app publicada:**
- Que el `.pk-dock` no quede tapado por el `.toast` (los dos viven a 84 px del borde inferior; el toast tiene
  `z-index:120` y el dock 44). Como el toast es efímero y el dock es persistente, en la práctica el toast se
  monta arriba del dock durante dos segundos. Es aceptable, pero hay que mirarlo en un teléfono real con el
  teclado cerrado y abierto.
- Que la barra de 3 px de `.is-new` se vea en pantallas de baja densidad. En el emulador se ve; el
  `box-shadow` interior puede redondearse distinto en algunos navegadores móviles.
- Los tiempos de `planListUpdateAsync`: si tarda más de lo que dura la pantalla del viaje, el aviso va a
  entrar casi siempre por el dock y el estado 15 se va a ver poco. No es un problema de diseño, pero cambia
  cuál de los dos anclajes es el caso frecuente.

**Decisiones que necesitan tu confirmación:**
1. **El aviso de propuestas de sacar (20) no tiene aplazamiento persistente:** se cierra por visita y vuelve
   hasta que se resuelvan las propuestas. Es la única señal de esta entrega que puede volver a aparecer sola
   después de cerrarla. Si preferís que también se aplace con firma, es el mismo mecanismo del § 4.2.
2. **La marca de nuevo es del documento, no de cada persona** (§ 4.3, límite conocido). En un viaje
   compartido, quien recorra la lista primero limpia las marcas para todos. Si esto tiene que ser por
   persona, hace falta un campo en el modelo del motor que hoy no existe y que no invento acá.
3. **`aria-live` y el estado 16:** el aviso que entra por abajo mientras alguien está tildando no se anuncia
   por lector de pantalla a propósito, para no cortar la lectura de la fila en curso. Alguien que use lector
   se va a enterar del aviso cuando llegue navegando. Si preferís que se anuncie, es un atributo.

**Hueco heredado que sigue abierto:** el PDF (VAL-35) sigue sin diseño, tal como quedó anotado en § 5.10 de
`docs/design/valija-inteligente.md`. Esta entrega no lo toca y no lo cierra.
