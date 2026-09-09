AIR HOCKEY STANDALONE V2 - MULTIPLAYER LOCAL

IMPORTANTE
==========
V1 NO SE MODIFICA.

V2 existe para comprobar una sola cosa:
¿podemos mantener la sensación buena del juego local cuando hay networking?

ARQUITECTURA
============
physics.js
  Núcleo de física único y compartido.
  El servidor Node ejecuta ESTE MISMO archivo.

server.js
  HTTP + WebSocket sin dependencias npm.
  Física autoritativa: 240 Hz.
  Broadcast de snapshots: 120 Hz.

client.js
  Ratón -> mazo propio 1:1 visual.
  Input -> servidor hasta 120 Hz con trailing edge.
  El último movimiento nunca se pierde.
  Puck y rival: servidor autoritativo.

NO USA
======
- Habbo
- Nitro
- Arcturus
- plugins
- packets de Habbo
- npm install
- librerías externas

PRUEBA
======
1. Ejecuta run_multiplayer.bat
2. Se abren dos pestañas.
3. Primera conexión: jugador azul.
4. Segunda conexión: jugador rojo.
5. Juega contra ti mismo usando dos ventanas o pide a otra persona que use la segunda.

QUÉ COMPROBAR
=============
- Cada mazo sigue su ratón inmediatamente.
- Puck no atraviesa mazos.
- Golpes cortos registran siempre.
- No hay snaps del mazo propio.
- El puck no empieza a moverse antes del contacto.
- Rebotes/paredes se sienten igual que V1.
- El rival se mueve con fluidez suficiente.

SI V2 SE SIENTE PEOR QUE V1
===========================
NO se toca la física.
El defecto está en networking/render de snapshots y se corrige ahí.

SOLO cuando V2 se sienta como V1 se integra en Habbo.
