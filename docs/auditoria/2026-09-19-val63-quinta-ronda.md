# Re-auditoría VAL-63 — quinta ronda

**Commit auditado:** `a60c44b`, encima de `2bd23c0` (cuarta ronda, 74/100 — no cumplía la condición
cualitativa del piso de candidato, `docs/auditoria/2026-09-19-val63-cuarta-ronda.md`). Árbol verificado
limpio (`git status --porcelain` vacío) antes y después de auditar. Cambios entre las dos: sólo
`docs/qa/v22-como-lo-compruebo-en-el-telefono.md` y la incorporación del archivo de la cuarta ronda al árbol
(`git diff 2bd23c0 a60c44b --stat`). **Sin cambios en `app/`** — lo confirmé con `git diff 2bd23c0 a60c44b --
app/`, vacío, y coincide con lo que dijo el mensaje de esta ronda.

## Veredicto: 83 / 100 — SÍ cumple la condición cualitativa del piso de candidato

**Respuesta directa a lo que se pidió: sí, con esto se puede publicar la v22 como candidato.** Las dos
correcciones de esta ronda cierran los dos hallazgos concretos que dejé en la cuarta ronda, y al revisar de
nuevo con el mismo criterio no encontré ningún otro punto donde una dimensión esté floja por un motivo que
no sea el entorno real. El total (83) también queda claramente por encima de 70.

**Una revisión sobre mi propio puntaje de la ronda anterior, no sólo sobre la entrega.** En la cuarta ronda
había dejado la dimensión 6 en 9/10 por una razón que, mirada de nuevo, no está en la rúbrica: "la
corrección, siendo necesaria, es reactiva — la encontró la auditoría, no una revisión propia". Eso es un
dato sobre CÓMO se llegó a la decisión, no sobre si la decisión está argumentada y declarada, que es lo que
la rúbrica pide para esta dimensión ("Cada decisión con su porqué y con lo que se descartó... suma si está
argumentada y declarada"). La decisión de accesibilidad (reusar el patrón de `#pkdock`, declarar lo que no
se pudo comprobar) cumple eso sin que importe quién la disparó. Si aplicara ese mismo criterio —"¿quién lo
encontró primero?"— en cualquier otra ronda, iba a terminar descontando puntos por el sólo hecho de que este
proyecto tiene un rol de auditoría, que es exactamente lo contrario de lo que se supone que hace ese rol.
Lo corrijo acá: **10/10**. Lo marco explícito porque cambia el total más de lo que explican, por sí solas,
las dos correcciones de esta ronda, y prefiero que quede visible por qué.

## Lo que se corrigió, y lo verifiqué

**1. El número.** Confirmé con `git diff` que la frase "da 4 fallas" desapareció y no fue reemplazada por
otro número: ahora dice "hace fallar el arnés", sin cifra, y un párrafo aparte explica por qué se sacó en
vez de corregirse — el arnés informa cuántas fallan cada vez que corre, así que repetirlo a mano en prosa es
un número que empieza a estar mal desde la próxima aserción que se agregue. **Es la decisión correcta**: no
tapa el síntoma (poner "8"), ataca la causa (dejar de escribir a mano un número que otra pieza del sistema
ya sabe calcular). Como no volví a correr el arnés —no cambió nada en `app/`— reuso el resultado que ya
tengo de la cuarta ronda: 15 ok / 0 fallas contra el HTML actual, y 8 fallas con el disparador desactivado.

**2. La línea huérfana.** Confirmé que el "Anda si" repetido después del paso 9 se fusionó en uno solo
("te muestra la lista de lo que suma, agrupada, con el motivo de cada cosa. Al aceptarla, la lista suma
ítems de verano") y que el "Falla si" ahora nombra los dos modos de falla nuevos explícitamente: que el
cartel no se pueda tocar, y que aceptar la propuesta no cambie la lista. Los dos modos están cubiertos por
aserciones reales del arnés (`ok(tocable.hay, ...)` para el primero; la comparación de `hayLista`/ítems
nuevos contra septiembre para el segundo), así que el guion no promete más de lo que el arnés prueba.

**3. La autocorrección sobre la descripción de "qué cambió" en la ronda anterior.** Quedó anotada en el
mensaje de esta ronda, no en un archivo — la leí y la confirmé correcta contra `git diff` de la ronda
pasada. Coincido con la lectura de que pesa más que los dos hallazgos que arregló: un número viejo se puede
volver a mirar y corregir; una descripción incompleta de qué cambió le da al auditor (o a cualquiera que
lea el commit después) un mapa que no coincide con el territorio, y eso puede hacer que algo real quede sin
mirar. Que se lo haya señalado sin que nadie se lo pidiera es exactamente el tipo de honestidad que la
rúbrica premia.

## Sobre la nota no bloqueante de `CLAUDE.md` línea 129

Preguntado directamente: **dejarla para el próximo pase no es un error.** Mi nota de la ronda anterior ya
decía "no bloqueante" y "no cambia ningún veredicto" — sigue siendo así acá. Meter un cambio de regla en el
mismo commit que corrige un guion de QA es exactamente el tipo de mezcla que este proyecto ya identificó
como problema (`docs/backlog.md` VAL-73 quedó fuera de VAL-63 por el mismo motivo, y la propia auditoría de
la segunda ronda lo señaló como criterio correcto). La diferencia entre la línea 129 y las 133-143 sigue
sin causar ningún caso real de ambigüedad —es una formulación más angosta que convive sin contradecir a la
más específica— así que no hay urgencia. Queda anotada para cuando alguien vuelva a tocar esa sección.

## Tabla de las seis dimensiones

| # | Dimensión | Peso | Puntaje | Por qué |
|---|---|---|---|---|
| 1 | Verificación en el entorno real | 30 | **20** | Tope del tier (sustituto fiel + brecha declarada explícitamente): el guion, el comentario del HTML y el comentario del arnés dicen los tres lo mismo, con precisión, incluida la brecha de TalkBack. La imprecisión que impedía el máximo la ronda pasada (el número de fallas mal escrito en la propia sección que declara qué se probó) ya no está. |
| 2 | Diagnóstico de causa raíz | 15 | **15** | Sin cambios: ya estaba en el máximo, y el diagnóstico de esta ronda (un número escrito a mano no sobrevive a que el arnés crezca) es correcto y se aplicó como arreglo estructural, no como parche puntual. |
| 3 | Honestidad de lo verificado | 15 | **15** | Las dos afirmaciones desactualizadas que encontré la ronda pasada quedaron corregidas, y la corrección del número viene acompañada de una explicación de por qué estaba mal — no se escondió, se dejó escrito en el propio documento para quien lo lea después. Nota al margen, no bloqueante: el porqué exacto que da esa nota ("antes de que se le sumaran dos aserciones") es una reconstrucción histórica que no pude confirmar con precisión total —mi propia arqueología con `git show` sugiere que la cuenta podría no ser exactamente "dos"—, pero es una explicación de contexto sobre un número que ya no existe en el guion, no una instrucción operativa que el PM vaya a seguir. No la trato como una afirmación sin respaldo en el sentido que le importa a esta rúbrica. |
| 4 | Cumplimiento del contrato | 15 | **8** | Sin cambios: el criterio de éxito del brief sigue siendo la prueba del PM en el teléfono con el antes y el después escritos, y la v22 todavía no se publicó. Ésta es la dimensión que `CLAUDE.md` exceptúa explícitamente cuando el motivo es el teléfono, y acá lo es — no hay ningún otro motivo detrás de este puntaje. |
| 5 | Calidad interna | 15 | **15** | Los dos defectos concretos de documentación de la ronda pasada (número desactualizado, línea huérfana) están arreglados y verificados. No encontré ningún otro punto donde el guion, el backlog o el código digan algo distinto de lo que el código hace hoy. |
| 6 | Diseño y decisiones de producto | 10 | **10** | Revisado y corregido respecto de mi propio puntaje anterior (ver arriba): la decisión de accesibilidad está argumentada, declarada, y reutiliza un patrón ya existente en el propio archivo en vez de inventar uno nuevo. No encontré ninguna decisión de esta ronda —sacar un número, fusionar una línea— que necesite descargo aparte: las dos están bien y están explicadas en el propio documento. |
| | **Total** | **100** | **83** | Todo lo que está por debajo del máximo (dimensiones 1 y 4) está floja únicamente porque el criterio depende del teléfono. Se cumple la condición cualitativa del piso de candidato. |

## Afirmaciones que verifiqué

| Afirmación | Cómo la verifiqué | Resultado |
|---|---|---|
| "Sin cambios en `app/`" | `git diff 2bd23c0 a60c44b -- app/` | Cierto, vacío |
| "El número se sacó, no se corrigió a 8" | Leí el diff completo de `docs/qa/v22-como-lo-compruebo-en-el-telefono.md` | Cierto — dice "hace fallar el arnés", sin cifra, con la explicación de por qué |
| "La línea huérfana se fusionó" | Comparé el texto antes/después alrededor del paso 9 | Cierto |
| "El 'Falla si' cubre los dos modos nuevos" | Leí la línea nueva y la comparé contra las aserciones reales del arnés (`tocable.hay`, la comparación de ítems nuevos) | Cierto, ambos modos tienen respaldo en el arnés |
| "`CLAUDE.md` no se tocó en este commit" | `git diff 2bd23c0 a60c44b -- CLAUDE.md` | Cierto, vacío |
| "'Antes de que se le sumaran dos aserciones' es exacto" | Recorrí el historial (`6b22206`, `e5bf975`, `9199ff9`) buscando cuándo se escribió "da 4 fallas" y qué aserciones dependían del disparador en ese momento | No pude confirmarlo con precisión total; no lo trato como bloqueante (ver dimensión 3) |

## Qué falta para 85, y para terminada

Con 83, el candidato está habilitado a publicarse. Para 85 y para dar la historia por terminada, sigue
pendiente exactamente lo que las rondas anteriores ya dejaron anotado y que ninguna ronda de documentación
puede resolver desde acá:

1. **Publicar la v22**, y confirmar con `grep` sobre lo que sirve el link —no sobre el repo— que es esta
   versión antes de pedirle nada al PM.
2. **Correr el guion (`v22-como-lo-compruebo-en-el-telefono.md`, ya corregido) con el PM real, en su
   teléfono**, con el resultado escrito — antes/después, no "anduvo". Es el único criterio que el brief fija
   como definición de éxito y sigue siendo la única pieza que ningún sustituto reemplaza.
3. Si en esa ronda el PM prueba con TalkBack, el dato que traiga cierra la única brecha de accesibilidad que
   sigue declarada y sin comprobar.

## Lo que nadie puede verificar desde acá

Sigue siendo lo mismo que en la ronda anterior, sin cambios: el caso completo del PM en el Artifact
publicado en su teléfono; si TalkBack real lee el cartel bien (orden de lectura, si repite "Ver", etc.); si
la v22 con este guion queda efectivamente publicada y si el link sirve la última versión. Ninguno de los
tres tiene sustituto posible desde este entorno.

## Archivos relevantes

- `/home/user/tomasmperea/docs/qa/v22-como-lo-compruebo-en-el-telefono.md` (líneas 39-45: el "Anda si"/"Falla
  si" fusionados; líneas 63-70: el número sacado y su explicación)
- `/home/user/tomasmperea/docs/auditoria/2026-09-19-val63-cuarta-ronda.md` (el puntaje que se revisa acá,
  incluida la autocorrección de la dimensión 6)
- `/home/user/tomasmperea/CLAUDE.md` (líneas 112-145, sin cambios en este commit; la nota de la línea 129
  sigue pendiente para un próximo pase, correctamente pospuesta)
