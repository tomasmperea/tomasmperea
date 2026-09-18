# v19 y v20 — las pruebas, paso a paso

**Link:** https://claude.ai/artifact/3Q4KLi6g3ygTAJdR79aTCf

Abrilo en el teléfono. Son tres pruebas. En todas, si algo sale mal: **sacá captura y mandámela.**

---

## Antes de empezar

1. Abrí el link.
2. Mirá arriba, al lado de donde dice **Valija**.
3. Tiene que decir **v20**.

**Si no dice v20:** pará acá y avisame. Cerrá la pestaña, volvé a abrir el link y fijate de nuevo.

---

## Prueba 1 — adjuntar el PDF a una reserva

1. Tocá un viaje.
2. Tocá **Agregar**.
3. En el título escribí cualquier cosa, por ejemplo `prueba`.
4. Bajá hasta donde dice **DOCUMENTO**.
5. Tocá **Archivo**.
6. Elegí el PDF de Aerolíneas, el mismo de ayer.
7. Esperá unos segundos.

**Anda si:** aparece el nombre del archivo y al lado su peso, por ejemplo `PDF · 123 KB`.

**Falla si:** aparece un texto en rojo.
→ Sacá captura. Fijate que entre **el renglón chiquito gris de abajo**, el que tiene números.

8. Tocá **Guardar**.

---

## Prueba 2 — importar el mismo PDF

1. Dentro del viaje, tocá **Importar**.
2. Tocá **Subir el PDF**.
3. Elegí el mismo PDF.
4. Esperá unos segundos.

**Anda si:** aparece el archivo con su peso y el botón **Interpretar** se puede tocar.

**Falla si:** aparece un texto en rojo, o **Interpretar** queda apagado.
→ Sacá captura, con el renglón chiquito gris incluido.

5. Si anda, tocá **Interpretar** y seguí hasta **Guardar**.

---

## Prueba 4 — la caja de pegar el texto (nueva, v20)

Es la única que falta. Diez segundos.

1. Entrá a un viaje.
2. Tocá **Importar**.
3. Mirá abajo, donde dice **Pegar el texto del correo**.

**Anda si:** aparece **cerrada** — sólo el título con un `+` al lado, sin la caja de escribir.

**Falla si:** aparece abierta, con el recuadro grande para escribir a la vista.

4. Tocá el título.

**Anda si:** se abre y aparece el recuadro para escribir.

→ Si algo de esto no pasa, sacá captura.

---

## Prueba 3 — la foto

1. Entrá a cualquier reserva.
2. Bajá hasta **DOCUMENTO**.
3. Tocá **Sacar foto**.
4. Sacá una foto de cualquier cosa.

**Anda si:** entra y muestra su peso.

**Falla si:** texto en rojo.
→ Captura.

---

## Qué me mandás

| Si pasó esto | Mandame |
|---|---|
| Las tres andan | "anduvo" |
| Alguna falla | la captura, con el renglón chiquito gris visible |
| Arriba no dice v20 | avisame antes de seguir |
| Se queda en "Preparando el archivo…" y no cambia más | la captura y "quedó colgado" |
| El teléfono muestra un cartel de "Memoria insuficiente" | la captura |

---

<details>
<summary>Si te interesa: qué estaba roto y qué cambió</summary>

Tu captura de ayer resolvió el problema. El renglón gris decía `informa 123129 B · memoria 0 B`: un solo
intento de leer el archivo, sobre uno de 123 KB.

El error era mío y estaba desde el principio. Antes de leer el archivo había un atajo que preguntaba "¿este
archivo ya trae los datos puestos?". La pregunta estaba mal hecha: se conformaba con que **existiera** algo
con ese nombre. Y resulta que los navegadores nuevos —el tuyo— le agregaron a todos los archivos una función
que se llama igual. Así que el atajo contestaba que sí, agarraba la función en vez de los datos, sacaba cero,
**y devolvía sin probar nada más.**

Todo archivo volvía vacío antes de que existiera cualquier otro camino. Los tres arreglos anteriores tocaban
código que ese atajo salteaba. Por eso no cambió nada tres veces seguidas.

**Y explica lo de la foto de la cámara**, que yo había explicado mal: no entraba por venir de la cámara,
entraba porque pesaba 2,7 MB. Arriba de 190 KB el archivo va por otro camino que no pasa por el atajo. Tus
PDF pesaban 123 KB y 20 KB. La diferencia era el tamaño.

**Qué tan probado está:** esta vez el defecto se reproduce acá. Le agregué al navegador de pruebas la misma
función que tiene el tuyo, y con el código de la v18 el arnés falla 9 veces (8 en los dos gestos) mostrando
lo mismo que viste. Con el arreglo, verde.

**Qué no está probado:** que en tu teléfono alcance. Puede haber más de una cosa rota. Si falla de nuevo, el
renglón gris va a decir algo distinto, y esa diferencia ya es el próximo dato.

</details>
