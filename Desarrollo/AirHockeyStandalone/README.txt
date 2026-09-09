AIR HOCKEY STANDALONE V1

Objetivo
--------
Probar el juego como juego ANTES de volver a integrarlo en Habbo.

Qué NO usa
----------
- Arcturus
- Nitro
- packets
- furnis
- networking

Qué sí tiene
------------
- Canvas 1000x600
- timestep fijo a 240 Hz
- ratón -> mazo 1:1
- colisión sólida círculo-círculo
- microsteps dinámicos de hasta 4 px
- paredes y postes de portería sólidos
- fuerza según componente normal
- límite de velocidad de impacto del mazo
- fricción y rebote ajustables
- CPU simple
- debug de hitboxes

Prueba primero estas 5 cosas
-----------------------------
1. Roza el puck de lado: debe desviarse poco.
2. Empújalo lentamente: debe moverse de forma controlable.
3. Haz un golpe frontal rápido: debe salir fuerte.
4. Intenta atravesarlo con el mazo: no debe poder saltarse la colisión.
5. Haz movimientos violentos de ratón: el control visual debe seguir siendo inmediato.

Los sliders son deliberados: primero encontramos una sensación buena.
Después congelamos constantes y recién entonces hacemos multiplayer.
