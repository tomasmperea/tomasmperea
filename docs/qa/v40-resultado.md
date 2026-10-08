# v40 — el resultado de la ronda del PM

**Fecha:** 09/10/2026 · **Build:** v40, Artifact Versión 34 · **Historias:** VAL-79, VAL-92, VAL-94

El PM corrió el guion completo. No reportó fallas; reportó dos mejoras de experiencia, textual:

> *"1. es realmente molesto desde la UX que cada vez que elijo el destino del vuelo (no lo probé con los
> alojamientos) me haga la pregunta si sigo yendo al destino principal de la edición del viaje; deberíamos
> agregar una capa de inteligencia que entienda, ejemplo: si el destino principal del viaje es EEUU, y los
> vuelos tengo destinos a Orlando, Miami y NY, no me esté preguntando cada vez porque difiere de EEUU (son
> estados dentro de un mismo país y la lógica es correcta); ahora si el destino principal es Australia y tengo
> vuelos cargados a Escocia, si sería interesante que se le pregunte al usuario si fue un error o si es una
> escala, o si el viaje cambió*
> *2. solamente quiero que esto se pregunte y se actualice en la valija, no así también en los vuelos como
> está ahora porque es muy molesto cargar o importar vuelos y que surja esa pregunta de manera recurrente"*

**Diagnóstico del punto 1, medido y no supuesto:** «EEUU» no era un país para la app. El dato tiene los países
sólo con su nombre en español («Estados Unidos»), así que «EEUU» contra MCO daba "no se sabe", y la v40
preguntaba también cuando no se sabía.

Las dos mejoras van como **ronda 2 de VAL-79** (brief `docs/briefs/destino-del-vuelo.md`), en la v41.

**Sin respuesta explícita en esta ronda:** la tecla «→|» de Gboard (paso D2) y las capturas pedidas. El PM
dijo que probó todo el guion; no se da por verificado ningún paso en particular más allá de eso.
