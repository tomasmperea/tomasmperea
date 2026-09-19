# Re-auditoría VAL-63 — tercera ronda

**Commit auditado:** `9199ff9`, encima de `6b22206` (ya auditado en la segunda ronda,
`docs/auditoria/2026-09-19-val63-segunda-ronda.md`, 76/100 — candidato). Árbol verificado limpio
(`git status --porcelain` vacío) antes de auditar. Único cambio: `app/valija.html` (la función
`toast()` y el handler de guardar del viaje) y `app/pruebas/val63-cambia-el-viaje.js` (dos
aserciones nuevas), confirmado con `git show 9199ff9 --stat`.

## Veredicto: 60 / 100 — NO PUBLICAR, ni siquiera como candidato

Por debajo de 70 y por debajo de 85. No aplica el piso de candidato de `CLAUDE.md` (70, "sólo si
lo único que falta es el entorno real"): acá hay deducciones reales en honestidad, cumplimiento
del contrato, calidad interna y diseño — no sólo en la dimensión 1. `CLAUDE.md` mismo dice que en
ese caso "no hay piso de 70 que valga".

El defecto técnico está bien encontrado y bien arreglado — esa parte del trabajo es sólida y la
verifiqué a fondo (ver dimensión 2). Lo que hunde el puntaje es lo que rodea al arreglo: el guion
que el PM va a usar para probarlo está roto para la versión que se le va a pedir que pruebe, y la
declaración de accesibilidad afirma más de lo que el código realmente entrega.

## Un veto de redacción sobre `CLAUDE.md`, como se pidió

La sección nueva (`## PUBLICAR y TERMINAR no son lo mismo...`) dice que el piso de 70 vale
"sólo si lo único que falta es el entorno real", y después dice que si el auditor baja el puntaje
"por otra dimensión —causa raíz, honestidad, calidad interna— no hay piso de 70 que valga".

Esa lista nombra las dimensiones 2, 3 y 5. **No nombra la 4 (cumplimiento del contrato) ni la 6
(diseño).** En la práctica ya pasó algo que muestra por qué eso importa: en la segunda ronda de
VAL-63, la dimensión 4 se dockeó a 8/15 — no por otra causa que "el entorno real", porque el
propio brief fija el criterio de éxito como la prueba del PM en su teléfono. Ese caso está bien:
el hueco de la 4 y el hueco de la 1 son la misma cosa mirada dos veces. Pero la redacción no dice
eso — no distingue "la dimensión 4 bajó por la MISMA razón que la 1" de "la dimensión 4 bajó por
un motivo propio, que no tiene nada que ver con el teléfono" (una historia a medio hacer, un
criterio de aceptación incumplido por otro motivo). Tal como está escrito, alguien podría leer "no
nombra la 4, entonces la 4 no rompe el piso de 70" y publicar algo con un criterio de aceptación
real, no relacionado al entorno, incumplido. Lo mismo con la 6: una decisión de diseño mal
argumentada hoy no rompe el piso de 70 por la letra literal.

**No es lo que decidió el PM el 19/09** (leí el commit `6efc360`: la intención es "el único hueco
es el entorno real", no "las dimensiones 2, 3 y 5 en particular"). Pero la redacción actual abre
esa puerta. Recomiendo agregar una frase: *"vale también para la 4 y la 6 cuando la causa de su
baja es la misma indisponibilidad del entorno real que explica la 1; si la baja tiene una causa
propia, no hay piso que valga en ninguna dimensión."* En esta ronda no cambia el veredicto (el
total es 60, muy por debajo de cualquier piso), pero la próxima vez que alguien saque justo 70 con
la 4 floja por un motivo que no es el teléfono, esta ambigüedad va a importar.

## Tabla de las seis dimensiones

| # | Dimensión | Peso | Puntaje | Por qué |
|---|---|---|---|---|
| 1 | Verificación en el entorno real | 30 | **14** | Mismo sustituto de siempre (Playwright + Chromium de escritorio, gestos tocados de verdad: abre la hoja, cambia la fecha, toca Guardar, **toca el cartel**). Corrí el arnés yo mismo (9/9) y confirmé que toca el control, no dispara el evento. Pero el "guion para el PM" que exige el candidato (`docs/qa/v21-como-lo-compruebo-en-el-telefono.md`) quedó **desactualizado para lo que se está por publicar**: dice "v21" en el paso de verificación de versión, mientras el código de este commit subió `VALIJA_VERSION` a "22" (línea 914), y no menciona el paso nuevo de tocar el cartel. Si el PM sigue ese guion tal cual sobre la v22, la instrucción "Si no dice v21: pará y avisame" lo va a frenar antes de empezar. Un sustituto declarado pero con el guion roto no es una brecha bien declarada: es una brecha declarada para una versión que ya no es la que se entrega. |
| 2 | Diagnóstico de causa raíz | 15 | **15** | Verificación exhaustiva, no sólo lectura. Confirmé con `grep -n 'id="toast"'` que hay un único contenedor `#toast` en toda la app y que **todos** los `toast(...)` (busqué las ~35 llamadas) pasan por la misma función — así que "es de cualquier par de carteles seguidos" es cierto, no una exageración, siempre que se entienda acotado a pares de `toast()` (ver honestidad). Reproduje el defecto viejo con mis propias manos: armé una copia de `valija.html` con el guardia `if(t.firstElementChild===mio)` sacado y sólo esa línea, y corrí el arnés — el cartel "Tengo 1 cosa..." aparece en el log de carteles capturados con "VER" y todo, pero al momento de la aserción específica ya no está (`{"hay":false}`), exactamente el síntoma que describe el commit y que el PM reportó ("no me... mostró cuáles son los que se agregan"). También revisé los otros `setTimeout` del archivo (im-slow, doc-nopick, im-nopick, ioTimers) y ninguno comparte el patrón de dos relojes independientes sobre el mismo nodo — así que el arreglo es del tamaño correcto: cubre lo que realmente estaba roto, ni más ni menos. |
| 3 | Honestidad de lo verificado | 15 | **10** | El commit separa con precisión lo nuevo de lo viejo, y no esconde que "no actualizar sola la lista" es una decisión de producto confirmada por el PM, no un bug. Pero el test agrega la aserción "y se anuncia como botón, para quien usa lector de pantalla" (comentario del propio arnés) sin haber verificado que un lector de pantalla realmente se entera de que el cartel apareció — y no se entera: ver dimensión 6. Es una afirmación sobre accesibilidad que suena más completa de lo que es, sin el matiz de qué le falta. Tampoco se declara que el guion del PM quedó desincronizado con la versión que se sube (dimensión 1) ni que `docs/backlog.md` (entrada VAL-63) no se actualizó con este hallazgo. Nada de esto es una mentira activa, pero son afirmaciones sin el descargo que la rúbrica pide para el puntaje alto. |
| 4 | Cumplimiento del contrato | 15 | **7** | El brief (`docs/briefs/la-valija-cumple.md`, "Cómo se valida") fija el criterio de éxito de forma explícita: "Contra el Artifact publicado, en el teléfono del PM... el antes y el después escritos, no 'anduvo'." Eso sigue sin existir — igual que en la ronda anterior. Y esta vez el camino para conseguirlo quedó peor, no igual: el guion que se le iba a entregar al PM para cerrarlo (`v21-como-lo-compruebo-en-el-telefono.md`) no sirve tal cual para la v22 (ver dimensión 1). El resto de lo que reportó el PM sí quedó resuelto y lo verifiqué: el aviso dentro de la valija seguía diciendo lo correcto (lo comprobé leyendo el HTML generado, no lo asumí del commit), y ahora el cartel lleva ahí con un toque. |
| 5 | Calidad interna | 15 | **8** | El código es limpio, el comentario nuevo describe lo que el código hace (lo comparé línea por línea con el diff, no hay divergencia). Las dos aserciones nuevas del arnés discriminan de verdad — las corrí contra dos controles negativos distintos (ver abajo) y las dos fallan exactamente donde tienen que fallar, sin arrastrar ninguna de las otras 7 aserciones del archivo. Descuento por documentación que dejó de describir lo que el código hace hoy: el guion de QA (`v21-como-lo-compruebo-en-el-telefono.md`) quedó con el número de versión viejo y sin el paso nuevo — es el mismo patrón que el proyecto ya nombró como trampa histórica ("la documentación que quedó mintiendo"), esta vez en un documento operativo, no en un comentario de código. `docs/backlog.md` tampoco se actualizó con el hallazgo del defecto viejo del cartel ni con el arreglo, así que alguien que lea sólo el backlog no se entera de que esto pasó. |
| 6 | Diseño y decisiones de producto | 10 | **6** | Las decisiones de producto están bien: mantener "la app propone, no pisa" fue confirmado por el PM y quedó escrito; la duración de 7 s con su motivo (tiempo para decidir, no sólo para leer) es una decisión chica pero argumentada. La falla está en la decisión de accesibilidad: `role="button"`, `tabindex="0"` y manejo de teclado alcanzan para que el cartel sea operable UNA VEZ que el foco llega ahí, pero nada lo hace descubrible. El `#toast` no tiene `aria-live` — a diferencia de `#pkdock`, que sí lo tiene y trae un comentario propio explicando por qué hace falta ponerlo desde la carga ("una región viva creada junto con su contenido no se anuncia", línea 832-835) — así que un lector de pantalla no se entera de que apareció nada. Y en el DOM, `#toast` es el último elemento del `<body>` (después de `#main`, `#fab`, `#pkdock` y `#modal`, línea 837), sin que `closeSheet()` mueva el foco a ningún lado (`function closeSheet(){ $modal.innerHTML = ""; }`, sin gestión de foco) — así que un usuario de teclado que recién cerró la hoja del viaje tendría que tabular por TODA la pantalla para llegar al cartel antes de que se borre a los 7 s. Es exactamente el patrón que ya está documentado y resuelto para `#pkdock` en este mismo archivo, y no se aplicó acá. Una decisión de accesibilidad declarada como completa que en realidad es parcial, sin decir qué le falta. |
| | **Total** | **100** | **60** | Por debajo del piso de candidato (70) y muy por debajo de terminado (85). |

## Afirmaciones que verifiqué

| Afirmación | Cómo la verifiqué | Resultado |
|---|---|---|
| "El aviso DENTRO de la valija está bien" | Leí `app/valija.html` en la vista de la valija (el aviso de plan desactualizado con "Ver qué agrego" / "Ahora no") y lo confirmé además en pantalla vía el arnés (`"aviso":"El viaje cambió... Ver qué agrego\nAhora no"`) | Cierto |
| "Que la lista no se actualice sola es a propósito" | Confirmado por texto del commit y consistente con `docs/design/valija-inteligente-b.md` (estado 16-19, "no interrumpir nunca"); no hay forma de que yo verifique la conversación con el PM, pero el diseño previo ya documentaba esta regla antes de esta ronda | Consistente, no contradicho |
| "El cartel se puede tocar y lleva a la valija" | Corrí `val63-cambia-el-viaje.js` contra el HTML actual: 9/9, incluida la aserción de navegación (`hash":"#/trip/.../valija"`) | Cierto |
| "role=button... y se anuncia como botón para quien usa lector de pantalla" | Revisé `#toast` (sin `aria-live`), la posición de `#toast` en el DOM (último nodo del body) y `closeSheet()` (sin gestión de foco) | **Falso tal como está afirmado** — el rol está bien puesto, pero nada anuncia ni dirige el foco hacia el cartel; ver dimensión 6 |
| "UN DEFECTO VIEJO... es de cualquier par de carteles seguidos" | `grep -n 'id="toast"'` (un único contenedor) + `grep -n 'toast('` (todas las llamadas pasan por la misma función) + reproduje el defecto sacando sólo el guardia de identidad | Cierto, acotado a pares de `toast()` — no a los otros avisos de la app (`#pkdock`, `#im-slow`, `#doc-nopick`, `#im-nopick`), que usan otros mecanismos y no comparten el defecto |
| "El arreglo no deja ningún cartel colgado para siempre" | Recorrí las combinaciones: toast repetido con mismo texto, cadena de 3+ carteles, click que dispara `go()` de forma asíncrona (no reentrante) — en todos los casos el último cartel mostrado siempre tiene su propio `setTimeout` sin cancelar, así que siempre termina borrándose | Cierto, no encontré ningún caso colgado |
| "Las aserciones nuevas discriminan" | Corrí dos controles negativos: (1) saqué el tercer argumento `alTocar` del call site → 2 FALLARON, exactamente las dos aserciones del cartel tocable; (2) saqué el guardia `if(t.firstElementChild === mio)` dejando sólo `t.innerHTML=""` → 2 FALLARON, las mismas dos, y además reproduce visualmente el defecto viejo (`"hay":false` después de haber visto "VER" en el log) | Cierto en los dos casos |
| "20 arneses en verde" | Corrí 5 de los nombrados: `val63-cambia-el-viaje.js` (9/9), `motores-desde-html.js` (39/39), `hallazgos-qa-bloque-b.js` (31/31), `valija-bloque-b.js` (111/111), `adjuntar-documento.js` (81/81) | No contradicho en lo que corrí (más de la mitad del total reclamado); no repetí los ~15 restantes |
| "El guion del PM (`v21-como-lo-compruebo-en-el-telefono.md`) sigue vigente" | Nadie lo afirmó en el commit — pero tampoco se avisó que dejó de estarlo. Leí el archivo completo: dice "v21" en el chequeo de versión y no menciona tocar el cartel | El guion **no** está actualizado para lo que se sube; esto es un hallazgo mío, no una afirmación desmentida |
| VAL-74: los números de línea y el mecanismo doble (prompt + parser) | `grep -n "MAX_AI_ITEMS\|hasta 8"` en `app/parts/packing-engine.js`: línea 195 (constante), 1490 (prompt), 1556 (parser) | Cierto, coincide exactamente con lo que dice el backlog |
| VAL-74: existe un camino para medir con modelo real | `app/pruebas/lote-modelo-real.js` existe y su comentario documenta que corre contra una respuesta de un modelo real, no un simulador escrito de memoria | Cierto |

## Respuestas puntuales a lo pedido

**1. El defecto del cartel — ¿algún cartel se queda colgado, o hay otro par que sufra lo mismo?**
No encontré ningún caso donde el cartel quede colgado para siempre: el guardia de identidad hace
que, en cualquier cadena de N carteles, el único que sobrevive sea siempre el último mostrado, y
su propio reloj termina limpiándolo. Sobre "es de cualquier par, no de VAL-63": es cierto para
cualquier par de llamadas a `toast()` (confirmé un solo contenedor `#toast` y una sola función), y
no encontré ningún otro sitio del archivo con el mismo patrón de dos relojes independientes
compitiendo por el mismo nodo — los otros avisos temporizados (`#im-slow`, `#doc-nopick`,
`#im-nopick`) usan banderas de estado o elementos propios, no el reloj-sobre-nodo-compartido que
tenía `toast()`. No es una exageración; sí conviene decir, la próxima vez que se escriba así, que
se refiere a los carteles de `toast()` y no a "cualquier aviso de la app" en general.

**2. ¿El cartel tocable es accesible de verdad?**
No del todo. `role="button"`, `tabindex="0"` y el manejo de `Enter`/`Espacio` hacen que el control
sea **operable** si alguien llega hasta él. Pero nada lo hace **descubrible**: `#toast` no tiene
`aria-live` (a diferencia de `#pkdock`, que sí lo tiene con un comentario propio explicando por
qué), está al final del `<body>` en el orden del DOM, y `closeSheet()` no mueve el foco a ningún
lado después de guardar. Es la declaración cosmética que se sospechaba: cumple la letra de un
control accesible, pero en el flujo real (guardar el viaje → la hoja se cierra → el cartel aparece
7 segundos después en otro punto del DOM) nadie que dependa del teclado o de un lector de pantalla
se va a enterar de que apareció.

**3. El arnés — ¿las aserciones pueden fallar de verdad?**
Sí, en los dos controles pedidos. Sacar el `alTocar` del call site y sacar el guardia de identidad
producen la misma falla (2 FALLARON) por razones distintas, y en el segundo caso además se ve en
el log el propio defecto viejo reproducido (el texto "VER" aparece en el historial de carteles
capturados y después el `querySelector` específico no lo encuentra).

**4. El guion desactualizado — ¿es bloqueante?**
Sí, coincido con la lectura del PM. No es un detalle cosmético: el primer paso del guion actual
dice "Si no dice v21: pará y avisame", y la versión que se está por subir dice v22. Seguido tal
cual, el guion frena al PM antes de que llegue a probar lo que se arregló. Además no incluye el
paso nuevo (tocar el cartel), que es justamente lo que más cambió esta ronda. No se publica sin
actualizar ese archivo — es la pieza que convierte "probamos en un sustituto" en "y así lo cerrás
vos", y ahora mismo esa pieza está rota para la versión que va a servir el link.

**5. VAL-74 — ¿está bien planteada?**
Sí. Verifiqué los tres hechos que cita (línea de la constante, el prompt que pide "hasta 8", el
parser que corta ahí) y los tres son exactos. El criterio de "medir con un modelo real antes de
elegir un número" es el correcto para este proyecto — es literalmente la lección que costó la
iteración 3 (un simulador escrito de memoria en vez de leído del contrato), aplicada de vuelta a
un simulador que en este caso ni siquiera hace falta, porque `lote-modelo-real.js` ya existe. La
entrada también evita repetir el error de VAL-63 con `travelers`: no propone un número nuevo sin
medir, propone medir primero. No tengo objeciones.

## Lo que falta para llegar a 85 (y antes, a 70)

En orden:

1. **Actualizar `docs/qa/v21-como-lo-compruebo-en-el-telefono.md` a v22.** Cambiar el número de
   versión en el chequeo inicial, agregar el paso de tocar el cartel y confirmar que lleva a la
   valija, y actualizar la tabla de "Dónde se probó esto" con el arnés y los dos controles
   negativos que corrí en esta ronda. Sin esto, no hay guion válido para el candidato — es el
   ítem más urgente porque bloquea todo lo demás.
2. **Resolver o declarar la brecha de accesibilidad del cartel.** O se agrega `aria-live="polite"`
   a `#toast` desde la carga (mismo patrón ya usado en `#pkdock`, con el mismo argumento) y se
   decide qué pasa con el foco al cerrar la hoja, o se declara explícitamente en el commit y en el
   guion de QA que el cartel tocable no es descubrible por teclado ni lector de pantalla todavía.
   Lo que no puede seguir es la aserción de test diciendo "para quien usa lector de pantalla" sin
   que sea cierto.
3. **Actualizar `docs/backlog.md` (entrada VAL-63)** con el defecto viejo encontrado (el reloj que
   pisaba carteles ajenos) y el arreglo de esta ronda, para que quede la historia completa en el
   único lugar donde alguien la va a buscar después.
4. **Publicar y confirmar que lo publicado es esto.** Cuando se suba, `grep` de `VALIJA_VERSION`
   sobre lo servido por el link, no sobre el repo, antes de pedirle nada al PM — la lección de
   "Publicar no es haber publicado" sigue vigente y nadie la corrió esta ronda porque el PM pidió
   el puntaje primero.
5. **Correr el guion actualizado con el PM real, en su teléfono, con el antes y el después
   escritos** — el criterio de éxito que fija el propio brief, y lo único que de verdad cierra
   VAL-63.

## Lo que nadie puede verificar desde acá

- **El caso completo del PM, en el Artifact publicado, en su teléfono.** No hay atajo: es el
  entorno real y ningún sustituto lo reemplaza. Pasos exactos, una vez que se corrija el punto 1
  de arriba: abrir el link, confirmar que dice v22, crear el viaje de Noruega, cambiar a verano,
  tocar Guardar, esperar el cartel, **tocarlo**, confirmar que lleva a la valija con "Ver qué
  agrego" visible, y mandar captura de cada paso.
- **Si un lector de pantalla real (TalkBack, que es lo que corre en el teléfono del PM) anuncia o
  no el cartel.** Argumenté desde el DOM (sin `aria-live`, sin gestión de foco) que no debería,
  pero no tengo forma de correr TalkBack desde acá. Si alguien lo tiene a mano, es la forma más
  directa de confirmar o desmentir el punto 6 de la tabla.
- **Si la v22 con este arreglo queda efectivamente publicada en el link del Artifact**, y si el
  link sirve la última versión o una fijada. El PM avisó que todavía no la subió; cuando la suba,
  este chequeo (leer lo servido, no el repo) queda pendiente de quien publique.
- **Los ~15 arneses declarados en verde que no corrí esta vez** (`tarjeta-y-lote`,
  `importar-arranque`, `importar-sin-imagenes`, `tier-del-modelo`, los tres cruces, `pdf-real`,
  `base-compartida`, `lote-modelo-real`, los cuatro de archivo, `el-script-parsea`). Corrí 5 de los
  nombrados (más de la mitad del total reclamado) y los cinco coincidieron con lo reportado; no
  desmiento los restantes, tampoco los confirmo.

## Archivos relevantes

- `/home/user/tomasmperea/app/valija.html` (líneas 402-410: CSS `.toast.tocable`; 911-914:
  `VALIJA_VERSION`; 832-837: `#pkdock` con `aria-live` y su comentario, `#modal`, `#toast` sin
  `aria-live`; 7933: `closeSheet()` sin gestión de foco; 7962-7986: `toast()` con el guardia de
  identidad nuevo; 8051-8058: el call site que pasa `alTocar`)
- `/home/user/tomasmperea/app/pruebas/val63-cambia-el-viaje.js` (líneas 200-231: las dos
  aserciones nuevas sobre el cartel tocable)
- `/home/user/tomasmperea/docs/qa/v21-como-lo-compruebo-en-el-telefono.md` (desactualizado: dice
  v21, no incluye el paso de tocar el cartel)
- `/home/user/tomasmperea/docs/backlog.md` (entrada VAL-63, líneas 429 en adelante: no refleja
  esta ronda; entrada VAL-74, líneas 464-502: verificada, bien planteada)
- `/home/user/tomasmperea/docs/briefs/la-valija-cumple.md` (líneas 117-124: "Cómo se valida",
  el criterio de éxito que sigue sin cumplirse)
- `/home/user/tomasmperea/CLAUDE.md` (líneas 112-136: la sección nueva CANDIDATO/TERMINADO, con
  el veto de redacción arriba)
