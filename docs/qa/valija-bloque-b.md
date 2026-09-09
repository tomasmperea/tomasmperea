# QA — Bloque B: "la valija razona sobre el viaje completo" (VAL-44, VAL-45, VAL-46, VAL-43)

**Contra qué se valida:** `docs/briefs/interpretar.md` (bloque B) y `docs/design/valija-inteligente-b.md`,
apoyado en `docs/design/packing-engine.md` §§4-8. Se asume vigente todo lo ya probado en
`docs/qa/valija-inteligente.md` (iteración 1.5) salvo que un caso de acá lo contradiga.

**Cómo se probó.** `app/valija.html` corrido de verdad en Chromium headless
(`NODE_PATH=/opt/node22/lib/node_modules`, paquete `playwright` global) contra el archivo real, sin
reescribir la app. Todos los gestos se hicieron tocando el control que una persona tocaría: `click()` sobre
`#newtrip`, `#additem`, `[data-t="car"]`, `#pk-build`, el círculo `.pk-drop`, el encabezado de categoría
`.pk-cat-hd`, etc. — nunca se disparó a mano el evento interno que un control debería producir. Los scripts
usados quedan en el scratchpad de la sesión, no en el repo.

Este entorno bloquea el CDN, así que `claude.use("db")` y `claude.use("sample")` reales no están disponibles.
Para los casos que necesitan que la capa de IA responda (VAL-43, la mitad "viva" de VAL-45, el estado 07),
usé `page.addInitScript()` para reemplazar `window.claude.use` por una función que **respeta el contrato
documentado** (`ask(prompt) => {items, quitar, clima}` vía `sample.json`, ver `packing-engine.md` §1 y §6) —
mismo criterio que exige `app/parts/db-mock.js` para simuladores de plataforma: leído del contrato, no de
memoria. Donde no usé este simulador, lo digo explícitamente y el caso queda como no verificado en vivo.

Cada caso dice si lo **verifiqué corriendo la app** (con capturas), si lo verifiqué **a nivel de motor**
(Node, contra `packing-engine.js` real, no reescrito) o si lo **inferí leyendo el código** sin ejecutarlo.

---

## 1 · Casos de prueba

### VAL-44 · la capa inteligente ve el viaje completo

| # | Caso | Cómo | Resultado |
|---|---|---|---|
| 44.1 | El resumen de reservas que recibe la capa de IA nunca lleva `confirmation`, `phone` ni `address` | Verificado a nivel de motor: armé tres reservas (vuelo, alojamiento, auto) con código de reserva, teléfono y dirección reales, más una nota con un teléfono pegado a mano, y llamé `PackingEngine.summarizeReservationsForAI` directo. Ninguno de los ocho valores sensibles apareció en el `JSON.stringify` del resultado; el teléfono en la nota libre salió como `[dato omitido]` | **Pasa** |
| 44.2 | Las notas sí viajan, saneadas | Mismo test: la nota "El depto no tiene lavarropas. Llamar al 600123456 antes de llegar." llegó como "El depto no tiene lavarropas. Llamar al [dato omitido] antes de llegar." — el dato útil sobrevive, el teléfono no | **Pasa** |
| 44.3 | Cada sugerencia cita el dato concreto del viaje | Corriendo con el simulador de IA: un vuelo internacional cargado antes de armar la lista hizo que la regla de "adaptador de enchufe" quedara acreditada a `lista base`, no a la IA (ver 45.2) — es el mecanismo que hace posible citar el dato puntual. No pude ejercitar en vivo un caso donde el propio *texto* del motivo cite un dato de una reserva (ej. "tu escala en Lima es de 8 horas") porque mi simulador de `ask` no reproduce razonamiento real, solo el contrato de forma. **No verificado el contenido del razonamiento**, sólo el mecanismo que lo permite | **Parcial** |
| 44.4 | La capa inteligente recibe reservas de todos los tipos (vuelo, escala, alojamiento, auto, actividad) | Inferido leyendo `summarizeReservationsForAI` y la detección de escalas (`hoursBetween` entre vuelos consecutivos); no armé un viaje con escala real para verlo en pantalla porque no hay forma de ver el resumen desde la interfaz (es interno al prompt) | **No verificado en vivo** (la interfaz no expone este dato para inspeccionarlo sin abrir devtools) |

### VAL-45 · ningún ítem repetido entre capas

| # | Caso | Cómo | Resultado |
|---|---|---|---|
| 45.1 | Un sinónimo que la IA propone no duplica lo que una regla ya puso | **Verificado corriendo, de punta a punta**: cargué un vuelo internacional (pone "Adaptador de enchufe" por regla) y armé la lista con un simulador de IA que devuelve `{nombre:"Adaptador de corriente", motivo:"..."}` — sinónimo declarado en `SYNONYM_GROUPS`. La lista final tiene **un solo** ítem "Adaptador de enchufe", no dos | **Pasa** |
| 45.2 | El ítem duplicado se acredita a la capa de menor precedencia, nunca a la IA | Mismo test: el chip de origen del ítem quedó en `lista base`, no `por Madrid, España` (destino/IA), confirmando que `parseDestinationItems` lo descarta antes de que se le acredite a la capa 2 | **Pasa** |
| 45.3 | Un ítem legítimo nuevo de la IA (sin sinónimo en la base) sí entra | Mismo test: "Repelente en aerosol" (no hay regla de repelente en un viaje de ciudad corto) apareció en la lista final, atribuido a destino | **Pasa** |
| 45.4 | `verifyNoDuplicateItems` no deja pasar duplicados en ninguna lista que arma el motor | A nivel de motor: `node app/parts/packing-engine.test.js` → 66/66 en verde, incluye el grupo VAL-45 completo (6 casos) | **Pasa** (motor, no re-testeado a mano) |

### VAL-46 · la lista se actualiza cuando el viaje crece

| # | Caso | Cómo | Resultado |
|---|---|---|---|
| 46.1 | Agregar una reserva a un viaje con lista ya generada dispara la detección | Verificado corriendo: armé lista tipo "ciudad" (28 ítems), agregué un auto por el formulario real y guardé → al volver a entrar a la valija apareció el aviso "Agregaste **el auto (Europcar)**. Tengo **2** cosas para sumarle a la valija." | **Pasa** |
| 46.2 | La tira de entrada (pantalla del viaje) también avisa, sin pedir nada | Verificado corriendo: la tira "Valija" mostró el chip "cosas nuevas" antes de entrar a la pantalla de empacado | **Pasa** |
| 46.3 | Aplicar el plan marca los ítems nuevos: barra ámbar + palabra "nuevo" + chip "N nuevos" en la categoría, y anima `.fresh` una vez | Verificado corriendo, con captura: fila "Licencia de conducir internacional" con banda ámbar, tag "nuevo" en mono, categoría "Documentación" con chip "2 nuevos" | **Pasa** |
| 46.4 | "Ahora no" aplaza sin perder el plan; no vuelve a ofrecerse solo, sobrevive a un reload, sigue accesible en "De dónde sale esta lista" | Verificado corriendo: aplacé, recargué la página completa (`page.reload()` + `goto` de la misma ruta), reentré a la valija → el aviso **no** volvió a aparecer solo, y la hoja de transparencia mostró "Novedades sin sumar" | **Pasa** |
| 46.5 | "Listo, ya las vi" limpia la marca de inmediato | Verificado corriendo: 2 ítems con `.is-new` antes del click, 0 después, sin recargar ni salir de la pantalla | **Pasa** |
| 46.6 | Degradación sin `IntersectionObserver`: cuenta visitas y limpia recién al salir de la segunda | Verificado corriendo con `IntersectionObserver` eliminado del `window` antes de cargar la página: aplicar y salir sin mirar deja la marca; una segunda visita completa (entrar y salir de nuevo) la limpia; al entrar una tercera vez ya no hay marcas | **Pasa** |
| 46.7 | El aviso que entra por el dock (estado 16) no mueve la lista bajo el pulgar | Verificado corriendo: con la pantalla de la valija ya abierta, forcé la escritura de una reserva y el recálculo (`checkPackingPlan`) — la posición de la primera categoría en pantalla no cambió un píxel; el dock apareció fijo abajo. **Nota de método:** este escenario en la vida real lo dispara *otra persona* escribiendo por `onSnapshot` mientras la primera está empacando; no tengo una base compartida real en este entorno para simular dos sesiones, así que forcé la misma función que dispararía esa escritura (`checkPackingPlan`) en vez del evento de red — es la única forma de llegar a este estado sin una base compartida real, lo declaro explícitamente | **Pasa** (con la salvedad de método) |
| 46.8 | Sólo lectura: aviso sin acciones, con el texto exacto documentado | Verificado corriendo, forzando `Store.canWrite=false` tras generar el plan: el aviso mostró "Estás viendo la valija de este viaje. Quedó vieja... Las puede sumar quien tenga permiso de edición." sin ningún botón de acción | **Pasa** |
| 46.9 | Aceptar una propuesta desde la fila hace `dismissItem` + `clearRemovalSuggestion` en la misma escritura | Verificado corriendo (ver también VAL-43): toqué el círculo teñido → el ítem pasó a `descartado` y la propuesta desapareció de la hoja de transparencia en la misma acción, sin un segundo paso | **Pasa** |
| 46.10 | Un ítem agregado a mano nunca recibe `sugerenciaQuitar`, aunque la IA lo proponga | Verificado **a nivel de motor**, con un `ask` fabricado a mano que devuelve exactamente `{quitar:[{nombre:"Mate y termo", motivo:"..."}]}` apuntando a un ítem creado con `addManualItem`: `enrichWithDestination` lo procesó y el ítem terminó sin `sugerenciaQuitar`. No es sólo la prueba unitaria existente del motor — la reproduje aparte, con mi propio `ask`, siguiendo la recomendación de `CLAUDE.md` de no confiar en un simulador de memoria | **Pasa** |
| 46.11 | Progreso: el contador y el `pct` se mantienen coherentes al sumar ítems nuevos y al aceptar una propuesta de sacar | Verificado corriendo: 28→30 al aplicar 2 nuevos ("0 de 30 · faltan 30"); 30→29 al aceptar una propuesta de sacar sobre uno de esos nuevos ("descartar saca del total", como documenta `packing-engine.md` §8) | **Pasa** |
| 46.12 | Recálculo al entrar (`recalcularPlanAlEntrar`): corre una vez por viaje y por sesión | Verificado **leyendo el código**: `PK_RECALC_HECHO` es un `Set` por `tripId` que se llena antes de la promesa y sólo se borra si la lectura del historial falla o si `checkPackingPlan` corrió después (invalidación explícita). No lo ejercité en vivo entrando y saliendo muchas veces porque el resultado sería indistinguible de 46.1 sin inspeccionar el `Set` interno; sí lo hice indirectamente en casi todos los demás casos (cada reentrada a la valija pasa por acá) sin encontrar recomputaciones dobles | **Verificado por lectura + uso indirecto**, no con una aserción dedicada |
| 46.13 | Dos viajes con listas viejas en la misma sesión no se pisan entre sí | **No verificado.** No armé el escenario de dos viajes distintos, cada uno con su propia lista desactualizada, alternando entre ambos. `App.plan`/`App.planTripId` es un slot único (no un mapa por viaje), así que en teoría el plan de un viaje se pisa con el del otro cada vez que se entra a uno distinto — es exactamente lo que `planDe()` espera (compara `App.planTripId` contra el `tripId` pedido) y por diseño se recalcula al reentrar, pero **no lo comprobé tocando la app** | **No verificado** |

### VAL-43 · la lista se adapta al destino de verdad, y puede sacar ítems

| # | Caso | Cómo | Resultado |
|---|---|---|---|
| 43.1 | La IA puede proponer sacar un ítem con motivo, y no lo aplica sola | Verificado corriendo con el simulador de IA: "Licencia de conducir internacional" quedó con el círculo de descartar teñido de ámbar, el ítem siguió en la lista, `pendiente`, con su motivo original intacto — nada se borró solo | **Pasa** |
| 43.2 | La fila no crece: la única marca es el color del botón de descartar | Verificado corriendo (captura): la fila de la propuesta ocupa el mismo alto que cualquier otra, sin bloque de texto adicional | **Pasa** |
| 43.3 | Aceptar desde la fila (círculo teñido) resuelve con un toque | Verificado corriendo: toqué `.pk-drop.sug` → el ítem pasó a `descartado` y la sección "Cosas que capaz no necesitás" de la hoja de transparencia quedó vacía | **Pasa** |
| 43.4 | El piso: un ítem crítico (DNI, pasaporte) nunca puede recibir una propuesta de sacar, aunque la IA lo pida | **No reproducido de forma independiente en este QA** — el brief de integración declara haberlo cubierto ("el DNI sin marca aunque la IA lo proponga"), y lo confirmé por lectura de código (`isCriticalClave`, filtrado en `parseDestinationItems` antes de que la propuesta llegue al documento) más el caso de motor ya en verde. No repetí el experimento con mi propio `ask` fabricado por respetar la indicación de no volver a probar lo que integración ya cubrió con navegador real | **Pasa** (heredado + código leído, no re-ejecutado) |
| 43.5 | Un ítem nuevo (VAL-46) que en la misma pasada recibe también una propuesta de sacar (VAL-43) convive sin romper la fila ni la hoja | Verificado corriendo, con un `ask` que apunta la propuesta de sacar justo a uno de los dos ítems que la regla del auto acababa de agregar: la fila mostró **las dos marcas a la vez** (banda + tag "nuevo" y círculo teñido) sin crecer; la hoja del ítem mostró el bloque "TE PROPONGO SACARLO" arriba y, más abajo, "Se sumó a la lista el 9 de septiembre, cuando agregaste el auto (Europcar)." — los estados 22 y 23 conviven exactamente como documenta la especificación | **Pasa** |
| 43.6 | Datos sucios: nombre de reserva con `<`, comillas y HTML no rompe el aviso ni el encabezado de grupo de la hoja del plan | Verificado corriendo: proveedor `<img src=x onerror=alert(1)> "comillas" & <b>ñañó</b>` en una reserva de auto → el aviso y el encabezado de la hoja mostraron el texto escapado (`&lt;img...&gt;`), sin ningún diálogo de `alert()` disparado y sin romper el layout | **Pasa** |
| 43.7 | El aviso combinado "3+4" del §25 ("Sumé N cosas... Y hay N que capaz no necesitás. Verlas") aparece cuando la misma pasada de la capa de IA agrega ítems nuevos y además propone sacar uno de ellos, sin resolver la propuesta | Verificado corriendo, con captura: apliqué el plan (2 nuevos) sin tocar "Listo, ya las vi"; el aviso mostró las dos líneas juntas, "Sumé 2 cosas por el auto (Europcar)... Listo, ya las vi" y, debajo, "Y hay 1 que capaz no necesitás. Verlas", tal como documenta el §25 | **Pasa** |

---

## 2 · Hallazgos

### Bloqueante

#### H1 — Aplicar un plan de actualización calculado *antes* de regenerar la lista (o cambiar el tipo de viaje) descarta en silencio todo lo hecho después, y lo hace pasar por un éxito

**Qué pasa.** El plan que ofrece "Ver qué agrego" / "Sumar N" (`App.plan`) se calcula una vez, en el momento
en que se guarda una reserva, y queda en memoria con una copia completa de `plan.listaPropuesta`. Nada en la
app invalida ni recalcula ese plan si, mientras sigue pendiente, la persona **regenera la lista** ("Rehacer
la lista") o **cambia el tipo de viaje**. Al tocar después "Sumar N", `aplicarPlan` hace
`Store.savePacking(trip.id, plan.listaPropuesta)` — un `set` completo con la copia vieja — pisando entera la
lista recién regenerada. El aviso de confirmación dice "Sumé 2 cosas... Listo, ya las vi", como si todo
hubiera salido bien.

**Cómo se reprodujo (gesto real, Playwright sobre `app/valija.html`):**
1. Crear un viaje con fechas, entrar a la valija, elegir tipo **Ciudad**, tocar "Armar la lista" (28 ítems).
2. Volver al viaje, tocar "Agregar", elegir "Auto", cargar título/fechas/proveedor/dirección/código y guardar.
   Esto dispara `checkPackingPlan` y dos ítems quedan pendientes de sumar (licencia de conducir y su versión
   internacional).
3. Entrar a la valija: aparece el aviso "Agregaste **el auto (Europcar)**. Tengo **2** cosas para sumarle a
   la valija." — **sin tocarlo todavía**.
4. Tocar el ícono de información (`De dónde sale esta lista`) → "Cambiar el tipo" → elegir **Playa** →
   "Usar este tipo". La lista se regenera de verdad: pasa a 35 ítems, el header muestra "· Playa".
5. El aviso del paso 3 **sigue ahí**, sin haberse invalidado ("Agregaste el auto... Tengo 2 cosas...").
   Tocar "Ver qué agrego" → "Sumar 2".
6. Resultado: el header vuelve a decir "· Ciudad" y la lista vuelve a tener 30 ítems (28 + los 2 del auto).
   Los 5 ítems específicos de "Playa" que se acababan de agregar en el paso 4 **desaparecieron sin aviso**, y
   el tipo de viaje elegido a mano volvió al anterior. El único mensaje visible es el de éxito: "Sumé 2 cosas
   por el auto (Europcar). Quedan marcadas hasta que las mires."

**Qué debería pasar.** O bien `aplicarPlan` revalida contra la lista actual antes de escribir (recalculando
`plan` o al menos comprobando que la lista guardada no cambió desde que se calculó el plan), o bien
cualquier acción que reemplace la lista entera (regenerar, cambiar tipo) invalida `App.plan` y hace
desaparecer el aviso, obligando a que la detección se recalcule contra el estado nuevo antes de volver a
ofrecerse. Lo mínimo indispensable es que la app no deje aplicar un plan stale sin decir nada: si va a pisar
cambios hechos después de que el plan se calculó, tiene que preguntarlo, no aplicarlo con un mensaje de
"listo, ya está".

**Por qué importa más de lo que parece.** Esto no es sólo el caso de "cambiar el tipo". `runGenerate` nunca
toca `App.plan` bajo ningún camino, así que el mismo problema alcanza a "Rehacer la lista" con el tipo
**sin** cambiar en cualquier escenario donde la regeneración produzca una lista distinta a la que había
cuando se calculó el plan — por ejemplo, si la capa de IA sí está disponible (a diferencia de este entorno) y
devuelve una sugerencia distinta la segunda vez. En este entorno, sin `claude.use`, "Rehacer" con el mismo
tipo dio un resultado numéricamente idéntico al plan viejo y no mostró pérdida visible — lo comprobé aparte
— pero eso es una coincidencia de que acá no hay capa de IA, no una garantía de la app. También contradice
directamente la garantía que la propia hoja del plan promete por escrito un renglón antes del botón "Sumar":
*"Nada de lo que ya marcaste se toca"* — cambiar el tipo de viaje sí se toca.

**Gravedad: bloqueante.** Incumple la garantía central de VAL-46 ("nunca se pierde lo ya marcado") en un
camino de uso perfectamente normal (entrar, ver el aviso, decidir mirar antes otra cosa de la lista, volver),
y lo hace de forma silenciosa, con un mensaje que asegura éxito.

---

### Importante

#### H2 — Una categoría colapsada a mano por la persona no se abre sola cuando le llegan ítems nuevos, aunque la especificación dice explícitamente que tiene que hacerlo

**Qué pasa.** `docs/design/valija-inteligente-b.md` §4.3 dice, en el mismo párrafo que explica por qué existe
el mecanismo de "visto": *"las categorías con ítems nuevos se abren solas en la primera visita después de
aplicar. Una fila adentro de una categoría plegada nunca puede entrar en la ventana visible, y sin esto los
flags no se limpiarían jamás."* El código (`pkCategoryHtml`, `app/valija.html`) sí abre sola una categoría
con ítems nuevos **excepto cuando la persona la colapsó a mano en algún momento anterior** — el comentario en
el propio código lo declara a propósito ("Si la persona la pliega a mano, manda ella"), pero esa excepción no
está en la especificación aprobada y **rompe exactamente la garantía que ese párrafo dice sostener**.

**Cómo se reprodujo (gesto real):**
1. Crear un viaje, armar la lista tipo Ciudad (28 ítems, "Documentación" abierta con 7 pendientes).
2. Tocar el encabezado de la categoría "Documentación" para colapsarla a mano (gesto real: `click` sobre
   `.pk-cat-hd`). Confirmado con el propio DOM: `data-open` pasa de `"true"` a `"false"`.
3. Agregar una reserva de auto (dispara el plan de VAL-46, dos ítems nuevos, ambos caen en "Documentación":
   licencia de conducir y su versión internacional).
4. Entrar a la valija, tocar "Ver qué agrego" → "Sumar 2".
5. Resultado: la categoría "Documentación" muestra el chip "**2 nuevos**" en su encabezado, pero sigue
   **colapsada** (`data-open="false"`). Las filas nuevas están en el DOM con `display:none` (la regla CSS de
   `.pk-cat[data-open="false"] .pk-body-wrap`).

**Consecuencia concreta.** Mientras la categoría siga colapsada, las dos filas nunca entran a la ventana
visible (`display:none` nunca intersecta), así que el `IntersectionObserver` nunca las puede marcar como
"vistas", y tampoco se pueden tocar (el botón está oculto) para marcarlas como vistas por acción directa.
La única vía que sigue abierta es la explícita: el aviso "Sumé 2 cosas... **Listo, ya las vi**" —que, a
diferencia de lo que pensé al principio, sí sigue reapareciendo en visitas siguientes mientras
`pkItemsNuevos(list).length` sea mayor a cero, así que la marca **no queda atrapada para siempre**— pero eso
significa que alguien puede limpiar la marca de "nuevo" sin haber visto nunca, ni por casualidad, cuáles eran
esos dos ítems, si nunca vuelve a abrir esa categoría a mano. Es justo el escenario que el diseño dice que el
auto-open existe para evitar, sólo que en vez de un callejón sin salida queda una salida que no obliga a
mirar.

**Qué debería pasar.** Que una categoría con ítems nuevos se abra sola incluso si la persona la había
colapsado antes de que esos ítems existieran — el comentario del código ("si la persona la pliega a mano,
manda ella") tiene sentido para una categoría que **ya estaba así cuando se colapsó**, no para una que
después recibió contenido nuevo que la persona nunca vio. Alternativa más simple: que el colapso manual se
resetee cuando se aplica un plan, igual que se resetea `PK.avisoAplazado`/`PK.hideRemovals`/`PK.seenNew` en
`pkMount` — hoy `PK.openCats` es la única pieza de estado por-visita que sobrevive sin querer entre visitas.

**Gravedad: importante.** No impide cumplir VAL-46 (los ítems se agregan y se marcan correctamente en el
dato), pero degrada justo la garantía de descubribilidad que el diseño dice que existe para eso, en un gesto
tan común como colapsar una categoría que uno ya completó.

---

## 3 · Lo que no pude verificar, explícitamente

- **VAL-44, el contenido del razonamiento de la IA** (que cite el dato puntual del viaje en el texto del
  motivo, ej. "tu escala en Lima es de ocho horas"). Verifiqué el mecanismo que lo hace posible
  (`summarizeReservationsForAI`, la detección de escalas, la atribución de origen), pero mi simulador de
  `ask` respeta el contrato de forma, no reproduce razonamiento real — depende del modelo real, que este
  entorno no tiene.
- **VAL-46.13, dos viajes con listas viejas en la misma sesión, alternando entre ambos.** No lo probé
  tocando la app. `App.plan`/`App.planTripId` es un único slot, no un mapa por viaje; por lectura de código
  parece correcto (se recalcula al reentrar a cada viaje), pero no tengo una aserción propia para esto.
- **VAL-43.4, el piso de DNI/pasaporte.** Lo doy por cubierto porque integración ya lo probó con navegador
  real y porque el código (`isCriticalClave` + el filtro en `parseDestinationItems`) es consistente con eso;
  no lo repetí para no duplicar trabajo ya hecho.
- **Un plan con 30 ítems nuevos / un viaje con 40 reservas, en la interfaz real.** Medí el motor a nivel de
  Node con 40 reservas y una segunda tanda de 30 reservas adicionales (`generatePackingList` en 3 ms,
  `planListUpdate` en 1 ms, sin duplicados) pero no llegué a armar ese volumen a través de la interfaz (habría
  significado completar ~70 formularios de reserva a mano vía Playwright). El riesgo de performance en el
  motor es bajo por la medición; el riesgo de layout con una hoja de 30 tarjetas de propuesta o un grupo de 30
  ítems en `sheetPackingPlan` no lo evalué.
- **La base de datos compartida real (`claude.use("db")`) y la concurrencia entre dos sesiones reales.** Este
  entorno no tiene acceso a esa capa (bloqueo de CDN declarado por la consigna). Simulé el caso del dock
  (estado 16) forzando la función interna que la escritura de otra persona dispararía, no una escritura real
  de otra sesión — lo declaro en el caso 46.7.

