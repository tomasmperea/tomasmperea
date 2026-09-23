# El tipo de viaje — VAL-76 y VAL-77a

Brief de la iteración en curso. Es el contrato de trabajo: lo que está acá se construye, lo que no está
acá no.

**Diseño aprobado por el PM el 23/09.** El muestrario es `app/parts/tipo-de-viaje-ui.html`, ocho estados,
renderizado en los dos temas. La variante B quedó elegida y la A descartada; el muestrario las muestra a las
dos con su sello, y no hay que volver a discutirlas.

**No entra en esta iteración:** VAL-77b, la atribución de cada ítem a una de las dos partes. Está escrita en
el backlog con su dependencia y con la decisión que le falta. Si un arreglo de esta iteración parece
necesitarla, eso es la señal de que el arreglo se pasó de alcance.

---

## Qué pide cada historia

**VAL-76 — cambiar el tipo sobre una lista ya armada.** El botón existe y funciona (`pk-changetype`), pero
vive adentro de la hoja del ⓘ. El PM usó la app varios días y concluyó que no se podía. Lo que falta no es la
función: es que sea alcanzable desde donde se ve el tipo, y que se entienda qué va a pasar antes de tocarlo.

**VAL-77a — "mixto" deja de ser una etiqueta vacía.** Pasa a ser una combinación explícita de los tipos que
ya existen. El motor recibe las dos partes y las reglas de las dos suman. No se inventan tipos nuevos.

---

## Las decisiones de modelo de datos, ya tomadas

No son para revisar. Cada una tiene su motivo, y el motivo es una regla de CLAUDE.md que este proyecto ya
pagó.

**1. `list.tipoViaje` sigue siendo un string, siempre.** Con dos tipos guarda una forma canónica:
`"montana+ciudad"`, con las partes ordenadas según el orden de `TRIP_TYPE_KEYS` para que sea estable. No se
agrega un campo `tipoViajes` en paralelo: dos campos que dicen lo mismo se desincronizan, y eso es
exactamente el modo de falla que el proyecto ya tiene escrito.

**2. Una sola función parte el string, y todo el mundo la llama.** `tripTypeParts(s)` devuelve el array. No
hay un segundo lugar que haga `split("+")`. Una lista que hay que acordarse de mantener sincronizada se va a
quedar corta; la única pregunta es cuándo.

**3. `mixto` sobrevive como valor guardado y desaparece de la grilla.** `normalizeTripType("mixto")` sigue
devolviendo `"mixto"`, y `tripTypeParts("mixto")` devuelve `["mixto"]`. Las reglas que hoy dicen
`tripTypes:["ciudad","playa","mixto"]` siguen matcheando igual sobre una lista vieja. **Una lista guardada
antes de esta iteración tiene que comportarse exactamente como antes**, y eso es una prueba, no una
intención.

**4. El tope de dos lo pone la interfaz, no el parser.** `tripTypeParts` devuelve lo que encuentra. Si
truncara callado, convertiría una sorpresa en su propio diagnóstico, que es la compuerta que este proyecto ya
pagó en septiembre.

---

## El cambio en el motor

El matcher de reglas hoy pregunta por un escalar:

```js
if (cond.tripTypes && cond.tripTypes.indexOf(ctx.tripType) < 0) return false;
if (cond.notTripTypes && cond.notTripTypes.indexOf(ctx.tripType) >= 0) return false;
```

Con dos tipos eso deja de alcanzar. `ctx.tripTypes` pasa a ser el array, y el matcher pregunta si **alguna**
de las partes está en `cond.tripTypes` (y si **ninguna** está en `notTripTypes`).

**Y acá va el barrido, que es lo que más caro salió en VAL-72.** El defecto no es de la función: es de la
**forma** —un lugar que trata el tipo como un escalar—, y hay más de uno. Antes de dar por bueno el cambio:

```
grep -n 'ctx\.tripType' app/valija.html
grep -n '\.tipoViaje' app/valija.html
grep -n 'tripType\b' app/valija.html
```

Cada aparición se mira y se decide: ¿ésta quiere el string guardado, o quiere las partes? Se decide leyendo
el sitio, no de memoria. Los que ya sé que existen —y no son todos, por eso el grep— están en el matcher,
en `learnFromHistory`, en `tripContext`, en el rótulo de la cabecera, en el conteo del historial y en la hoja
del ⓘ.

**`learnFromHistory` compara la combinación entera.** Un viaje montaña+ciudad aprende de otros
montaña+ciudad, y no de los de montaña a secas. **Eso es una limitación declarada, no un defecto**: está
escrita en el backlog como lo que VAL-77b viene a cerrar. Se compara por conjunto de partes, no por string
crudo, para que `"ciudad+montana"` y `"montana+ciudad"` sean la misma cosa aunque alguna lista vieja haya
quedado al revés.

---

## Las pantallas

Las ocho del muestrario. El markup y el CSS están escritos ahí y se copian, no se reinventan.

| | Qué es |
|---|---|
| **Variante B** | Un renglón propio para el viaje en la cabecera: el botón del tipo, más los chips que ya existen. El renglón es del **viaje**, no del tipo. |
| **Elegir una** | La grilla de siempre, menos «Mixto». El caso normal no cambia en nada. |
| **Elegir dos** | Se marcan dos. La marca es un **tilde, sin número**: no hay tipo principal ni secundario. |
| **El tope** | Con dos marcadas, las demás se apagan pero **no se van**. |
| **Rehacer** | Cuatro renglones con un número cada uno: qué se conserva y qué se recalcula. |
| **Migración** | Una lista que dice «mixto» pregunta una vez de qué dos cosas era, sin bloquear nada. |

Lo que ya existe y no se toca: los tokens de color, la tipografía, el contenedor de 460px, `esc()` sobre
todo lo que viene de datos.

---

## Cómo se prueba, y esto no es opcional

**Empezá por el gesto.** Si se toca un botón, la prueba toca el botón. Disparar el evento interno que ese
botón debería producir saltea justamente el tramo donde vive el bug, y en este proyecto ya mató una entrega.

Los gestos que tienen que tener prueba propia, cada uno:

1. Tocar el botón del tipo desde la cabecera y llegar al selector.
2. Marcar una sola y armar la lista.
3. Marcar dos y armar la lista, y ver que entran ítems de las dos.
4. Marcar una tercera con dos ya marcadas, y ver que no pasa nada.
5. Destildar una de las dos.
6. Cambiar el tipo con la lista ya armada, y que lo empacado siga empacado, lo descartado siga descartado y
   lo manual siga ahí.
7. Abrir una lista guardada que dice `"mixto"` y que **funcione igual que antes**.

**Los fixtures se escriben leyendo el formulario, no de memoria.** Un vuelo tiene origen, destino, sale y
**llega**; un alojamiento tiene check-in, **check-out** y dirección; un auto tiene retiro, **devolución** y
lugar; un traslado tiene **desde**, hasta y fecha. Todas las fechas son `datetime-local`. De cada campo
opcional que el motor lee tiene que haber un caso con y un caso sin.

**Todo arnés que rompe algo a propósito necesita al menos un caso que falle si el sabotaje no llegó.** Un
escenario que espera que todo salga bien puede pasar porque el sabotaje nunca se aplicó.

**Y las regresiones que ya existen corren enteras.** `app/pruebas/` completo, en verde, antes de decir que
está listo.

---

## Antes de commitear cada arreglo

Las cuatro preguntas, que son las que este proyecto paga cuando no se hacen:

1. **¿Qué caso vecino comparte la causa?** Si el arreglo distingue A de B, preguntate por C — y buscalo con
   `grep` de la estructura en todo el archivo, no en la función que estás tocando.
2. **¿El arreglo puede romper el caso que la historia vino a resolver?** Correr el caso de éxito **después**
   del arreglo, explícitamente.
3. **¿Qué condición saqué, y qué caso la necesitaba?** Un `if` que estorba casi siempre protegía algo.
4. **¿El fixture se parece a lo que la app escribe?**

---

## Qué significa terminado acá

Los criterios de aceptación de arriba cumplidos, funcionando en un teléfono, e igual en tema claro y oscuro.
Y con puntaje del auditor: **70 para salir como candidato** —y sólo si lo único que falta es el teléfono—,
**85 para darlo por terminado**.

**Lo que no se afirma sin haberlo probado, se declara.** Este entorno no es un teléfono. Decir dónde se
probó, qué queda sin cubrir y cómo comprobarlo nunca es una mala nota; afirmar sin respaldo sí.

**Y no se commitea el árbol entero.** Mientras haya otro agente corriendo, `git add` con rutas de archivo
exactas. Ni `-A`, ni un punto, ni un directorio.
