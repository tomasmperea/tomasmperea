# v34 · VAL-75 terminada, y lo que el teléfono encontró

**Probado por el PM en su teléfono el 22/09**, sobre el Artifact publicado. Es lo único que este proyecto
llama *verificado*.

## Los tres pasos del guion: pasaron

| Paso | Qué había que ver | Resultado |
|---|---|---|
| 1 · El chip | que diga "por Noruega", no "por Argentina" | **OK** |
| 2 · Cambiar el destino | el aviso, la hoja, el botón "Sacar N", y que se vayan | **OK** |
| 3 · Lo empacado | que no aparezca en lo que se saca y siga empacado | **OK** |

De su captura de las 19:36: *"El viaje cambió: tengo **5** cosas para sumarle y **10** cosas que ya no
corresponden"*, con el botón **"Ver qué cambio"**. Y a las 19:38, después de aplicar: la lista pasó de **41 a
44** ítems, sumando 14 y sacando 10.

**VAL-75 se da por terminada.**

## Lo que el teléfono encontró y el escritorio no

El cartel de confirmación decía **"Sumé 14 cosas"** y se callaba las 10 que sacaba.

El toast que agregué para el caso "sólo sacar" no lo cubría: dispara únicamente cuando el plan **no** suma
nada, que es el caso que yo había probado con el dedo. **El mixto —el más común cuando cambia el destino,
porque casi siempre hay reglas nuevas y ítems viejos a la vez— quedaba mudo sobre la mitad de lo que hacía.**

Es la misma clase de error que el barrido de textos de la ronda anterior: arreglé la instancia que estaba
mirando. Arreglado en v34, con el caso mixto entero en el arnés de clics y su control negativo.

## Los pasos 4 y 5

**Paso 5 tiene respuesta, y es que no.** El modelo no marca solo los ítems del destino viejo. VAL-79 deja de
esperar el dato.

**Paso 4 destapó otra cosa**, y no era lo que ninguno de los dos pensaba: el campo *Destino (IATA)* del vuelo
tiene `maxlength="4"`, así que `SUECIA` se guardó como `SUEC`, sin aviso. Al modelo le llega ese `SUEC` como
destino que manda, y lo único reconocible que ve es el destino escrito viejo. Está entero en **VAL-80**, con
la reproducción y el contraste contra un IATA de verdad.

## Una que costó una publicación

El bump de versión de la v34 fue `sed '935s/"33"/"34"/'` sobre un archivo donde un comentario agregado minutos
antes ya había corrido esa línea a la **934**. El sed no encontró nada, **no falló**, y salió un build distinto
con el mismo "33" que el PM ya tenía probado.

Lo agarró el primero de los cuatro `grep` sobre el archivo **servido**. Ninguna prueba lo habría visto: el
número no cambia ningún comportamiento. Queda escrito al lado del propio sello.
