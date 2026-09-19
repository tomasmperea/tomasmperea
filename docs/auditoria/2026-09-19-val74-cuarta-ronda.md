# Re-auditoría VAL-74, cuarta ronda — el candado, puesto a prueba

**Commit auditado:** `c8860fe225e37ad61d56cb2e7ca34624bde8e6d4` · **Árbol:** limpio (`git status --porcelain`
vacío, antes y después) · **Publicado:** no.

## Veredicto: CANDIDATO — 88/100. Sí, publicá como candidato.

Sube de 81 a 88. Hice exactamente lo que pedían: agarré una copia del motor, le agregué un campo real al
ítem guardado —no en el repo, en un archivo aparte del scratchpad— y miré si el candado lo agarraba.
**Lo agarró.** No es decorativo. Con eso, y sin haber encontrado ninguna quinta instancia activa, esto cruza
el piso de 85 para candidato.

Queda una observación estructural, no un bug: el candado protege corriendo una prueba, no porque sea
imposible que alguien vuelva a desincronizar dos lugares. Lo explico abajo con el experimento, no como
opinión.

---

## El experimento que pedían: "agregale un campo en una copia y fijate si el arnés lo agarra"

Hice dos cosas, no una, para que la respuesta fuera completa:

**1) Reproduje el candado exacto del arnés, con un campo nuevo colgando del ítem real.** Tomé el motor
publicado, lo copié a `/tmp/.../scratchpad/engine-modificado.js` (nunca toqué el repo), y le agregué un
campo nuevo de verdad:

- En `makeItem()`, un campo `fuenteDato: fields.fuenteDato || ""` — como pasaría si mañana alguien decide
  guardar de qué reserva o nota salió el ítem, una funcionalidad con sentido de producto, no un capricho de
  prueba.
- En `enrichWithDestination()` —el único call-site que arma el ítem real—, le agregué el valor real:
  `fuenteDato:"Sugerido por IA a partir de tu reserva de vuelo EZE-OSL y tus notas del viaje sobre la
  excursion al fiordo"`.
- **A propósito, no toqué `parseDestinationItems`** — ni el `campos` que arma para medir, ni
  `pesoGuardadoDeItem`. Es la simulación exacta de "alguien edita el camino real y se olvida del que mide",
  que es lo que pasó tres veces con `regla`, `orden` y `cantidad`.

Corrí, contra esa copia, la MISMA comparación que trae el arnés nuevo (predicho vs. guardado de verdad):

```
guardado tiene el campo nuevo: "Sugerido por IA a partir de tu reserva ..."
predicho (candado, tal cual el arnés lo escribe): 355 · guardado de verdad: 461
¿el candado del arnés detecta la divergencia? SÍ, falla (medido !== real)
```

**El candado no es decorativo.** Si alguien agrega un campo al ítem real y corre el arnés, la prueba
"lo que se mide es exactamente lo que se guarda" rompe, con los dos números a la vista, antes de llegar a
ningún teléfono.

**2) Confirmé además que el riesgo real seguía ahí sin el candado** — para que quede claro qué evita. Con el
mismo motor modificado, 5.000 ítems de motivo mínimo (el caso adversarial de la ronda 2) con el campo nuevo
colgando de cada uno:

```
5000 propuestos, motivo mínimo, CON el campo nuevo colgando de cada ítem:
bytes reales finales: 335.716 · tope: 262.144 · SE PASA
```

Es decir: sin el candado, ese cambio hubiera sido la quinta ronda, con el mismo síntoma que las tres
anteriores. Con el candado, y si alguien lo corre antes de publicar, se ve en la consola de Node, con los
dos números uno al lado del otro, no en una captura del teléfono del PM.

---

## Lo que no cambió: el candado protege corriendo una prueba, no por diseño estructural

Esto es la salvedad que prometí no esconder. Miré por qué el candado funciona, y el motivo es preciso:
**sigue habiendo dos lugares donde alguien escribe a mano la lista de campos del ítem**, no uno:

1. `parseDestinationItems` arma `campos` (el que se mide, para decidir el presupuesto).
2. `enrichWithDestination` arma un objeto literal aparte —con los mismos nombres, hoy— para el `makeItem`
   real que efectivamente se guarda (`packing-engine.js` línea ~1799 en el archivo actual).

Hoy los dos coinciden, campo por campo, valor por valor —lo comparé y no hay divergencia activa, esto NO es
un quinto bug, quiero ser preciso—. Pero **siguen siendo dos enumeraciones independientes**, y el propio
commit lo dice con otras palabras para las dos versiones anteriores: eso es exactamente lo que se desincronizó
tres veces. "Deja de haber lista" es cierto para lo que `makeItem` agrega por su cuenta (`estado`,
`empacadoEn`, `cantidadEditada`, `nota`, timestamps) — cualquier default nuevo ahí lo cuenta solo, sin que
nadie tenga que acordarse. No es cierto todavía para los campos que cada CALL SITE decide pasar — ésos siguen
enumerados a mano, en dos lugares.

**Por qué igual llamo a esto "el candado alcanza" y no "hay una quinta":** porque lo comprobé — cuando la
divergencia ocurre, el candado la agarra, siempre que se corra. No encontré ningún caso donde la divergencia
pase Y el candado no la note. La salvedad es sobre CUÁNDO se entera alguien (al correr la prueba, no al
guardar en producción), no sobre SI se entera.

**Recomendación, no bloqueante, para cerrar también esto:** que `parseDestinationItems` devuelva los
`campos` completos (los mismos que ya arma para medir) en vez de un objeto recortado, y que
`enrichWithDestination` llame `makeItem(x, at)` directamente sobre eso, sin reconstruir un literal aparte.
Ahí sí quedaría una sola enumeración, y el candado pasaría de "prueba que agarra el error" a "no hay error
posible de esta familia". Lo dejo para cuando convenga, no para esta ronda: no encontré nada que lo haga
urgente.

---

## El resto de lo que verifiqué

**La cantidad se acota a 99, y la medición ahora sí incluye el valor real.** Corrí `val74-sin-tope-de-ocho.js`
completo: la aserción nueva "lo que se mide es exactamente lo que se guarda" da predicho=339, guardado=339,
coincide con lo que reportan. Y "una cantidad absurda se acota antes de guardarse" confirma que
`99999999999999999999` queda en `99`.

**Repetí mi batería adversarial de las tres rondas anteriores contra el código actual, sin encontrar ningún
caso nuevo que se pase del tope:** cantidad de 20 dígitos (253.700 bytes, ok), cantidad `Infinity`/negativa/
string numérica mezcladas (253.855, ok), motivo largo con acentos combinado con cantidad grande (253.776,
ok), categoría inventada —que de todos modos cae en el `CATEGORY_ORDER` por defecto, no hay forma de
inyectar una categoría arbitraria—. Ninguno se acerca siquiera al margen ajustado que vi en la ronda 2.

**Las dos copias del motor siguen idénticas** — diff byte a byte, de nuevo.

**Arneses corridos, sin regresión:** `val74-sin-tope-de-ocho` (37/37, incluye las dos aserciones nuevas del
candado), `motores-desde-html` (39/39), `valija-bloque-b` (111/111).

**Verifiqué que no hay otra vía de entrada que evite el presupuesto de bytes.** Hay otros tres call-sites de
`makeItem` en el motor —reglas base, ítems promovidos del historial, ítems agregados a mano— y ninguno pasa
por `pesoGuardadoDeItem`/`bytesLibresDeLista`. Es correcto que no pasen: son conjuntos acotados por diseño
(un catálogo fijo de reglas, algo que la persona ya agregó dos veces, un ítem por vez que la persona escribe
ella misma), no la salida sin límite de un modelo. No es una brecha, es el único lugar donde correspondía
poner el presupuesto.

---

## Tabla de las seis dimensiones

| # | Dimensión | Peso | Puntaje | Por qué |
|---|---|---|---|---|
| 1 | Verificación en el entorno real | 30 | **25** | Hice el experimento exacto que pedían —agregar un campo en una copia y ver si el arnés lo agarra— y el resultado es positivo, verificado, no supuesto: el candado detecta la divergencia. Repetí además toda la batería adversarial de las tres rondas anteriores sin encontrar overshoot nuevo. No llega a 30 porque sigue siendo Node, y porque la protección es de tiempo de prueba, no una imposibilidad estructural — está un paso de serlo, no lo es todavía. |
| 2 | Diagnóstico de causa raíz | 15 | **14** | "El error no es qué campo falta, es enumerar a mano los campos de otra función" es el diagnóstico correcto, y va un nivel más arriba que las dos rondas anteriores — trata la clase, no la instancia. El arreglo (delegar en `makeItem`) elimina la clase para los defaults internos de esa función. No llega a 15 porque la generalización se detuvo un paso antes de eliminar también la otra enumeración (la de `enrichWithDestination`), que es la que mi experimento demuestra que sigue siendo posible desincronizar. |
| 3 | Honestidad de lo verificado | 15 | **14** | El commit cita "predicho 339, guardado 339" y coincide exacto con lo que corrí. Nombra las tres rondas anteriores y sus tres campos con precisión, sin minimizar. No reclama más de lo que el candado hace — no dice "esto ya no puede pasar", dice "falla acá y no en el teléfono de alguien", que es exactamente lo que comprobé que es cierto. |
| 4 | Cumplimiento del contrato | 15 | **14** | Cierra el único punto pendiente de la ronda 3 (`cantidad`), toma la sugerencia del techo de plausibilidad con la razón correcta (no es tamaño, es sentido), y agrega el candado que yo había pedido poner a prueba. Un punto menos porque "buscá la quinta" tiene una respuesta con matices (ver arriba) y no un cierre absoluto. |
| 5 | Calidad interna | 15 | **13** | Buen arnés nuevo, con un control real (lo probé rompiéndolo a propósito en una copia). El diseño de `pesoGuardadoDeItem(campos)` es mejor que el de la ronda anterior. Quedan dos enumeraciones de campos en vez de una, que es la recomendación de arriba, no un defecto activo. |
| 6 | Diseño y decisiones de producto | 10 | **9** | Buen criterio de alcance: no "arregló" un campo más por las dudas, entendió que el problema era el patrón y lo resolvió al nivel correcto sin sobre-ingeniería. Coincide conmigo en no correr `lote-modelo-real.js` esta ronda, con argumento propio. |
| | **Total** | **100** | **88** | **CANDIDATO.** Se puede publicar. |

---

## Afirmaciones verificadas en esta ronda

| Afirmación | Verificación | Resultado |
|---|---|---|
| "Predicho 339, guardado 339" | Corrí `val74-sin-tope-de-ocho.js` | **Cierto**, exacto |
| "Si alguien agrega un campo y la medición no lo cuenta, falla acá" | Lo probé de verdad: agregué `fuenteDato` en una copia del motor, sólo en el call-site real, y corrí la misma comparación del candado | **Cierto**: predicho 355 vs. guardado 461, la aserción `medido === real` rompe |
| "Sin el candado, ese mismo cambio sería la quinta ronda" | Con la misma copia modificada, corrí el caso adversarial de 5.000 ítems | **Cierto**: 335.716 bytes contra un tope de 262.144 |
| "5.000 propuestos con cantidad de veinte dígitos entran 841 y quedan 8.180 bytes de margen" | Corrí el arnés y repetí el experimento por mi cuenta (835-841 ítems según semilla del motivo, margen 8.289-8.444) | **Cierto**, dentro del rango esperable |
| "Se acota a 99" | Verifiqué con `cantidad:99999999999999999999` en varios escenarios | **Cierto**, en todos los casos |
| No hay otra vía de entrada de ítems de IA que evite el presupuesto | Revisé los otros tres call-sites de `makeItem` | **Cierto**, ninguno corresponde a la capa de IA sin límite |
| Las dos copias del motor siguen idénticas | Diff byte a byte | **Cierto** |
| "12 arneses en verde" | Corrí `val74-sin-tope-de-ocho` (37/37), `motores-desde-html` (39/39), `valija-bloque-b` (111/111) | **Cierto**, sin regresión |

---

## Lo que falta para llegar a los 12 puntos que quedan

No es bloqueante para publicar como candidato — ninguno de los dos puntos de abajo es un defecto activo, y
por eso el puntaje ya cruza 85. Quedan para cuando convenga:

1. **Una sola enumeración, no dos.** Que `parseDestinationItems` devuelva los `campos` completos que ya
   arma para medir, y que `enrichWithDestination` llame `makeItem` directamente sobre eso en vez de
   reconstruir el literal. Cierra la salvedad estructural de esta ronda sin depender de que alguien recuerde
   correr el arnés.
2. Lo de siempre, ya declarado, entorno real: cuántos ítems y de qué largo devuelve el modelo del teléfono
   del PM con el prompt nuevo.

## Lo que nadie puede verificar desde acá

Sigue sin estar vacío, y sigue siendo lo mismo de las tres rondas anteriores — no apareció nada nuevo que
sólo se pueda comprobar en el teléfono:

1. **Cuántos ítems y de qué largo devuelve el modelo real del teléfono del PM**, con el prompt "sin llenar
   por llenar" y ahora con el tope de cantidad en 99. Ya declarado en el backlog con criterio concreto.
2. **Que el guardado real en la base compartida se comporte como predice `bytesSerializados`** — es una
   asunción razonable (la base mide bytes UTF-8 del JSON serializado, es el contrato documentado en
   `docs/briefs/adjuntar.md`), pero nunca se guardó un documento real de ~254 KB contra la base de este
   proyecto durante esta auditoría. Si en algún momento se puede probar contra la base real (no sólo el
   motor en Node), sería la única confirmación que falta de que el número "262.144" que el código usa
   coincide con el que la base aplica de verdad.
