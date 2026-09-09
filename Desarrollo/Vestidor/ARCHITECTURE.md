# Biribiri Vestidor — Arquitectura V1

## Principio

**Nada persistente del vestidor se guarda en `localStorage`.**

Biribiri trata el vestidor como un sistema de juego persistente y validado por servidor.

## Armario

El armario estándar ya persiste los looks en MariaDB mediante `users_wardrobe`.

Biribiri conserva esa tabla para los outfits y añade una tabla propia únicamente para derechos de slots:

`biribiri_wardrobe_entitlements`

### Modelo de slots

- Slots **1–10**: base, disponibles para todos.
- Slots **11–20**: bonus HC, disponibles mientras el usuario tenga HC activo.
- Slots **21+**: slots extra comprados de forma permanente.
- Los slots extra comprables por créditos quedan preparados en arquitectura, pero la compra no se activa hasta fijar precio y UX.

Si HC caduca, los outfits de los slots 11–20 **no se borran**. Quedan almacenados y bloqueados hasta recuperar HC.

## Seguridad

Nitro sigue usando el packet estándar `800` para guardar un outfit, pero el plugin Biribiri registra un `ICallable` sobre ese packet.

Antes de que Arcturus ejecute `SaveWardrobeEvent`, el guard clona el packet, lee `slot_id`, calcula los slots permitidos en servidor y cancela el handler si el slot está bloqueado.

## Estado del armario

Packets propios:

- `6200`: solicitar estado de slots.
- `6201`: estado de slots.

## Persistencia

Outfits: `users_wardrobe`

Entitlements: `biribiri_wardrobe_entitlements`

No se usa almacenamiento del navegador.

## Próximas fases

1. Validar V1 de slots.
2. Añadir compra de slots extra con créditos y transacción server-side.
3. PoC HEX/RGB real.
4. Conjuntos con nombre/metadata propia.
5. Favoritos.
6. Randomizador con candados.
7. Historial server-side.
8. Compartir looks.

## V2 — navegación del armario

La interfaz se divide en secciones fijas para impedir crecimiento vertical infinito:

- `BASE`: 10 slots, usando el icono clásico de la percha/armario.
- `HC`: 10 slots, usando el icono HC.
- `EXTRA`: slots comprados, paginados de 10 en 10.

Los slots extra mantienen IDs continuos en servidor:

- Extra página 1: slots 21–30.
- Extra página 2: slots 31–40.
- Extra página 3: slots 41–50.

La paginación es solo presentación. La persistencia continúa en `users_wardrobe` y los derechos en `biribiri_wardrobe_entitlements`.

### Detección HC

Nitro usa como señal visual efectiva:

1. estado HC recibido del plugin Biribiri;
2. o el nivel HC nativo ya conocido por Nitro (`GetClubMemberLevel()`).

La validación definitiva de guardado continúa siendo server-side mediante el guard del packet `800`.

