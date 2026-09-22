# v33 · Guion de prueba para el PM — VAL-75

**Qué cambió:** la valija ahora también se entera de lo que **sobra**, no sólo de lo que falta. Antes, un
viaje que sólo necesitaba sacar ítems terminaba con la app diciendo *"La lista sigue al día con lo que
cargaste"*.

**Dónde:** el Artifact publicado, **abierto desde el teléfono**. En la cabecera tiene que decir **v33**. Si
dice otra cosa, no es esta versión y la prueba no cuenta.

**Son tres pasos seguidos, sobre el mismo viaje.** Diez minutos, de una sentada.

---

## Paso 1 · El viaje que reportaste

Abrí **el viaje a Noruega que ya tenés**, el de la captura del 19/09. No armes uno nuevo: la gracia es que
esa lista se guardó con la versión vieja, y queremos ver que la app la entienda igual.

1. Entrá a la valija.
2. Mirá el chip de los ítems que sugirió la IA (pantalón impermeable, polar, buff).

**Qué mirar:** el chip tiene que decir **"por Noruega"**, no "por Argentina".

*(Si ese viaje ya lo cambiaste a Argentina, pasá directo al paso 2 y contame qué decían los chips.)*

---

## Paso 2 · Cambiar el destino

1. Desde la pantalla del viaje, tocá editar.
2. Cambiá el destino a **Argentina**. Guardá.

**Qué mirar, en orden:**

- Aparece un cartel. **¿Qué dice exactamente?** Sacale captura.
- Tocá el botón del cartel. Se abre una hoja.
- La hoja tiene que mostrar un bloque **"Saco ..."** con los ítems de Noruega, y abajo de cada uno *"Lo
  había sugerido por Noruega"*.
- **El botón de abajo tiene que decir "Sacar N"**, no "Sumar".

Tocalo.

**Qué mirar después:** los ítems de Noruega que **no** habías empacado desaparecieron, y la app te
confirma qué hizo.

---

## Paso 3 · Lo que empacaste no se toca

Antes de hacer el paso 2 —o en un viaje nuevo, da igual— **empacá uno** de los ítems que sugirió la IA
(tocá el círculo). Después cambiá el destino.

**Qué mirar:** ese ítem **no** tiene que aparecer en la lista de lo que se saca, y después de aplicar tiene
que seguir ahí y seguir empacado. Es tu regla del 22/09: si ya está en la valija de verdad, no se saca.

---

## Y una cuarta cosa, si te queda tiempo

Con un viaje cualquiera que tenga la valija armada, **cargá un vuelo**.

**Qué mirar:** la app **no** tiene que proponerte sacar nada de lo que sugirió la IA.

Esto lo encontró la auditoría antes de publicar: la app nombra el destino con el texto que escribiste
cuando no hay vuelos, y con el código de aeropuerto en cuanto hay uno. La primera versión comparaba los dos
como si fueran distintos y te proponía sacar cosas válidas. Está arreglado y probado acá, pero es el gesto
más común de la app y vale verlo en tu teléfono.

---

## Qué está probado acá y qué no

| | Estado |
|---|---|
| El motor: las cuatro reglas de estado, el destino vencido, la lista vieja sin el campo | Probado en Node, 35 afirmaciones |
| La pantalla: el cartel, la hoja, el botón, la confirmación | Probado con clics reales en Chromium de escritorio, 17 afirmaciones |
| El mismo gesto en tu teléfono | **Esto es lo que falta** |
| Que el modelo real conteste bien para Argentina | Sólo tu teléfono lo contesta |

Lo de arriba no es "verificado": es un sustituto, y su brecha es el visor del teléfono. Por eso el guion.
