# v36 — el guion del PM

**Qué probar:** VAL-80, el campo del vuelo que se comía letras y rompía la cadena entera.

**Dónde:** el Artifact publicado, **abierto desde el teléfono**. Arriba a la izquierda tiene que decir **v36**.
Si dice v35, el link quedó fijado a una versión vieja: avisá y lo resolvemos antes de gastar la ronda.

**Auditoría:** 84/100, candidato, sin bloqueantes. Lo único que la separaba de terminada es esto.

---

## 1 · Escribí el nombre entero y mirá que no te coma nada

Abrí un viaje con **Noruega** escrito en destino principal. Agregar → Vuelo → en **Destino (IATA)** escribí
`SUECIA`.

- ¿Quedan **las seis letras** en el campo? (antes guardaba `SUEC` sin decir nada)
- ¿Aparece abajo un cartel ámbar apenas terminás de escribir?

## 2 · Guardá

- Tiene que **guardar**, no bloquear.
- Y decirte qué va a hacer con eso: que `SUECIA` no es un código de tres letras, que va como pista, y que con
  eso no puede fijar el destino del viaje.

**Lo que el cartel NO dice, a propósito:** que el destino escrito "siga mandando". Sería falso en cuanto
cargues otro vuelo del mismo viaje con un código de verdad.

## 3 · Armá la valija — esto es lo que sólo contesta el aparato

Andá a la valija y armá la lista.

- **¿El motivo habla de Noruega?** Tiene que hablar de lo que escribiste, no de `SUECIA` ni de un código raro.

Acá está el corazón de la historia y lo que ninguna prueba de acá puede contestar: comprobamos que al modelo
**dejó de llegarle** que `SUEC` manda. Que razone mejor con el texto nuevo es una hipótesis que no
comprobamos, y la contesta tu pantalla.

## 4 · El contraste, que es lo que cierra tu reporte original

Borrá ese vuelo, cargá otro con `ARN` (Estocolmo, el código de verdad) y **rehacé la lista**.

- Ahora el motivo tiene que hablar de **Suecia**, no de Noruega.

Ése es el par que buscabas: con un código el vuelo manda; sin código, el destino escrito vuelve a mandar y el
lugar viaja igual como pista.

## 5 · El cartel en oscuro

Repetí el paso 1 con el tema oscuro puesto **desde el botón de la cabecera** (el explícito, no el del
sistema), sólo para mirar que el cartel se lea.

---

## Lo que NO se probó, y por qué se dice

- **Nada corrió en un teléfono.** Todo fue Chromium de escritorio con el archivo local. Los arneses tocan los
  controles de verdad —escriben en el campo y tocan Guardar— pero eso no prueba el visor del teléfono.
- **El modelo es falso en los arneses.** Lo que está comprobado es **qué texto recibe**, no qué hace con él.
  El paso 3 es exactamente eso.
- **Los dos temas se miraron en captura**, no en un aparato. Por eso el paso 5.
- **Una cosa va a seguir mostrando tres letras**, y no es este defecto: la banda vertical de la tarjeta del
  viaje abrevia cualquier destino a tres caracteres, así que vas a ver `EZE → SUE`. Abrevia igual `Noruega`
  → `NOR`, o sea que no supone que sea un código: es el ancho de la banda. Está anotado como **VAL-81**, y lo
  digo antes para que no te suene a "todavía me come letras".

**Con tu respuesta VAL-80 pasa de candidato a terminada.** Publicar no cierra nada.
