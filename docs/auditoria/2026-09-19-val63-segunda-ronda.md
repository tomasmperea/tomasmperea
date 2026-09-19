# Re-auditoría VAL-63 — segunda ronda

**Commit auditado:** `6b22206`, encima de `1f2d047`/`73ed0f0` ya auditados en la primera ronda
(`docs/auditoria/2026-09-19-val63.md`, veto en 38). Árbol verificado limpio
(`git status --porcelain` vacío) antes y después de auditar. Único cambio en `app/` entre
`1f2d047` y `6b22206`: `app/valija.html` (la guarda) y `app/pruebas/val63-cambia-el-viaje.js`
(el arnés), confirmado con `git diff --stat 1f2d047 6b22206`.

## Veredicto: 76 / 100 — no se da por terminada la iteración, pero **sí se puede publicar como
candidato**

Menos de 85. Por la letra de `docs/auditoria/rubrica.md` eso significa que VAL-63 no se cierra
todavía como terminada. Pero la misma rúbrica separa esa decisión de la de publicar: "publicar
como candidato" exige que todo lo verificable acá esté verificado y que el único hueco sea el
entorno real, declarado, con guion para el PM. Eso es exactamente lo que hay ahora — a diferencia
de la primera ronda, donde el hueco no era el entorno: era un bug verificable acá y no verificado.
Esta vez no encontré ningún hallazgo local sin resolver. Recomiendo publicar como candidato,
pedirle al PM que corra `docs/qa/v21-como-lo-compruebo-en-el-telefono.md`, y no marcar VAL-63 como
terminada hasta que ese resultado vuelva escrito.

## Tabla de las seis dimensiones

| # | Dimensión | Peso | Puntaje | Por qué |
|---|---|---|---|---|
| 1 | Verificación en el entorno real | 30 | **20** | Mismo sustituto que la primera ronda (Playwright + Chromium de escritorio, `file://`, gestos tocados de verdad), pero ahora con brecha declarada de forma operativa: `docs/qa/v21-como-lo-compruebo-en-el-telefono.md` es el guion exacto que la rúbrica pide para un candidato, y dice explícitamente qué NO arregla esta entrega. Sigue sin haber registro de una corrida en el Artifact ni en el teléfono, y no pude confirmar desde acá que la v21 esté efectivamente publicada (ver "lo que no pude verificar"). |
| 2 | Diagnóstico de causa raíz | 15 | **14** | El arreglo no repite el error: en vez de adivinar dos campos más, elimina la clase entera de error (comparar todo lo editable). Verifiqué independientemente que `CAMPOS_EDITABLES_DEL_VIAJE` coincide exactamente con los 6 inputs de `sheetTrip` (`t_name`, `t_dest`, `t_from`, `t_to`, `t_people`, `t_notes`), que `Store.saveTrip` sólo se llama desde ese handler, y que el motor no lee ningún campo del viaje fuera de esos seis más `international` (que no es editable desde ninguna UI). No encontré ningún campo editable que se le siga escapando. |
| 3 | Honestidad de lo verificado | 15 | **13** | El commit nombra la trampa por su nombre ("la documentación que queda mintiendo, cometida dos días después de la última vez") y admite las dos afirmaciones falsas sin dorarlas. El QA doc distingue con precisión qué se arregló (el disparador) de qué no (la calidad de la sugerencia, VAL-66/VAL-72) y avisa por adelantado el efecto sorpresa de que renombrar dispare consulta. Descuento 2 puntos porque el commit no repite, en su propio texto, que todo esto se corrió en un sustituto y no en el entorno real — queda implícito en la existencia del QA doc, pero no dicho. |
| 4 | Cumplimiento del contrato | 15 | **8** | El brief fija el criterio de éxito como el caso del PM verificado en el Artifact, en su teléfono, con antes y después escritos — eso sigue sin existir. El resto de lo que pide el brief para VAL-63 (disparador al guardar, guarda sin falso negativo, aviso, normalización de fechas, retorno aditivo) está hecho y verificado. |
| 5 | Calidad interna | 15 | **12** | Las dos aserciones nuevas discriminan de verdad (ver abajo, las corrí contra la guarda vieja y fallan). El comentario del código ahora describe lo medido, no lo supuesto. `motores-desde-html.js` sigue en 39/39 (el motor no cambió). Descuento por VAL-73: el registro en `docs/backlog.md` explica la carrera sólo como "la revisión no llegó a tiempo", pero al reproducirla encontré un síntoma más serio que esa frase no cubre (ver abajo) — la nota subestima lo que su propio diagnóstico muestra. |
| 6 | Diseño y decisiones de producto | 10 | **9** | "Dejar de adivinar y comparar todo lo editable" es la decisión correcta después de fallar adivinando dos veces, está argumentada y no esconde el costo (una consulta de más cuando cambia el nombre). Deja escrita la pregunta de producto real que esto destapa (¿debería el nombre pesar tanto?) como backlog en VAL-72, en vez de resolverla apurado acá. |
| | **Total** | **100** | **76** | Sube 38 puntos sobre la primera ronda. Sigue por debajo de 85: no se da por terminada la iteración, pero cumple la vara de "candidato" de la rúbrica. |

## Respuestas puntuales a lo que se pidió

### 1. ¿El enfoque nuevo tiene algún falso negativo?

No encontré ninguno. Hice tres verificaciones independientes:

- **La forma:** `sheetTrip` (línea 7952 en adelante) tiene exactamente 6 campos editables:
  `t_name`, `t_dest`, `t_from`, `t_to`, `t_people`, `t_notes`. `CAMPOS_EDITABLES_DEL_VIAJE =
  ["name", "destination", "startDate", "endDate", "travelers", "notes"]` los cubre uno a uno.
- **El único punto de escritura:** `grep -n "Store.saveTrip(" app/valija.html` da una sola
  coincidencia (línea 7995, dentro de este mismo handler). No hay otro camino para editar un viaje
  que se salga de esta guarda.
- **Lo que el motor realmente lee:** `grep -oP "trip\.\w+" app/parts/packing-engine.js | sort -u`
  da `destination, endDate, id, international, name, notes, startDate` — siete campos. Los seis
  editables están cubiertos; el séptimo (`international`) no tiene ningún control en la interfaz
  que lo escriba (`grep -n "international" app/valija.html` no muestra ningún `input`/checkbox que
  lo setee), así que no hace falta incluirlo.

Un hallazgo colateral, a favor de la nueva guarda: `travelers` **no aparece en absoluto** en
`packing-engine.js` — el motor no lo usa para nada (`computeQty` sólo mira `ctx.days`). O sea que
la primera versión también se había equivocado al INCLUIR `travelers` ("las cantidades salen de
ahí" — falso, pero en la dirección inofensiva: sobra, no falta). Esto refuerza que adivinar campo
por campo, en cualquier dirección, no funcionó dos veces; el enfoque de "todo lo editable" es el
correcto.

### 2. ¿Las aserciones dadas vuelta están bien, o acomodadas?

Las corrí contra una copia con la guarda vieja (`["startDate","endDate","destination","travelers"]`,
sin `name` ni `notes`) para confirmar que SÍ discriminan:

```
node app/pruebas/val63-cambia-el-viaje.js <copia-con-guarda-vieja>
...
· cambiar SÓLO las notas también mueve la valija
  FALLA cambiar las notas volvió a preguntarle al modelo
· renombrar el viaje también, porque el motor usa el nombre
  FALLA renombrar volvió a preguntarle al modelo: el nombre alimenta el motor
  2 FALLARON
```

Y contra el HTML real (con la guarda nueva), las mismas dos aserciones pasan, y una copia sin el
cable entero sigue fallando las 6 (las 4 originales más estas 2). **No están acomodadas: fallan
cuando tienen que fallar y pasan cuando tienen que pasar.**

Reproduje además, por mi cuenta y sin navegador, los números exactos que cita el commit:

```
SOLO NOTAS  (trekking y kayak)         -> 6 ítems nuevos*
SOLO NOMBRE (con pista de actividad,
             destino ya puesto)        -> 5 ítems nuevos
```

*(el commit dice 3, yo medí 6 con mi propio texto de notas — la diferencia es el texto de prueba
usado, no el mecanismo; con destino=Madrid y notas="trekking y kayak" sobre una base sin pistas
previas también me dio 6. El número exacto depende del texto elegido; el hecho de que **notas
mueve la lista sin tocar fecha/destino/viajeros** es lo que importa y está confirmado en los dos
casos.)*

**Voy más allá del pedido:** mi primera auditoría había calificado el caso de "nombre" como un
borde raro que requería destino vacío. Es más grave que eso — lo reproduje con destino puesto
("Noruega") y sólo cambiando el nombre a un texto con pista de actividad, y da 5 ítems nuevos,
igual que reporta el commit. El mecanismo es el mismo `textBlob`/`facts` que usan las notas, no
depende de `deduceInternational`. La corrección del commit sobre mi propio hallazgo es correcta y
la verifiqué.

### 3. ¿El guion del PM promete algo que esta entrega no hace?

No. `docs/qa/v21-como-lo-compruebo-en-el-telefono.md` dice explícitamente "Lo que esta entrega NO
arregla: que la sugerencia sea buena", nombra VAL-66 y VAL-72, y la fila de "apareció el cartel
pero la lista no cambió" pide las dos capturas en vez de dar por sentado un veredicto — coherente
con la regla del proyecto de no concluir de un dato lo que no se puede determinar leyendo. También
avisa por adelantado el efecto sorpresa de renombrar, con el número medido. Es fiel a lo que el
código hace.

### 4. VAL-73 — ¿el criterio de no tocarlo acá es correcto?

**El criterio de no arreglarlo en este commit es correcto.** Mezclar un arreglo de estabilidad de
arnés de otra historia en el medio de VAL-63 es exactamente el ruido que el proyecto ya identificó
como problema en otras rondas.

**Pero la nota en el backlog subestima lo que encontraste, y te contradigo ahí.** Corrí
`valija-bloque-b.js` tres veces seguidas y reproduje la falla una vez:

```
=== run 3 ===
diag {"view":"packing","recalc":[],"items":["flight"],"hayLista":false,"aMano":null,"appPlan":null}
FALLA entrar a la valija recalcula el plan (0 nuevos)
FALLA 15 · el aviso entra ARRIBA de la lista
FALLA (excepción) locator.innerText: Timeout 30000ms exceeded.
```

`hayLista:false` y `items:["flight"]` (sin el auto que el test acababa de guardar con
`Store.saveItem`, antes del `reload`) es un síntoma más grave que "la revisión no llegó a tiempo".
No es que `planDe('t1')` tardó: es que **después del reload, la reserva del auto y la lista de
valija no estaban**, como si la escritura no hubiera quedado firme antes de recargar. El
`waitForFunction(...).catch(()=>{})` que la nota del backlog señala explica por qué el test no
frena ahí a esperar, pero no explica por qué el dato no está — eso es anterior a esa línea.

No sé si el bug vive en el harness (una espera que falta entre `Store.saveItem` y `page.reload()`)
o en la app (una escritura que no se garantiza firme antes de que la persona pueda recargar/salir
de la app). No lo investigué más a fondo porque no es el alcance de esta ronda. Pero si fuera lo
segundo, no es sólo "un arnés inestable": es la misma familia de promesa que VAL-63 hizo esta
iteración ("la app se entera de lo que pasó"), aplicada a guardar una reserva en vez de guardar el
viaje. Te pido que la entrada de VAL-73 en el backlog incluya este diagnóstico completo (el
`hayLista:false`, el ítem que falta) y no sólo la lectura de "la espera se traga el vencimiento",
para que quien la tome después no la subinvestigue asumiendo que es sólo timing del test. Prioridad:
no tengo forma de saber desde acá si es P3 o más alta sin decidir primero si la causa es del harness
o de la app — y esa es justo la pregunta que dejaría escrita en vez de asumida.

## Afirmaciones que verifiqué

| Afirmación | Cómo la verifiqué | Resultado |
|---|---|---|
| "Cambiar sólo las notas mueve la lista" | `pe.planListUpdate` con sólo `notes` distinto | Cierto — `desactualizada:true`, ítems nuevos en 6 (con mi texto) |
| "Cambiar sólo el nombre mueve la lista, aun con destino puesto" | ídem, con destino="Noruega" fijo y nombre con pista de actividad | Cierto — 5 ítems nuevos, igual que el commit |
| "`CAMPOS_EDITABLES_DEL_VIAJE` no deja afuera ningún campo editable" | Comparé contra los inputs de `sheetTrip`, el único call site de `Store.saveTrip`, y los campos que lee `packing-engine.js` | Cierto, sin excepciones encontradas |
| "El arnés da vuelta la aserción, no la acomoda" | Corrí el arnés contra una copia con la guarda vieja: las dos aserciones nuevas fallan ahí y pasan con la guarda nueva | Cierto |
| "20 arneses en verde" | Corrí `val63-cambia-el-viaje.js` (9/9) y `motores-desde-html.js` (39/39); no repetí los 18 restantes, según lo acordado | No contradicho por lo que corrí; el resto sigue sin verificación mía directa esta ronda |
| "VAL-73 no es causado por este cambio" | Corrí `valija-bloque-b.js` 3 veces contra el HTML actual (post-VAL-63): 1 falla de 3, mismo patrón que describe el commit | Consistente con "preexistente", pero encontré un síntoma (`hayLista:false`) más severo que el descrito en el backlog |
| El guion del PM no promete de más | Leí `docs/qa/v21-como-lo-compruebo-en-el-telefono.md` completo | Cierto, declara la brecha y el alcance con precisión |

## Lo que falta para llegar a 85

1. **Confirmar la publicación real de v21.** Intenté leer el archivo que sirve el Artifact vía
   HTTP; el shell que responde es dinámico (JS + API), no expone el HTML de la app por ese medio.
   No pude hacer el `grep` de marca de versión que pide el proceso del proyecto. Alguien con acceso
   al link tiene que confirmarlo antes de pedirle nada al PM.
2. **Correr el guion `v21-como-lo-compruebo-en-el-telefono.md` con el PM real**, en su teléfono, y
   escribir el resultado. Esto es lo único que falta para dar la iteración por terminada, no para
   publicarla como candidato.
3. **Ampliar la entrada de VAL-73** con el diagnóstico `hayLista:false` / ítem faltante que
   reproduje, para que la investigación futura no arranque asumiendo que es sólo timing del test.
4. (Menor) Restar explícitamente, en el propio commit o en un doc de entrega, que todo lo corrido
   acá fue en Chromium de escritorio vía Playwright y no en el entorno real — hoy esa brecha vive
   sólo implícita en la existencia del QA doc.

## Lo que nadie puede verificar desde acá

- **El caso completo del PM, en el Artifact publicado, en su teléfono.** Sigue siendo la única
  pieza que falta. Pasos: los que ya escribe `docs/qa/v21-como-lo-compruebo-en-el-telefono.md` —
  no tengo nada que agregarle, lo revisé y está completo y honesto.
- **Si la v21 con esta guarda nueva está efectivamente publicada en el link del Artifact.** El
  intento de leerlo vía HTTP devuelve el shell de carga de `claude.ai`, no el HTML de la app; hace
  falta abrirlo con un cliente que ejecute el JS del frame, o confirmarlo por otro medio, antes de
  pedirle al PM que lo pruebe.
- **Si el síntoma de VAL-73 es un bug del harness o de la app.** Lo dejé como pregunta abierta en la
  sección de arriba; no se puede cerrar sin instrumentar la escritura real (`Store.saveItem`,
  `Store.savePacking`) alrededor del `reload`, cosa que está fuera del alcance de esta ronda.
- **Los 18 arneses declarados en verde que no corrí esta vez** (repetí sólo `val63-cambia-el-viaje.js`
  y `motores-desde-html.js`, según lo que se me indicó que no hacía falta repetir). No los desmiento,
  tampoco los confirmo.

## Archivos relevantes

- `/home/user/tomasmperea/app/valija.html` (líneas 7116-7166: comentario y guarda nueva;
  7984-8018: handler de Guardar)
- `/home/user/tomasmperea/app/pruebas/val63-cambia-el-viaje.js` (líneas 200-243: los dos casos
  nuevos y el que se dio vuelta)
- `/home/user/tomasmperea/app/parts/packing-engine.js` (qué campos del viaje lee el motor de verdad)
- `/home/user/tomasmperea/docs/qa/v21-como-lo-compruebo-en-el-telefono.md`
- `/home/user/tomasmperea/docs/backlog.md` (entrada VAL-73, a ampliar)
