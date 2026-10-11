# Beta con una persona — el kit

**Decisión del PM (10/10):** testers externos, unas 5 personas, empezando por **una** para ver cómo se extiende.

**Qué se eligió y por qué.** Los testers no usan la app del PM: usan una **copia aparte**, «Valija beta»,
publicada **sin base compartida**. Cada tester guarda sus viajes en su propio teléfono, así que nadie ve los de
nadie y la app del PM y sus datos no se tocan. No hubo que construir VAL-98 (datos privados en la nube) para
empezar: la app ya funcionaba entera sin base, y es el camino que más cubren las pruebas.

| | App del PM | Valija beta |
|---|---|---|
| Dónde se guardan los viajes | Base compartida del Artifact | En el teléfono de cada tester |
| Quién ve qué | Quien abre el link ve todo | Cada uno, lo suyo |
| Inteligencia artificial | Sí | Sí, con la cuenta del tester |
| «Contanos» | No aparece | Abre el comentario de claude.ai |
| Mismo código | — | Sí: el mismo `app/valija.html`. Cambian el título de la pestaña («Valija beta») y lo que se le pide a la plataforma al publicar: IA, descargas y comentarios, **sin base de datos** |

## Lo que cambió en la app para esto (v44)

- **«Contanos»** (VAL-99): un botón en la pantalla de inicio (sólo ahí, no adentro de un viaje) que abre el
  comentario de claude.ai sobre esa pantalla. La app no escribe nada: lo escribe el tester en la caja de comentarios de Claude. Si la vista no
  admite comentarios, el botón lo dice y se va.
- **«Tus viajes se guardan en este teléfono»** (VAL-101): un aviso una sola vez, sólo sin base compartida. En la
  app del PM no aparece nunca.
- **Sin promesas de funciones futuras** (v45, decisión del PM del 11/10): «Acerca de» ya no muestra «Próxima
  iteración» ni el panel de pendientes anuncia avisos por correo. Se sacó **de las dos copias**, la tuya
  también: es un solo archivo.
- **«Compartir el viaje»** sin base ya no ofrece un link que no lleva el viaje: ofrece el resumen para pegar en
  un chat. «Acerca de» y el panel de pendientes dejan de decir que los datos viajan con el link.

## Lo que todavía no se sabe, y la primera persona contesta

1. **¿Puede abrir el link alguien de afuera de tu cuenta?** La beta no declara base de datos, que era lo que
   el contrato marcaba como «interno de la organización», así que debería poder. No está comprobado.
2. **¿Le anda la inteligencia artificial?** Usa la cuenta de Claude del tester: la primera vez le pide permiso.
   Sin IA, Importar no funciona (pide cargar a mano) y la valija se arma con reglas, sin el ajuste por destino
   (medido el 11/10). Si alcanza con una cuenta gratuita no está comprobado. Es la pregunta que más pesa: ver
   `docs/decisiones/ia-para-cualquiera.md`.
3. **¿Sus viajes siguen ahí al día siguiente?** El visor de claude.ai guarda los datos del navegador por
   página; si los borrara entre visitas, la beta no sirve así y hay que adelantar VAL-98.
4. **¿Le aparece «Contanos»?** Depende de que la plataforma le permita comentar a alguien de afuera.
5. **¿Me llegan sus comentarios?** Comprobado a medias el 11/10 con el comentario «prueba» del PM: «Contanos»
   abrió el comentario desde su teléfono, anclado a la pantalla de inicio, y yo lo pude leer y contestar. Pero
   ese me **avisó** porque el PM, como dueño, lo mandó a Claude; un tester no puede hacer eso. Lo que dice la
   herramienta: los comentarios comunes **no me avisan solos, pero los puedo leer cuando me lo pidas**. O sea:
   decime «leé los comentarios de la beta» y los resumo. Falta ver uno escrito por alguien de afuera.

## Dónde está

**Link de «Valija beta»:** https://claude.ai/artifact/MqXA3sUNzcfqSRy8wQ6iXh — publicada el 10/10 como v44
(versión 2 del Artifact), fijada al mismo contrato de la plataforma que la app del PM (0.2.41). **Hoy es
privada:** sólo la abrís vos hasta que la compartas.

Cómo se publica cada versión nueva (lo hace el PO): copiar `app/valija.html` cambiando sólo el `<title>` a
«Valija beta», publicarla sobre ese link con `sample`, `downloads` y `comments` en forma `composer_only`, **sin
`db`**, y hacer los cuatro `grep` sobre lo servido, igual que con la app del PM.

## Cómo la compartís

La copia la publico yo, con lo que le toca pedirle a la plataforma; vos sólo la compartís.

1. Abrí el link de «Valija beta» que te paso (es otro distinto del tuyo).
2. Tocá **Compartir** de Claude, arriba a la derecha, y elegí que la pueda ver **cualquiera con el link**.
3. Copiá ese link y mandáselo con el mensaje de abajo.

## Mensaje para mandarle (copiá y pegá)

> ¡Hola! Te paso **Valija**, una app que estoy armando para tener todo un viaje en un solo lugar: vuelos,
> alojamientos, autos y la valija para armar. Me ayudaría mucho que la pruebes unos 15 minutos desde el
> teléfono.
>
> [link]
>
> 1. Creá un viaje: uno que tengas pronto, o uno inventado.
> 2. Cargá una reserva. Si tenés el mail de confirmación de algo, probá **Importar** y pegá el texto.
>    Contame si te anduvo: es la parte que necesita tu cuenta de Claude.
> 3. Entrá a **Valija** y armá la lista de equipaje.
> 4. Volvé a abrirla mañana y fijate si tu viaje sigue ahí.
>
> Para contarme qué te pareció, volvé a la pantalla de inicio y tocá el globito de arriba (**Contanos**), y
> escribí ahí. Si no te aparece, mandame capturas por acá.
>
> Algunas cosas para que sepas:
> - Tus viajes se guardan **sólo en tu teléfono**: no los veo yo ni nadie. Si borrás los datos del navegador
>   se pierden, así que no cargues nada que no quieras perder.
> - Para leer mails y armar la valija usa la inteligencia artificial de Claude con tu cuenta: la primera vez
>   te pide permiso.
> - Lo que escribas en los comentarios lo pueden ver los demás que prueben la app.
>
> ¡Gracias!

## Qué te pido de vuelta

- Una **captura de la pantalla de inicio** apenas la abra: la etiqueta de arriba tiene que decir **«en este
  dispositivo»** y la versión, **v44**.
- Si pudo comentar con «Contanos» o te mandó capturas.
- Si al día siguiente sus viajes seguían ahí.

Si los comentarios me llegan desde acá (pregunta 5), los resumo en `docs/beta/feedback.md`; si no, pasámelos.

## Para pasar de una persona a cinco

Se extiende **sin cambiar nada** si las cinco preguntas de arriba dan bien: el mismo link, y cada uno guarda lo
suyo. Lo que cambia con cinco:

- **Los comentarios se ven entre ellos** (lo dice el contrato de la plataforma). Si eso molesta, «Contanos» pasa a guardar el comentario en privado,
  y para eso sí hace falta base de datos (vuelve VAL-98, en otra forma).
- **Cada publicación sale a las dos copias.** Desde la v44, publicar es: la app del PM y «Valija beta», con la
  misma versión, y los cuatro `grep` sobre las dos.

Si alguna de las cinco preguntas da mal:

| Si… | Entonces |
|---|---|
| No puede abrir el link | La plataforma no deja compartir afuera de la cuenta: hay que hablarlo antes de seguir |
| No le anda la IA | La beta igual sirve para cargar y mirar; se avisa en el mensaje |
| Los viajes no siguen al otro día | Se adelanta VAL-98: datos en la nube, privados por persona |
| No le aparece «Contanos» | Feedback por capturas; se evalúa un formulario propio |
