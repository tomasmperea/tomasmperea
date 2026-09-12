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

## El dato que corrige una suposición mía

Yo había leído del contrato que el visor bloquea *toda* descarga que no sea un script.
**Es más preciso que eso: bloquea por host, no por tipo de archivo.** El motor es un
archivo WebAssembly —no un script— y bajó perfecto desde el CDN permitido. El
diccionario falla porque vive en `tessdata.projectnaptha.com`, que no está en la lista.

Queda anotado porque cambia qué es posible en general, no sólo acá.

## Lo que quedó abierto

La sonda no pudo leerse el resultado del chequeo de `limits()` (quedó fuera de la
captura), así que **VAL-56 sigue sin respuesta escrita**: no sabemos todavía si esa
vista informa que acepta imágenes. La sonda sigue publicada y lo contesta en la primera
pantalla.

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
