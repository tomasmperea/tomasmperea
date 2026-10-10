# v41 — el resultado de la ronda del PM

**Fecha:** 10/10/2026 · **Build:** v41, Artifact Versión 35 · **Historias:** VAL-79 (ronda 2), VAL-92

El PM corrió el guion y mandó dos capturas. Textual:

> *"hay que mejorar todo: paso A: no pregunta si es una escala o es un destino nuevo pero me sugiere quitar
> items. ejemplo: cree el viaje a EEUU primero con vuelo a Orlando (sugirió en función de este destino) pero
> cuando le agregue un vuelo de Orlando a Miami me sugirió quitar los items de Orlando lo cual no tiene sentido
> porque después sugiere agregar de nuevo "mirando el viaje entero" Paso B: armo la valija y aparece la
> pregunta pero al mismo tiempo ya me sugirió que agregar antes de responder si es destino o es escala (y si
> es escala no lo debería considerar en la valija pero ya está agregado de antemano) Paso C: eso está OK Paso
> D: importar el vuelo si está preguntando lo cual entiendo que está bien (podría ser una escala) otra cosa
> que identifique es que cuando elijo la fecha del viaje me resta -1 día, es decir, si la fecha es del 10 al
> 19 el viaje se guarda del 9 al 18 y está mal también el formato de día/hora de los vuelos es incómodo y no
> restringe la vuelta si ya elegí una fecha de ida"*

| Paso | Qué vio | Qué se hizo | Dónde |
|---|---|---|---|
| A | Sumar Orlando → Miami propuso sacar lo de Orlando | **Causa sin determinar.** Un camino reproducido (fecha del vuelo nuevo anterior a la ida). Se publica una línea que dice lo que miró el motor | VAL-79 ronda 3 |
| B | La valija sugería para el vuelo antes de la respuesta | Un vuelo sin contestar no suma ni saca | VAL-79 ronda 3 |
| C | OK | — | — |
| D | Importar y que después pregunte: le parece bien | Sin cambios | — |
| Fechas | El viaje del 10 al 19 se mostraba del 9 al 18 | Causa leída y reproducida en horario argentino; arreglada | VAL-96 |
| Formato | Fecha y hora de los vuelos incómodas, sin límite entre ida y vuelta | Tres opciones dibujadas, **esperan elección del PM** | VAL-95 |

**Lo que dice el paso D, leído con cuidado:** el PM vio la pregunta en la valija después de importar. Desde la
v41 importar no pregunta en la pantalla de importar; la pregunta aparece en la valija. Es lo que se diseñó.

**Sobre el paso A**, «mirando el viaje entero» es el título de un grupo del panel del plan, no texto del
modelo. Eso ubica lo que vio el PM en el cálculo de la app («Saco…»), no en una sugerencia de sacar del
modelo.
