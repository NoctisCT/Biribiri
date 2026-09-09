# Air Hockey V0

Backend server-authoritative para Biribiri / Arcturus Morningstar.

## Objetivos de esta V0

- Cada furni de Air Hockey mantiene una partida independiente por `itemId`.
- Máximo 2 jugadores por mesa.
- Un usuario solo puede pertenecer a una mesa simultáneamente.
- El cliente solo manda la posición deseada de su mazo.
- El servidor limita el mazo a su mitad del campo.
- El servidor calcula puck, paredes, colisiones, goles y marcador.
- Victoria a 7 goles.
- Tick servidor: 50 ms.
- Snapshots: hasta 20/s.

## Interaction

`air_hockey_name`

Debe coincidir con `items_base.interaction_type` del furni.

## Packets reservados

### Cliente -> servidor

- `6000`: MOVE `(itemId, x, y)`
- `6001`: READY `(itemId)`
- `6002`: LEAVE `(itemId)`

### Servidor -> cliente

- `6003`: OPEN
- `6004`: STATE
- `6005`: ROUND
- `6006`: CLOSE
- `6007`: ERROR

## Coordenadas

Campo normalizado:

- ancho: `10000`
- alto: `6000`

El cliente puede dibujar a cualquier resolución y convertir coordenadas visuales a esta escala.

## Siguiente capa

Nitro:
- composers 6000-6002;
- IncomingHeader 6003-6007;
- parsers/events;
- `AirHockeyView.tsx`;
- interpolación visual entre snapshots;
- captura de puntero/táctil;
- lobby READY y marcador.
