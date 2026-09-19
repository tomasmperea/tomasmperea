# v22 — la prueba, paso a paso

**Link:** https://claude.ai/artifact/3Q4KLi6g3ygTAJdR79aTCf

Es **una sola prueba** y es tu caso de Noruega. Si algo sale mal: **sacá captura y mandámela.**

---

## Antes de empezar

1. Abrí el link.
2. Arriba, al lado de **Valija**, tiene que decir **v22**.

**Si no dice v22:** pará y avisame.

---

## La prueba — que la valija se entere de que cambiaste la fecha

1. Creá un viaje: nombre **Noruega**, destino **Noruega**, salida **14/09/2026**, regreso **24/09/2026**.
2. Entrá al viaje y **armá la valija** (el botón grande de abajo).
3. Esperá a que la lista aparezca. Mirá qué sugiere y, si querés, sacale una captura.
4. Volvé a la pantalla del viaje y tocá el **lápiz** de arriba para editarlo.
5. Cambiá las fechas a **10/06/2027** y **20/06/2027**.
6. Tocá **Guardar**.
7. **Quedate mirando la pantalla unos segundos.**

**Anda si:** aparece abajo un cartel que dice **"Tengo N cosas para sumarte a la valija"**, con un **VER**
al costado.

**Puede tardar unos segundos** — la app le está preguntando al modelo. Si te fuiste a otra pantalla, el
cartel te va a alcanzar ahí; eso es normal.

8. **Tocá el cartel.**

**Anda si:** te lleva a la valija y ahí hay un aviso que dice *"El viaje cambió y la lista quedó vieja"*
con un botón **Ver qué agrego**.

9. Tocá **Ver qué agrego**.

**Anda si:** te muestra la lista de lo que suma, agrupada, con el motivo de cada cosa. Al aceptarla, la
lista suma ítems de verano.

**Falla si:** no aparece ningún cartel al guardar, o el cartel no se puede tocar, o al aceptar la propuesta
la lista queda exactamente igual que en septiembre.

---

## Qué me mandás

| Si pasó esto | Mandame |
|---|---|
| Todo el recorrido anduvo | **"anduvo"** |
| El cartel aparece pero no se puede tocar | captura |
| No apareció ningún cartel | captura de la pantalla del viaje |
| Apareció el cartel pero la lista no cambió | **las dos capturas**, la de septiembre y la de junio |
| Arriba no dice v22 | avisame antes de seguir |

---

## Dónde se probó esto, y dónde no

**Se probó:** en Chromium de escritorio, con Playwright, tocando los botones reales de la pantalla —abrir la
hoja del viaje, cambiar la fecha, tocar Guardar, y tocar el cartel hasta llegar a "Ver qué agrego"—. El arnés es `app/pruebas/val63-cambia-el-viaje.js` y su
control negativo, que desactiva el disparador, hace fallar el arnés.

(Acá decía "da 4 fallas". Eran 8: el número había quedado de una versión anterior del arnés, de antes de que
se le sumaran aserciones nuevas. Es la tercera vez esta semana que una cifra escrita a mano en prosa queda
vieja, así que se saca en vez de corregirse — el arnés dice cuántas son cada vez que corre, y la prosa no
tiene por qué repetirlo.

Y la primera versión de esta misma nota decía "dos aserciones", que tampoco pude confirmar al contarlas. Un
número de más en la explicación de por qué sobraba un número.)

**No se probó:** en tu teléfono. Es lo único que este proyecto llama "verificado", y es lo que te estoy
pidiendo con esta prueba. La tabla de `CLAUDE.md` dice exactamente qué no cubre el sustituto que usé: el
navegador del teléfono, sus permisos y su visor.

---

## Lo que esta entrega NO arregla

**Que la sugerencia sea buena.** Lo que se arregló es que la app **vuelva a preguntar** cuando cambiás el
viaje — antes no preguntaba nunca. Si la respuesta de junio es floja, o si para un viaje multidestino sigue
mirando el destino que escribiste en vez de tus vuelos, eso es lo que viene después: **VAL-66 y VAL-72**,
que ya están mapeadas con prioridad más alta que ésta.

Por eso la tercera fila de la tabla pide las dos capturas: si el cartel aparece pero la lista no cambia,
el problema es de las otras dos historias y con esas capturas arranco con dato en vez de con una suposición.

**Una brecha de accesibilidad, declarada.** El cartel ahora se puede usar con teclado y el contenedor avisa
que cambió. Lo que NO está comprobado es si un lector de pantalla real lo lee bien: eso se prueba en un
teléfono con el lector prendido y no lo hicimos. Si usás TalkBack alguna vez, contame qué escuchás.

**Y algo que te va a llamar la atención:** ahora **renombrar el viaje también dispara la revisión**. No es un
error. El motor usa el nombre del viaje como pista —renombrar "Viaje" a "Noruega" agrega 5 ítems—, algo que
yo había dado por falso sin medirlo. Que el nombre pese tanto es raro y queda anotado como pregunta de
producto en VAL-72; mientras el motor lo use, el disparador tiene que respetarlo.
