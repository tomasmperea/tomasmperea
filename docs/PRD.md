# Valija — PRD del MVP

**Estado:** MVP publicado y funcionando
**Fecha:** septiembre 2026
**Rol que escribe:** Product Owner
**App en vivo:** https://claude.ai/code/artifact/136a6d7e-9952-4edb-b6d3-11f6e69c8cb4

---

## 1. El problema

La información de un viaje vive repartida entre las plataformas donde se compró cada cosa. El alojamiento
queda en Booking, el auto en Hertz, los aéreos en JetSmart o Iberia, las entradas en un mail suelto. En el
momento en que se necesita el dato (el mostrador del aeropuerto, el check-in del hotel, la ventanilla de la
rentadora) hay que buscar entre apps y correos.

Dos consecuencias concretas:

1. **Fricción de acceso.** El dato existe pero no está a mano.
2. **Huecos invisibles.** Nadie tiene la vista completa, así que las faltas aparecen tarde: noches sin
   alojamiento, un tramo de vuelta sin comprar, un check-in online que se pasó.

El problema no es la falta de información. Es la falta de un lugar donde converja.

## 2. Usuario y momento de uso

**Usuario primario:** persona que planifica sus propios viajes y compra en varias plataformas, con más de un
viaje abierto a la vez (uno cercano y otro en etapa de ideas).

**Usuario secundario:** acompañante de viaje que necesita ver o cargar información sin ser el dueño del plan.

Tres momentos de uso distintos, con necesidades distintas:

| Momento | Necesidad | Respuesta del producto |
|---|---|---|
| Planificando (semanas antes) | Ver qué falta | Panel de pendientes y anillo de completitud |
| Cerrando (días antes) | Tener todo junto y compartible | Resumen en PDF y compartir el viaje |
| Viajando (en el lugar) | Encontrar un dato en segundos | Itinerario por día en el teléfono |

## 3. Qué entrega el MVP

Alcance cerrado y funcionando hoy:

- **Viajes en paralelo.** Cada viaje es un proyecto propio con sus fechas, destino y participantes.
- **Carga manual por tipo de reserva.** Vuelo, alojamiento, auto, traslado, actividad y nota. Cada tipo pide
  los campos que le corresponden: un vuelo pide origen, destino, número y asiento; un alojamiento pide
  check-in, check-out y dirección.
- **Lectura automática de confirmaciones.** Se pega el texto del mail de confirmación, o se sube una foto de
  la tarjeta de embarque o el voucher, y los campos se completan solos. El usuario revisa antes de guardar.
- **Itinerario por día.** Las reservas se agrupan cronológicamente y se numeran los días del viaje.
- **Motor de pendientes.** Detecta datos faltantes por reserva y además revisa el viaje como un todo.
- **Compartir para ver o editar.** Permiso de lectura y de escritura diferenciados.
- **Resumen en PDF.** Una hoja de ruta descargable con los pendientes arriba y el itinerario completo abajo.

### El motor de pendientes

Es la pieza que convierte un contenedor de datos en algo que trabaja para el usuario. Seis reglas activas:

1. **Campos obligatorios faltantes** por reserva, según su tipo.
2. **Viaje sin fechas**, que impide calcular todo lo demás.
3. **Noches sin alojamiento.** Cruza el rango del viaje contra las noches cubiertas por reservas y nombra las
   fechas descubiertas. Es la regla de mayor valor y ninguna plataforma individual puede darla, porque
   requiere ver el viaje completo.
4. **Vuelta faltante.** Un solo tramo cargado en un viaje con fecha de regreso.
5. **Check-in online abierto.** Se activa 48 horas antes de un vuelo sin asiento asignado.
6. **Proximidad del viaje.** Aviso a partir de los 14 días.

## 4. Qué queda deliberadamente afuera

Decisiones tomadas para que el MVP saliera rápido, con la razón de cada una:

| Fuera del MVP | Por qué | Cuándo |
|---|---|---|
| Avisos por correo | Necesita un servidor que corra sin la app abierta | Iteración 2 |
| Integraciones con las plataformas de servicios de viaje | Requieren acuerdos comerciales o scraping frágil | Iteración 3 |
| Cuentas de usuario propias | El MVP se apoya en la identidad de la plataforma | Iteración 2 |
| Mapas embebidos | No resuelve el problema central | Iteración 3 |
| Gastos y división de cuentas | Es otro producto | Sin fecha |

## 5. Limitaciones conocidas

Se documentan porque afectan decisiones de la próxima iteración, no porque bloqueen el uso.

**El compartir es por valija, no por viaje.** Quien recibe acceso ve todos los viajes que haya en esa valija,
no solo el que se le compartió. El link con el viaje específico lo lleva directo a ese viaje, pero puede
navegar al resto. Para uso personal y con acompañantes de confianza alcanza. Un permiso real por viaje
necesita cuentas propias, y eso llega en la iteración 2.

**Los avisos viven dentro de la app.** El panel de pendientes es correcto y se actualiza solo, pero requiere
abrir la app. El aviso que llega sin que lo pidas es justamente lo que falta.

**La lectura automática puede equivocarse.** Por eso el flujo obliga a revisar antes de guardar, y el prompt
tiene instrucción explícita de dejar un campo vacío antes que inventar un código o un horario.

## 6. Métricas

Qué mirar para saber si el producto sirve, en orden de importancia:

1. **Viajes con más de tres reservas cargadas.** Es la señal de que el usuario está consolidando de verdad y
   no solo probando.
2. **Porcentaje de completitud promedio al inicio del viaje.** Mide si el motor de pendientes efectivamente
   empuja a completar.
3. **Reservas cargadas por importación contra carga manual.** Si la importación gana, la fricción bajó.
4. **Viajes compartidos sobre viajes creados.** Valida la hipótesis de que viajar es colaborativo.
5. **PDF exportados por viaje.** Valida la necesidad del resumen offline.

## 7. Riesgos

**El de producto:** que cargar a mano sea demasiado trabajo para el valor que devuelve. Se mitiga con la
importación automática, que ya está en el MVP y es lo primero a instrumentar y medir.

**El técnico:** que las integraciones de la iteración 3 no se puedan construir. Booking y las aerolíneas no
tienen APIs abiertas para consumidores finales. Por eso la iteración 2 propone el buzón de reenvío de mails,
que da el 80% del beneficio sin depender de terceros.

**El de adopción:** que se use una vez y se abandone. La contramedida es el aviso por correo, que trae al
usuario de vuelta sin que él tenga que acordarse.
