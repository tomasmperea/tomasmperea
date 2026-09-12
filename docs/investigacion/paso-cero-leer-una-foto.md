# Paso cero: ¿se puede reconocer texto de una imagen dentro de la app?

**Resuelto:** 12 de septiembre de 2026, probado por el PM en su teléfono
**Sonda:** `app/sonda-ocr.html` · https://claude.ai/code/artifact/0fb24b3b-66ae-44bd-b7db-075e487e0d98

## La respuesta: no, no con esa librería

El motor de reconocimiento **sí** carga y se inicializa. Lo que no llega nunca es el
**diccionario del idioma**, y sin diccionario no lee nada. Se probaron cuatro orígenes
distintos, incluidos dos en CDN permitidos. Ninguno bajó.

```
loading tesseract core       100%   ← el motor bajó
initializing tesseract       100%   ← arrancó
loading language traineddata   0%   ← se quedó acá, en los cuatro intentos
```

**Costó una tarde en lugar de una iteración.** Es exactamente para esto que existe el
paso cero.

## Una corrección: me había equivocado dos veces, y la segunda la arreglo acá

Primero leí el contrato y dije que el visor bloquea *toda* descarga que no sea un
script. Cuando el motor bajó bien, lo corregí y dije que el bloqueo era **por host y no
por tipo de archivo**. **Eso también estaba mal**, y el chequeo de la propia sonda lo
desmiente:

```
Una descarga que no es script → BLOQUEADA (TypeError) · 3 ms
```

Ese intento apuntaba a `cdnjs`, que **sí** es un host permitido, y aun así falló. Lo que
vale es la lectura original del contrato: **una descarga por `fetch` está bloqueada
siempre, incluso desde un host permitido.** Lo único que pasa es un `<script>`.

Entonces por qué bajó el motor: porque la librería lo carga **como script** desde dentro
de su worker, no con `fetch`. El diccionario del idioma, en cambio, se baja con `fetch`,
y por eso no llega **de ningún lado**.

**La consecuencia práctica es peor de lo que dije:** no existe ningún host desde el cual
el diccionario pueda bajar. La única vía sería empotrarlo dentro de la app como dato, y
para eso hace falta que alguien consiga el archivo —este entorno tampoco puede
descargarlo, por lo mismo—.

## VAL-56, contestada

La sonda leyó `limits()` en vivo en el teléfono del PM, el 12/09:

```
El modelo acepta imágenes en esta vista
  → NO acepta imágenes · prompt máximo 64 KB de texto
```

**Confirmado por el contrato, no inferido de un error.** La vista no acepta imágenes, y
punto. VAL-56 queda cerrada: VAL-41, VAL-42 y VAL-61 están bloqueadas por plataforma,
no por una falla nuestra ni por un error transitorio.

**Y un dato nuevo que no teníamos: el prompt tiene un tope de 64 KB de texto.** Fui a
ver si el motor lo respeta y sí: recorta a 12000 caracteres antes de armar el pedido,
avisando en el propio texto que recortó. Está en `MAX_CARACTERES_TEXTO`, decidido leyendo
el contrato. Un comprobante real no se acerca; un contrato de treinta páginas sí, y ahí
el recorte es visible en lugar de silencioso.

---

## El replanteo: el problema estaba mal planteado

El pedido del PM fue: *"muchas confirmaciones vienen por correo sin un PDF adjunto y
necesito que la funcionalidad sea capaz de interpretar la captura de pantalla del
correo"*.

La necesidad real no es **la captura**. Es **que la confirmación esté en el cuerpo de un
correo**. La captura era el medio que se le ocurrió para traerla.

Y para eso ya hay un camino que funciona hoy, sin construir nada: **copiar el texto del
correo y pegarlo.** La app ya tiene ese campo, y desde la iteración 2 está arriba y
abierto cuando no hay otra vía.

**Copiar el texto es estrictamente mejor que fotografiarlo:** no hay error de lectura,
no hay librería de varios megas, no hay diccionario que bajar, no hay segundos de
espera, y funciona sin señal. Un reconocedor de imagen sobre una captura de pantalla es
la peor versión de algo que el correo ya te da en texto perfecto.

Además, los dos sistemas operativos ya traen reconocimiento de texto propio para el caso
en que la captura sea la única fuente: Android lo ofrece en el propio editor de capturas
y en Lens; iOS, con Live Text. **El teléfono ya sabe hacer OCR.** No hace falta que la
app lo reimplemente peor.

## Las opciones, con lo que cuesta cada una

| # | Camino | Costo | Riesgo |
|---|---|---|---|
| **A** | **Guiar a copiar el texto del correo** y dejar el campo de pegado impecable | Bajo: una pantalla y su texto | Ninguno. Funciona hoy |
| B | Empotrar el diccionario dentro de la app como dato | Alto: ~3 MB más de app, y hace falta que el PM consiga el archivo porque este entorno no lo puede descargar | No verificable acá. Apuesta técnica |
| C | Esperar a que la plataforma acepte imágenes | Cero | No depende de nosotros. Plazo desconocido |
| D | Buzón de reenvío de correos | Alto: necesita servidor | Ya está en la iteración 4 |

**Recomendación: A ahora.** Resuelve la necesidad real, cuesta una pantalla, y libera la
iteración 3 para los otros dos pedidos del PM —adjuntar el documento y que la tarjeta de
embarque se desprenda de un vuelo— que son los que agregan valor que hoy no existe.

B queda registrada como apuesta posible si A resulta incómodo en la práctica. C se suma
sola el día que la plataforma lo habilite, y entonces la lectura de imagen pasa a ser el
camino preferido por precisión.
