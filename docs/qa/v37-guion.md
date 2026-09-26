# v37 — el guion del PM

**Qué probar:** VAL-77b — cada ítem que agregás a mano sabe a qué parte del viaje pertenece, y lo aprendido
cruza de un tipo de viaje a otro.

**Dónde:** el Artifact publicado, **abierto desde el teléfono**. Arriba a la izquierda tiene que decir **v37**.

**Auditoría:** 88/100, candidato, sin bloqueantes.

---

## Antes de empezar: esta prueba es distinta

El resultado de esta historia **no se ve en la pantalla donde agregás el ítem: se ve en el viaje siguiente.**
Por eso hacen falta tres viajes. Son cortos: **alcanza con nombre y fechas**, sin vuelos ni reservas.

---

## 1 · Un viaje de dos tipos: la pregunta aparece

**Viaje A**: nombre «Prueba A», cualquier fecha. En la valija elegí **Montaña y Ciudad** y armá la lista.

En **Ropa**, tocá «Agregar a ropa» y escribí `Buzo polar`.

- ¿Aparece debajo la fila **«Es para»** con Ciudad, Montaña y Las dos, **sin nada marcado**?
- Tocá **Montaña** y después **Agregar**. ¿La fila del ítem dice **«para montaña»**?

Las opciones van en el orden de la cabecera —Ciudad, Montaña—, no en el del muestrario. Es a propósito.

## 2 · El otro camino, y sin elegir

En el mismo viaje, el botón grande de abajo: **Agregar ítem**. Escribí `Termo`.

- ¿Está la misma pregunta como un campo más?
- Agregalo **sin elegir nada**. ¿Se agrega igual, sin chip?

## 3 · Un viaje de un solo tipo: no pregunta nada

**Viaje B**: «Prueba B», **Montaña sola**. Agregá `Buzo polar` en Ropa.

- ¿**No** aparece ninguna fila de chips? — Es la mitad del diseño: con un tipo, el gesto no paga ni un toque.

## 4 · El viaje siguiente — el caso de éxito de toda la historia

**Viaje C**: «Prueba C», **Montaña sola**, armá la lista.

- ¿Aparece **Buzo polar** sin que lo agregues, marcado **«tus viajes»**?
- ¿El motivo dice **«Lo agregaste a mano en 2 viajes de montaña»**?

**Hoy, antes de esta versión, no aparecía**: el viaje A era montaña+ciudad y no le enseñaba nada a uno de
montaña sola.

**Lo que NO tiene que aparecer acá, y no es un defecto:** el chip «para montaña». Ese chip existe sólo en
viajes de dos tipos, y este Buzo polar no lo agregaste vos: vino del historial.

## 5 · El control

En el viaje C, tocá el tipo, cambialo a **Ciudad sola** y **Rehacé la lista**.

- ¿**Buzo polar desaparece**? Lo aprendiste para montaña, no para ciudad.

## 6 · Oscuro

Repetí el paso 1 con el tema oscuro puesto **desde el botón de la cabecera**, sólo para mirar la fila de chips.

---

## Dos cosas que podés ver en tus valijas de antes, y qué son

**«Por lo que agregaste a mano en otros viajes, tengo N cosas para sumarle.»** Es esta historia funcionando:
ahora lo que aprendiste en viajes de un tipo le llega a los de dos tipos. Hasta ayer ese aviso decía, en falso,
«El viaje cambió» — se arregló antes de publicar.

**«El viaje cambió: saco N que ya no corresponde», sin haber tocado el viaje.** Es un defecto conocido y anterior
a esta historia —sale igual en la versión de antes—: la misma causa inventada, del lado de lo que se aprende a
sacar. Está anotado como **VAL-85**. No lo reportes como parte de esto.

---

## Lo que NO se probó

- **Nada corrió en un teléfono.** Chromium de escritorio con el archivo local, tocando los controles de verdad.
- **El área táctil de los chips** se superpone unos 5px entre vecinos; es el CSS del muestrario. Sólo lo contesta
  tu pulgar, en el paso 1.
- **La base compartida de verdad**: probado con un simulador.

**Con tu respuesta VAL-77b pasa de candidato a terminada.**
