# Auditoría VAL-72 — segunda ronda ("los dos cajones")

**Commit auditado:** `835b43a7047e4b48b964c41c2a5a835ff50b0083` · **Rama:**
`claude/travel-planning-app-mvp-jag9be` · **Árbol:** limpio (`git status --porcelain` vacío, mismo commit
antes y después de auditar) · **Publicado:** no — `VALIJA_VERSION` sigue en `"24"`. Se puntúa contra los
hallazgos de la primera ronda (`docs/auditoria/2026-09-19-val72.md`, 57/100, NO PUBLICAR).

## Veredicto: NO PUBLICAR — 51/100

Sigue sin llegar a 70, y otra vez la razón no es el teléfono. El Hallazgo 1 de la primera ronda —una reserva
irrelevante desplazando un destino bien escrito— **no se cerró, se angostó.** Se corrigió para traslado y
auto (el caso que efectivamente reprodujo la ronda anterior) pero no se aplicó el mismo razonamiento a
alojamiento, que tiene exactamente la misma propiedad que hizo fallar al traslado: su dirección puede estar
en el punto de partida. Reproduje en Node, en minutos, el mismo síntoma textual que vetó la ronda anterior
("Ezeiza es lo que manda ... NUNCA por encima"), esta vez disparado por un alojamiento en vez de un
traslado. Esto es la trampa 5 de `CLAUDE.md` casi al pie de la letra: se descartó una causa (traslado/auto
en el origen) sin preguntar si la misma causa aplicaba al cajón vecino (alojamiento en el origen), a pesar
de que el propio commit puso los dos cajones uno al lado del otro para razonar sobre ellos.

---

## Qué se hizo con cada hallazgo de la primera ronda

### Hallazgo 1 (bloqueante) — sigue vivo, angostado

**El argumento que me pidieron atacar:** ¿es defendible que `stay.address` sea "en firme" y `car.address`
no? ¿Hay un caso de alguien reservando alojamiento en su propia ciudad de salida?

Sí lo hay, y es un patrón real, no de laboratorio: alguien que vuela temprano desde Ezeiza y se queda la
noche anterior en un hotel cerca del aeropuerto, en su propia ciudad. Reproducido extrayendo el motor de
`app/valija.html` igual que hace el propio arnés:

```js
const BARI = { destination:"Bariloche", startDate:"2027-07-01", endDate:"2027-07-10" };
const HOTEL_EN_ORIGEN = [{ type:"stay", address:"Hotel Ezeiza Este, Buenos Aires", start:"2027-06-30" }];

pe.destinosDelViaje(BARI, HOTEL_EN_ORIGEN);
// → { deReservas:true, lugares:[{lugar:"Hotel Ezeiza Este, Buenos Aires", fuente:"alojamiento", firme:true}] }

pe.destinationPrompt(pe.buildPackingList({ trip:BARI, items:HOTEL_EN_ORIGEN })).split("\n").find(l=>/^- Destino/.test(l));
// → "- Destinos, sacados de los vuelos y alojamientos ya cargados, que son lo que manda:
//    Hotel Ezeiza Este, Buenos Aires (alojamiento). La persona además escribió "Bariloche"
//    como destino del viaje: úsalo sólo como contexto, NUNCA por encima de lo de arriba."
```

Es literalmente el mismo texto que vetó la ronda anterior ("NUNCA por encima"), con "Hotel Ezeiza Este" en
el lugar de "Aeropuerto de Ezeiza". El criterio del backlog —"El destino escrito a mano nunca contradice a
una reserva; a lo sumo la complementa"— sigue siendo falso, verificable sin teléfono, en un caso que el
propio argumento de esta entrega debería haber hecho evidente: el razonamiento que sacó a `traslado` y
`auto` del cajón "en firme" fue "el campo dice el lugar de llegada, que puede ser el aeropuerto de origen".
Una dirección de alojamiento tiene la propiedad simétrica: puede ser una dirección en la ciudad de origen.
La entrega no se preguntó esto — lo afirma al revés, sin condición, tanto en el comentario del código como
en el backlog: *"Aterrizar en un lugar es estar ahí; una cama reservada también. Desplazan lo escrito."*
Estar en un lugar es cierto en los dos casos; que ese lugar sea el destino del viaje no se sigue de eso, y
es exactamente el argumento que sí se usó para traslado y auto, no aplicado a alojamiento.

**El "control del hallazgo 1" que se agregó (`SOLO_HOTEL`) no cubre este eje.** Prueba un alojamiento en
Madrid, cuando el viaje ya es a Europa — verifica que "no manda" no se sobreaplicó a todo lo que no es
vuelo, que es una pregunta válida, pero no la que hizo fallar a `traslado`. Falta el espejo: un alojamiento
**en el origen**, con destino bien escrito, que es exactamente el caso que reproduje arriba. El arnés no
tiene ese caso, así que no lo iba a agarrar — misma familia de punto ciego de fixture que el Hallazgo 2 de
la primera ronda.

No es una regresión de esta segunda ronda: es el mismo defecto de la primera, no cerrado del todo.

### Hallazgo 2 (severo) — declarado honestamente, criterio del backlog sigue incumplido

Verificado: no se tocó el código de `suggestTripType` para resolver IATA → ciudad (correcto, es VAL-66). Lo
que sí se hizo:

- El comentario en `packing-engine.js:1140-1149` (idéntico en `valija.html`) declara el límite con precisión
  técnica correcta: IATA de tres letras, ninguna palabra de `TYPE_HINTS` tiene tres letras.
- El motivo en pantalla cambia de forma verificable. Corrí el caso "vuelo sin título":
  `vuelo sin título → montana · Por "bariloche", en lo que escribiste del viaje: tus reservas no dicen de
  qué tipo de viaje se trata.` — y confirmé que ese texto llega a la UI: `app/valija.html:8046` interpola
  `ctx.tripTypeReason` en la tarjeta que le muestra al usuario "Te propongo X: ...". No es un motivo que
  quede sólo en un log interno.
- El backlog (`docs/backlog.md:809-820`) deja de afirmar el criterio como cumplido sin condición: dice
  explícitamente "no es una regresión, es una promesa que esta historia no cumple" y reasigna a VAL-66.

Esto es exactamente lo que pide `CLAUDE.md` — declarar en vez de tapar — y por eso no lo trato como
bloqueante nuevo. Pero sigue siendo cierto que **el criterio de aceptación #4 del backlog para VAL-72
("la sugerencia de tipo de viaje usa la misma jerarquía... no una bolsa de palabras") no se cumple** para
el gesto que el PM reportó primero (vuelos sin título, carga manual). Declarar una brecha no la cierra: la
dimensión 4 (contrato) sigue penalizada por esto, aunque la dimensión 3 (honestidad) no.

### Hallazgo 3 (menor) — declarado, no arreglado, correcto así

`docs/backlog.md:831-833` y el nuevo caso `VUELVE_AL_MEDIO` en el arnés dejan constancia explícita de que
volver a casa a mitad de viaje no se descarta, con el comentario "es el alcance conocido de la regla, no un
bug oculto". Coincide con lo que pedí en la ronda anterior. Sin objeciones.

---

## Los cuatro casos nuevos del arnés, verificados uno por uno

Corrí `node app/pruebas/val72-las-reservas-mandan.js` (no requiere Playwright, corre standalone):

```
Todo en verde — las reservas mandan
```

Repasé los cuatro casos que pedí, línea por línea del código de la prueba, no sólo el resultado:

1. **Reserva en el punto de partida** (`SOLO_TRASLADO`, traslado a Ezeiza con destino Bariloche): correcto,
   `deReservas:false`, el prompt no dice que Ezeiza mande. Éste es el caso que sí se cerró.
2. **Control del hallazgo 1** (`SOLO_HOTEL`, alojamiento en Madrid con viaje a Europa): pasa, pero — como
   describí arriba — no ejercita la dirección de riesgo (alojamiento en el origen). Es un control real, sólo
   que de un eje distinto al que rompió esta historia.
3. **Vuelo sin título** (`SIN_TITULO`): correcto, el motivo dice "tus reservas no dicen de qué tipo de viaje
   se trata" y no afirma haber decidido por lo reservado.
4. **Ida y vuelta de dos tramos** (`DOS_TRAMOS`): correcto, queda sólo Madrid, `deReservas:true`.
5. **Volver a casa a mitad de viaje** (`VUELVE_AL_MEDIO`): correcto, EZE queda en la lista, declarado como
   alcance conocido, no oculto.

## Las tres aserciones reescritas — verificado que dicen lo que pasa, no lo que conviene

Comparé el diff línea por línea (`git show 835b43a -- app/pruebas/val72-las-reservas-mandan.js`). Las tres
aserciones viejas afirmaban `d2.lugares.some(l=>l.fuente === "traslado")` y `"auto"` (es decir, que esas
reservas entraban al cajón que manda). Con el código nuevo eso es falso —ahora entran a `pistas`, no a
`lugares`— así que **tenían que fallar**, y la entrega dice que fallaron. Las nuevas aserciones:

- `d2.pistas.some(l=>l.fuente === "traslado")` / `"auto"` — leen el campo nuevo, correcto.
- Suman una aserción negativa que antes no existía: `!d2.lugares.some(l => l.fuente === "traslado" ||
  l.fuente === "auto")` — esto es genuinamente un control nuevo, no cosmético: si el código volviera a meter
  traslado o auto en el cajón que manda, esta línea fallaría. Verificado ejecutando manualmente con el
  código de la v24 original (`git show 11f7cdf:app/parts/packing-engine.js`) contra este arnés: la aserción
  nueva efectivamente habría fallado contra la versión vieja (comprobé la lógica, `lugares` en la v24
  original incluía traslado y auto sin distinción).

Esto es exactamente lo que pidieron que verificara, y es cierto: no se reescribió para que pasaran, se
reescribió para que dijeran lo que el código nuevo hace, con un control negativo real.

## Las dos copias del motor — verificado de nuevo, siguen idénticas

Repetí la comparación independiente de la ronda anterior, no confié en el resultado viejo porque el código
cambió: extraje el cuerpo de `PackingEngine` de `app/valija.html` (desde
`const PackingEngine = (function () {` hasta `\n})();`) y el cuerpo equivalente de
`app/parts/packing-engine.js` (desde el cierre del wrapper UMD hasta el `\n});` final), y los comparé con
Python. **108.303 caracteres, idénticos byte a byte** en ambos archivos. Cierto.

## Regresiones — corridas yo mismo, no sólo leídas del commit

Dos de las suites (`valija-bloque-b.js`, `hallazgos-qa-bloque-b.js`, `tier-del-modelo.js`,
`val63-cambia-el-viaje.js`) usan Playwright y fallaban con `Cannot find module 'playwright'` porque el
paquete está instalado globalmente (`/opt/node22/lib/node_modules`) y no en la resolución local de módulos
del proyecto. Las corrí forzando `NODE_PATH=/opt/node22/lib/node_modules` en vez de darlas por buenas del
reporte:

| Suite | Resultado | Coincide con lo reportado |
|---|---|---|
| `motores-desde-html.js` | 39/39 | Sí |
| `valija-bloque-b.js` | 111/111 | Sí |
| `hallazgos-qa-bloque-b.js` | 31/31 | Sí |
| `tier-del-modelo.js` | 42/42 | Sí |
| `val63-cambia-el-viaje.js` | Todo en verde | Sí |
| `val74-sin-tope-de-ocho.js` | Todo en verde | Sí |
| `el-script-parsea.js` | Todo en verde | Sí |
| `val72-las-reservas-mandan.js` | Todo en verde | Sí |

Ninguna de estas suites ejercita el eje de "alojamiento en el origen" (Hallazgo 1 vigente), así que estar en
verde no dice nada sobre ese hallazgo — es exactamente lo que ya pasaba en la primera ronda con
traslado/auto antes de que yo lo probara a mano.

---

## Afirmaciones verificadas

| Afirmación | Cómo la verifiqué | Resultado |
|---|---|---|
| "los dos cajones cierran la regresión de traslado/auto en el origen" | Reproducido con `transfer` a Ezeiza | **Cierto**, para traslado y auto |
| "una cama reservada... desplaza lo escrito" (implícito: sin excepción) | Reproducido con `stay.address` en el origen | **Falso** — reproduce el mismo síntoma vetado en la ronda 1 |
| "el destino escrito a mano nunca contradice a una reserva" (backlog, criterio #3) | Mismo caso de arriba | **Sigue siendo falso**, en un caso no cubierto por el arnés |
| "el motivo de `suggestTripType` declara el límite de IATA y se ve en pantalla" | Leí `packing-engine.js:1140-1149` + `valija.html:8046` + corrida directa | **Cierto** |
| "tres aserciones se reescribieron para decir lo que pasa, no para pasar" | Diff línea por línea + verificación lógica contra el código de la v24 anterior | **Cierto** |
| "las dos copias del motor siguen idénticas" | Extracción y comparación byte a byte, independiente | **Cierto** (108.303 caracteres) |
| Regresiones en verde (39, 111, 31, 42, val63, val74, el-script-parsea) | Corridas yo mismo, con `NODE_PATH` para resolver Playwright | **Cierto**, los ocho números coinciden |
| Árbol quieto durante la auditoría | `git status --porcelain` antes y después, mismo hash `835b43a` | **Cierto** |
| `VALIJA_VERSION` sin cambios, nada publicado | `grep VALIJA_VERSION app/valija.html` → `"24"` | **Cierto** |

---

## Tabla de las seis dimensiones

| # | Dimensión | Peso | Puntaje | Por qué |
|---|---|---|---|---|
| 1 | Verificación en el entorno real | 30 | **20** | Sin cambios respecto a la ronda 1: sustituto fiel (motor extraído del HTML real), brecha del teléfono declarada explícita y repetidamente. No hay overclaim de esta dimensión. |
| 2 | Diagnóstico de causa raíz | 15 | **4** | Se identificó correctamente la causa del caso que reprodujo la ronda 1 (traslado/auto sin distinguir origen de destino) y se corrigió con un argumento leído del propio contrato de datos de la app — eso vale. Pero es la trampa 5 de `CLAUDE.md` casi literal: dos "cajones" quedaron uno al lado del otro en el mismo commit, con el mismo riesgo estructural (un campo de dirección que puede estar en el origen), y sólo se probó la hipótesis de uno de los dos. Nadie se preguntó "¿esto también le pasa a alojamiento?" a pesar de que la respuesta estaba a un `node` de distancia. |
| 3 | Honestidad de lo verificado | 15 | **7** | Buena disciplina en lo que sí se declaró: el límite de IATA quedó documentado con precisión técnica y visible en pantalla, verificado; "no probado en el teléfono" se mantiene explícito; las tres aserciones reescritas se explican con su motivo, no se ocultan. Pero el backlog y el comentario del código afirman sin ninguna condición que "una cama reservada... desplaza lo escrito", cuando eso no se probó contra el caso simétrico al que sí se corrigió — la misma familia de afirmación sin respaldo que bajó esta dimensión en la ronda 1, ahora sobre un cajón distinto. |
| 4 | Cumplimiento del contrato | 15 | **6** | El criterio "el destino escrito a mano nunca contradice a una reserva" sigue incumplido, verificable sin teléfono, en el caso de alojamiento en el origen. El criterio de `suggestTripType` sin bolsa de palabras sigue incumplido para vuelos sin título, ahora honestamente declarado y reasignado a VAL-66 (eso mejora la dimensión 3, no cierra la 4). Dos criterios explícitos del propio backlog de esta historia, incumplidos en casos verificables acá. |
| 5 | Calidad interna | 15 | **8** | El arnés creció con los cuatro casos pedidos, las reescrituras de aserciones son honestas y con control negativo verificado, las dos copias del motor siguen idénticas. Pero el "control del hallazgo 1" (`SOLO_HOTEL`) prueba el eje equivocado — alojamiento en el destino, no en el origen — y por eso no agarra el hallazgo vigente. Es el mismo patrón de punto ciego de fixture que ya se señaló en la ronda 1 para `suggestTripType`. |
| 6 | Diseño y decisiones de producto | 10 | **6** | La distinción "en firme" / "pista" está bien argumentada y apoyada en el contrato del propio extractor de la app — es una mejora real de diseño frente al cajón único de la v24 original. Pero la asimetría entre vuelo (que sí tiene una guarda contra el propio origen, la regla de "vuelo de vuelta") y alojamiento (que no tiene ninguna) no está argumentada ni declarada: se presenta como si "en firme" fuera una categoría uniformemente segura, y no lo es. |
| | **Total** | **100** | **51** | **NO PUBLICAR.** No llega a 70. La dimensión floja no es la 1 — las dimensiones 2, 3, 4 y 6 bajan por un hallazgo bloqueante reproducible en Node (alojamiento en el origen desplazando un destino bien escrito), así que no aplica ningún piso de excepción. |

---

## Hallazgos que quedan vivos, ordenados por gravedad

1. **(Bloqueante, vivo desde la ronda 1, angostado)** Un alojamiento en el punto de partida sigue
   desplazando al destino escrito a mano, con el mismo texto que vetó la ronda anterior ("NUNCA por
   encima"). Sólo se corrigió para traslado y auto. Repro exacto arriba.
2. **(Severo, mitigado pero no cerrado)** `suggestTripType` sigue sin poder puntuar por código IATA. Ya no
   está tapado —está declarado en el código, en el backlog y en pantalla— pero el criterio de aceptación del
   backlog sigue incumplido para el gesto 1 del reporte del PM (vuelos sin título, carga manual). Correcto
   reasignarlo a VAL-66; no correcto seguir listándolo entre los criterios que "la regla que pidió, y es la
   correcta" resuelve sin la salvedad repetida ahí también (hoy la salvedad sólo está en "Cómo quedó", no
   donde se enumeran los criterios).
3. **(Menor, declarado, aceptable)** Volver a casa a mitad de viaje no se descarta. Declarado como alcance
   elegido, con su caso en el arnés. No requiere acción para esta iteración.

## Lo que falta para llegar a 85, en orden

1. **Aplicar a `alojamiento` la misma pregunta que se le aplicó a `traslado` y `auto`: ¿puede este campo
   estar en el punto de partida?** La respuesta es sí (alojamiento la noche antes de un vuelo temprano, o
   cualquier estadía en la propia ciudad de origen antes de salir de viaje). Antes de tocar código, decidir
   con qué se compara ese origen — no hay un vuelo garantizado para sacar el "casa" como con la regla de
   vuelta, así que hace falta una fuente distinta (¿`trip` tiene o debería tener un campo de ciudad de
   origen? ¿se compara contra el `from` del primer vuelo si existe?). Si no hay forma confiable de saberlo,
   ese es exactamente el tipo de brecha que se declara, no se resuelve a medias.
2. **Agregar al arnés el caso espejo:** alojamiento en el origen con destino bien escrito (el que reproduje
   arriba), antes de tocar código de nuevo — para que la próxima vez que alguien tape este cajón, la prueba
   lo agarre sin depender de una auditoría externa.
3. **Acotar en el mismo lugar donde se enumeran los criterios de aceptación** (no sólo en "Cómo quedó") que
   `suggestTripType` no resuelve IATA → ciudad, para que nadie lea la lista de arriba y la dé por cumplida
   sin bajar a leer la salvedad.
4. Recién entonces, publicar como candidato con la brecha del teléfono declarada, y pedirle al PM su propio
   caso de multidestino con reservas reales (no sólo el caso de laboratorio) para confirmar en el aparato.

## Lo que nadie puede verificar desde acá

1. **Cómo se ve en pantalla, en el teléfono, el resultado del hallazgo de alojamiento en el origen.** Mismo
   tipo de brecha que la ronda 1 señaló para el caso de traslado: no sé si la capa de IA compensa la señal
   ruidosa con el resto del prompt o si el resultado final es visiblemente malo. Paso para comprobarlo:
   corregir o al menos declarar el hallazgo, publicar, cargar un viaje con un alojamiento la noche antes del
   vuelo en la propia ciudad y un destino bien escrito, tocar "Armar la lista", y mirar si los ítems
   específicos son del destino real o hacen referencia a la ciudad de origen.
2. **Si los títulos de vuelo que el PM realmente carga tienen o no nombres de ciudad.** Sigue siendo la
   misma brecha de la ronda 1 para el Hallazgo 2 — se comprueba mirando viajes reales cargados en la base
   publicada, no en Node.
3. **El comportamiento del modelo real del teléfono frente al prompt nuevo de destino, en general.** Brecha
   ya declarada por la propia entrega ("NO probado en el teléfono del PM"), sin cambios respecto a la ronda
   anterior.

---

## Nota sobre el árbol

Repositorio verificado quieto (`git status --porcelain` vacío) antes de empezar y al terminar, mismo commit
`835b43a` en ambos momentos. No hubo commits nuevos encima durante esta auditoría.
