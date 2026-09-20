# Auditoría VAL-72 — tercera ronda ("sólo un vuelo puede desplazar el destino escrito")

**Commit auditado:** `9ab4b35e7f5edac164b06dab2d85e571f0e60ddb` · **Rama:**
`claude/travel-planning-app-mvp-jag9be` · **Árbol:** limpio (`git status --porcelain` vacío antes y después de
auditar, mismo commit en ambos momentos) · **Publicado:** no — `VALIJA_VERSION` sigue en `"24"`, confirmado
con `grep`. Se puntúa contra los dos vetos anteriores (`docs/auditoria/2026-09-19-val72.md`, 57/100;
`docs/auditoria/2026-09-19-val72-segunda-ronda.md`, 51/100).

## Veredicto: NO PUBLICAR — 70/100

El hallazgo bloqueante que tumbó las dos rondas anteriores **está cerrado**, y lo verifiqué de forma
independiente y adversarial (abajo). Pero encontré un defecto nuevo — no el mismo, uno distinto — de la
misma familia que este proyecto ya tiene escrita como trampa: un comentario que describe un diseño que el
código ya no tiene, en la misma función que causó los dos vetos anteriores. Sumado a una discrepancia numérica
verificable en el propio commit y a un hueco de cobertura no declarado en la herramienta nueva
(`las-dos-copias.js`), el total no llega a 85, y **tampoco califica para el piso de candidato en 70**: la
regla del proyecto es que ese piso vale sólo cuando la dimensión 1 es la única floja, y acá hay bajas en las
dimensiones 3 y 5 por motivos que no tienen nada que ver con el teléfono. No hay overclaim de las bajas que sí
importan (destino, vuelo de vuelta): las tres traen evidencia reproducible.

**La buena noticia, dicha primero porque es real:** por primera vez en tres rondas, ataqué específicamente a
buscar el "caso espejo del caso espejo" que pedía el encargo y no lo encontré. La regla nueva
(comparabilidad por tipo de dato, no por tipo de reserva) parece genuinamente sólida, y el trabajo que falta
para publicar es mucho más chico que en las dos rondas anteriores.

---

## 1 · ¿Queda algún camino por el que una reserva en el punto de partida desplace el destino escrito?

**No encontré ninguno**, y lo ataqué de la forma más adversarial que pude, no sólo confirmando el caso que
ya reprodujo la ronda 2.

Reproduje, extrayendo el motor de `app/valija.html` (mismo método que `motores-desde-html.js`):

```js
// Las tres reservas de origen JUNTAS, sin ningún vuelo:
destinosDelViaje(BARI, [
  { type:"transfer", to:"Aeropuerto de Ezeiza", start:"2027-06-30T20:00" },
  { type:"stay", address:"Hotel Ezeiza Este, Buenos Aires", start:"2027-06-30" },
  { type:"car", address:"Aeropuerto de Ezeiza", start:"2027-06-30T18:00" }
]);
// → { lugares:["Bariloche"/escrito-a-mano], deReservas:false,
//     pistas:["Hotel Ezeiza Este, Buenos Aires","Aeropuerto de Ezeiza"] }
```

`deReservas` da `false` y "Bariloche" —lo escrito a mano— sigue siendo el destino, con las tres reservas de
origen mandadas igual como pista, cada una con su fecha. También revisé el tipo de reserva `act` (Actividad),
que tiene su propio campo `address` ("Visita al Prado") y **no está en ninguna de las dos listas** de
`destinosDelViaje` (ni firme ni pista) — no es una regresión de esta entrega (ya estaba así en las dos
rondas anteriores, nadie lo tocó), y no abre un camino de desplazamiento porque simplemente no participa. Lo
dejo anotado como una omisión preexistente, no como hallazgo de esta ronda: una actividad en el origen no
manda, pero tampoco se le avisa al modelo, y eso es "menos información" (el mismo tipo de pérdida por
omisión que el proyecto ya discutió para traslado/auto en la ronda 1, sólo que acá nunca se corrigió porque
nadie lo pidió).

**Verificado con `git blame`/lectura del código, no sólo con el fixture:** el único camino a `firme:true` en
`destinosDelViaje` es la rama de vuelos (`sumar(..., "vuelo", f, true)`, línea única en la función). Todas
las demás llamadas a `sumar` pasan `false` explícito. No hay ninguna rama condicional que pueda promover una
dirección a firme.

## 2 · ¿La regla del vuelo de vuelta sigue siendo sólida?

La ataqué con los seis casos que pidió el encargo, más algunos propios, usando el motor extraído del HTML
real:

| Caso | Resultado | Correcto |
|---|---|---|
| Vuelo sin `from` (`undefined`) | No descarta nada (casa = `""`) | Sí — seguro, no rompe (ya lo había verificado la ronda 1) |
| `from` vacío (`""`) | Igual que arriba | Sí |
| Un solo vuelo | Nunca se descarta (`vuelos.length>1` es la guarda) | Sí |
| `to` en minúscula (`"eze"` vs `"EZE"`) | Detecta la vuelta igual, `norm()` normaliza case | Sí |
| `to`/`from` con espacios (`" EZE "`) | Detecta la vuelta igual, `norm()` hace `.trim()` | Sí |
| Ida y vuelta con horarios reales (`datetime-local`), orden del array invertido | Ordena por `start` y detecta la vuelta igual | Sí |
| Timestamp idéntico entre ida y vuelta (dato duplicado/erróneo) | Detecta la vuelta igual | Sí |

**Un caso encontré que sí se comporta distinto, y lo declaro sin llamarlo hallazgo:** si dos vuelos comparten
la MISMA fecha **sin horario** (string `"2027-07-01"`, sin la parte de hora) y el array los trae en el orden
"vuelta, luego ida", el `sort` estable preserva ese orden y la función descarta el vuelo equivocado. Esto no
es explotable en la práctica: el campo `start` de un vuelo es un `datetime-local` (`REQUIRED.flight` en
`app/valija.html:1417`, "fecha y hora de salida"), así que dos vuelos reales casi nunca comparten el mismo
string completo salvo que sean el mismo vuelo cargado dos veces. Repetí la prueba con horarios reales
distintos en el mismo día y el orden del array invertido, y ahí sí funciona bien (ver tabla). No lo cuento
como hallazgo porque no corresponde a ningún dato que la interfaz pueda producir.

**Conclusión: la regla del vuelo de vuelta es sólida.** No encontré ninguna forma de engañarla con datos que
la app pueda realmente generar.

## 3 · La regresión de producto aceptada (Europa + hotel en Madrid ya no declara Madrid)

Verificado en `docs/backlog.md:899-903`: está declarada explícitamente, con el motivo (evitar volver a
producir el caso catastrófico de las rondas 1 y 2), lo que se pierde (una afirmación que a veces era
correcta), y el camino de mejora (VAL-66, traducir IATA a ciudad).

**Mi lectura: es un precio defendible, no una pérdida que debería frenar esta entrega**, por dos motivos
concretos que verifiqué y no doy por sentados:

1. El modelo sigue viendo Madrid igual — con su dirección y su fecha, como pista — así que no es que la
   información desaparezca; es que deja de venir con la etiqueta "esto es lo que manda, ignorá lo escrito".
   Verificado: `lineaDestinos` sigue mandando la dirección completa en `pistas` en todos los casos que probé.
2. La alternativa (mantener alojamiento como "firme") ya se probó dos veces y produjo el defecto
   catastrófico real (destino equivocado desplazando uno correcto), mientras que esta pérdida es "una
   sugerencia que podría haber sido un poco mejor", no un destino incorrecto.

**Dicho esto, no es gratis y toca la promesa original del criterio #1** ("si hay vuelos o cualquier reserva
en firme que indique destino, eso prima"). Es un cambio de alcance del criterio de aceptación, no sólo un
detalle de implementación, y quien decide si ese cambio de alcance es aceptable para "terminado" —no para
"candidato"— tendría que ser el PM, no el agente que lo escribió. Recomiendo pedir esa confirmación explícita
antes de cerrar la historia como terminada, aunque no es necesaria para publicar como candidato (está
declarada, con argumento y alternativa).

## 4 · `las-dos-copias.js` — el control negativo, y mi propia comparación aparte

**El control negativo funciona.** Lo corrí y además lo leí línea por línea: mete `var colado = 1;` al
principio de la primera función del motor y verifica que (a) el texto efectivamente cambió y (b) la
comparación por prefijo lo detecta como divergencia real y no como "cola de más" (`!real[nombre].startsWith(saboteada[nombre])`).
Es un control real, no cosmético.

**No tiene una lista de excepciones que tape diferencias** en el sentido que pedía el encargo — no hay un
array de nombres exceptuados. Pero tiene un hueco estructural distinto, no declarado en su propio comentario:
`funciones()` extrae contenido a partir del primer `function` que encuentra con la regex `/^\s*function\s+([A-Za-z0-9_$]+)\s*\(/gm`.
**Todo lo que está ANTES del primer `function` en el cuerpo del motor —constantes (`VERSION`,
`TOPE_LISTA_BYTES`, `MAX_NOMBRE_IA`, `HISTORY_PROMOTE_AT`...), su comentario de cabecera, y el comentario
extenso "VALIJA · MOTOR DE SUGERENCIA DE EQUIPAJE" de 100+ líneas— nunca se compara.** Si mañana alguien
cambia `TOPE_LISTA_BYTES` en una sola copia, este arnés diría "Todo en verde — las dos copias dicen lo mismo"
igual.

Hice mi propia comparación, independiente del arnés, con Python, para no confiar en el resultado del arnés
ni en el mío propio de rondas anteriores (el código cambió):

```python
# desde el marcador "CONSTANTES Y CATÁLOGOS" hasta la primera función, en ambos archivos
html_chunk == src_chunk  # → True, 3.302 caracteres idénticos
```

**Hoy no hay divergencia** — lo verifiqué yo, no el arnés — pero el hueco de cobertura es real y no está
dicho en ningún lado del propio `las-dos-copias.js` (su comentario de cabecera explica bien la trampa de
buscar por número de línea, pero no menciona esta otra). Es exactamente el tipo de cosa que el propio arnés
fue escrito para prevenir, con un punto ciego distinto en el mismo lugar.

## 5 · Las seis aserciones reescritas — dice seis, medí ocho

El commit dice: *"Seis aserciones viejas fallaron al correrlo y fue correcto: describían el diseño
anterior."* No confié en el número. Corrí el archivo de pruebas **de la ronda 2** (`git show
835b43a:app/pruebas/val72-las-reservas-mandan.js`) contra el motor **de esta ronda** (`app/valija.html`
actual):

```
node <test-de-ronda-2> app/valija.html
  8 FALLARON
```

Ocho, no seis. Las ocho:

1. "y le dice al modelo que nadie lo confirmó" (regex de texto vieja)
2. "un viaje sin vuelos pero con alojamiento tiene destino de reserva igual"
3. "el alojamiento aporta su dirección, y manda"
4. "la dirección va tal cual, sin recortarle «Madrid»..." (leía `lugares`, ahora está en `pistas`)
5. "presentado como pista, con las dos lecturas a la vista" (regex de texto vieja)
6. "un viaje sin vuelos pero con alojamiento tiene destino en firme" (bloque `SOLO_HOTEL`)
7. "y sale del alojamiento" (mismo bloque)
8. "«Europa» ya no compite con él" (mismo bloque)

**La sustancia es correcta**: revisé las ocho una por una contra el diff (`git show e313e4c --
app/pruebas/val72-las-reservas-mandan.js`) y las ocho están resueltas — cinco reescritas en su lugar (1, 2,
3, 4, 5) y tres removidas junto con el bloque `SOLO_HOTEL` completo (6, 7, 8), reemplazadas por el caso
`HOTEL_EN_ORIGEN` que cubre el eje que realmente importa. La cobertura que perdían las tres removidas
(alojamiento-en-destino, no-desplaza) sigue existiendo igual en el bloque `OTRAS` unas líneas arriba. No hay
sustancia perdida.

**Pero el número que se afirma en el propio commit es falso, verificado.** No cambia el veredicto de que el
trabajo está bien hecho, pero es exactamente el tipo de afirmación numérica que la rúbrica pide correr en vez
de creer — "corrí las pruebas" en este caso significa "corrí el conteo", y el conteo no coincide.

## 6 · Hallazgo nuevo (severo, no bloqueante): el comentario que describe la jerarquía vieja

No estaba en el encargo, salió de leer el código completo de la función en vez de sólo el diff. Es la trampa
4 de `CLAUDE.md` ("la documentación que quedó mintiendo"), en vivo, en la misma función que causó los dos
vetos anteriores:

`app/parts/packing-engine.js:1596-1602` (idéntico en `app/valija.html:2973-2979`), dentro del bloque de
comentario que encabeza `destinosDelViaje`:

```
LA JERARQUÍA, de más firme a menos:

  1. vuelo      — el `to` es un código de aeropuerto, no hay ambigüedad;
  2. traslado   — el "hasta" lo escribió la persona sobre algo reservado;
  3. alojamiento— la dirección dice dónde se duerme, que es dónde se está;
  4. auto       — dónde se retira, que suele ser el mismo lugar;
  5. el campo del viaje — lo último, y sólo si no hay ninguna reserva.
```

Esto es el diseño de la **primera** versión (la que vetó la ronda 1 con 57/100): traslado, alojamiento y auto
como "firmes" en un orden de firmeza decreciente. **El código de hoy no tiene ninguna jerarquía entre
traslado/alojamiento/auto — los tres son "pista" al mismo nivel, ninguno firme**, y esa es exactamente la
regla que las dos rondas de auditoría forzaron. Veinte líneas más abajo, dentro de la misma función, hay OTRO
bloque de comentario — nuevo, de este commit — que sí describe correctamente el diseño actual ("sólo los
vuelos pueden desplazar lo que la persona escribió... Todo lo demás viaja como PISTA"). **Los dos comentarios
se contradicen entre sí, dentro de la misma función, a veinte líneas de distancia.**

No cambia el comportamiento (verifiqué en los puntos 1 y 2 de arriba que el código hace lo que dice el
comentario nuevo, no el viejo), pero es exactamente el tipo de trampa que ya le costó una iteración a este
proyecto: alguien que lea sólo el encabezado —que es lo primero que se lee al entrar a la función— sale
creyendo que existe una jerarquía de firmeza entre traslado/alojamiento/auto que ya no existe. La próxima
persona que toque esta función (la tercera en tocarla, después de dos rondas de auditoría) tiene un
comentario mintiéndole desde arriba sobre el mismo eje exacto que ya rompió dos veces.

**Esto es rápido de arreglar** —borrar o reescribir 7 líneas—, a diferencia de los hallazgos de las rondas 1
y 2, que exigían cambiar lógica.

---

## Afirmaciones verificadas

| Afirmación | Cómo la verifiqué | Resultado |
|---|---|---|
| "una reserva en el punto de partida no puede cambiar el destino" (nuevo criterio del backlog) | Reproducido con traslado, alojamiento, auto, y los tres juntos, en el origen, sin vuelos | **Cierto**, sin excepción encontrada |
| "sólo un vuelo puede desplazar el destino escrito" | Lectura de `destinosDelViaje`: única llamada a `sumar(...,true)` es la de vuelos | **Cierto** |
| La regla del vuelo de vuelta resiste los casos borde pedidos | 7 casos borde reproducidos con el motor real | **Cierto**, con una curiosidad no explotable declarada en el punto 2 |
| "las dos copias del motor dicen lo mismo" (`las-dos-copias.js`) | Corrido (verde) + comparación Python independiente de funciones Y de la sección de constantes que el arnés no cubre | **Cierto hoy**, pero el arnés tiene un hueco de cobertura no declarado (preámbulo antes del primer `function`) |
| "el control del arnés detecta una diferencia metida a mano" | Leído el código del control + corrido | **Cierto** |
| "seis aserciones viejas fallaron y se reescribieron" | Corrí el test de la ronda 2 contra el motor de esta ronda | **Falso el número** (fallaron ocho, no seis); **cierta la sustancia** (las ocho están resueltas sin pérdida de cobertura) |
| "VAL-72 no toca la capa de guardado ni la de recarga" (VAL-73) | `git show e313e4c -- app/valija.html \| grep ^@@` — sólo tres funciones tocadas, ninguna de guardado | **Cierto** |
| El backlog no vuelve a afirmar sin condición "el destino escrito a mano nunca contradice a una reserva" | `grep` de la frase exacta en todo `docs/backlog.md` | **Cierto**, aparece una sola vez, como la regla que se pidió, no la que se entregó |
| La salvedad de IATA está en la lista de criterios de aceptación, no sólo en "Cómo quedó" | Lectura de `docs/backlog.md:815-818` | **Cierto**, corregido respecto a la ronda 2 |
| Regresiones en verde (39, 111, 31, 42, val63, val74, el-script-parsea, las-dos-copias, val72) | Corridas una por una, con `NODE_PATH=/opt/node22/lib/node_modules` | **Cierto**, los nueve coinciden (`valija-bloque-b` di 111/111 en mis dos corridas) |
| `VALIJA_VERSION` sin cambios, nada publicado | `grep VALIJA_VERSION app/valija.html` → `"24"` | **Cierto** |
| Árbol quieto durante la auditoría | `git status --porcelain` antes y después, mismo hash `9ab4b35` | **Cierto** |

---

## Tabla de las seis dimensiones

| # | Dimensión | Peso | Puntaje | Por qué |
|---|---|---|---|---|
| 1 | Verificación en el entorno real | 30 | **20** | Sin cambios respecto a las dos rondas anteriores: sustituto fiel (motor extraído del HTML real), brecha del teléfono declarada explícita y repetidamente en el commit y en el backlog. No hay overclaim de esta dimensión. |
| 2 | Diagnóstico de causa raíz | 15 | **12** | Por primera vez la regla no es un parche por tipo de reserva sino un criterio que se sostiene solo (¿es comparable contra el origen?) y que verifiqué que cierra el hueco para traslado, alojamiento, auto y sus combinaciones — ataqué específicamente a encontrar el "caso espejo del caso espejo" y no lo encontré. No es 15 porque llegar acá costó dos vetos de no aplicar la misma pregunta al vecino, y porque el criterio deja una regresión de capacidad real (aunque declarada) en vez de una solución que preserve todo lo bueno de antes. |
| 3 | Honestidad de lo verificado | 15 | **10** | Muy buena disciplina en lo sustancial: la regresión de producto está declarada con su argumento, el flake de VAL-73 tiene una tabla con "lo que NO permite decir" en vez de una conclusión cómoda, la salvedad de IATA quedó donde corresponde. Pero encontré dos afirmaciones verificables que no se sostienen: el conteo de "seis aserciones" (eran ocho) y el comentario stale de la jerarquía (afirma, sin quererlo, un diseño que el código ya no tiene). Ninguna de las dos es una afirmación de "verificado" sobre algo no probado — son inexactitudes menores dentro de un reporte por lo demás riguroso —, por eso no bajo más. |
| 4 | Cumplimiento del contrato | 15 | **12** | El caso de éxito ("Europa" con MAD/CDG/FCO) sigue cumpliéndose, verificado. El criterio "no contradice una reserva" ahora es cierto en todos los casos que until probé (incluyendo los tres tipos de reserva juntos en el origen). La salvedad de IATA está correctamente ubicada en los criterios de aceptación. No es 15 porque el criterio #1 original ("cualquier reserva en firme... indica destino") se recortó de forma real (alojamiento deja de ser firme en cualquier circunstancia, no sólo en el origen) sin que conste una confirmación del PM sobre ese recorte de alcance. |
| 5 | Calidad interna | 15 | **8** | El arnés creció con casos reales y bien razonados, y `las-dos-copias.js` tiene un control negativo genuino. Pero encontré, sin que estuviera en el encargo, un comentario que contradice al código a veinte líneas de distancia, dentro de la misma función que ya recibió dos vetos — es la trampa 4 de `CLAUDE.md`, en vivo, en las dos copias del motor. Sumado al hueco de cobertura no declarado en la herramienta nueva y al conteo incorrecto de aserciones, hay tres defectos de calidad interna verificables, ninguno relacionado con el teléfono. |
| 6 | Diseño y decisiones de producto | 10 | **8** | El criterio de comparabilidad (IATA vs. texto libre) es una decisión de diseño sólida, argumentada con el tipo de dato y no con una suposición sobre el viajero, y generaliza mejor que las dos versiones anteriores. La pérdida de capacidad se declara con su motivo y su alternativa (VAL-66). No es 10 porque ese recorte de promesa original no se marcó explícitamente como una pregunta para el PM, sólo como una decisión ya tomada. |
| | **Total** | **100** | **70** | **NO PUBLICAR.** El hallazgo bloqueante de las dos rondas anteriores está cerrado, verificado de forma independiente y adversarial. Pero el total no llega a 85, y tampoco puede tratarse como candidato: la regla del proyecto es que el piso de 70 vale sólo cuando la dimensión 1 es la única floja, y acá las dimensiones 3 y 5 bajan por motivos que no son el teléfono (un comentario que miente, un conteo que no cierra, un hueco de cobertura no declarado). Son arreglos rápidos, no otro rediseño, pero corresponde hacerlos antes de publicar. |

---

## Lo que falta para llegar a 85, en orden

1. **Corregir el comentario de `LA JERARQUÍA` en `destinosDelViaje`** (`app/parts/packing-engine.js:1596-1602`
   y `app/valija.html:2973-2979`, idénticos). Borrarlo o reescribirlo para que diga lo mismo que el bloque de
   comentario nuevo que está veinte líneas más abajo, en la misma función. Es la corrección más chica de esta
   lista y la más importante: es la trampa que ya costó una iteración, encontrada dos rondas después de
   creerla resuelta.
2. **Corregir el número en el commit o en el registro de la entrega**: son ocho aserciones reescritas, no
   seis. No hace falta rehacer nada de código — la sustancia de las ocho está bien resuelta —, pero el número
   que se reporta tiene que coincidir con el que se puede correr.
3. **Declarar el hueco de cobertura de `las-dos-copias.js`** en su propio comentario de cabecera: que el
   contenido antes de la primera declaración `function` (constantes, comentario de cabecera del motor) no se
   compara. No hace falta arreglarlo esta ronda si se declara — arreglarlo bien (comparar desde el inicio del
   cuerpo, no desde el primer `function`) puede ser la siguiente iteración de esta herramienta.
4. **Pedirle al PM una confirmación explícita, antes de "terminada"**, sobre el recorte de alcance: que un
   alojamiento — en cualquier lugar del viaje, no sólo en el origen — deje de poder declarar destino por sí
   solo. Es una decisión de producto razonable y bien argumentada, pero cambia una promesa original del
   criterio de aceptación, y quien puede aceptar ese cambio es quien lo pidió.
5. Recién entonces, publicar como candidato con la brecha del teléfono declarada (como ya hace el commit), y
   pedirle al PM su caso multidestino real, cargado a mano, para confirmar en el aparato.

## Lo que nadie puede verificar desde acá

1. **Cómo se ve en pantalla, en el teléfono, el resultado final para un viaje con reservas en el origen y en
   el destino mezcladas.** Verifiqué que el motor arma el prompt correctamente (Bariloche sigue siendo el
   destino, las pistas de origen viajan con su fecha), pero no sé si la capa de IA del teléfono usa esa
   información de la forma que el prompt le pide, ni si el resultado final —la lista de ítems— es
   visiblemente mejor que antes de esta historia. Paso para comprobarlo: publicar, cargar un viaje con un
   traslado o alojamiento en el punto de partida y un destino bien escrito, tocar "Armar la lista", y mirar
   si los ítems son del destino real.
2. **El caso multidestino real que originó el reporte** (un viaje "Europa" con vuelos a Madrid, París y
   Roma), cargado con los datos reales del PM (títulos, notas, fechas tal como él los escribe) en vez del
   fixture del arnés. El fixture usa títulos descriptivos ("Vuelo a Madrid"); si el PM no los escribe así, el
   Hallazgo 2 de la ronda 1 (`suggestTripType` sin poder puntuar por IATA) sí se manifiesta, y esto sólo se
   confirma mirando viajes reales cargados en la base publicada.
3. **El comportamiento del modelo real del teléfono frente al prompt nuevo de destino, en general.** Brecha
   ya declarada por la propia entrega ("NO probado en el teléfono del PM"), sin cambios respecto a las dos
   rondas anteriores.

---

## Nota sobre el árbol

Repositorio verificado quieto (`git status --porcelain` vacío) antes de empezar y al terminar, mismo commit
`9ab4b35` en ambos momentos. No hubo commits nuevos encima durante esta auditoría.
