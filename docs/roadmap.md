# Valija — Roadmap

Cuatro iteraciones. Cada una tiene un objetivo único y se puede cortar después de cualquiera de ellas con un
producto que se sostiene solo.

---

## Iteración 1 — Consolidar (entregada)

**Objetivo:** que toda la información de un viaje esté en un solo lugar y se sepa qué falta.

Entregado: viajes en paralelo, carga manual por tipo, lectura automática de confirmaciones por texto e
imagen, itinerario por día, motor de pendientes con seis reglas, compartir para ver o editar, resumen en PDF.

**Pregunta que responde:** ¿la gente carga sus viajes acá?

---

## Iteración 2 — Avisar

**Objetivo:** que el producto te busque en lugar de esperar a que lo abras. Es la iteración de retención.

Necesita infraestructura propia. La app deja de ser autónoma y pasa a tener servidor.

**Alcance:**

- **Correos de aviso.** Un proceso diario evalúa las reglas de pendientes de cada viaje y manda un correo solo
  cuando hay algo nuevo que decir. Nunca un correo vacío.
- **Cadencia por cercanía.** A 30 días, un resumen semanal de lo que falta. A 7 días, un repaso de documentación
  y traslados. A 48 horas, el aviso de check-in online. El día anterior, la hoja de ruta completa.
- **Buzón de reenvío.** Cada usuario recibe una dirección propia del estilo `tomas.a3f9@valija.app`. Reenvía el
  mail de confirmación de Booking sin abrir la app y la reserva aparece cargada. Es la integración más barata
  que existe: no depende del permiso de ninguna plataforma y funciona con todas.
- **Cuentas propias.** Habilita el permiso por viaje en lugar de por valija, que es la limitación principal del
  MVP.
- **Sincronización con el calendario.** Exportar el viaje como calendario suscribible, para que los hitos
  aparezcan en el teléfono sin abrir nada.

**Stack propuesto:** Next.js sobre Vercel, Postgres con Supabase para datos y autenticación, Resend para los
correos, un cron diario para el evaluador de reglas, e Inbound Parse para el buzón. Todo elegido por velocidad
de puesta en marcha, no por escala.

**Pregunta que responde:** ¿vuelven sin que se lo pidamos?

---

## Iteración 3 — Interpretar todo

**Objetivo:** que subir cualquier documento de viaje sea suficiente. El usuario deja de tipear.

**Alcance:**

- **Cualquier archivo entra.** PDF del voucher, captura de pantalla, foto del contrato de alquiler, el
  itinerario en papel. Se interpreta y se archiva junto a la reserva.
- **Documento original guardado.** Que la tarjeta de embarque siga estando ahí para mostrarla en el mostrador,
  no solo sus datos extraídos.
- **Mapas.** Ubicaciones de alojamientos y actividades en un mapa del viaje, con el traslado entre puntos.
- **Detección de conflictos.** Un check-out a las 10 y un vuelo a las 11 desde un aeropuerto a una hora de
  distancia es un problema, y el producto debería decirlo.
- **Primeras integraciones directas.** Las aerolíneas que tengan API abierta para estado de vuelo, empezando
  por retrasos y cambios de puerta.

**Pregunta que responde:** ¿podemos eliminar la carga manual por completo?

---

## Iteración 4 — Acompañar

**Objetivo:** pasar de organizador a compañero de viaje.

**Alcance:**

- Estado de vuelo en vivo con avisos de retraso y cambio de puerta.
- Modo sin conexión, porque el momento de mayor necesidad suele ser el de peor señal.
- Gastos compartidos entre los participantes del viaje.
- Sugerencias a partir de los huecos del itinerario.

**Pregunta que responde:** ¿es la app que se abre durante el viaje y no solo antes?

---

## Lo que decide seguir o parar

Al cierre de cada iteración se mira una sola cosa antes de arrancar la siguiente:

| Después de | Seguimos si |
|---|---|
| Iteración 1 | Hay viajes con más de tres reservas cargadas |
| Iteración 2 | Los correos se abren y traen gente de vuelta a la app |
| Iteración 3 | La carga manual baja frente a la automática |
