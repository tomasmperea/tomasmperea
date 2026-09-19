# Re-auditoría VAL-63 — cuarta ronda

**Commit auditado:** `2bd23c0`, encima de `9199ff9` (tercera ronda, 60/100,
`docs/auditoria/2026-09-19-val63-tercera-ronda.md`). Árbol verificado limpio (`git status --porcelain`
vacío) antes y después de auditar. Cambios entre las dos: `CLAUDE.md`, `app/valija.html` (el `aria-live` y
su comentario), `app/pruebas/val63-cambia-el-viaje.js` (aserción reescrita + una nueva), `docs/backlog.md`
(historia de las tres rondas) y el guion renombrado a `docs/qa/v22-como-lo-compruebo-en-el-telefono.md`
(`git diff 9199ff9 2bd23c0 --stat`).

**Una corrección sobre el mensaje que acompañó esta ronda:** dice "el único cambio en `app/` es el
`aria-live` del contenedor y el comentario". Eso es sobre `app/valija.html`. También cambió
`app/pruebas/val63-cambia-el-viaje.js`, que está bajo `app/`. No es grave — el cambio es exactamente el
esperado (la aserción reescrita más una nueva) y lo corrí — pero lo anoto porque el pedido de esta ronda es
específicamente "que no haya más referencias viejas", y una descripción de "qué cambió" que se queda corta
en el propio mensaje de cierre es del mismo género, aunque mucho más chico.

## Veredicto: 74 / 100 — NO CRUZA el piso de candidato, aunque el número lo sugiera

El total numérico (74) está por encima de 70. **Pero la letra nueva de `CLAUDE.md` no dice "70 puntos": dice
que el piso vale sólo si la única razón de cualquier dimensión floja es la indisponibilidad del entorno
real.** Dos dimensiones de esta tabla (3 y 5) están flojas por un motivo que no es el teléfono — encontré
otra afirmación desactualizada, esta vez adentro del propio guion que se estaba corrigiendo por eso mismo.
Es chica, no bloquea el gesto del PM, y se arregla en una línea. Pero es exactamente el patrón que esta
ronda vino a cerrar, reapareciendo en el mismo commit que lo cierra, y la regla nueva —que le pedí leer con
el mismo ojo— dice con toda claridad que eso no cruza el piso todavía.

## Lo que se arregló, y lo verifiqué de verdad

**1. La accesibilidad.** `#toast` ahora tiene `aria-live="polite"` puesto en el HTML estático, desde la
carga — confirmé con `git diff` que es exactamente el mismo patrón que ya usa `#pkdock` (con su propio
comentario, escrito el 19/09, explicando por qué tiene que ser así). La aserción del arnés que decía "se
anuncia como botón, para quien usa lector de pantalla" —la que la ronda anterior marcó como falsa, porque
sólo miraba `role`— ahora dice "lleva role=button, así que es operable con teclado y no sólo con el dedo",
que es lo que de verdad verifica. Se agregó una aserción nueva que lee `getAttribute("aria-live")` sobre el
contenedor real y compara contra `"polite"`. Corrí el arnés contra `app/valija.html` actual: **15 ok, 0
fallas**, la aserción nueva incluida (`aria-live=polite`). Esto es un arreglo real, no una declaración: el
código cambió, no sólo el comentario.

Sigue habiendo un límite, y ahora está bien dicho en los tres lugares que importan —el comentario del HTML,
el comentario del arnés, y el guion del PM—: nada de esto prueba que TalkBack en un Android real lo lea. Eso
es correcto declararlo así, porque de verdad no se puede comprobar desde acá.

**2. El guion, en general.** `docs/qa/v22-como-lo-compruebo-en-el-telefono.md` reemplaza al de v21: dice
"v22" en el chequeo de versión (coincide con `VALIJA_VERSION = "22"` del HTML), agrega el paso de tocar el
cartel y llegar a "Ver qué agrego", avisa que el cartel puede tardar y alcanzar a la persona en otra
pantalla, y declara la brecha de TalkBack con una frase concreta y pedible ("si usás TalkBack alguna vez,
contame qué escuchás"). Esto está bien hecho.

**3. El backlog.** La entrada de VAL-63 ahora resume las tres rondas con los números que dejaron: 38, 76,
60, y por qué cada una bajó. Lo comparé contra lo que yo mismo verifiqué en las rondas anteriores y no
encontré ninguna discrepancia — coincide, incluida la autocrítica de "tercera vez en la semana que escribo
una afirmación sin comprobarla".

**4. La redacción de `CLAUDE.md`.** Se pidió que la revise con el mismo ojo que encontró el hueco anterior.
Lo hice, y sí cierra lo que estaba abierto: la regla vieja enumeraba "causa raíz, honestidad, calidad
interna" (dimensiones 2, 3, 5) y se olvidaba de la 4 y la 6, dejando la puerta abierta a defender un criterio
de aceptación incumplido por un motivo ajeno al teléfono, con el argumento de "esa dimensión no está en la
lista". La nueva no enumera: dice que la única excepción es que la dimensión esté floja **porque** el
criterio exige el aparato, y dice explícitamente que si la 4 baja por otra causa, sí rompe el piso. Es lo
que hacía falta y no encontré ninguna otra dimensión que quedara afuera esta vez.

Un matiz de redacción, no un agujero: la línea 129 (que no se tocó en este commit) sigue diciendo "el piso
de 70 vale cuando la única dimensión floja es la 1", una formulación más angosta que la de las líneas
133-143, que sí permite que la 4 esté floja por la misma razón. Las dos conviven sin contradecirse en la
práctica (133-143 es más específica y llegó después), pero si alguien lee sólo la 129 se va a confundir.
Sugiero unificarlas la próxima vez que se toque esta sección — no es urgente, no cambia ningún veredicto.

## Lo que encontré, y por qué pesa

**El guion sigue teniendo una referencia vieja.** La sección "Dónde se probó esto" dice: *"El arnés es
`app/pruebas/val63-cambia-el-viaje.js` y su control negativo, que saca el cable, da 4 fallas."* Ese número
es de la versión v21 del arnés, antes de que esta misma ronda le agregara la aserción de `role` reescrita
más la de `aria-live`. Lo corrí:

```
node app/pruebas/val63-cambia-el-viaje.js <copia con "if(mueveLaValija)" reemplazado por "if(false && mueveLaValija)">
```

Resultado: **8 FALLARON**, no 4 — las dos de consulta al modelo, "la app quedó con algo para ofrecer", "la
app le avisó...", "el cartel se puede tocar", "lleva role=button", "cambiar las notas" y "renombrar". (La
aserción de `aria-live` sigue en verde ahí, correctamente, porque no depende del cable — es justo lo que
tiene que pasar.)

Esto es chico en impacto — no es un paso que el PM siga, es una frase de contexto para quien lee el guion
después — pero es el mismo defecto exacto que esta ronda existe para cerrar: un documento que describe un
estado que el código ya dejó atrás. Encontrarlo en el mismo archivo que se estaba reescribiendo por esa
misma razón es la señal que el PM pidió que no se le atribuyera más a distracción.

**Un segundo rastro, más chico:** en la sección de pasos, después del paso 9 ("Tocá Ver qué agrego" / "Anda
si: te muestra la lista..."), queda una línea suelta — *"Anda si: hay un aviso ofreciéndote lo que cambió, y
al aceptarlo la lista suma ítems de verano."* — que no cuelga de ningún paso numerado. Es un resto de la
estructura del guion v21 (donde el paso 8 era "Entrá a la valija" y esa frase lo seguía directo). No es
falsa, pero está huérfana y repite, con otras palabras, lo que ya dice el "Anda si" del paso 9. Vale la pena
sacarla o fusionarla la próxima vez que se toque este archivo.

## Tabla de las seis dimensiones

| # | Dimensión | Peso | Puntaje | Por qué |
|---|---|---|---|---|
| 1 | Verificación en el entorno real | 30 | **18** | Sigue siendo el mismo sustituto (Playwright + Chromium de escritorio, gestos reales), con la brecha ahora bien declarada en tres lugares (comentario del HTML, comentario del arnés, guion del PM) y con la versión del guion sincronizada con el código (v22 en los dos). Tope de 20 para este tier porque nada se probó en el teléfono; descuento 2 por el número de "4 fallas" desactualizado en la misma sección que declara la brecha — una declaración que tiene un dato mal es una declaración menos confiable. |
| 2 | Diagnóstico de causa raíz | 15 | **15** | Sin cambios respecto a la ronda anterior en esta dimensión (ya estaba en el máximo); el diagnóstico nuevo de esta ronda —"role hace operable, no descubrible; para eso hace falta aria-live, y tiene que estar desde la carga"— es preciso, se apoya en el precedente ya escrito para `#pkdock`, y el arreglo lo prueba (aserción nueva en verde, corrida por mí). |
| 3 | Honestidad de lo verificado | 15 | **12** | Sube 2 puntos: la corrección de la aserción sobre accesibilidad es honestidad de la mejor clase —el propio commit se titula "una afirmación mía que otra vez era falsa" y lo dice sin adornos, en el código, en el arnés y en el guion del PM. Pero encontré una afirmación nueva sin respaldo en el mismo commit ("da 4 fallas", verificado en 8): no es una mentira deliberada, es la misma clase de error que se estaba corrigiendo, sin cazar. |
| 4 | Cumplimiento del contrato | 15 | **8** | Igual que en la ronda anterior: el criterio de éxito del brief (`docs/briefs/la-valija-cumple.md`) es la prueba del PM en su teléfono con el antes y el después escritos, y sigue sin existir porque la v22 todavía no se publicó. Ésta es la dimensión que la letra nueva de `CLAUDE.md` exceptúa explícitamente cuando el motivo es el teléfono, y acá lo es. |
| 5 | Calidad interna | 15 | **12** | Mejora fuerte respecto a la ronda anterior (8→12): el guion quedó sincronizado en versión y pasos, el backlog se actualizó con la historia completa y verificable, el código y el comentario nuevo coinciden con lo que hacen (lo comparé línea por línea). No llega al máximo por el número desactualizado ("4 fallas") y la línea huérfana del guion — documentación que, en un archivo más chico y más reciente, volvió a quedarse un paso atrás del código. |
| 6 | Diseño y decisiones de producto | 10 | **9** | El arreglo de accesibilidad reutiliza un patrón ya establecido en el propio archivo (`#pkdock`) en vez de inventar uno nuevo, y la decisión de qué declarar como no verificable (TalkBack real) en vez de fingir que ya se resolvió es la decisión correcta después de haber cometido el error contrario la ronda pasada. No llega a 10 porque la corrección, siendo necesaria, es reactiva —la encontró la auditoría, no una revisión propia antes de escribir la aserción original. |
| | **Total** | **100** | **74** | Por encima de 70 en número crudo. **No cumple la condición cualitativa del piso de candidato**, porque dos dimensiones (3 y 5) están flojas por una razón que no es el teléfono. Ver veredicto. |

## Afirmaciones que verifiqué

| Afirmación | Cómo la verifiqué | Resultado |
|---|---|---|
| "`#toast` ahora tiene `aria-live` desde la carga, igual que `#pkdock`" | `git diff 9199ff9 2bd23c0 -- app/valija.html`; comparé el atributo y la posición (HTML estático, no insertado por JS) | Cierto |
| "La aserción vieja se reescribió para decir lo que de verdad verifica" | Leí el diff del arnés: `tocable.rol === "button"` ahora se lee como "operable con teclado", no como "se anuncia" | Cierto |
| "Hay una aserción nueva de `aria-live`" | Corrí `val63-cambia-el-viaje.js` contra `app/valija.html`: 15 ok / 0 fallas, incluida `el contenedor de los carteles es una región viva desde la carga (aria-live=polite)` | Cierto |
| "El guion dice v22 y coincide con el código" | `grep VALIJA_VERSION app/valija.html` → `"22"`; `docs/qa/v22-como-lo-compruebo-en-el-telefono.md` línea 12: "tiene que decir v22" | Cierto |
| "El guion declara la brecha de TalkBack" | Leí el archivo completo: sección "Lo que esta entrega NO arregla" tiene el párrafo "Una brecha de accesibilidad, declarada" | Cierto |
| "El backlog resume las tres rondas con los puntajes correctos" | Comparé contra mis propias auditorías de la segunda y tercera ronda (38→no, 76, 60) | Cierto |
| "`CLAUDE.md` ya no enumera dimensiones y cierra el hueco de la 4 y la 6" | Leí `CLAUDE.md` líneas 133-143 | Cierto, con el matiz de la línea 129 sin actualizar (no bloqueante) |
| "El único cambio en `app/` es el `aria-live` y el comentario" | `git diff 9199ff9 2bd23c0 --stat` | **Falso, chico:** también cambió `app/pruebas/val63-cambia-el-viaje.js` (la aserción reescrita + la nueva) |
| "El control negativo (sacar el cable) da 4 fallas" | Armé una copia con `if(mueveLaValija)` → `if(false && mueveLaValija)` y corrí el arnés | **Falso: da 8 fallas**, no 4 — el número quedó de la versión anterior del arnés |
| "La lista huérfana del guion no repite nada nuevo" | Leí el guion completo, paso por paso | Es redundante con el "Anda si" del paso 9 inmediato anterior; no es falsa, está mal ubicada |

## Qué falta para cruzar el piso de candidato (y después, para 85)

1. **Corregir el número en el guion:** "da 4 fallas" → "da 8 fallas" (o, mejor, sacar el número fijo y decir
   "el control negativo rompe todas las aserciones que dependen del disparador", que no se desactualiza cada
   vez que se agrega una aserción).
2. **Sacar o fusionar la línea huérfana** ("Anda si: hay un aviso ofreciéndote lo que cambió...") con el
   "Anda si" del paso 9, para que el guion no tenga dos frases distintas prometiendo lo mismo.
3. Con (1) y (2) hechos, dimensiones 3 y 5 suben lo suficiente como para que la única dimensión floja pase a
   ser la 1 (y la 4, por la misma razón que la 1) — ahí sí se cumple la condición cualitativa del piso de
   candidato, no sólo el número.
4. Después de eso, lo que ya está anotado en la ronda anterior sigue vigente para llegar a 85: publicar,
   confirmar con `grep` sobre lo servido (no sobre el repo) que es esta versión, y correr el guion con el PM
   real, en su teléfono, con el resultado escrito.

## Lo que nadie puede verificar desde acá

- **El caso completo del PM, en el Artifact publicado, en su teléfono.** Sigue siendo la única pieza real
  que falta, y sigue sin sustituto. Los pasos son los del guion v22, una vez corregido.
- **Si TalkBack real lee el cartel.** El `aria-live` está bien puesto según el estándar y según el precedente
  ya usado en este mismo archivo, pero eso es una condición necesaria, no una prueba de que el lector de
  pantalla específico del teléfono del PM efectivamente lo anuncia bien (orden de lectura, si repite el
  "Ver", etc.). El propio guion ya lo declara y pide el dato si alguna vez se prueba.
- **Si la v22 con este arreglo queda publicada**, y si el link sirve la última versión. El PM todavía no la
  subió (según el mensaje de esta ronda); cuando la suba, sigue pendiente el chequeo de "leer lo servido, no
  el repo" antes de pedirle nada.
- **Los arneses que no volví a correr.** Sólo corrí `val63-cambia-el-viaje.js`, que es el único que cambió
  según el propio diff. No repetí los demás, tal como se pidió.

## Archivos relevantes

- `/home/user/tomasmperea/app/valija.html` (líneas 832-844: `#pkdock`, `#modal`, `#toast` con `aria-live`
  nuevo y su comentario)
- `/home/user/tomasmperea/app/pruebas/val63-cambia-el-viaje.js` (líneas 214-231: la aserción reescrita y la
  aserción nueva de `aria-live`)
- `/home/user/tomasmperea/docs/qa/v22-como-lo-compruebo-en-el-telefono.md` (el guion; línea 65: el número
  desactualizado; el bloque después del paso 9: la línea huérfana)
- `/home/user/tomasmperea/docs/backlog.md` (líneas ~464-488: el resumen de las tres rondas de VAL-63)
- `/home/user/tomasmperea/CLAUDE.md` (líneas 112-145: la sección CANDIDATO/TERMINADO reescrita; línea 129
  sin actualizar respecto de 133-143)
