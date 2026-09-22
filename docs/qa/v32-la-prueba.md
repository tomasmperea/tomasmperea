# v32 — la prueba, paso a paso

**Link:** https://claude.ai/artifact/3Q4KLi6g3ygTAJdR79aTCf

Son **dos pruebas** de tres minutos cada una. La primera es tu caso de Europa. La segunda comprueba que
arreglando eso no rompimos lo de siempre.

Si algo sale mal: **sacá captura y mandámela.**

---

## Antes de empezar

Abrí el link. Arriba, al lado de **Valija**, tiene que decir **v32**.

**Si no dice v32:** pará y avisame. Significa que el link te quedó fijado a una versión vieja y todo lo que
pruebes no dice nada.

---

## Prueba 1 — el viaje multidestino, que es lo que reportaste

1. Creá un viaje: nombre **Europa**, destino **Europa**, salida **01/04/2027**, regreso **17/04/2027**.
2. Cargá tres vuelos. **Poné la hora de llegada en los tres**, que es donde vivía uno de los bugs:

   | Vuelo | Origen | Destino | Sale | Llega |
   |---|---|---|---|---|
   | 1 | EZE | MAD | 01/04 08:00 | 01/04 23:30 |
   | 2 | MAD | CDG | 06/04 09:00 | 06/04 11:00 |
   | 3 | CDG | FCO | 11/04 14:00 | 11/04 16:00 |

3. Entrá al viaje y tocá **armar la valija**.
4. Esperá a que aparezca la lista y **leé los motivos de los ítems**.

**Anda si:** los motivos hablan de **Madrid, París o Roma** — o de España, Francia, Italia. Cosas de esas
ciudades en abril.

**Falla si:** los motivos siguen hablando de **"Europa"** en general, o si aparece ropa que no tiene nada
que ver con ninguna de las tres.

**Mandame una captura de la lista**, ande o no ande. Es lo único que dice si el arreglo sirvió de verdad.

---

## Prueba 2 — el control: que no se rompió lo de siempre

Esta es la que comprueba que, al hacer que los vuelos manden, no le pisamos el destino a un viaje normal.

1. Creá otro viaje: nombre **Bariloche**, destino **Bariloche**, salida **01/07/2027**, regreso
   **10/07/2027**.
2. Cargá **un solo traslado**: desde **Av. Santa Fe 1234**, hasta **Aeropuerto de Ezeiza**,
   el **01/07 05:00**. Nada más. Sin vuelos.
3. Armá la valija.

**Anda si:** la lista es para **Bariloche en julio** — frío, nieve, montaña.

**Falla si:** la lista habla de **Buenos Aires** o de Ezeiza. Eso sería la app tomando el viaje al
aeropuerto como si fuera tu destino.

---

## Qué me mandás

| Si pasó esto | Mandame |
|---|---|
| Las dos anduvieron | **"anduvieron"** + la captura de la lista de Europa |
| La 1 habla de "Europa" en general | captura de la lista |
| La 2 habla de Buenos Aires | captura de la lista |
| Arriba no dice v32 | avisame antes de seguir |

---

## Dónde se probó esto, y dónde no

**Se probó acá:** el motor corriendo sobre el HTML publicado, con los dos casos de arriba y con unos cuantos
más que salieron de dieciséis rondas de auditoría — vuelo de vuelta, tramo por tierra, escala corta, reservas
a medias, una nota sola. Más el arnés de navegador que toca los botones de verdad.

**No se probó:** en tu teléfono. Es lo único que este proyecto llama "verificado", y es exactamente lo que
te estoy pidiendo. Lo que ningún arnés de acá puede contestar es **si la sugerencia es buena** — sólo si el
motor recibe el destino correcto.

---

## Lo que esta entrega NO arregla

**Que la lista vieja se actualice sola cuando cambiás el destino.** Si ya tenías una valija armada para
Noruega y cambiás el viaje a Argentina, los ítems de Noruega siguen ahí. Eso es **VAL-75**, y va junto con
sacar "Cambiar el tipo" de donde está escondido (**VAL-76**) y con que "mixto" sea una combinación que
elijas (**VAL-77**). Las tres salen juntas, como pediste.

**Que el motor sepa que MAD es Madrid.** Hoy el código de aeropuerto le llega al modelo como código. Para
el destino alcanza; para el clasificador local de tipo de viaje no, y cuando pasa la pantalla te lo dice.
Eso es **VAL-66**.
