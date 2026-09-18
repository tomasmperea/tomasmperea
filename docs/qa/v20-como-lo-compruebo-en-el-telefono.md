# v20 — las pruebas, paso a paso

**Link:** https://claude.ai/artifact/3Q4KLi6g3ygTAJdR79aTCf

Abrilo en el teléfono. **Son cuatro pruebas.** La 4 es nueva y es la única que falta para cerrar la
iteración 3; las otras tres ya las hiciste en la v19 y anduvieron, pero conviene rehacerlas rápido por si
algo se rompió en el camino.

En todas, si algo sale mal: **sacá captura y mandámela.**

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
6. Elegí el PDF de Aerolíneas.
7. Esperá unos segundos.
8. Tocá **Guardar**.

**Anda si:** aparece el nombre del archivo y al lado su peso, tipo `PDF · 123 KB`.

**Falla si:** aparece texto en rojo.

---

## Prueba 2 — importar el mismo PDF

1. Dentro del viaje, tocá **Importar**.
2. Tocá **Subir el PDF**.
3. Elegí el mismo PDF.
4. Esperá unos segundos.
5. Si se puede tocar **Interpretar**, tocalo y seguí hasta **Guardar**.

**Anda si:** aparece el archivo con su peso y **Interpretar** se puede tocar.

**Falla si:** hay texto en rojo, o **Interpretar** queda apagado.

---

## Prueba 3 — la foto

1. Entrá a cualquier reserva.
2. Bajá hasta **DOCUMENTO**.
3. Tocá **Sacar foto**.
4. Sacá una foto de cualquier cosa.

**Anda si:** entra y muestra su peso.

**Falla si:** texto en rojo.

---

## Prueba 4 — la caja de pegar el texto ← **ESTA ES LA NUEVA**

Es lo único que cambió en la v20 y lo único que falta para cerrar la iteración. Son diez segundos.

1. Entrá a un viaje.
2. Tocá **Importar**.
3. **Primero mirá arriba, donde están los botones.** Tiene que haber **un solo botón**: `Subir el PDF`.
   - *(Si además aparecen `Sacar foto` o `Galería`, avisame y pará: la prueba no sirve, porque tu teléfono
     está en otro estado y lo que veas abajo no prueba nada.)*
4. Ahora mirá más abajo, donde dice **Pegar el texto del correo**.

**Anda si:** aparece **cerrada** — se ve sólo el título con un `+` al lado, sin el recuadro grande para
escribir.

**Falla si:** aparece abierta, con el recuadro a la vista.

5. Tocá el título.

**Anda si:** se abre y aparece el recuadro para escribir.

---

## Qué me mandás

| Si pasó esto | Mandame |
|---|---|
| **Las cuatro andan** | **"anduvieron las cuatro"** y cierro la iteración 3 |
| Alguna falla | la captura |
| En la prueba 4 aparecen más de un botón arriba | avisame: la prueba no sirve así |
| Arriba no dice v20 | avisame antes de seguir |
| Se queda en "Preparando el archivo…" y no cambia más | la captura y **"quedó colgado"** |
| El teléfono muestra un cartel de **"Memoria insuficiente"** | la captura |

**Sobre las capturas:** cuando algo falla, abajo del texto rojo aparece **un renglón chiquito gris con
números**. Sacá la captura de forma que ese renglón entre completo. Con ese renglón se resolvió en una
ronda el problema que llevaba cuatro.

**Sobre el cartel de "Memoria insuficiente":** apareció en una de tus capturas del 17/09. **No es de la
app**, es de Android, y no tengo cómo mirarlo desde acá. Sigue anotado como observación sin conclusión: no
lo estoy llamando defecto. Si vuelve a aparecer, mandalo — puede no ser nada, o puede ser un segundo
problema, y con dos apariciones ya deja de ser casualidad.

---

<details>
<summary>Si te interesa: qué se arregló en la v19 y qué cambió en la v20</summary>

**La v19 cerró el defecto de las cuatro rondas.** Tu captura lo resolvió: el renglón gris decía
`informa 123129 B · memoria 0 B`, un solo intento de leer un archivo de 123 KB.

El error era mío y estaba desde el principio. Antes de leer el archivo había un atajo que preguntaba "¿este
archivo ya trae los datos puestos?". La pregunta se conformaba con que **existiera** algo con ese nombre, y
los navegadores nuevos —el tuyo— le agregaron a todos los archivos una función que se llama igual. El atajo
contestaba que sí, agarraba la función en vez de los datos, sacaba cero, **y devolvía sin probar nada más.**
Los tres arreglos anteriores tocaban código que ese atajo salteaba.

Y explica lo de la foto de la cámara, que yo había explicado mal: no entraba por venir de la cámara, entraba
porque pesaba 2,7 MB. Arriba de 190 KB el archivo va por otro camino que no pasa por el atajo. Tus PDF
pesaban 123 KB y 20 KB. **La diferencia era el tamaño.**

**La v20 es sólo tu pedido:** que la caja de pegar el texto arranque colapsada. Sigue abriéndose sola en los
casos donde pegar es lo único que se puede hacer, y nunca esconde texto que ya escribiste.

**Qué está probado y qué no:** las pruebas 1, 2 y 3 las validaste vos en la v19, en tu teléfono. La prueba 4
todavía no la vio nadie ahí: el cambio se probó en la computadora, con los cuatro estados de esa pantalla
cubiertos. Por eso la iteración no está cerrada hasta que hagas esa prueba.

</details>
