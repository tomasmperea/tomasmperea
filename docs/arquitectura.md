# Valija — Notas técnicas

Para el equipo que tome el código. El MVP entero es un archivo: `app/valija.html`.

## Por qué un solo archivo

La decisión de arquitectura del MVP fue optimizar tiempo hasta tener algo usable en un teléfono real, no
elegancia estructural. Sin build, sin framework, sin dependencias que instalar. La única librería externa es
jsPDF, cargada por CDN con versión fija, y solo para generar el resumen.

Esa decisión se paga en la iteración 2, cuando entre el backend. El código está escrito para que ese momento
duela poco: la capa de datos está aislada detrás de un objeto `Store` y el resto de la app no sabe de dónde
vienen los datos.

## Cómo está organizado

El archivo sigue este orden:

1. **Tokens de diseño en CSS.** Paleta completa en `:root` y redefinición de tokens para tema oscuro, tanto
   por preferencia del sistema como por elección explícita del usuario.
2. **Iconos y catálogo de tipos.** Los seis tipos de reserva y sus rótulos.
3. **Utilidades de fecha.** Formato en español y aritmética de días y noches.
4. **`Store`.** La capa de datos.
5. **Motor de pendientes.** `REQUIRED`, `missingFields`, `tripAlerts` y `completeness`.
6. **Router por hash.** Dos vistas: lista y viaje.
7. **Render.** Funciones puras que devuelven HTML a partir del estado.
8. **Sheets.** Los formularios y diálogos.
9. **Exportación a PDF.**

## La capa de datos

`Store` funciona contra dos backends y la app no distingue cuál está activo:

- **En la nube.** Base de datos del artifact, compartida entre quienes tengan acceso. Estructura:
  `trips/{tripId}` para el viaje y `trips/{tripId}/items/{itemId}` para cada reserva. Una reserva por documento
  y no el viaje entero en uno solo, para que dos personas editando a la vez no se pisen: la escritura es
  último-que-escribe-gana y la granularidad por reserva limita el daño.
- **Local.** `localStorage` cuando la base no está disponible. Permite abrir el archivo suelto y que funcione.

Los cambios llegan por suscripción, así que dos personas editando el mismo viaje se ven en vivo sin recargar.

### Permisos de lectura y escritura

Se declaran al publicar: lectura para quien pueda abrir la página, escritura solo para quien tenga permiso de
edición. La app detecta en qué modo está con una escritura de prueba al arrancar, y si falla deshabilita los
controles de edición en lugar de dejar que fallen al usarlos.

## El motor de pendientes

`REQUIRED` declara los campos obligatorios por tipo de reserva, con su nombre en lenguaje humano para poder
decir "falta el código de reserva" en lugar de "falta confirmation". Agregar una regla nueva es agregar una
entrada ahí, o una condición en `tripAlerts` si la regla mira el viaje completo y no una reserva.

La regla de noches sin alojamiento construye el conjunto de noches cubiertas y lo resta del rango del viaje.
Es la única que no puede derivarse de una reserva individual y la de mayor valor para el usuario.

## La lectura de confirmaciones

Usa el modelo desde la propia página. El prompt está en `sheetImport` y tiene tres reglas que importan:
devolver un objeto por reserva, separar ida y vuelta en dos vuelos, y dejar un campo vacío antes que inventar
un dato. Lo interpretado se muestra para revisar y recién se guarda con confirmación explícita del usuario.

Acepta texto pegado y también imágenes, cuando la vista lo permite. La app consulta esa capacidad antes de
mostrar el campo de subir foto.

## Qué mover primero en la iteración 2

`Store` es el punto de corte. Reemplazar sus métodos por llamadas a la API deja intacto el resto de la app.
El motor de pendientes debería mudarse al servidor tal cual está, porque es el mismo cálculo que necesita el
proceso diario de correos: conviene extraerlo a un módulo compartido antes de duplicarlo.

## Publicar cambios

El archivo se publica como artifact. Republicar el mismo archivo actualiza la misma dirección y todos los que
tengan el link ven la versión nueva.
