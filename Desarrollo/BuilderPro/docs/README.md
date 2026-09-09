# Builder Pro

Builder Pro es el sistema avanzado de construcci?n para Holo/Nitro.

Su objetivo es permitir operaciones grupales precisas sobre furnis sin destruir
estructuras que el sistema normal de colocaci?n no podr?a reconstruir.

## Principio principal

Una operaci?n de grupo debe preservar la estructura existente.

Para movimientos y cambios de altura:

- se conserva la relaci?n exacta entre X/Y/Z;
- los furnis seleccionados no colisionan entre s?;
- las colisiones externas se validan antes de aplicar la operaci?n;
- una estructura imposible ya existente no debe ser recalculada internamente;
- si una operaci?n falla, debe revertirse completamente.

El servidor sigue siendo autoritativo.

## Arquitectura

Backend:

- `BuilderProPlugin`
- `BuilderProPackets`
- `GroupMoveService`
- `GroupTransformService`
- `MoveGroupRequest`
- `TransformGroupRequest`

Nitro:

- `BuilderProView`
- `BuilderProSelectionVisualizer`
- protocolo Builder Pro dentro de `nitro-renderer`

Protocolos actuales:

- `6300` MOVE_GROUP
- `6301` MOVE_GROUP_RESULT
- `6302` TRANSFORM_GROUP
- `6303` TRANSFORM_GROUP_RESULT

## Implementado

### Selecci?n

- multiselecci?n con clic normal;
- clic sobre seleccionado para deseleccionar;
- selecci?n rectangular por ?rea;
- m?ximo de 100 furnis;
- exclusi?n de Stack Helper y Tile Walk Magic;
- resaltado visual azul;
- opci?n para ocultar el resaltado sin perder la selecci?n.

### Movimiento X/Y

- movimiento grupal r?gido;
- botones;
- teclado;
- flechas mantenidas con ACK-chain;
- intervalo actual de 200 ms;
- watchdog para evitar bloqueo permanente;
- pasos configurables;
- Alt + drag;
- preview local en tiempo real antes del env?o al servidor.

### Colisiones

La validaci?n externa usa volumen de construcci?n 3D.

Esto evita tratar cualquier coincidencia X/Y como una colisi?n total.

Los furnis seleccionados se ignoran entre s? durante la validaci?n.

### Altura Z

- subir/bajar la selecci?n completa;
- pasos 0.1 / 0.5 / 1;
- preservaci?n de X/Y;
- preservaci?n de diferencias Z;
- rollback ante rechazo.

### Rotaci?n de estructura

Es una operaci?n diferente de girar la orientaci?n de los furnis.

La rotaci?n estructural:

- rota f?sicamente X/Y alrededor de un pivote;
- mantiene Z;
- permite pivote autom?tico;
- permite elegir un pivote manual;
- el pivote manual se marca en ?mbar;
- el pivote sigue siendo visible aunque se oculte el resaltado azul.

El pivote manual est? validado funcionalmente.

### Trazas

MOVE_GROUP mantiene `requestId` de extremo a extremo.

Las trazas se conservan por ahora para desarrollo y depuraci?n.

### Orientaci?n local / Girar furnis

La orientaci?n local est? implementada y validada.

`Girar furnis` reproduce la sem?ntica de giro nativa de Nitro/Holo:

- cada furni conserva exactamente X/Y/Z;
- un clic equivale a un ?nico giro nativo;
- cada furni avanza exactamente a su siguiente direcci?n permitida;
- se respetan las direcciones diagonales cuando existen;
- todos los furnis seleccionados giran dentro de una ?nica operaci?n;
- Nitro calcula la orientaci?n destino exacta de cada furni;
- el servidor recibe y aplica esas orientaciones exactas;
- el servidor mantiene la validaci?n autoritativa y el rollback grupal.

`ORIENT` es independiente de `ROTATE_STRUCTURE`.

`ORIENT` cambia ?nicamente la orientaci?n de cada furni en su posici?n actual.

`ROTATE_STRUCTURE` rota f?sicamente la construcci?n en X/Y alrededor de un
pivote y usa una rotaci?n geom?trica de 90 grados.

## Build

Backend:

`mvn -DskipTests package`

Nitro:

`yarn vite build --base=/dist/`

No ejecutar `yarn install` sobre esta instalaci?n: el proyecto contiene
implementaciones personalizadas y una copia f?sica de `nitro-renderer` en
`node_modules` que se mantiene de forma quir?rgica.

## Seguridad

Builder Pro no debe:

- regalar furnis;
- crear furnis inexistentes;
- modificar master durante desarrollo;
- aplicar parcialmente una operaci?n grupal;
- recalcular una pila interna v?lida o forzada;
- aceptar posiciones externas inv?lidas sin validaci?n del servidor.
