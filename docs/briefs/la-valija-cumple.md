# Brief de iteración 4 — Que la valija cumpla lo que promete

**Escribe:** Product Owner
**Decide el alcance:** el PM, el 19/09, después de probar la app entera
**Consumen este brief:** motor, diseño UX/UI, frontend, QA, auditoría

---

## La pregunta que responde

**¿La valija inteligente es inteligente?**

Las iteraciones 1 a 3 construyeron la promesa: una valija que razona sobre el viaje. La prueba completa del
PM del 19/09 encontró que **la promesa no se cumple en el caso más obvio**: cambió el viaje de otoño a
verano y la lista no se movió.

Esta iteración no agrega funciones. Hace que las que existen hagan lo que dicen.

---

## Por qué "Avisar" se corre a la iteración 5

El roadmap tenía la 4 como la iteración de retención: correos, cron, buzón de reenvío, cuentas propias.
Eso **no es más Valija: es un backend nuevo** —servidor, base propia, autenticación, servicio de correo—, y
son semanas de infraestructura antes de que se vea un solo cambio en el teléfono.

El argumento que decidió el orden: **mandar correos sobre una valija que sugiere mal amplifica el problema
en vez de arreglarlo.** Un aviso semanal que recomienda ropa de otoño para un viaje de verano es peor que no
avisar.

Decisión del PM el 19/09. "Avisar" queda intacta y pasa a la 5.

---

## Alcance

### El corazón, y lo que define el éxito

**VAL-63 · La lista se entera de que cambió el viaje.** P0.

El motor ya sabe hacerlo: `planListUpdate` recibe el viaje entero y reconstruye. Falta el disparador —
`checkPackingPlan()` se llama al guardar una reserva y al importar, nunca al guardar el viaje.

Pero cablear el evento es la mitad barata. **El motor no tiene lógica propia de estación ni de clima**: la
única mención de temporada vive adentro del texto que se le manda al modelo. Toda la sensibilidad a "otoño
vs verano" está en la capa de IA y nunca se midió.

**VAL-66 · El motor sabe del destino.** P0.

Documentación de entrada —visa, vigencia de pasaporte, vacunas, permisos de menores—, y lo que cambia por
estación en ESE destino, no en general.

Van juntas y no se pueden separar: actualizar la lista al cambiar la fecha no sirve de nada si lo que
recalcula tampoco distingue una estación de otra.

**VAL-65 · El campo "Notas" alimenta al motor.** P2 por impacto, pero entra acá porque es del mismo tema.

Decisión del PM el 19/09, de tres salidas posibles. Hoy ese campo se guarda y nada lo lee: un campo que sólo
escribe promete una memoria que no existe. Pasa a ser entrada del motor, y la interfaz tiene que decir para
qué sirve, porque cambia qué significa escribir ahí.

### Lo que saca fricción

**VAL-70 · Entrar a una reserva sin entrar a editarla.** P1. Hoy abre en modo edición y eso genera cambios
involuntarios.

**VAL-68 · Subir el tope de documentos por reserva.** P1. Era una suposición nuestra, no un límite de la
plataforma; está escrito así en el propio código. Va junto con **VAL-62** (avisar del cupo de la base antes
de que falle un guardado), porque subir el tope hace que ese aviso importe más.

### Lo barato que se nota

**VAL-64** · un viaje vacío no muestra 100% completo. **VAL-67** · las categorías de la valija arrancan
colapsadas. **VAL-69** · el formato de fecha depende del tipo de reserva.

Entran si no compiten con el corazón. Ninguna justifica sola una iteración, y las tres se ven todos los días.

---

## Fuera de alcance, y por qué

- **Toda la infraestructura de "Avisar".** Va a la 5, entera.
- **VAL-71** · el resumen exportable sale mal. Es el final del recorrido y el PM lo puso en prioridad baja.
  Va con una condición cuando se haga: **se reproduce primero**. "Caracteres pisados" es el síntoma típico de
  una fuente sin los glifos del español, y puede que no haya que rediseñar nada.

### VAL-57, que hay que decidir y no estoy decidiendo solo

VAL-57 —que la confirmación del correo entre sin tipear— venía marcada como **primera prioridad de la
iteración 4** desde que se cayó de la 3. No entra acá, y eso es un compromiso que se corre por segunda vez:
queda dicho.

**Mi recomendación es que espere a la 5, y el motivo no es la prioridad: es que el buzón de reenvío la
reemplaza.** Reenviar un correo a una dirección es estrictamente mejor que abrir la app, copiar el texto y
pegarlo. Construir VAL-57 ahora es construir algo que la iteración siguiente vuelve innecesario.

Si el PM prefiere tenerla antes, entra — pero conviene que sea con esa consecuencia a la vista.

---

## Cómo se valida

Contra el Artifact publicado, en el teléfono del PM. Un criterio que no se puede comprobar así se considera
no cumplido.

**La prueba que define el éxito, y es la suya:** crear un viaje a Noruega para viajar ahora, cambiarlo a
verano, y que la lista se actualice sola con una diferencia que tenga sentido. El antes y el después
escritos, no "anduvo".

**Y la trampa que esta iteración tiene que esquivar.** Todo lo que se toca acá depende de la capa de IA, que
contesta distinto cada vez. Un arnés que la simula sólo puede confirmar lo que el que lo escribió ya creía —
es exactamente el error que costó cuatro rondas en la iteración 3. Acá hay un camino que allá no existía:
`app/pruebas/lote-modelo-real.js` ya le pregunta a un modelo de verdad. **Lo que se afirme sobre el
razonamiento del motor se prueba contra un modelo real o se declara sin probar.**
