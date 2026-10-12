# ¿Cuánto cuesta sacar a Valija de Claude?

**Pregunta del PM (12/10):** *"por ahora lo que tenemos es el costo del uso de los modelos de IA de Claude; pero
cual es el costo de sacar la app de Claude?"*

**Estado:** análisis del PO para decidir (VAL-102). Nada construido. Complementa
`docs/decisiones/costo-ia-por-usuario.md` (el costo de la IA) y `docs/decisiones/ia-para-cualquiera.md`.

## La respuesta corta

Hay tres costos distintos, y **el de plata es el más chico**:

| Costo | Cuánto | Qué lo mueve |
|---|---|---|
| **Plata por mes** (servidores, dominio) | **De USD 1 a 3 por mes** si los datos siguen en el teléfono; **USD 25 a 30 por mes** si se guardan en la nube con cuentas | Si hay o no cuentas de usuario |
| **La IA** (lo del documento anterior) | ~USD 0,60 por usuario típico por año con el modelo medio (estimado) | Cantidad de usuarios y modelo |
| **Construirlo** | 5 a 8 entregas como las de estas semanas, según el escenario | Si hay o no cuentas de usuario |
| **Lo que deja de hacer Claude por nosotros** | Responsabilidad, no plata: privacidad, abuso, mantenimiento | Ver abajo |

## Qué hace hoy Claude por Valija, y qué lo reemplaza

La app usa la plataforma en seis lugares (`claude.use`). Fuera de Claude, cada uno necesita su reemplazo:

| Hoy lo da Claude | Afuera hace falta | Esfuerzo |
|---|---|---|
| **Dónde vive la página** (el link del Artifact) | Un hosting de páginas estáticas y un dominio propio | Chico |
| **La IA** (Importar, ajustar la valija; 3 lugares) | Un **servidor chico** que guarde nuestra clave de la API —nunca puede ir en la página— y haga los pedidos; con **topes por persona** para que nadie vacíe la cuenta | Mediano |
| **Guardar los datos** | Nada, si siguen en el teléfono como en la beta. Si se quieren en la nube: **cuentas de usuario** y una base de datos | Nada / grande |
| **Descargar el PDF** | Ya tiene salida sin Claude: abre «Imprimir → Guardar como PDF». Lo prolijo es la descarga común del navegador | Chico |
| **«Contanos»** | Un formulario propio que guarde el comentario | Chico |
| **Quién es quién** (para topes y datos) | Sin cuentas: un identificador anónimo por dispositivo. Con cuentas: un sistema de ingreso | Chico / grande |

## La plata por mes, con precios de hoy

Precios encontrados el 12/10/2026 en sitios comparadores, **no en las páginas oficiales**: hay que confirmarlos
antes de contratar.

| Pieza | Opción de referencia | Precio |
|---|---|---|
| Hosting de la página | Cloudflare Pages | **Gratis**; sin tope de tráfico para páginas estáticas, según las fuentes |
| Servidor chico de la IA | Cloudflare Workers | **Gratis** hasta 100.000 pedidos por día; **USD 5 por mes** el plan pago (10 millones de pedidos por mes incluidos) |
| Dominio `.com` | Cloudflare Registrar | **~USD 10 por año** (las fuentes dicen entre 9,77 y 10,46) |
| Base de datos con cuentas (sólo escenario 2) | Supabase | **Gratis** para probar (500 MB, pero el proyecto se pausa tras 7 días sin uso y no tiene copias de seguridad); **USD 25 por mes** el plan Pro, en la práctica algo más |

**Escenario 1 — datos en el teléfono, como la beta:** ~USD 10 por año de dominio, más USD 0 a 60 por año de
servidor, más la IA. **Con mil usuarios típicos: del orden de USD 700 por año en total**, casi todo IA.

**Escenario 2 — datos en la nube con cuentas:** lo anterior más ~USD 300 por año de base de datos.

## Construirlo: cuántas entregas

Contado en entregas como las de estas semanas (cada una con su prueba, su auditoría y tu prueba en el teléfono):

| # | Entrega | Escenario 1 | Escenario 2 |
|---|---|---|---|
| 1 | La página en un hosting propio con dominio, y el circuito de publicar y verificar ahí | ✓ | ✓ |
| 2 | El servidor de la IA con nuestra clave, sus topes y el aviso cuando se llega al tope | ✓ | ✓ |
| 3 | La app hablándole a ese servidor en vez de a Claude (Importar y valija), con las mismas pruebas | ✓ | ✓ |
| 4 | PDF y «Contanos» sin Claude | ✓ | ✓ |
| 5 | Prueba de calidad: ¿el modelo barato lee bien las reservas? (la que dejó pendiente el analista) | ✓ | ✓ |
| 6 | Cuentas de usuario: entrar, salir, recuperar la contraseña | | ✓ |
| 7 | Datos en la nube por persona, y pasar lo que cada uno ya tiene en el teléfono | | ✓ |
| 8 | Borrar la cuenta y sus datos (lo exige cualquier política de privacidad seria) | | ✓ |

**Escenario 1: ~5 entregas. Escenario 2: ~8.** No lo paso a horas: depende del ritmo de pruebas y auditorías,
que estas semanas fue lo que más tiempo llevó, no el código.

## Lo que hoy hace Claude y afuera pasa a ser nuestro

No cuesta plata por mes, pero es lo que más pesa:

- **Privacidad.** Los mails de las reservas (nombres, códigos, a veces documentos) pasarían por **nuestro**
  servidor y de ahí a la API. Hace falta una **política de privacidad** y decidir qué se guarda (lo sano: nada).
  Eso lo tiene que revisar alguien que sepa de lo legal; no es trabajo de los agentes.
- **Abuso.** Un link público con IA que pagamos nosotros es un blanco. Los topes por persona y un **límite de gasto
  en la cuenta de la API** no son opcionales.
- **Que ande.** Hoy si la IA falla, falla en Claude. Afuera, el servidor caído es nuestro: hace falta enterarse
  (un aviso) y tener a quién le toque mirarlo.
- **La cuenta de la API.** Alguien tiene que abrirla, ponerle medio de pago y el límite de gasto. Eso lo hacés vos;
  ningún agente puede ni debe tocar una tarjeta.

## Mi recomendación

1. **No sacarla todavía.** La beta en Claude, con la opción 1 que ya validaste, te deja medir lo que decide esto:
   si el núcleo sin IA retiene, y cuánto usa la gente Importar cuando sí la tiene.
2. **Si los datos dicen que sí: escenario 1 primero.** Datos en el teléfono, sin cuentas: ~5 entregas y
   ~USD 700 por año cada mil usuarios. Las cuentas (escenario 2) se suman sólo si la beta pide usar Valija en dos
   dispositivos o compartir viajes.
3. **El primer paso concreto, cuando decidas:** la entrega 5 (la prueba de calidad del modelo barato), porque es la
   que más mueve el costo de la IA y es barata: unos pocos dólares de API, y necesita que abras la cuenta.

## Fuentes de los precios

- Cloudflare Workers: [srvrlss.io](https://www.srvrlss.io/provider/cloudflare/),
  [appstackinsider.com](https://appstackinsider.com/insights/cloudflare-workers-pricing/),
  [makerkit.dev](https://makerkit.dev/pricing-calculator/cloudflare). Página oficial para confirmar:
  [cloudflare.com/plans](https://www.cloudflare.com/plans/)
- Cloudflare Pages: [dev.to](https://dev.to/nayankyada/cloudflare-pages-pricing-2026-free-tier-limits-workers-costs-when-to-upgrade-2ono),
  [temps.sh](https://temps.sh/blog/cloudflare-pages-free-tier-limits-2026)
- Dominio `.com`: [tld-list.com](https://tld-list.com/registrars/cloudflare),
  [Forbes Advisor](https://www.forbes.com/advisor/business/software/best-domain-registrar/)
- Supabase: [uibakery.io](https://uibakery.io/blog/supabase-pricing),
  [makerkit.dev](https://makerkit.dev/blog/saas/supabase-pricing),
  [automationatlas.io](https://automationatlas.io/answers/supabase-pricing-explained-2026/)

Son proveedores **de referencia** para poner números, no una elección: hay otros equivalentes y la elección se
hace cuando se decida construir.
