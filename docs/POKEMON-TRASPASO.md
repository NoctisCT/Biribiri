# PokemonEngine — Estado, hallazgos y trabajo pendiente

Última actualización: 19 de septiembre de 2026
Rama: `codex/pokemon-engine` · Worktree: `build/pokemon-engine` · Base: `dev`

**Este documento es el punto de entrada.** Está escrito para que alguien sin contexto de la conversación pueda continuar. Lo que no esté aquí, está en los documentos que enlaza.

## Para la siguiente sesión: empezar por el hito 6b

Los hitos 1 a 5 y el **6a** están hechos. Lo siguiente es el **hito 6b**: combate de punta a punta, salvaje y PvP, con `ServicioArena`, formación en sala y bloqueo de posición. Su plan está escrito en `docs/superpowers/plans/2026-09-19-pokemon-engine-hito-6b-combate.md`, con las decisiones de diseño ya tomadas de la spec del 6a y de la sección 9 de este documento.

Antes de escribir una línea, leer de este documento la **sección 3 (restricciones del entorno)**: cada punto de esa lista costó un fallo real.

Orden mínimo para ponerse en marcha:

```bash
cd build/pokemon-engine
"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -o test   # 295 en verde
grep -rn "com.eu.habbo" Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/{combate,entrenador,seguidor,encuentros,captura,tienda,clima}/
```

El segundo comando **no debe devolver nada** salvo un comentario en `CatalogoAnimaciones`. Es la invariante que permite probar las reglas sin levantar el emulador.

### El orden que toca

1. **Hito 6b, el combate.** Es lo único que separa al proyecto de ser jugable de verdad: hoy pisas la hierba, sale un Pokémon y solo puedes tirarle balls. No hay turnos, ni ataques, ni huida. Empezar por escribir su plan a partir de la sección 9 y de la spec de la fase 1, que ya tienen tomadas las decisiones.
2. **Hito 7, el cliente**, en cuanto el 6b tenga eventos que pintar. Es el único hito que toca el cliente de producción y **compite con el trabajo del vestidor en `dev`**: coordinarlo antes de empezar.
3. Lo demás puede esperar: efectos de objetos y habilidades, MOs, intercambio, ranking.

**Lo que NO toca hacer todavía**: más contenido de mundo. Kanto ya tiene zonas, encuentros, clima, tiendas y centro; añadir rutas antes del combate es amueblar una casa sin puertas.

---

## 1. Mapa de documentos

| Documento | Contenido |
|---|---|
| `docs/superpowers/specs/2026-09-18-pokemon-engine-fase1-design.md` | **La spec de la fase 1.** Todas las decisiones de diseño y su razón |
| `docs/REGISTRO-PACKET-IDS.md` | Registro de packet ids del hotel y método para rehacerlo |
| `docs/RUNTIME-AISLADO.md` | Cómo arrancar y recrear el emulador de pruebas, y cómo servir el cliente |
| `docs/superpowers/plans/2026-09-18-pokemon-engine-hito-1-cimientos.md` | Plan del hito 1 (hecho) |
| `docs/superpowers/plans/2026-09-18-pokemon-engine-hito-2-catalogo.md` | Plan del hito 2 (hecho) |
| `docs/superpowers/plans/2026-09-18-pokemon-engine-hito-3a-nucleo-numerico.md` | Plan del hito 3a (hecho) |
| `docs/superpowers/plans/2026-09-18-pokemon-engine-hito-3b-turno.md` | Plan del hito 3b (hecho) |
| `docs/superpowers/plans/2026-09-18-pokemon-engine-hito-4-entrenador.md` | Plan del hito 4 (hecho) |
| `docs/superpowers/plans/2026-09-19-pokemon-engine-hito-5-mundo.md` | Plan del hito 5 (hecho) |
| `docs/superpowers/specs/2026-09-19-pokemon-engine-6a-mundo-design.md` | **Spec del hito 6a**, con las decisiones de diseño y su razón |
| `docs/superpowers/plans/2026-09-19-pokemon-engine-hito-6a-mundo.md` | Plan del hito 6a (hecho) |
| `docs/superpowers/plans/2026-09-19-pokemon-engine-hito-6b-combate.md` | **Plan del hito 6b, el combate.** Lo que toca ahora |
| Sección 9 de este documento | **Decisiones del 6b ya tomadas**: huida, abandono, dónde se pelea, evolución |
| Sección 10 de este documento | Importador de salas desde otro hotel, proyecto aparte |

---

## 2. Qué es esto

Rediseño del sistema Pokémon del hotel: un **juego completo y multijugador integrado en el holo**, server-side, con el emulador como única autoridad y alta fidelidad a las mecánicas de los juegos.

Sustituye al prototipo anterior: `PokemonBackend/` (Node + ws en el puerto 8085, 1.217 líneas) y cinco vistas de Nitro con estilos inline y `any[]`. **Ese prototipo sigue vivo y se elimina en el hito 7.**

### Decisiones cerradas

| Decisión | Elección |
|---|---|
| Arquitectura | Plugin Java independiente. **Cero reutilización de RPGEngine**: está hecho para RPGs de combate por casillas; Pokémon es combate estático estilo juegos |
| Fidelidad | Alta: IVs, EVs, naturalezas, habilidades, PP, estados, clima, condiciones de bando |
| Datos | PokéAPI (catálogo, nombres en español, learnsets) + Showdown (flags y mecánica). **Las dos fuentes son imprescindibles**, ver §4 |
| Contenido fase 1 | Solo Kanto, con el catálogo completo importado y la disponibilidad controlada por temporada |
| Moneda | Pokédólares propios, separados de los créditos del hotel |
| Temporadas | Progreso del jugador permanente; ranking y logros por temporada |
| Dobles | El motor los soporta desde el día uno (bando = lista de posiciones); el contenido de la fase 1 es individual |
| Nivel efectivo | El motor calcula stats a un nivel que le pasa el controlador (torneos a 50) |
| MOs | Estado por jugador, con opción de marcar una zona como global para puzles |
| Combate en sala | Formación **Entrenador — Pokémon — Pokémon — Entrenador**, proximidad obligatoria de 5 baldosas, bloqueo de posición |
| Confusión | **1-4 turnos** por decisión del propietario, no los 2-5 que reporta PokéAPI |

### Fases

| Fase | Contenido |
|---|---|
| **1** | Núcleo jugable completo en Kanto + cliente nuevo. **En curso** |
| **2** | Render de entidades en sala. Primer entregable: **seguidor visible**. Después: combate en sala, espectadores, cries, UI de tiendas, MOs restantes |
| **3** | Gimnasios e insignias |
| **4** | Torneos trimestrales |
| Futuro | Crianza y huevos, zona Safari, regiones nuevas por temporada, megas y formas |

---

## 3. Restricciones del entorno — leer antes de tocar nada

Estas cinco cosas han costado un fallo cada una. No son teoría.

### 3.1 Nunca `yarn install` ni `composer install`

Un `yarn install` rompió Subastas, Arcade y otros sistemas. `node_modules` y `vendor` se **copian** desde la copia principal con robocopy, nunca se instalan.

### 3.2 El renderer de Nitro es una copia física, no un enlace

`node_modules/@nitrots/nitro-renderer` está declarado como `file:submodules/renderer` pero en disco es una **copia de directorio** (verificado: `LinkType` vacío). Vite resuelve desde `node_modules`, así que **todo cambio en `submodules/renderer` hay que replicarlo a mano**.

**Copiar solo los ficheros tocados, nunca el directorio entero.** Las dos copias pueden haber divergido, y un `cp -r` machacaría registros que solo existen en `node_modules`. Comprobar antes de dar nada por bueno, contra la copia de la rama principal:

```bash
A=xampp/htdocs/nitro-react/node_modules/@nitrots/nitro-renderer/src
B=build/pokemon-engine/xampp/htdocs/nitro-react/node_modules/@nitrots/nitro-renderer/src
diff --strip-trailing-cr "$A/<fichero>" "$B/<fichero>"
```

Sin `--strip-trailing-cr` los finales de línea marcan el fichero entero como distinto. **Lo correcto es que solo salgan líneas `>`**: si aparece alguna `<`, se ha borrado algo que hacía falta.

Ficheros del renderer que Pokémon toca y hay que replicar tras cada cambio:

```
nitro/communication/NitroMessages.ts
nitro/communication/messages/{incoming,outgoing}/{Incoming,Outgoing}Header.ts
nitro/communication/messages/{incoming,outgoing,parser}/pokemonengine/*
nitro/room/RoomContentLoader.ts
nitro/room/RoomObjectLogicFactory.ts
nitro/room/object/RoomObjectVisualizationFactory.ts
nitro/room/object/{visualization,logic}/index.ts
nitro/room/object/{visualization,logic}/pokemon/*
api/nitro/room/IRoomEngine.ts
api/nitro/room/object/RoomObject{Visualization,Logic}Type.ts
```

### 3.3 Registrar el composer, no solo el evento

En `NitroMessages.ts` hay dos registros: `_events.set(...)` para lo entrante y `_composers.set(...)` para lo saliente. Registrar solo el evento hace que **el cliente nunca envíe el paquete** y el fallo es silencioso.

### 3.4 Los packet ids se comprueban en el bytecode

Asignar el 5060 rompió Cinema: Arcturus rechaza el segundo registro del mismo id con `Header already registered` y el plugin que pierde la carrera se queda roto con una sola línea en el log. **La mayoría de plugins en ejecución no tienen su código en el repositorio**, así que la única lista fiable sale de desensamblar los JAR. Método en `docs/REGISTRO-PACKET-IDS.md`.

PokemonEngine tiene reservado **6400-6419**. En uso: 6400/6401 (estado y UI, JSON) y 6402/6403 (seguidor, binario).

### 3.4 bis El runtime de pruebas solo tiene dos plugins

`build/pokemon-test-runtime` carga **NitroWebsockets y pokemon-engine**, nada más. Producción tiene 92. En el cliente de pruebas los **arcades, las reacciones, las subastas y todo lo demás no funcionan**: el botón está, el paquete sale y no hay nadie al otro lado. No es un fallo, es lo que impide que un error aquí toque el hotel.

Si hace falta probar algo junto a Pokémon, se copia ese JAR a `build/pokemon-test-runtime/plugins/` y se reinicia **ese** emulador.

### 3.5 El emulador en segundo plano llena el disco

El emulador imprime `Waiting for command:` en bucle cuando su consola no tiene terminal. Lanzarlo redirigiendo la salida a un fichero **generó 95 GB de log**. Arrancarlo siempre filtrando:

```bash
java -Dfile.encoding=UTF8 -jar Habbo-3.6.0-jar-with-dependencies.jar 2>&1 \
  | grep --line-buffered -v "Waiting for command" > runtime.log
```

### 3.6 Otros detalles que muerden

- **`escapeshellarg` rompe `node -e` en Windows**: el conversor de Showdown se escribe a fichero y se ejecuta como fichero
- **MSYS convierte `--base=/pokemon-dist/`** en una ruta de Windows: usar `MSYS_NO_PATHCONV=1`
- **`.gitignore:12` tiene `**/vendor/`**, que excluye `src/assets/styles/bootstrap/vendor/_rfs.scss`, código fuente necesario del cliente. **Un clon limpio no puede compilar Nitro.** Sin arreglar
- **Arcturus consume el `auth_ticket` en el primer login**: hace falta uno nuevo por sesión de prueba
- **Apache corre como aplicación de consola**, no como servicio: `httpd -k graceful` no funciona, hay que reiniciarlo desde el panel de XAMPP

---

## 4. Hallazgos de la investigación de datos

### 4.1 PokéAPI no tiene flags de movimiento

Sus claves son `accuracy, contest_*, damage_class, effect_chance, effect_changes, effect_entries, flavor_text_entries, generation, id, learned_by_pokemon, machines, meta, name, names, past_values, power, pp, priority, stat_changes, target, type`.

**No hay contacto, sonido, puño, mordisco, bala, bloqueable por Protección, reflejable ni atraviesa-Sustituto.** Sin eso no funcionan Piel Tosca, Casco Dentado, Insonorizar, Puño Férreo, Mandíbula Fuerte, Protección ni Capa Mágica.

Sí aporta el bloque `meta`, que es mucho: dolencia y su probabilidad, golpes mínimos y máximos, turnos, drenaje, curación, ratio de crítico, retroceso y probabilidad de cambio de stats. Y los **nombres oficiales en español**.

### 4.2 Showdown aporta lo que falta

`https://play.pokemonshowdown.com/data/moves.js`, 451 KB, 954 movimientos. **37 flags** y campos mecánicos legibles por máquina: `breaksProtect, ignoreAbility, ignoreDefensive, ignoreEvasion, ignoreImmunity, critRatio, willCrit, multihit, recoil, sideCondition, slotCondition, volatileStatus, weather, terrain, condition.duration, forceSwitch, selfSwitch, ohko, overrideOffensiveStat, overrideDefensiveStat`, más `isNonstandard`, `isZ` e `isMax` para filtrar vigencia.

Casos comprobados: Velo Aurora es `sideCondition: auroraveil` con `duration: 5`; Amago tiene `breaksProtect: true` y **no** tiene flag `protect`; Psicocorte usa `overrideDefensiveStat: def`; Plancha Corporal `overrideOffensiveStat: def`; Velocidad Extrema `priority: 2`.

Es JavaScript con claves sin comillas, así que **no se parsea como JSON**: se convierte con Node.

### 4.3 El reparto real del trabajo de efectos

Del catálogo importado:

- **937 movimientos**, de los que **685 vigentes** (descartados Z, Dinamax y retirados)
- **141 movimientos vigentes** necesitan código propio (135 `unique` + 6 `whole-field-effect`)
- **Pero solo 64 de esos 141 son alcanzables en Kanto.** De 493 movimientos vigentes que aprende algún Pokémon de gen 1, el **87% sale de los datos**
- Los 64 relevantes están encabezados por Mimético, Descanso y Sonámbulo, que aprenden **145 de las 151 especies**

Las primitivas reutilizables que sí están implementadas: **12 condiciones de bando, 4 climas, 4 terrenos, 36 estados volátiles, 4 condiciones de hueco.**

### 4.4 Sprites de pmdcollab (fase 2)

Repositorio `PMDCollab/SpriteCollab`. Verificado en `sprite/0025`:

- **35 animaciones por Pokémon**: Walk, Attack, QuickStrike, Charge, Hurt, Faint, Idle, Sleep, Eat, Hop, Cringe…
- **`AnimData.xml` trae `HitFrame`, `RushFrame` y `ReturnFrame`**: el frame exacto en que el golpe conecta, que sincroniza la animación con el evento de daño del motor
- **Los variocolores son carpetas aparte** (`0025/0000` normal, `0025/0001`): no hay que recolorear
- **El tamaño de frame varía por animación** (Walk 32×40, Attack 80×80, QuickStrike 120×136): el empaquetador debe leer el XML
- Las 8 direcciones dan la vista de frente para el rival **y la de espaldas para el Pokémon propio**, que es lo que un combate estático necesita y otras fuentes no ofrecen

**Licencia: CC BY-NC 4.0 con atribución obligatoria**, verificado en la política de envío. La cláusula no comercial choca con `MONETIZACION.md`. El riesgo mayor no es esa cláusula sino que los Pokémon son IP de Nintendo y Game Freak. Decisión del propietario: se usan, con créditos.

### 4.5 bis PokéAPI ya no da el precio de los objetos

El endpoint `/item` **ya no trae `cost`**. Ahora publica `prices`, una lista por grupo de versión con `purchase_price` y `sell_price`, y a día de hoy está vacía para buena parte de Kanto: Poké Ball, Poción, Superpoción, Revivir, Antídoto y Repelente devuelven `prices: []`. Super Ball, Ultra Ball y las MT sí la traen.

Por eso `MapeadorObjeto` lee `prices` prefiriendo los grupos de Kanto (`red-blue`, `yellow`, `firered-leafgreen`) y, cuando no hay ninguno, cae en `PRECIOS_KANTO`, una tabla sembrada a mano con los precios de gen 1. El precio de venta sale del `sell_price` real si existe y, si no, es la mitad del de compra.

Lo mismo pasa con el **multiplicador de captura de las balls**, que PokéAPI no ha dado nunca: se siembra en `MapeadorObjeto::BALLS_KANTO` y el verificador lista las balls que se quedan sin él.

Otro detalle de formato: los objetos guardan su descripción en `flavor_text_entries[].text`, no en `flavor_text` como las especies y los movimientos.

### 4.5 ter Las categorías de PokéAPI no son bolsillos

El bolsillo sale de la categoría del objeto, pero las **bayas están repartidas** entre `medicine`, `effort-drop` y media docena más, así que se reconocen por el nombre (`*-berry`) antes de mirar la categoría.

Y la categoría `gameplay`, que es donde viven la bici, el mapa y las cañas de Kanto, **no está mapeada**: cae en `OBJETOS`. Mientras no existan objetos clave en juego da igual, pero cuando se implementen las MO hay que decidir si `gameplay` pasa a `CLAVE`, porque en `OBJETOS` un jugador podría vender la bici.

### 4.5 Otros datos verificados

- PokéAPI devuelve **19 tipos**, no 18: incluye `stellar` (Astral, el Teracristal de gen 9). La tabla de efectividades son **361 combinaciones**, no 324
- **Agarre** (`vice-grip`) se perdía por grafía: PokéAPI usa la antigua, Showdown `visegrip`. Es un movimiento legítimo de Kanto (Krabby, Kingler, Pinsir). Corregido con `MapeadorMovimiento::ALIAS_SHOWDOWN`
- Los **54 movimientos sin correspondencia en Showdown** son todos movimientos Z (36), Oscuros de XD/Colosseum (18) y Maxi. `pokemon:verify-catalog` los separa del ruido y falla si aparece alguno legítimo

---

## 5. Estado actual: 6 de 9 hitos, 295 pruebas de Java y 27 de PHP

### Hecho y verificado

| Hito | Contenido | Verificación |
|---|---|---|
| **1** | Plugin que carga, migraciones idempotentes, packets 6400/6401, adaptador de cliente | Saludo de punta a punta en el runtime aislado: devuelve el `userId` del usuario conectado, que el cliente nunca envía |
| **2** | Importador y verificador del catálogo | 1.025 especies, 937 movimientos, 133.067 learnsets, 576 evoluciones, 374 habilidades, 19 tipos, 361 combinaciones. `verify-catalog` → coherente |
| **3a** | Cálculo de stats, tabla de tipos, fórmula de daño, catálogo en memoria | 36 pruebas. Cero SQL en camino de combate |
| **3b** | Modelo de estado en 3 niveles, orden del turno, impedimentos, ejecución de movimientos, fin de turno, `ServicioCombate` | 101 pruebas. Misma semilla reproduce el combate evento por evento |
| **3c** | Mecánica real conectada, 12 condiciones de bando, 4 climas, 4 terrenos, volátiles | 138 pruebas |
| **4** | Entrenador, equipo, 32 cajas, mochila, pokédex, pokédólares y **el seguidor server-side**, adelantado del hito 8 | 225 pruebas. Migración 4 aplicada en el runtime aislado; 1.025 especies con habilidades y género y 36.336 aprendizajes por nivel en memoria |
| **5** | Catálogo de objetos importado, encuentros por zona, captura con la fórmula real, centros Pokémon y tiendas. Migración 6 y acciones 7, 60-62 y 120-123 | 36 pruebas nuevas de Java y 12 de PHP. **Probado de punta a punta en el runtime aislado**: en la sala 203 apareció un Rattata de nivel 4, la primera Poké Ball falló con una sacudida y la segunda lo capturó; quedó en el equipo con sus cuatro movimientos, la mochila bajó de 10 a 8 balls y la Pokédex lo marcó visto y capturado. En la sala 206 (Ciudad Verde) se compraron 5 Poké Balls por 1.000, se rechazó una compra sin saldo, se vendieron 2 por 200 y el Centro curó el equipo entero. La prueba destapó que `GeneradorPokemon` repetía movimientos del learnset; arreglado y con dos pruebas propias |
| **6a** | El mundo con iniciativa propia: disparador por furni con doble llave, probabilidad por paso con enfriamiento, clima por zona cada 4 horas, franja clavada a `Europe/Madrid`, y los cimientos de datos que no podían esperar | 32 pruebas nuevas de Java y 2 de PHP. **Probado en el runtime**: caminar por una franja de hierba en la sala 203 sacó un Rattata sin pulsar nada; el clima sorteó Sol y sobrevivió a cuatro reinicios; el tiempo jugado sumó 45 s en la sala 203 y 37 en la 206, y cero en una sala sin zona |
| **Extra** | **El seguidor se ve en la sala**, con sprites de PMD, profundidad real y menú de acciones al pulsarlo. Es la capa de render de entidades de la fase 2, adelantada | Probado a mano en el cliente de pruebas: camina interpolado, gira, se sienta y se tumba con el avatar, y lo tapa el furni que tiene delante |

**Invariante comprobada en cada commit**: ninguna clase de `combate/`, `entrenador/`, `seguidor/`, `encuentros/`, `captura/` ni `tienda/` importa `com.eu.habbo`. Es lo que permite probar las reglas sin emulador y reutilizarlas en la fase 2. La única excepción deliberada es `DireccionTest`, que sí importa `Rotation` de Arcturus **a propósito**, para comprobar que las ocho direcciones del seguidor coinciden con las del emulador.

### Estado del runtime de pruebas tras el hito 5

Lo que quedó en `habbo_pokemon_test_20260918` después de probar, por si estorba:

- La sala **206 («Centro Pokémon»)** está dada de alta en `pokemon_zone_rooms` apuntando a Ciudad Verde. Es lo que permite probar tienda y centro; se quita con un `DELETE FROM pokemon_zone_rooms WHERE room_id = 206`.
- Hokusei (id 5) tiene dos Rattata capturados, ninguna Poké Ball y 2.200 pokédólares. El Rattata `pokemon_owned` id 2 se capturó **antes** del arreglo de movimientos duplicados y conserva el 39 repetido; el id 3 ya sale limpio.
- `pokemon_items` tiene los 2.223 objetos. **25 balls se quedan sin multiplicador** porque no son de Kanto; el verificador las lista y no falla por ello.
- La sala 203 tiene una franja de **siete baldosas de hierba alta** en `y = 6`, puesta para probar el disparador.
- `pokemon_encounter_furni` tiene dados de alta tres sprites, y **los tres se quedan** por decisión del propietario: `jungle_c16_tallgrass` (8930) es el de uso normal, y las dos filas de `easter_c22_tallgrass` (19102868 y 60139172, el mismo furni duplicado en `items_base`) quedan para uso puntual.
- El Pikachu de Hokusei tiene `variante = 'pikachu_disfraz'` de una prueba. Se quita con un `UPDATE ... SET variante = 'normal'`.

### Pendiente

| Hito | Contenido | Tamaño |
|---|---|---|
| **5** | Zonas de Kanto, gating por `pokemon_zone_rooms`, encuentros y spawns, captura con fórmula real, centros Pokémon, modelo de tiendas | Medio |
| **6b** | Combate de punta a punta: salvaje y PvP, formación, `ServicioArena` con arenas predefinidas y resolución dinámica, bloqueo de posición, reserva de baldosas, huida solo en salvaje, abandono y anulación por expulsión | Grande |
| **7** | **Cliente nuevo completo**: 11 vistas, `PokemonStateProvider` con reducer, SCSS del holo, cero `any`. Y eliminar `PokemonBackend/` y `usePokemonSocket.ts` | El más grande |
| **8** | MOs de interfaz (Destello, Vuelo, Surf), intercambio entre jugadores, ranking de temporada | Medio |

**Los hitos 5 y 6 son enteramente de servidor y no necesitan coordinación.** El 7 es el único que toca el cliente de producción y compite con el trabajo del vestidor en `dev`.

### Deuda conocida

1. **Los 141 movimientos con `effect_code` tipo `manual_`** no tienen implementación. Los 64 alcanzables en Kanto son el alcance real; el resto puede esperar a que su región se abra. Consultar con:
   ```sql
   SELECT id, nombre_es FROM pokemon_moves WHERE vigente=1 AND effect_code LIKE 'manual_%';
   ```
2. **`pokemon_move_effects.implemented` sigue a 0 en todas las filas.** Hay que marcar las primitivas ya implementadas para que el verificador informe de verdad
3. **Habilidades sin implementar**: `pokemon_abilities_cat` está importada con nombres y descripciones, pero `effect_code` vale `sin_implementar` en las 374
4. **Objetos**: `pokemon_items` ya está importada con `pokemon:import-items`. Lo que sigue sin implementar es el **efecto** de cada objeto: solo las balls tienen `effect_code` propio, el resto vale `sin_implementar`, así que una poción todavía no cura
5. **Solo está descargado Pikachu (0025).** Los sprites viven en `xampp/htdocs/public/dist/pokemon/sprite/<id 4 dígitos>/` y son los `<Anim>-Anim.png` más el `AnimData.xml`. Para cualquier otra especie hay que bajarlos de `PMDCollab/SpriteCollab`. Falta decidir si se sirven desde ahí o desde `nitro-assets`, y falta el pipeline que los baje en masa
6. **El variocolor no tiene sprite propio todavía.** En SpriteCollab las variantes son subcarpetas (`0025/0000`, `0025/0001`); el cargador aún no las mira, así que un shiny se dibuja como uno normal
7. **Algunas animaciones de PMD solo traen una dirección.** El `Sit` de Pikachu es una hoja de 96×40: tres fotogramas y **una sola fila**. No es un fallo del mapeo, es lo que hay en el origen, y por eso cada estado lleva animación de respaldo y el cliente recorta la fila a las que existan
8. **`HotelNight.tsx` tenía un error de sintaxis heredado** (`<div .../><` partido en dos líneas). Ya arreglado. **No rompía el build**: `esbuild` acepta el espacio dentro de la etiqueta de cierre y solo `tsc` lo rechazaba
9. **El `.gitignore` impide compilar Nitro desde un clon limpio** (§3.6)
10. **Ningún objeto tiene efecto todavía.** Solo las balls llevan `effect_code` propio; pociones, curaciones de estado y MT valen `sin_implementar`, así que se pueden comprar pero no usar

---

## 6. Cómo trabajar en esto

### Compilar y probar el plugin

```bash
cd build/pokemon-engine
"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" \
  -f "Desarrollo/PokemonEngine/pom.xml" clean package
cp Desarrollo/PokemonEngine/target/pokemon-engine-1.0.0.jar ../pokemon-test-runtime/plugins/
```

### Runtime aislado

Nunca se despliega en producción. Detalles en `docs/RUNTIME-AISLADO.md`.

| | Producción | Pruebas |
|---|---|---|
| Carpeta | `Emulator/` | `build/pokemon-test-runtime/` |
| Juego / RCON | 3000 / 3001 | **3200 / 3201** |
| WebSocket | 2096 | **2196** (vive en `emulator_settings.ws.nitro.port`) |
| Base de datos | `habbo` | **`habbo_pokemon_test_20260918`** |
| Plugins | 92 | **2** |

### Importar y verificar el catálogo

```bash
cd build/pokemon-engine/xampp/htdocs
../php/php.exe artisan pokemon:import-catalog     # idempotente, con caché en storage/app/pokemon-cache
../php/php.exe artisan pokemon:verify-catalog     # sale con código 1 si hay incoherencias
../php/php.exe vendor/bin/phpunit tests/Unit/Pokemon/
```

El `.env` del worktree apunta a la base de pruebas. **Comprobarlo antes de ejecutar cualquier import.**

### Cliente de pruebas

Alias de Apache `/pokemon-dist` → el dist del worktree. Tras cada `yarn build` hay que reaplicar dos parches (base de assets, `socket.url` y `config.urls`); están en `docs/RUNTIME-AISLADO.md`.

---

## 7. Arquitectura del plugin

`Desarrollo/PokemonEngine/`, paquete `com.retro.pokemonengine`, Java 16, Gson sombreado y reubicado a `com.retro.pokemonengine.shaded.gson`.

| Clase | Responsabilidad |
|---|---|
| `PokemonEnginePlugin` | Ciclo de vida, migraciones, carga de catálogos, registro de los handlers 6400 y 6402, y los eventos de sala y paso del seguidor |
| `PokemonCommandHandler` | Único punto de entrada. Lee `action` y despacha. **El `userId` sale de la conexión, nunca del paquete** |
| `BaseDatosPokemon` | Runner de migraciones idempotentes. Si una falla, el plugin no se habilita |
| `migraciones/M001Base`, `M002Catalogo`, `M003SinShowdown`, `M004Entrenador` | Esquema en la versión 4 |
| `ServicioPokedex` | Catálogo inmutable en memoria: especies, movimientos, mecánica, tabla de tipos |
| `ServicioGeneracion` | El otro catálogo: habilidades, género y los 36.336 aprendizajes por nivel. Va aparte porque al motor de turno no le hacen falta |
| `ServicioZonas` | El gating. Una sala sin fila en `pokemon_zone_rooms` no tiene nada de Pokémon |
| `ServicioEntrenador` | Entrenador, equipo, cajas, mochila y pokédex contra la base de datos |
| `ServicioEconomia` | Pokédólares con `SELECT ... FOR UPDATE` y registro en la misma transacción |
| `ServicioSeguidor` | El seguidor vivo: estela por `UserTakeStepEvent` y latido de medio segundo para la animación |
| `AccionesEntrenador` | Las acciones del 6400 que no son saludo ni catálogo |
| `PokemonCuerpo` / `PokemonPackets` / `SeguidorPackets` / `PokemonAcciones` | Protocolo: JSON en 6400/6401, binario en 6402/6403, rangos de acción reservados |

| `ServicioObjetos` | El catálogo de objetos en memoria, con el multiplicador de ball ya en décimas |
| `ServicioEncuentros` | Tablas de encuentro por zona y el Pokémon salvaje en curso, uno por jugador, solo en memoria |
| `ServicioCaptura` | La tirada de ball: comprueba sitio, gasta la ball, aplica la fórmula y guarda la captura |
| `ServicioTienda` | Tiendas y existencias. Reserva antes de cobrar y devuelve el dinero si algo falla después |
| `ServicioCentro` | Cura el equipo: PS al máximo, estado a `none` y PP llenos. Gratis, no toca la economía |
| `AccionesMundo` | Las acciones 7, 60-62 y 120-123. La sala sale de la sesión, nunca del paquete |
| `migraciones/M006Mundo` | Encuentros, obstáculos, tiendas y existencias, más la siembra de las tres primeras zonas de Kanto |

### Lo puro del hito 5

| Paquete | Responsabilidad |
|---|---|
| `encuentros/` | `TablaEncuentros` sortea por peso acumulado; `Encuentro`, `MetodoEncuentro` y `Franja` describen la fila. Sin base de datos: se prueba con 10.000 tiradas |
| `captura/` | `FormulaCaptura`, la de gen 3+ con truncado entero. Los multiplicadores llegan en décimas (una Super Ball es 15) para que el truncado sea el de los juegos |
| `tienda/` | `ReglasTienda`: comprobar todo antes de cobrar, no entregar a medias y no vender objetos clave |

### El motor, en `combate/`

Sin dependencias del emulador. `ServicioCombate` es una función: **(estado, acciones) → (estado nuevo, eventos)**.

| Clase | Responsabilidad |
|---|---|
| `EstadoCombate` / `Bando` / `PokemonCombate` | Los tres niveles de estado: global, de bando, por Pokémon |
| `Accion` / `Evento` | Lo que entra y lo que sale |
| `RngCombate` | Azar sembrado. La semilla se guarda para reproducir el combate |
| `CalculadoraStats` / `Naturaleza` / `Etapas` | Stats reales y multiplicadores de etapa (divisor 3 para precisión y evasión) |
| `TablaTipos` / `Tipos` | Efectividades y constantes de tipo |
| `CalculadoraDano` | Fórmula de gen 3+ con truncado entero en cada paso |
| `OrdenTurno` | Huida/objeto/cambio, prioridad, velocidad, empate por RNG |
| `Impedimentos` | Congelación, sueño, retroceso, parálisis, enamorado, confusión, y precisión |
| `EjecutorMovimiento` | Las 11 categorías genéricas, todas dirigidas por datos |
| `Volatiles` | Enamorado, Mofa, Maldición, Canto Mortal, Tormento, Anulación, Embargo |
| `CondicionesBando` | Pantallas, protecciones y las 4 trampas de entrada |
| `Campo` | Clima y terreno |
| `CatalogoCombate` | Interfaz que evita que el motor dependa de `ServicioPokedex` |

### El estado del jugador, en `entrenador/`

También sin dependencias del emulador.

| Clase | Responsabilidad |
|---|---|
| `PokemonPoseido` / `MovimientoPoseido` | El Pokémon del jugador: IV, EV, naturaleza, género, shiny, PP con Más PP. `aCombate()` lo convierte a números de combate con el nivel efectivo que se le pase, sin tocar el nivel real |
| `TablaExperiencia` | Las 6 curvas de PokéAPI con sus nombres tal cual los guarda el importador |
| `GeneradorPokemon` / `EspecieGeneracion` / `CatalogoGeneracion` | Creación: IV, naturaleza 1/25, género por octavos, shiny 1/4096, pokerus 3/65536, habilidad oculta solo si se pide |
| `Almacenamiento` | Equipo de 6 y 32 cajas de 30, con compactado y la regla de no quedarse sin nadie que pueda combatir |
| `Bolsillo` / `Mochila` | Seis bolsillos, tope de pila 999, objetos clave que no se tiran |
| `Economia` | Pokédólares: saldo nunca negativo, tope, y un movimiento por cambio |
| `Dex` | Banderas que solo suben |

### El seguidor, en `seguidor/`

| Clase | Responsabilidad |
|---|---|
| `RastroSeguidor` | La estela: ocupa la baldosa que el entrenador deja. Un rodillo o un teletransporte lo colocan encima en vez de hacerle caminar |
| `Direccion` | Las 8 direcciones de Habbo, comprobadas contra `Rotation.Calculate` |
| `CatalogoAnimaciones` / `EstadoSeguidor` | **Fuente única** de los 37 estados y sus animaciones PMD. La migración 4 siembra la tabla leyendo de aquí, así que código y base de datos no pueden separarse |
| `MaquinaAnimacion` | Precedencia: combate > interacción pedida > tumbado > sentado > durmiendo > bailando > gesto > caminando > parado |

---

## 7 bis. El seguidor en el cliente

El Pokémon **es un objeto de sala de Nitro**, no una capa de HTML encima. Esa fue la diferencia entre «se ve» y «se ve bien»: los objetos de sala entran en la lista que `RoomSpriteCanvas` ordena por profundidad, así que el furni y los avatares lo tapan cuando toca. Una capa de HTML no puede conseguirlo, porque el lienzo **reconstruye y reordena esa lista en cada fotograma** (`_sortableSprites.sort((a, b) => (b.z - a.z))`) y borra cualquier cosa inyectada a mano.

### Piezas

| Fichero | Qué hace |
|---|---|
| `submodules/renderer/.../visualization/pokemon/PokemonFollowerVisualization.ts` | Copia al sprite la textura y el ancla que el cliente deja en el modelo del objeto |
| `.../visualization/pokemon/PokemonFollowerVisualizationData.ts` | Trivial: `initialize()` devuelve `true` |
| `submodules/renderer/.../logic/pokemon/PokemonFollowerLogic.ts` | Solo declara que escucha clics |
| `RoomObjectVisualizationFactory` / `RoomObjectLogicFactory` | Tres `case` que dan de alta el tipo `pokemon_follower` |
| `RoomContentLoader.isLoaderType` | Una línea que exime al tipo de la descarga de assets |
| `IRoomEngine` | Declara `createRoomObjectUser` y `getRoomObjectUser`, que ya existían en `RoomEngine` pero no en la interfaz |
| `src/api/pokemon/PokemonSprites.ts` | Carga el `AnimData.xml`, mide el ancla real y recorta cada fotograma a su propia textura |
| `src/components/room/widgets/pokemon/PokemonFollowerLayer.tsx` | Crea el objeto, lo mueve y le da la textura de cada fotograma |
| `.../pokemon/PokemonFollowerMenuView.tsx` | El menú al pulsarlo, paginado de seis en seis |

### Las dos trampas

1. **`RoomContentLoader.isLoaderType` devuelve `true` para todo menos `user`.** Sin la exención, el motor busca un `.nitro` para el tipo nuevo, no lo encuentra y lo sustituye por **el cubo negro del placeholder**. Si aparece ese cubo, es esto.
2. **`RoomObjectSpriteVisualization.initialize` devuelve `false` en la clase base.** El gestor de salas lo interpreta como «esta visualización no vale» y **tira el objeto entero sin decir nada**. Hay que sobrescribirlo.

### Decisiones que no son obvias

- **Los fotogramas se recortan a texturas propias**, no se posiciona una hoja con CSS, porque un objeto de sala dibuja una textura. El escalado es de vecino más cercano: son píxeles.
- **El ancla se mide leyendo la hoja**, no se pone a ojo. Los fotogramas de PMD son cajas grandes con el bicho en medio y mucho transparente; anclar la caja deja al Pokémon flotando, y al escalar el hueco crece igual que el dibujo.
- **El paso se interpola en coordenadas de sala, con decimales**, no en píxeles de pantalla. El motor las acepta y así la cámara hace el resto sola.
- **El clic no usa la selección del motor.** Para una unidad, el motor busca al usuario que hay detrás del objeto, y un seguidor no es ninguno. Se caza el `pointerdown` antes de que llegue al lienzo, se compara con el rectángulo del sprite y se traga si acierta, para que el avatar no eche a andar.
- **`caminando` no sale de `RoomUnit.isWalking()`**, que es `!isAtGoal() && canWalk` y se queda en `true` para siempre si alguien pincha una baldosa inalcanzable. Sale de cuándo llegó el último paso.
- **`sentado` y `tumbado` no miran `cmdSit` ni `cmdLay`**: esos guardan que el jugador *pidió* sentarse y no siempre se limpian al levantarse.
- **La tabla de animaciones se sincroniza en cada arranque** desde `CatalogoAnimaciones`, no la siembra una migración. Quitar una animación es tocar el código y reiniciar.

---

## 8. Reglas de trabajo que conviene mantener

1. **Probar las probabilidades con miles de tiradas, no con una.** Las pruebas de parálisis (25%), descongelar (20%) y enamorado (50%) usan 2.000 iteraciones; una sola tirada no detecta una probabilidad invertida
2. **El desempate de velocidad usa el RNG**, no el orden de llegada, y hay una prueba que comprueba que no está sesgado a un bando en 40 semillas
3. **Nada de acentos en identificadores Java.** Da problemas de codificación
4. **El motor no escribe texto**: emite eventos con datos y el cliente traduce
5. **Truncado entero en cada paso** de las fórmulas, como en los juegos. Calcular en coma flotante de una pasada da valores distintos

---

## 9. Decisiones del hito 6b ya tomadas

Se acordaron con el propietario mientras se diseñaba el 6a. **No hace falta volver a discutirlas**, solo implementarlas.

### Huida y abandono

- **Contra entrenador no se huye.** En salvaje sí, con la fórmula de los juegos: Velocidad e intentos acumulados.
- **Cambiar de sala se bloquea durante el combate**: navegador, teletransporte y vista del hotel responden que estás en combate. Es coherente con el bloqueo de posición que ya estaba decidido: si no te dejo andar, tampoco te dejo teletransportarte.
- **Cerrar sesión o caerse la conexión sí saca**, y ahí entra el plazo de gracia de la spec de la fase 1: al reconectar vuelves al combate donde lo dejaste y, si expira, derrota por abandono.

### Salida forzada

Si te **echan, te banean, cierran o borran la sala, o le quitan la condición de sala Pokémon** a mitad de combate, el combate se **anula**: sin ganador, sin premio y sin penalización. En salvaje, el Pokémon desaparece.

El filo del otro lado, que hay que tener presente cuando llegue el ranking: si anular es gratis, el que va perdiendo le pide a un amigo dueño de la sala que le eche. La salida acordada es que **los combates que cuentan solo ocurran en salas oficiales** — gimnasios y torneos, donde no hay un dueño con botón de echar. En salas de jugador, todo amistoso.

### Dónde se pelea

**Obligatorio en sala.** Si no hay hueco para la formación, los siguientes combates se resuelven **en interfaz**, no se cancelan: el jugador nunca pierde el encuentro por estar la ruta llena, solo pierde el espectáculo. Es una bandera en `pokemon_battles`, no un segundo motor.

### Evolución

Al evolucionar cambia `species_id` y nada más: se conservan IV, EV, naturaleza, género, variocolor, entrenador original, ball, dónde y a qué nivel se capturó, mote, amistad y experiencia. La habilidad **se vuelve a resolver por el hueco**, y la oculta sigue siendo oculta. Los PS máximos se recalculan con las bases nuevas arrastrando el daño recibido.

El caso raro es el disfraz: si la especie nueva no tiene esa variante, el Pokémon se queda en `normal`.

### Lo que el motor todavía no tiene

- **Los objetos no tienen efecto.** Solo las balls llevan `effect_code` propio; pociones, curaciones de estado y MT se compran pero no se usan. El Repelente tampoco rellena el silenciado del disparador, que ya está escrito y esperando.
- **Las habilidades tampoco**: `pokemon_abilities_cat` está importada con nombres y descripciones, y `effect_code` vale `sin_implementar` en las 374.

---

## 10. Proyecto aparte: importador de salas de otro hotel

El propietario tiene salas Pokémon ya diseñadas en **hobba.tv**, donde no es administrador. Se estudió y esto es lo que hay:

- **La mitad difícil ya está escrita en este hotel**: BuilderPro restaura copias de seguridad creando la sala, escribiendo el modelo en `room_models_custom` y colocando los furnis. No hace falta escribir un importador, sino **fabricar la copia de seguridad** con los datos de la otra sala.
- Su `furniture.json` **no lleva salas**. Es el catálogo del hotel: sirve para traducir furnis entre hoteles por **nombre de clase**, que es lo único que viaja entre instalaciones; los `sprite_id` no.
- Hacen falta tres cosas de allí: las filas de `items` de esa sala, la de `rooms` y, si el modelo es personalizado, su mapa de alturas.
- **Su cliente no expone nada al `window`** — comprobado con `Object.keys(window)` — así que desde la consola no se puede leer el motor de sala. La vía sería un userscript con `@run-at document-start` que envuelva `WebSocket` y guarde los fotogramas entrantes, y descifrarlos aquí con los parsers del renderer que ya están en el repo. **Riesgo real**: si hobba.tv usa otra revisión de protocolo, los identificadores de paquete no coinciden y hay que emparejarlos a mano comparando con el tráfico propio.
- **La vía barata es pedirle las tres tablas a un administrador de allí.** Si sale, lo demás es un script de traducción de una tarde.

No bloquea nada del motor: sirve para tener rutas bonitas donde probar.
