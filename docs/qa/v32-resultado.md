# v32 — resultado de la prueba en el teléfono del PM

**Fecha:** 22/09/2026 · **Quién:** el PM, en su Android · **Veredicto: las dos pruebas pasaron.**

Esto es lo único que este proyecto llama **verificado**: el Artifact publicado, abierto desde el teléfono.

---

## Prueba 1 · el viaje multidestino a Europa

Encabezado en pantalla: **EUROPA · CIUDAD**. Lista de 37 ítems.

Los tres ítems de "Específicos del destino", textual de la captura:

| Ítem | Motivo |
|---|---|
| Paraguas plegable | "Abril es mes de lluvias intermitentes en **Madrid, París y Roma**, así que te sirve en los tres tramos." |
| Riñonera o bolsillo interno antirrobo | "Vas a moverte mucho en metro y zonas turísticas de **Madrid, París y Roma**, donde el carterismo es común." |
| Mochila plegable para el día | "Con más de **cuatro días en Madrid, cinco en París y tres en Roma**, casi todo el viaje son jornadas largas de caminata urbana." |

**Los tres nombran las tres ciudades.** El criterio de aceptación de VAL-72 era textual: *"un viaje 'Europa'
con vuelos a Madrid, París y Roma tiene que sugerir para esas tres ciudades, no para 'Europa'"*. Cumplido.

Y el tipo de viaje salió **ciudad**, no "mixto" ni "montaña": la jerarquía nueva de `suggestTripType`
funciona con datos reales.

### Y algo que NINGUNA auditoría podía comprobar desde acá

El tercer motivo dice **"cuatro días en Madrid, cinco en París y tres en Roma"**. Nadie le pasó esos números:
**el modelo los calculó** de los renglones crudos que la novena ronda decidió mandarle en vez de resumirlos.

Esa decisión fue la que cerró tres rondas de vetos. El razonamiento era: la anotación de tiempo que yo
escribía mentía de una forma distinta cada vez, y el modelo ya recibía las horas de cada vuelo, así que mejor
apuntarle al dato crudo que resumírselo. **Era una apuesta declarada como no verificable** — quedó escrita
así en la auditoría de la novena ronda y en las cuatro confirmaciones siguientes.

Esta captura la resuelve: el modelo lee `{"tipo":"entre-vuelos","ciudad":"MAD","horasEnTierra":105.5}` y
escribe "más de cuatro días en Madrid". **El dato crudo alcanzó, y el resumen habría estorbado.**

---

## Prueba 2 · el control, que es el caso que volteó dos auditorías

Viaje **Bariloche**, destino escrito "Bariloche", **una sola reserva: un traslado a Ezeiza**, sin vuelos.

Encabezado en pantalla: **BARILOCHE · MONTAÑA**. Lista de 41 ítems.

| Ítem | Motivo |
|---|---|
| Antiparras o anteojos de sol para nieve | "En **Bariloche en julio** hay nieve y el reflejo del sol en la montaña encandila." |
| Mochila chica para excursiones de día | "Para las **salidas de montaña en Bariloche**, llevando abrigo extra y agua." |
| Termo | "Práctica habitual en la zona y útil con el **frío de julio** en las salidas de día." |

**Cero mención a Buenos Aires o a Ezeiza.** El traslado en el punto de partida no desplazó el destino
escrito, que es exactamente el defecto que las rondas 2 y 3 encontraron y que costó rediseñar la función
entera.

---

## Qué queda sin verificar

- **Si las sugerencias son las MEJORES.** Se verificó que el motor recibe el destino correcto y que el
  modelo lo usa. Qué tan buena es la lista es otra pregunta, y es de producto, no de este arreglo.
- **Tema claro.** Las dos capturas son en tema oscuro.
- **Un viaje con escala corta de verdad** (dos horas en un aeropuerto): no se probó en el teléfono. Acá el
  motor manda el dato; queda por ver si el modelo no sugiere nada para esa ciudad.
