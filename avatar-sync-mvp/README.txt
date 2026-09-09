AVATAR SYNC MVP
===============

Objetivo de esta versión:
- :sync Usuario -> A controla a B
- :unsync -> rompe el vínculo
- Cada paso REAL de A se copia como el mismo dx/dy en B
- Si B no puede hacer exactamente ese paso, B se queda quieto
- Al salir/desconectarse cualquiera, el vínculo se destruye

Instalación:
1. Copia el JAR EXACTO de Arcturus/Morningstar que usa tu servidor a:
   lib/Arcturus.jar

2. Desde esta carpeta:
   mvn clean package

3. El resultado será:
   target/avatar-sync-0.1.0.jar

4. Copia ese JAR a la carpeta plugins/ de Arcturus y reinicia/reload plugins
   usando el mismo procedimiento que ya utilizas con tus otros plugins.

5. Prueba con dos usuarios en la misma sala:
   A escribe: :sync NombreDeB
   A camina derecha/izquierda/arriba/abajo/diagonal
   B debe copiar exactamente cada desplazamiento desde SU posición.

6. Pruebas importantes:
   - Pon una pared/bloque delante de B: A debe moverse y B quedarse quieto.
   - Borde del mapa: B debe quedarse quieto.
   - :unsync: B deja de copiar.
   - Que A o B salga de sala: el vínculo se destruye.

Todavía NO incluye:
- saludo
- baile
- giro sin movimiento
- sentado/tumbado
- modo espejo invertido
- bidireccional
- furni WIRED / interfaz Nitro

Primero hay que validar que el movimiento relativo se siente bien.
