# VAL-80 — el campo del vuelo te come letras, y eso rompe la cadena entera

Brief de trabajo. Lo que está acá se construye; lo que no está acá, no.

**P0.** El PM lo reportó el 22/09 y se difirió por decisión suya para sacar VAL-76 y VAL-77a primero. Esas
dos están terminadas y verificadas en su teléfono, así que el motivo de la espera ya no existe.

---

## Qué pasa, reproducido de nuevo el 24/09 contra el motor de la v35

El PM escribió `SUECIA` en **Destino (IATA)** de un vuelo. El campo tiene `maxlength="4"` y guardó `SUEC`,
sin decirle nada.

Pero el defecto es más ancho que eso, y esto es nuevo respecto de lo que decía el backlog:

```
ARN      → destino en firme   ← código real, correcto
SUEC     → destino en firme   ← truncado
SUECIA   → destino en firme   ← sin truncar, igual de roto
OS       → destino en firme
oslo     → destino en firme
```

**Cualquier `to` que no sea un código de tres letras desplaza al destino escrito.** El truncado no es la
causa: es lo que lo hizo visible. Un `to` con el nombre entero de la ciudad rompe exactamente igual.

Y las dos funciones que leen ese campo se contradicen sobre el mismo dato:

| Quién lo lee | Qué hace con `SUEC` |
|---|---|
| `deduceInternational` | filtra por `/^[A-Z]{3}$/` y **lo ignora**: decide por el texto del viaje |
| `destinosDelViaje` | lo toma como **destino en firme** y desplaza al escrito |
| La cabecera de la valija | muestra `trip.destination`: el escrito, o sea **el que no manda** |

Al modelo le llega, textual:

```
- Destinos, sacados de los vuelos ya cargados, que son lo que manda: SUEC (vuelo).
  La persona además escribió "Noruega" como destino del viaje: úsalo sólo como contexto.
```

El destino que manda es una cadena que no significa nada, y lo único reconocible que ve el modelo es el
destino viejo. Por eso el PM veía que le seguía sugiriendo Noruega después de cargar un vuelo a Suecia: **no
es que la app ignorara el vuelo, es que el vuelo le llegó mutilado.**

---

## Lo que entra

### 1 · La guarda del motor

Un `to` que no es un código IATA de tres letras **no puede desplazar al destino escrito**. Pasa a ser
**pista**, exactamente igual que una dirección: viaja al modelo entera y con sus fechas, y no despeja nada.

Ese criterio ya está escrito en `destinosDelViaje`, para las direcciones:

> *"Una dirección es texto libre y no hay nada guardado contra qué compararla. (...) Código contra código se
> comparan, así que de un vuelo sí se puede afirmar que no es el punto de partida."*

El razonamiento es correcto y la implementación no lo aplica: se le creyó al `to` de un vuelo por ser de un
vuelo, sin preguntar si era un código. **Es un defecto de forma, no de un caso.** Antes de darlo por
arreglado, `grep` de la estructura en todo el archivo: cada lugar que lee `from` o `to` de un vuelo y asume
que es un código.

**Y el vecino que hay que mirar sí o sí:** `casa`, el descarte del vuelo de vuelta, sale de
`norm(vuelos[0].from)`. Si el `from` tampoco es un código, ¿esa comparación sigue valiendo? Decidilo leyendo,
no de memoria, y escribí por qué.

### 2 · Que el campo deje de mutilar

Hoy hay **tres números distintos para el mismo dato**: el rótulo dice IATA (3 letras), el campo acepta 4, el
motor reconoce 3.

**Lo que no se puede hacer es seguir comiendo letras en silencio.** Bajar el `maxlength` a 3 es el mismo
defecto con una letra menos: quien escribe `SUECIA` obtiene `SUE` y tampoco se entera.

Entonces: el campo deja de truncar, y si lo que hay adentro no es un código de tres letras **se dice** — qué
pasó y qué hacer. **No bloquea el guardado**: con la guarda del punto 1 un `to` que no es código ya funciona
como pista, así que impedir guardar sería peor que aceptar. Se avisa y se guarda.

El mensaje no inventa una causa y no pide disculpas. Dice que ahí va el código de tres letras del aeropuerto,
que el nombre de la ciudad todavía no se puede traducir, y qué va a hacer la app con lo que escribió.

**El vecino, que el backlog no nombra:** la pantalla de revisar lo importado también tiene campos `from` y
`to` (`data-f="from"`), y ésos **no** tienen `maxlength`. O sea que el truncado es sólo del formulario manual
pero el dato malo entra por los dos lados. La guarda del motor cubre los dos; el aviso hay que decidirlo
para los dos, leyendo cada pantalla.

---

## Lo que NO entra

**Que el campo acepte nombres de ciudad.** Es lo que el PM intentó hacer y es lo más grande: necesita
traducir ciudad ↔ IATA, que es **VAL-66**. Si el arreglo parece necesitarla, ésa es la señal de que se pasó
de alcance — se anota y la entrega sale sin ella.

---

## Cómo se prueba

**Empezá por el gesto.** La prueba escribe en el campo y toca Guardar; no llama a la función por dentro.

Los gestos que necesitan prueba propia:

1. Escribir `SUECIA` en Destino (IATA) de un vuelo y guardar: **no se comen letras**, y la app dice algo.
2. Escribir `ARN` y guardar: no dice nada, y sigue siendo destino en firme. **Éste es el caso de éxito de
   VAL-72 y hay que correrlo DESPUÉS del arreglo, explícitamente.**
3. Un viaje multidestino con `MAD`, `CDG`, `FCO`: los tres siguen mandando y el aviso de multidestino sigue
   apareciendo. Es la historia que VAL-72 vino a resolver y no se puede romper.
4. Un `to` que no es código, ya guardado: llega al modelo **como pista, con sus fechas**, y el destino escrito
   vuelve a mandar.
5. Lo mismo entrando por la pantalla de revisar lo importado.
6. Una lista guardada antes de este cambio: se comporta igual que antes.

**Los fixtures se escriben leyendo el formulario.** Un vuelo tiene origen, destino, sale y **llega**; las
fechas son `datetime-local`. De cada campo opcional que el motor lee tiene que haber un caso con y un caso
sin. Y de `to`: casos de 2, 3 y 4 caracteres, en minúscula y en mayúscula.

**Todo arnés que rompe algo a propósito necesita al menos un caso que falle si el sabotaje no llegó.**

**Las regresiones de `app/pruebas/` corren enteras y en verde antes de decir que está listo.**

---

## Antes de commitear el arreglo

1. **¿Qué caso vecino comparte la causa?** Con `grep` de la estructura en todo el archivo, no en la función
   que estás tocando.
2. **¿El arreglo puede romper el caso que la historia vino a resolver?** Correr el multidestino de VAL-72
   **después**, explícitamente.
3. **¿Qué condición saqué, y qué caso la necesitaba?**
4. **¿El fixture se parece a lo que la app escribe?**

## Qué significa terminado

Criterios cumplidos, andando en un teléfono, e igual en claro y oscuro. Con puntaje del auditor: **70 para
salir como candidato**, **85 para terminado**. Lo que no se comprobó se declara: decir dónde se probó y qué
queda sin cubrir nunca es una mala nota; afirmar sin respaldo sí.

`git add` con rutas exactas. Ni `-A`, ni un punto, ni un directorio.
