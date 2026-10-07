# VAL-79 + VAL-92 — cuando el vuelo va a otro lado, la app pregunta; y Enter elige

Brief de trabajo. Lo que está acá se construye; lo que no está acá, no.

**P0.** Orden del PM el 07/10: *"OK al diseño, escribí el brief y construilo con VAL-92"*.
Diseño aprobado: `docs/design/val79-destino-del-vuelo-claro.png` y `-oscuro.png`.

---

## El reporte, textual (07/10, ronda de la v39)

> *"en un viaje creado con destino Bariloche pero que cargue de la lista origen buenos aires y destino Madrid,
> la valija actualiza y me sugiere por Madrid pero no me elimina o me sugiere eliminar los items por
> Bariloche, aún así no estén empacados; eso está mal porque debería primar ya un vuelo cargado, importado que
> por sobre el destino. en todo caso para corregir esto, hay que incluir algún warning en alguna parte del
> flujo cuando se cargue/importe algún destino distinto al principal del viaje en el editor preguntando si
> esto está Ok y si se confirma entonces más aún toma peso para el motor de la valija todos los destinos de
> los vuelos para alimentarse"*

> *"queda lo que estoy escribiendo sin nada seleccionado de la lista cuando aprieto afuera o aprieto enter
> en el teclado"* — con «aeroparqu» escrito y Aeroparque como única opción.

## La causa (leída en el código, no supuesta)

`destinoVencido` no compara un ítem razonado con el destino **escrito** contra un destino que sale de
**los vuelos**: `if (fuente !== actual.fuente) return false;`. Se escribió así en VAL-75 a propósito, porque
sin traducir MAD a una ciudad no había cómo saber si MAD es o no Bariloche. VAL-87 trajo esa traducción.

## Decisiones del PM (07/10)

1. **Tres respuestas:** «El viaje ahora es a Madrid», «Voy a los dos lugares», «Es una escala».
2. **Sólo pregunta si no coinciden**: misma ciudad o mismo país no pregunta.
3. **Los viajes que ya tienen el vuelo cargado también la reciben**, arriba de la valija.
4. **VAL-92:** Enter elige la opción marcada; salir del campo con **una sola** opción la toma.

---

## Lo que entra

### 1 · ¿Coinciden? Una sola función

`coincidenLugares(a, b)` → `true`, `false` o `null` (no se sabe). Usa el dato de VAL-87.

| a | b | Resultado |
|---|---|---|
| igual normalizado | | `true` |
| código | código | misma ciudad → `true` (EZE y AEP); si no, `false` |
| código | texto | el texto es la ciudad o el país del código → `true`; es otra ciudad u otro país del dato → `false`; el dato no lo reconoce («Patagonia», «Europa») → `null` |
| texto | texto | una ciudad dentro del país del otro → `true`; si no, `false` (la regla de VAL-75: Noruega → Argentina es un cambio) |

El motor de la valija **no conoce el dato de aeropuertos**: la app le pasa la función
(`PackingEngine.setComparadorDeLugares`). Sin ella el motor se comporta como hoy: código contra texto no se
compara. Así `app/parts/packing-engine.js` sigue probándose solo en Node.

### 2 · Qué ítem de destino quedó viejo (`destinoVencido`)

Un ítem de la capa de destino queda **vencido** sólo si **ninguno** de los lugares para los que se lo razonó
puede ser alguno de los lugares de ahora. «Puede ser» es `true` o `null`: ante la duda, se queda.

Los lugares de ahora son los destinos que salen de las reservas **más el destino escrito del viaje**. Eso es
lo que hace que, mientras nadie conteste, la valija siga sugiriendo para los dos (lo que dice el aviso).

Casos que definen el éxito, y cada uno con prueba:

| Viaje escrito | Vuelos | Ítem razonado para | Resultado |
|---|---|---|---|
| Bariloche | AEP→MAD, sin contestar | Bariloche | **se queda** (los dos) |
| Bariloche → contestó «ahora es a Madrid» (el escrito pasa a Madrid) | AEP→MAD | Bariloche | **vencido** |
| Bariloche | AEP→MAD marcado «escala» | MAD | **vencido** |
| Noruega | EZE→OSL | Noruega | se queda (mismo país) — el caso que VAL-75 protegía |
| Noruega | se borra el vuelo a OSL | OSL | se queda (Oslo es Noruega) |
| Noruega → Argentina (sin vuelos) | | Noruega | vencido — VAL-75 sin cambios |
| Bariloche | AEP→MAD «voy a los dos» | MAD y Bariloche | se quedan los dos |

### 3 · Lo que cada respuesta guarda

Se guarda en el **vuelo**: `destinoDecision` = `"cambia"`, `"suma"` o `"escala"`.

- **«El viaje ahora es a Madrid»** → además, el destino escrito del viaje pasa a ser la ciudad del vuelo
  («Madrid»). Con eso la regla del punto 2 vence lo de Bariloche.
- **«Voy a los dos lugares»** → `destinosDelViaje` suma el destino escrito como destino firme, junto a los de
  los vuelos. El modelo recibe los dos.
- **«Es una escala»** → `destinosDelViaje` no cuenta el `to` de ese vuelo como destino.

**«Cambiar»** borra la respuesta y vuelve a mostrar la pregunta. Si la respuesta fue «cambia», el destino
escrito **no** vuelve solo al anterior: se edita desde el viaje, como siempre. Se dice en la línea.

### 4 · Cuándo aparece la pregunta

Para un vuelo, cuando se cumplen todas:
- el viaje tiene destino escrito;
- el `to` del vuelo es un código del dato;
- el vuelo no tiene respuesta;
- `coincidenLugares(destino escrito, to)` **no** es `true`;
- el `to` no es casa: no coincide con el `from` del primer vuelo por fecha (la vuelta no se pregunta).

### 5 · Dónde aparece (las tres pantallas del diseño)

1. **Formulario manual**, debajo de Destino, apenas el campo tiene un código (elegido o resuelto). La
   respuesta se aplica **al guardar**. Si se guarda sin contestar, el vuelo queda sin respuesta y la pregunta
   pasa a la valija.
2. **Revisión de lo importado**, en la tarjeta de cada vuelo. Igual: se aplica al guardar.
3. **Valija**, arriba de todo, para el primer vuelo que necesite respuesta. Acá se aplica **al tocar**: se
   guarda el vuelo (y el viaje, si «cambia») y se recalcula el plan con el mecanismo de siempre
   (`checkPackingPlan`). Sin permiso de edición, la pregunta no se muestra.

Textos (del diseño aprobado):
- Formulario e importar: *«Tu viaje dice **Bariloche** y este vuelo va a **Madrid**. ¿Qué pasó?»* + *«Si no
  contestás ahora, te lo pregunto en la valija.»*
- Valija: *«Tenés un vuelo a **Madrid** y el viaje dice **Bariloche**. Mientras no me digas, sugiero para los
  dos lugares. ¿Qué pasó?»*
- Después de contestar, la línea verde con «Cambiar»:
  - *«Listo: el viaje pasa a ser a **Madrid**. La valija saca lo que era para Bariloche y no empacaste.»*
  - *«Listo: el viaje es a **Bariloche y Madrid**. La valija sugiere para los dos.»*
  - *«Listo: este vuelo es una **escala**. No cuenta para la valija.»*

**Lo que la línea afirma tiene que ser verdad.** «Saca lo que no empacaste» depende del plan de la valija,
que se propone y se aplica como siempre: lo empacado no se toca (VAL-75). Si la valija no tiene lista armada,
no hay nada que sacar y la línea no lo promete.

### 6 · VAL-92 en el campo de aeropuerto

- **Enter** con la lista abierta elige la opción marcada (la primera).
- **Flechas** arriba y abajo mueven la marca.
- **Salir del campo** con **una sola** opción en la lista la toma. Con varias, queda lo escrito, como hoy.
- **Excepción, encontrada al construir:** tres letras. «toj» trae una sola opción —Tojo Una-Una, Indonesia— y
  la tabla de VAL-87 dice que tres letras que el dato no tiene se guardan como código. Ni salir ni Enter eligen
  una opción cuyo código no sea lo escrito: queda TOJ. Si no, el código de Torrejón terminaba en Indonesia.
- **No se puede verificar desde acá** qué manda la tecla «→|» de Gboard (Enter o pasar de campo). Con
  cualquiera de las dos se elige: Enter por la regla de Enter, y pasar de campo por la de una sola opción
  (con varias, queda lo escrito). Se pregunta en el guion.

---

## Lo que NO entra

- Que el chip diga «por Madrid» en vez de «por MAD» (VAL-87 dejó el motor de la valija en códigos).
- Multidestino con más de dos lugares escritos; mapas; fechas por destino.
- Cambiar el destino escrito al deshacer «cambia».
- La hoja «Ver qué saco» y los textos de VAL-88.

## Criterios de aceptación (cada uno con prueba por gesto)

1. Formulario: viaje «Bariloche», elegir Madrid en Destino → aparece la pregunta. Con Bariloche (BRC) o un
   viaje «Argentina» con BRC → no aparece.
2. Lo mismo en la revisión de lo importado.
3. Cada una de las tres respuestas guardada en el vuelo, y «cambia» actualiza el destino del viaje.
4. Valija de un viaje que ya tiene el vuelo sin respuesta → la pregunta arriba. Tocar «El viaje ahora es a
   Madrid» → el plan propone sacar el ítem «por Bariloche» no empacado; un ítem empacado no se propone.
5. «Voy a los dos» → nada de Bariloche ni de MAD se propone sacar.
6. «Es una escala» → se propone sacar lo «por MAD».
7. La tabla del punto 2, en Node, entera.
8. La vuelta (MAD→AEP) no pregunta.
9. VAL-92: Enter elige; flechas mueven; salir con una sola opción la toma; con varias no.
10. Regresiones en verde: VAL-75, VAL-72, VAL-80, VAL-87, VAL-85, VAL-77b, `las-dos-copias`.
11. Claro y oscuro, 390 px, foco visible, 44 px de área táctil en las tres respuestas.

**Candidato con 70, terminado con 85 y el teléfono.** Sale como v40.
