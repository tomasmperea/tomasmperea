# ¿La IA de Valija sólo sirve con una cuenta de Claude?

**Pregunta del PM (11/10):** *"necesito entender si las funciones de IA solo van a servir si el tester tiene una
cuenta de Claude, la idea es que la app le funcione a cualquier usuario independiente de cualquier uso de
agentes o cuentas pagas"*.

**Estado:** análisis del PO para decidir. Nada de esto está construido.

## La respuesta corta

**Hoy, sí: la IA sólo funciona con una cuenta de Claude, y la paga quien la usa.** No es algo que se pueda
cambiar desde el código de la app: es cómo funciona el lugar donde vive. Valija es un **Artifact de Claude**, y
el contrato de la plataforma (`sample.d.ts`, la pieza con la que la app le pregunta al modelo) dice:

- cada pedido al modelo **gasta el uso de Claude de quien está mirando la página**, y la primera vez le pide
  permiso;
- fuera del visor de Claude la página **no tiene IA**: «cualquier otra copia de la página no tiene
  `window.claude`»;
- si la cuenta o la organización no tiene Claude disponible, el pedido se rechaza (`sampling_disabled`).

Lo que **no** dice el contrato, y no está comprobado: si una cuenta **gratuita** de Claude alcanza, y si alguien
**sin cuenta** puede siquiera abrir el link. La primera persona de la beta lo contesta.

## Qué funciona sin IA — con la IA apagada, el 11/10

| Función | Sin IA |
|---|---|
| Viajes, reservas a mano, pendientes | Funcionan enteros (es como corren casi todas las pruebas de la app) |
| Resumen en PDF | No usa IA; usa una librería externa que este entorno bloquea, así que acá no se pudo probar |
| Armar la valija | **Funciona** (medido): 28 ítems con las reglas propias de la app. Avisa: *«No pude ajustarla a Madrid, así que puede faltarte algo del lugar»* |
| Que la valija se actualice al cargar un vuelo | Por lo que dice el código, sigue con reglas y sin el ajuste por destino. **No medido hoy** |
| **Importar** (pegar un mail, subir un PDF o una foto) | **No funciona** (medido): *«La lectura automática no está disponible en esta vista. Cargá la reserva a mano desde Agregar»* |
| Importar, si el tester **tiene** cuenta pero **rechaza** el permiso | Tampoco funciona: deja pegar el texto y recién al interpretarlo dice *«La lectura automática no está habilitada en esta vista»* (medido por la auditoría con un simulador, no con la plataforma real) |

O sea: **sin cuenta, Valija pierde la función que más la diferencia** —leer las confirmaciones— y la valija
queda genérica. El resto anda.

## Si querés que funcione para cualquiera

Hay que sacar a Valija de adentro de Claude. Es un cambio de producto, no un arreglo:

| | Hoy (Artifact de Claude) | Valija independiente |
|---|---|---|
| Dónde vive | Un link de claude.ai | Una página web propia (un dominio, un hosting) |
| Quién puede usarla | Quien pueda abrir el link de Claude | Cualquiera con un navegador |
| IA | Con la cuenta del usuario, la paga él | Con **nuestra** cuenta de la API de Anthropic, **la pagamos nosotros** por uso |
| Qué hace falta construir | Nada | Un servidor chico que guarde la clave de la API (nunca puede ir en la página) y haga los pedidos al modelo; límites de uso por persona para que nadie lo vacíe; política de privacidad, porque los mails de las reservas pasan por nuestro servidor |
| Datos | Base compartida o el teléfono | El teléfono (como la beta) o una base propia con cuentas de usuario |

La app es un solo archivo, y todo lo que usa de Claude pasa por `claude.use()`, que ya maneja la ausencia. Pero
lo usa en **seis** lugares, no en uno: la IA (tres), la base de datos, las descargas y «Contanos». Mudarla es
reemplazar esas piezas —el servidor de IA, el guardado, la descarga del PDF y la forma de juntar comentarios—
además del hosting y, si se quieren datos en la nube, cuentas. No es «copiar el archivo a otro lado».

**Lo que no sé y no voy a inventar:** cuánto costaría por usuario. Depende de cuántas reservas importa cada
persona y de qué modelo se use, y se calcula con los precios vigentes, no de memoria. El analista lo puede
dimensionar con supuestos explícitos.

## Mi recomendación

**No decidir esto todavía, y usar la beta para que el dato decida.** Dos preguntas que la beta contesta y que
cambian la respuesta:

1. **¿Los testers tienen cuenta de Claude, y les anda la IA?** Si la mayoría no tiene, la beta en Claude mide un
   producto que no es el que querés lanzar.
2. **¿Qué valoran de verdad?** Si lo que los retiene es tener todo el viaje junto y la valija, Valija sin IA ya
   es un producto. Si lo que piden es «que lea mis mails», la IA es el corazón y hay que pagarla.

Para eso, en la beta conviene **pedirle a cada tester que pruebe Importar** y que nos diga si le anduvo: es la
función que separa los dos mundos.

Si ya sabés que el destino es un producto para cualquiera, la historia **VAL-102** (en `docs/backlog.md`)
arranca por el dimensionamiento de costos con el analista, antes de construir nada.
