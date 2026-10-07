# v39 — el resultado de la ronda del PM

**Fecha:** 07/10/2026 · **Build:** v39, Artifact Versión 33 · **Historias:** VAL-87 y VAL-85

El PM mandó tres capturas del teléfono (Android, Chrome, teclado Gboard) y cinco puntos. Textual:

> *"1. elige bien el origen y destino cuando el gesto es con el dedo*
> *2. queda lo que estoy escribiendo sin nada seleccionado de la lista cuando aprieto afuera o aprieto enter en el teclado*
> *3. si pongo 3 letras que no coinciden con nada también queda eso*
> *4. los temas claro/oscuro funciona bien*
> *5. estoy viendo que en un viaje creado con destino Bariloche pero que cargue de la lista origen buenos aires y destino Madrid, la valija actualiza y me sugiere por Madrid pero no me elimina o me sugiere eliminar los items por Bariloche, aún así no estén empacados; eso está mal porque debería primar ya un vuelo cargado, importado que por sobre el destino. en todo caso para corregir esto, hay que incluir algún warning en alguna parte del flujo cuando se cargue/importe algún destino distinto al principal del viaje en el editor preguntando si esto está Ok y si se confirma entonces más aún toma peso para el motor de la valija todos los destinos de los vuelos para alimentarse"*

## VAL-87 — contra el guion

| Paso | Resultado |
|---|---|
| A1 · elegir con el dedo | **OK** (punto 1). La ruta del vuelo guardado dice `AEP → MAD`: se guardó el código. |
| A1.3 · la lista con el teclado abierto | **OK.** La captura 1 muestra «aeroparqu» con la lista entera arriba del teclado. Gboard no cambió lo escrito: sugiere «Aeroparque» en su barra, pero no lo aplicó. |
| A2.1 · salir sin elegir | Queda lo escrito (punto 2). **Es lo que pide la tabla del brief**: un texto que no es código queda como pista. No dijo si apareció el aviso amarillo. |
| A2.3 · Enter/Ir | No elige (punto 2). **Es lo esperado y ya está anotado: VAL-92.** Medido: en Gboard la tecla es «→\|» (siguiente campo), no «Ir». |
| Tres letras fuera del dato | Quedan como se escribieron (punto 3). Es la fila 2 de la tabla del brief. |
| A3 · lo importado | **Sin respuesta.** |
| C · claro y oscuro | **OK** (punto 4). |

**Los puntos 2 y 3 describen el diseño, no un defecto.** Pero el punto 2 cuenta algo que el diseño no
previó: con «aeroparqu» hay **una sola** opción en pantalla y salir del campo no la toma. Va al PM como
decisión, junto con VAL-92 (ver abajo).

**VAL-87 sigue como candidata:** falta A3 (lo importado). Se agrupa en la próxima ronda.

## VAL-85 — sin respuesta

El PM no reportó la parte B. Sigue como candidata. Se agrupa en la próxima ronda.

## Punto 5 — es VAL-79, y VAL-87 era lo que la destrababa

Diagnóstico leyendo el código, no supuesto. En `destinoVencido` (`app/valija.html`):

```js
if (fuente !== String(actual.fuente || "")) return false;
```

Los ítems «por Bariloche» se razonaron con el destino **escrito**; desde que hay un vuelo, el destino sale de
**los vuelos** («MAD»). Fuentes distintas → la app no compara y retiene el ítem. Esa guarda se escribió a
propósito en VAL-75 (22/09) porque sin traducir MAD a una ciudad no había cómo saber si MAD es o no es
Bariloche. VAL-79 quedó esperando a VAL-66 por eso.

**VAL-87 trae esa traducción** (`porCodigo("MAD")` → Madrid, España). El prerrequisito ya existe.

**No es una regresión de VAL-87 ni de VAL-85:** esa guarda está igual desde VAL-75.

La propuesta del PM —preguntar cuando el vuelo va a otro lado que el destino del viaje— resuelve lo que la
traducción sola no puede: un destino escrito como «Patagonia» o «Europa» no se puede comparar con una ciudad.
Queda escrita en VAL-79 en el backlog.
