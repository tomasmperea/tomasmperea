# Auditoría VAL-75 — confirmación del delta

**Commit auditado (delta):** `1673ac569d920659051588ffc1e77ad300b67e7f`, sobre `632d371` (auditado y
vetado en 40/100, ver `2026-09-22-val75.md`)
**Alcance:** sólo lo que cambió en este commit. Lo ya puntuado en `632d371` no se re-audita.
**Árbol:** quieto durante esta ronda (`git status` limpio sobre `1673ac5` en todo momento).

## Veredicto

# NO PUBLICAR — 67 / 100 · no alcanza el piso de candidato (70)

El bloqueante que vetó la ronda anterior **está arreglado y bien verificado**: reproducido antes de tocar
nada, la causa correctamente identificada (comparar dos representaciones del mismo destino como si fueran
destinos distintos), el arreglo probado en las dos direcciones, y además se construyó la prueba de clic real
que faltaba (17 afirmaciones, tocando controles de verdad). Es un trabajo sólido y se lo reconozco.

Pero al perseguir "¿retener de más rompe algo?" encontré **dos bloqueantes nuevos**, uno de fondo y uno de
forma, los dos alcanzables con un gesto ordinario y dentro de lo que este mismo delta tocó. No corresponde
el piso de candidato porque no son brechas de entorno real: los reproduje los dos en Node/lectura de código,
sin teléfono.

---

## Bloqueantes (categoría b/d — no se anotan, frenan)

### 1 · "Retener de más" tiene un caso donde deja de ser sólo "una lista un poco vieja"

El arreglo decide no comparar cuando la **fuente** del destino cambió (de texto escrito a reservas, o al
revés) — correcto para el caso que arregla (cargar un vuelo al MISMO destino no debe disparar nada). Pero la
guarda no distingue "cambió la fuente porque cambió la representación" de "cambió la fuente porque el
destino cambió DE VERDAD y además coincide con el momento en que aparecieron o se borraron reservas". En ese
segundo caso, el ítem viejo **nunca se marca vencido**, aunque su motivo siga hablando de un lugar que ya no
es el del viaje.

Reproducido en Node, sin `ask`, sobre el mismo árbol de este delta:

```js
// Lista generada CON el destino escrito "Noruega" y SIN vuelos todavía
// (el orden por defecto de la app: armar la valija primero, cargar tickets después).
// porDestino:"Noruega", porDestinoFuente:"escrito"

// Se carga un vuelo real a Madrid — un destino DE VERDAD distinto, no el
// mismo Noruega en otro formato.
const vueloMadrid = { id:"f1", type:"flight", from:"EZE", to:"MAD", ... };
const r = pe.planListUpdate({ list: noruega, trip: NORUEGA, items:[vueloMadrid], tipoViaje:"montana" });

// r.sacados === []
// El pantalón impermeable con motivo "En Noruega la lluvia es frecuente..."
// se queda en la lista propuesta, indefinidamente, aunque el viaje ya sea a Madrid.
```

Por qué esto es indefinido y no "un poco viejo": para que el ítem se limpie hace falta que el modelo
**vuelva a sugerir exactamente esa clave** (así se actualiza por coincidencia en `mergeLists`, sin pasar por
`retenerDestinoVigente`) o que la persona lo descarte a mano. Si el destino nuevo no genera un ítem con la
misma clave —lo más probable, dos climas distintos raramente piden el mismo objeto—, el ítem queda pegado
para siempre, con un motivo que sigue mintiendo, y la cabecera del viaje (que por VAL-72 ya muestra el
destino de las reservas) va a decir una cosa mientras el ítem dice otra. Es el mismo síntoma que reportó el
PM el 19/09, con otro disparador.

**Por qué es alcanzable con el gesto más común**, no un caso de laboratorio: es el orden por defecto de la
app — armar la valija con el destino escrito, cargar los tickets después — y es literalmente el fixture que
usa `val75-sacar-con-el-dedo.js` para el resto del arnés (trip sin reservas → `pk-build` → recién después se
tocarían vuelos). VAL-63 y VAL-72 usaron ese mismo orden como su caso de éxito ("Europa" + 3 vuelos cargados
después).

**No pido una solución particular** — traducir IATA a lugar es VAL-66 y no existe, así que no hay ninguna
comparación barata acá — pero si la regla es "no comparar lo que no es comparable", hace falta decidir qué
hacer con el caso donde la fuente cambia Y el destino cambió de verdad, porque hoy ese caso cae en el mismo
balde que "no cambió nada" y el resultado es indistinguible de un defecto.

### 2 · Una instancia hermana de "Ver qué agrego" quedó sin actualizar

`app/valija.html:11787`, dentro de `sheetPackingInfo` (la hoja "De dónde sale esta lista", sección 19):

```js
<div class="sec-head"><span class="eyebrow">Novedades sin sumar</span></div>
<p ...>...cosas que aparecieron...</p>
<div><button class="btn sm" id="pk-info-plan">Ver qué agrego</button></div>
```

El commit corrigió las otras dos instancias del mismo texto (`packingNotice` y `pkRenderDock`, ambas ahora
usan `planVerQue(plan)`), pero ésta —que muestra exactamente el mismo `planPend` (`planDe(trip.id)`, ya
capaz de ser un plan sólo-sacar desde `632d371`)— quedó literal. Confirmado con `grep -n "Ver qué agrego"
app/valija.html`: tres apariciones antes de este commit, dos actualizadas, una no.

**Gesto:** cambiar el destino de un viaje con ítems de la capa de destino ya sugeridos (el mismo caso del
PM), y en vez de tocar el aviso, tocar el ícono ⓘ de la cabecera de la valija → "De dónde sale esta lista".
Con el plan pendiente sólo-sacar, esa hoja dice **"Novedades sin sumar"**, **"1 cosa que apareció"** y un
botón **"Ver qué agrego"** — las tres afirmaciones falsas sobre un plan que sólo saca. Es exactamente la
categoría de defecto que esta historia existe para eliminar (una afirmación con cara de dato que no es
cierta), y es la trampa que `CLAUDE.md` nombra explícitamente: "se barre la clase del ARCHIVO, no la de la
función" — se corrigieron 2 de 3 instancias del mismo texto.

Es de arreglo rápido (mismo patrón que las otras dos: envolver con `planVerQue`/`planCuentas` y ajustar el
texto de arriba), pero mientras esté así es una afirmación falsa en lo que el PM lee, y eso bloquea sin
excepción.

---

## Lo que se anota (no bloquea)

- **`valija-bloque-b` sigue con algo de inestabilidad residual.** Corrí el arnés completo tres veces, solo,
  sin otro Chromium corriendo (`ps aux` confirmado vacío): 111/111, 111/111, y una tercera con un timeout de
  10 s exactamente en la línea nueva (`app/pruebas/valija-bloque-b.js:644`, el `waitForFunction` que
  reemplazó los 200 ms fijos). El arreglo es genuino —reemplaza un número mágico por la condición real— y
  mejora la frecuencia reportada (1 de 10 antes), pero no la elimina del todo en este entorno. Es exactamente
  la inestabilidad de VAL-73 ya conocida y declarada por el equipo; sigue siendo arnés, no producto, y no
  frena esta entrega.
- La observación secundaria de la ronda anterior ("sumo 2 ítems" al re-sugerir el mismo nombre con un vuelo
  cargado) no la volví a perseguir en este delta — no cambió nada en el código que la explicaría, así que
  sigue en el mismo estado: sin confirmar, sin descartar.

---

## Afirmaciones verificadas de este delta

| Afirmación | Verificación | Resultado |
|---|---|---|
| El bloqueante de la ronda anterior (OSL vs. Noruega) está arreglado | Reproduje el repro exacto de mi auditoría anterior sobre este árbol | **Cierto.** `sacados: []` en las dos direcciones. |
| Los tres casos nuevos del arnés de motor (cargar vuelo, borrarlo, control de cambiar a otra ciudad) | `node app/pruebas/val75-la-lista-se-limpia.js` | **Cierto**, 35/35 en verde, control con filo confirmado (cambiar OSL→MAD con vuelo en las dos puntas sí saca los 3). |
| `val75-sacar-con-el-dedo.js` toca controles reales, no dispara eventos | Leído el arnés completo | **Cierto.** `.click()` sobre `.pk-mark`, `#edittrip`, `#save`, `[data-pk="verplan"]`, `#pk-plan-apply`; lee texto de pantalla, no estado interno, para las aserciones del chip y los botones. |
| "17 afirmaciones" en `val75-sacar-con-el-dedo.js` | Corrida real | **Cierto**, 17 líneas `ok` contadas en la salida. |
| "35 afirmaciones" en `val75-la-lista-se-limpia.js` (docs/qa/v33-guion.md) | Corrida real | **Cierto**, 35 líneas `ok`. |
| "Ver qué agrego" corregido en los dos avisos | `grep -n "Ver qué agrego" app/valija.html` | **Falso en parte.** Quedó una tercera instancia sin corregir en `sheetPackingInfo` (bloqueante 2 arriba). |
| `valija-bloque-b` ya no falla por el timing fijo | 3 corridas solas, sin contención | **Cierto que mejoró, falso que se eliminó del todo**: 2/3 verde, 1/3 timeout en la línea nueva. Se anota, no bloquea. |
| `docs/qa/v33-guion.md` no tiene afirmaciones sin respaldo | Leído completo | **Cierto.** La tabla final ("qué está probado y qué no") es honesta y los números coinciden con lo que corrí. |

---

## Tabla de las seis dimensiones (delta)

| # | Dimensión | Peso | Puntaje | Por qué |
|---|---|---|---|---|
| 1 | Verificación en el entorno real | 30 | **24** | Mejora grande: arnés de clic real con gestos genuinos (mobile viewport + touch), más el motor con los tres casos vecinos, más un guion honesto para el PM con una tabla "probado / no probado" que se corresponde con lo que corrí. Sigue sin haber prueba en el teléfono, pero está bien declarado y con guion concreto — eso es exactamente lo que el piso de candidato pide. No es 30 porque ninguno de los dos sustitutos usados (Node, Chromium con touch simulado) encontró los dos bloqueantes de arriba: hicieron falta una lectura activa del código y una prueba adversarial que el propio entregador no corrió. |
| 2 | Diagnóstico de causa raíz | 15 | **6** | La causa reportada está bien diagnosticada, reproducida y el arreglo la elimina, con control. Pero es la segunda vez en esta misma función que aparece "un caso vecino que no se preguntó" — la pregunta que `CLAUDE.md` pide hacer explícitamente antes de dar un arreglo por cerrado, y que el propio comentario del código roza ("retener de más es una lista un poco vieja") sin notar que en un caso deja de serlo. |
| 3 | Honestidad de lo verificado | 15 | **13** | Fuerte: cifras verificadas y correctas (35, 17), autocorrección visible, tabla "probado / no probado" del guion que no exagera. Resto un par de puntos porque el comentario del código sobre "retener de más" minimiza el caso que encontré arriba sin haberlo probado. |
| 4 | Cumplimiento del contrato | 15 | **8** | Los criterios textuales del backlog están cumplidos y ahora también verificados con clic real. Pero la promesa central de la historia —"lo pendiente se recalcula: se va si ya no corresponde"— sigue rota para el caso 1, y el texto que el PM lee en la hoja de información sigue mintiendo en el caso 2. |
| 5 | Calidad interna | 15 | **9** | El arnés de clic nuevo está bien construido (selectores copiados de un arnés que ya funciona, lee pantalla y no estado interno, observa el toast con `MutationObserver` en vez de carrera). El fix de `valija-bloque-b` es legítimo aunque no perfecto. Pero falta exactamente el barrido de archivo completo que `CLAUDE.md` pide para un patrón de texto duplicado — encontré la tercera instancia con un solo `grep`. |
| 6 | Diseño y decisiones de producto | 10 | **7** | La decisión de "no comparar lo que no es comparable" en vez de adivinar es defendible y está bien argumentada, con su trade-off explícito. Pierde puntos porque ese trade-off tiene un límite que no se señaló (el caso 1), y un diseño completo lo habría nombrado como until-VAL-66, igual que se nombró la limitación equivalente en VAL-72. |
| | **Total** | **100** | **67** | |

---

## Lo que falta para el próximo delta, en orden

1. **Decidir y arreglar el caso 1** (destino cambia de verdad Y la fuente cambia a la vez). No prescribo la
   solución — es una decisión de producto/diseño, no de auditoría — pero necesita quedar escrita con el caso
   a la vista, no descubierta de nuevo en la próxima ronda.
2. **Arreglar la tercera instancia de "Ver qué agrego"** en `sheetPackingInfo` (`app/valija.html:11787`), con
   el mismo patrón que las otras dos (`planVerQue`/`planCuentas`), y de paso el texto de arriba ("Novedades
   sin sumar" / "cosa que apareció").
3. **Agregar el caso 1 al arnés de motor**, como control negativo explícito, con la misma disciplina que ya
   tienen los tres casos que agregó este delta.
4. Opcional, no bloqueante: si alguien retoma `valija-bloque-b`, medir la frecuencia real del timeout nuevo
   con más corridas antes de darlo por resuelto del todo.

## Lo que nadie puede verificar desde acá

Sigue siendo lo mismo que la ronda anterior, más específico ahora que hay guion:

- **El guion completo de `docs/qa/v33-guion.md`, en el teléfono del PM**, una vez resueltos los dos
  bloqueantes de arriba. Los tres pasos y el cuarto opcional están bien armados y son diez minutos de una
  sentada — pero conviene agregarle un quinto paso con el caso 1 (armar la valija con destino escrito,
  después cargar un vuelo a un destino REALMENTE distinto) una vez que el bloqueante 1 tenga un arreglo,
  porque es exactamente el caso que un guion sin ese paso no va a encontrar.
- **Que el toast "Saqué N cosas que ya no correspondían" y el resto de los carteles encadenados se lean bien
  y a tiempo en la mano**, con el pulgar y con la latencia real del teléfono — el arnés de clic mide esto en
  Chromium de escritorio con `hasTouch` simulado, que no es lo mismo que el visor del teléfono.
