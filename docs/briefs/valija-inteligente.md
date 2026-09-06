# Brief de iteración — Valija inteligente

**Épica:** VAL-30
**Escribe:** Product Owner
**Estado:** entregada y publicada
**Consumen este brief:** diseño UX/UI, motor de sugerencias, QA

Este documento es el contrato de la iteración. Todo lo que se construya se valida contra los criterios de
aceptación de acá abajo.

---

## El problema

Armar el bolso es la última tarea del viaje y la que más se improvisa. Se hace de memoria, tarde, y con la
lista mental de lo que uno olvidó la vez anterior. El resultado conocido: llevar de más lo que no se usa y
olvidar lo que hacía falta.

Valija ya sabe cosas que ninguna lista genérica sabe: adónde va la persona, cuántos días, en qué fechas, con
quién, y qué hizo en sus viajes anteriores. Con eso puede proponer una lista concreta en lugar de una
plantilla.

## La hipótesis

Si la app propone una lista específica para este viaje y aprende de lo que la persona efectivamente empacó y
descartó, la lista se vuelve confiable a partir del segundo o tercer viaje, y deja de ser una tarea para
volverse una revisión.

Eso hace que la app se abra en un momento nuevo, la noche anterior al viaje, que hoy no está cubierto.

## Qué debe hacer

Sugerir qué llevar en función de cuatro entradas:

1. **Tipo de viaje.** Playa, ciudad, montaña, trabajo, aventura o mixto.
2. **Destino y fechas.** El clima esperado depende del lugar y de la época del año, no solo del lugar.
3. **Duración.** Las cantidades salen de los días, no de una lista fija.
4. **Historial.** Qué llevó la persona en viajes anteriores del mismo tipo, qué marcó como empacado y qué
   descartó de la sugerencia.

## Decisiones de producto ya tomadas

Estas no se discuten en la implementación, están decididas.

**El motor es híbrido: reglas primero, inteligencia después.** Una base de reglas determinísticas cubre lo
universal, documentos, electrónica y ropa por cantidad de días. Encima de eso, la capa inteligente agrega lo
específico del destino, como el tipo de enchufe de España o la altura de Bariloche en julio. Si la capa
inteligente no está disponible, la lista base igual se genera y sirve. La feature nunca depende por completo
de la IA.

**La sugerencia se acepta o se rechaza, no se impone.** Cada ítem sugerido se puede descartar. Descartar es
información valiosa y se guarda, porque es lo que alimenta el aprendizaje.

**Las cantidades se explican.** Decir "5 remeras" sin más obliga a confiar a ciegas. Decir "5 remeras, 4 días
más una de repuesto" permite ajustar con criterio.

**No se compra nada.** Sin links de compra ni recomendaciones de producto. En el momento en que la lista tenga
un interés comercial detrás, deja de ser confiable y pierde su función.

## Criterios de aceptación

### VAL-30 · Generar la lista sugerida — P0

Como viajero quiero que la app me proponga qué llevar según este viaje puntual.

- Se elige el tipo de viaje al generar la lista, con el tipo propuesto según el destino y la duración.
- La lista llega agrupada en categorías: documentación, ropa, calzado, higiene, electrónica, salud y
  específicos del destino.
- Cada ítem con cantidad muestra de dónde sale esa cantidad.
- La lista base se genera sin conexión a la capa inteligente, con las reglas locales.
- Generar una lista dos veces para el mismo viaje no duplica ítems, actualiza la existente conservando lo ya
  marcado.

### VAL-31 · Marcar lo que ya está en la valija — P0

Como viajero quiero ir tildando a medida que guardo, para saber qué me falta.

- Cada ítem se marca como empacado y se puede desmarcar.
- Un contador muestra cuánto lleva empacado sobre el total.
- Se pueden agregar ítems propios que no estaban sugeridos.
- Se puede descartar un ítem sugerido, distinto de marcarlo como empacado.
- El estado sobrevive a cerrar y volver a abrir la app.

### VAL-32 · Aprender del historial — P0

Como viajero quiero que la lista mejore con cada viaje, sin tener que configurar nada.

- Al generar una lista se consideran las listas de viajes anteriores del mismo tipo.
- Un ítem que la persona agregó a mano en dos viajes del mismo tipo aparece sugerido en el siguiente.
- Un ítem descartado dos veces en el mismo tipo de viaje deja de sugerirse.
- La lista indica qué ítems vienen del historial personal y cuáles de las reglas generales.
- Sin historial previo, la lista se genera igual con las reglas base.

### VAL-33 · Ajustar por destino y época — P1

Como viajero quiero que la lista contemple cómo va a estar el clima donde voy.

- La capa inteligente recibe destino, fechas y tipo, y agrega ítems específicos.
- Cada ítem específico del destino explica por qué está sugerido.
- Si la capa inteligente falla o no está disponible, la lista base se muestra igual y se avisa que faltó el
  ajuste por destino.

### VAL-34 · Compartir la lista con quien viaja conmigo — FUERA DE ALCANCE

Como viajero quiero que quien viaja conmigo vea la lista y marque lo suyo.

- La lista es parte del viaje y se comparte con él, respetando permisos de lectura y edición.
- ~~Se distinguen los ítems compartidos del grupo de los personales de cada uno.~~

**Sacada del alcance por el PO durante la iteración.** El primer criterio se cumple solo: la lista vive
dentro del viaje, así que ya viaja con el link compartido y respeta los permisos de lectura y edición.

El segundo es imposible hoy. Distinguir los ítems del grupo de los personales, y poder decir quién empacó
qué, requiere saber quién es cada persona que abre la app. La plataforma no expone identidad por visitante,
así que la app no puede diferenciar a dos personas que entran con el mismo link.

Se mueve a la iteración 2, donde llegan las cuentas propias con VAL-13. El diseño ya está hecho y esperando:
el estado 13 del muestrario tiene resuelta la vista de ítems del grupo.

Consecuencia para esta iteración: la lista se comparte y varios pueden marcarla, pero todos ven una sola
lista común sin distinguir de quién es cada ítem.

### VAL-35 · Llevar la lista en el PDF — P2

Como viajero quiero la lista en el resumen imprimible.

- El PDF del viaje incluye la lista con su estado de empacado.

## Fuera de alcance en esta iteración

- Peso y límites de equipaje por aerolínea.
- Fotos de los ítems.
- Listas por persona dentro del mismo viaje. Requiere identidad por visitante, que la plataforma no da hoy.

## Cómo se valida

Cada criterio de aceptación se prueba contra la app publicada, en un teléfono, con un viaje real cargado. Un
criterio que no se puede verificar así se considera no cumplido.
