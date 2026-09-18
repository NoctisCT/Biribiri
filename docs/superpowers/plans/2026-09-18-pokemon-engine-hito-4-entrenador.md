# Hito 4 — Entrenador, economía y seguidor

> Plan compacto: interfaces y casos de prueba. El código va directo a los fuentes.

**Objetivo:** el estado permanente del jugador (equipo, cajas, mochila, pokédex, pokédólares) y el **seguidor server-side** con su máquina de estados de animación vinculada a lo que hace el avatar en Habbo.

**Rama:** `codex/pokemon-engine` · **Base de datos:** `habbo_pokemon_test_20260918`

## Restricciones globales

- El paquete `combate/` y los nuevos paquetes puros **no importan `com.eu.habbo`**. Se verifica con grep en cada commit.
- Paquetes reservados: `6400/6401` estado y UI (JSON), `6402/6403` alta frecuencia del seguidor (binario).
- `userId` se lee siempre de `habbo.getHabboInfo().getId()`, nunca del paquete.
- Ninguna excepción escapa de un handler.
- Truncado entero en todas las fórmulas, igual que en los juegos.

---

## Alcance y límite honesto del seguidor

Este hito entrega el seguidor **completo en servidor**: se elige, se persiste, se mueve baldosa a baldosa detrás del jugador, cambia de animación según lo que hace el avatar y se difunde a la sala por `6403`. Lo que **no** entrega son los píxeles: dibujar el sprite PMD en la sala es la capa de render de la fase 2. Hasta entonces el seguidor se valida con el oyente de depuración del cliente (`PokemonEngine.onSeguidor`), que imprime posición, dirección y animación de cada entidad.

Las animaciones sembradas son **los nombres reales** del `AnimData.xml` de `PMDCollab/SpriteCollab` (verificado contra `sprite/0025`), no nombres inventados. El conjunto varía por especie, así que cada estado lleva animación de respaldo y el cliente resuelve contra el `AnimData.xml` de la especie.

### Vínculo estado del avatar → animación del seguidor

| Código | Vínculo en Habbo | PMD | Respaldo |
|---|---|---|---|
| `caminando` | `RoomUnit.isWalking()` | `Walk` | `Idle` |
| `parado` | por defecto | `Idle` | `Walk` |
| `durmiendo` | `RoomUnit.isIdle()` | `Sleep` | `EventSleep` |
| `despertando` | sale de idle | `Wake` | `Idle` |
| `sentado` | `RoomUnitStatus.SIT` o `cmdSit` | `Sit` | `Idle` |
| `tumbado` | `RoomUnitStatus.LAY` o `cmdLay` | `Laying` | `Sleep` |
| `bailando` | `DanceType != NONE` | `Hop` | `Idle` |
| `saludando` | `RoomUserAction.WAVE` | `Nod` | `Idle` |
| `riendo` | `RoomUserAction.LAUGH` | `Pose` | `Idle` |
| `carino` | `RoomUserAction.BLOW_KISS` | `DeepBreath` | `Idle` |
| `aprobando` | `RoomUserAction.THUMB_UP` | `Nod` | `Idle` |
| `saltando` | `RoomUnitStatus.JUMP` | `Hop` | `Idle` |
| `hablando` | `RoomUnitStatus.SPEAK` | `Nod` | `Idle` |
| `danado` | combate (hito 6) | `Hurt` | `Idle` |
| `debilitado` | combate (hito 6) | `Faint` | `Hurt` |

Las animaciones **sin vínculo** son las interactivas: se alcanzan pulsando el seguidor y eligiendo «Interactuar». Se siembran las restantes de `sprite/0025` (`Eat`, `Charge`, `Rotate`, `Pull`, `LookUp`, `Tumble`, `TumbleBack`, `Float`, `Trip`, `Cringe`, `LostBalance`, `HitGround`, `Head`, `Sink`, `LeapForth`, `Pain`, `QuickStrike`, `Shoot`, `Shock`, `Swing`, `Double`, `Attack`) con `es_interactivo = 1`.

---

## Tarea 4a — Esquema M004

**Ficheros:** `migraciones/M004Entrenador.java`, alta en `BaseDatosPokemon.migraciones()`.

Trece tablas: `pokemon_seasons`, `pokemon_items`, `pokemon_trainers`, `pokemon_owned`, `pokemon_owned_moves`, `pokemon_owned_ribbons`, `pokemon_boxes`, `pokemon_bag`, `pokemon_dex_entries`, `pokemon_currency_log`, `pokemon_zones`, `pokemon_zone_rooms`, `pokemon_follower_animations`.

La posición del seguidor **no se persiste**: se deriva de dónde está el jugador en cada sesión. Lo único permanente es qué Pokémon es, y eso vive en `pokemon_trainers.follower_owned_id`.

Decisiones que quedan fijadas aquí:

- `pokemon_zones` y `pokemon_zone_rooms` se crean **en este hito**, no en el 5, porque el seguidor necesita el gating desde el primer día. El hito 5 añade encuentros, obstáculos, tiendas y arenas.
- `pokemon_items` se crea vacía: el importador es trabajo del hito 5. La mochila referencia `item_id` sin clave ajena para que no bloquee.
- `pokemon_owned` lleva ya `parent_a_id`, `parent_b_id`, `es_huevo` y `pasos_huevo`: vacías hasta que llegue la crianza, pero el esquema no se vuelve a tocar por ellas.
- `season_id` en `pokemon_trainers` y `pokemon_owned`, con la temporada 1 (`kanto-t1`) sembrada.

**Pruebas:** `PlanMigracionTest` ya cubre el orden. Se verifica a mano en el emulador aislado: `[PokemonEngine] Migración 4 (entrenador) aplicada.`

---

## Tarea 4b — Núcleo puro del entrenador

**Paquete nuevo `entrenador/`, sin `com.eu.habbo`.**

| Clase | Responsabilidad |
|---|---|
| `EspecieGeneracion` | Lo que la generación necesita del catálogo: habilidades, `femaleRatio`, amistad base, pasos de huevo, `growthRate` |
| `CatalogoGeneracion` | Interfaz: `especie(int)`, `movimientosPorNivel(int especie, int nivel)` |
| `TablaExperiencia` | Las 6 curvas: `expParaNivel(curva, nivel)`, `nivelParaExp(curva, exp)` |
| `GeneradorPokemon` | `generar(EspecieGeneracion, int nivel, Opciones, RngCombate) → PokemonPoseido` |
| `PokemonPoseido` | El Pokémon del jugador: IVs, EVs, naturaleza, género, shiny, PS, estado, amistad, pokerus, 4 huecos con PP |
| `Almacenamiento` | Reglas de equipo y cajas |
| `Bolsillo` | Los 6 bolsillos con su tope de pila y si se puede tirar |
| `Mochila` | `anadir`, `quitar`, `cantidad` respetando topes |
| `Economia` | `aplicar(saldo, delta, origen) → Movimiento` con saldo nunca negativo |
| `Dex` | `EntradaDex` y la fusión de visto/capturado/shiny |

Constantes: equipo 6, cajas 32 × 30, tope de pila 999, shiny 1/4096, pokerus 3/65536, naturaleza 1/25, IV 0-31, EV 0-255 con tope 510.

### Casos de prueba

`TablaExperienciaTest`
- Las 6 curvas dan 0 en el nivel 1 y el valor conocido en el 100: `erratic` 600.000, `fast` 800.000, `medium_fast` 1.000.000, `medium_slow` 1.059.860, `slow` 1.250.000, `fluctuating` 1.640.000
- `nivelParaExp` es inversa de `expParaNivel` en los 100 niveles de cada curva
- Experiencia por debajo del nivel 1 devuelve nivel 1; por encima del 100, nivel 100

`GeneradorPokemonTest`
- Los 6 IVs caen en 0-31 y con semilla fija salen siempre los mismos
- `femaleRatio` `null` genera siempre sin género; 0 siempre macho; 100 siempre hembra; 12,5 da entre el 8% y el 17% de hembras en 4.000 tiradas
- El shiny sale cerca de 1/4096 en 400.000 tiradas
- Sin opción de oculta nunca se asigna la habilidad oculta; con probabilidad 100 siempre
- Una especie con una sola habilidad la asigna siempre, aunque la tirada pida la segunda
- Los movimientos son los **cuatro últimos** aprendidos por nivel hasta el nivel dado, en orden
- Con menos de cuatro movimientos disponibles no rellena huecos vacíos
- PS a tope y `experiencia == expParaNivel(curva, nivel)`
- La amistad arranca en la amistad base de la especie

`AlmacenamientoTest`
- El equipo acepta 6 y rechaza el séptimo
- Depositar deja el equipo sin huecos (se compacta, no quedan agujeros)
- No se puede depositar si dejaría el equipo sin ningún Pokémon en condiciones de combatir
- Un huevo no cuenta como Pokémon en condiciones de combatir
- Un Pokémon debilitado tampoco
- `primerHuecoLibre` recorre las 32 cajas y devuelve la primera libre
- Con las 32 cajas llenas (960) y el equipo lleno, la captura se rechaza con `ALMACEN_LLENO`
- Mover a una caja y a un hueco ocupados intercambia las posiciones
- Sacar de una caja al equipo lleno falla sin tocar nada

`MochilaTest`
- Añadir 5 y 5 del mismo objeto deja 10 en una sola entrada
- El tope de pila es 999 y el exceso se rechaza informando de cuánto cupo
- Los objetos de bolsillo clave no se pueden tirar ni vender
- Quitar más de lo que hay falla y no deja la cantidad negativa
- Quitar hasta 0 elimina la entrada

`EconomiaTest`
- Un gasto mayor que el saldo falla y el saldo no cambia
- Un ingreso produce un movimiento con `saldoResultante` correcto
- El saldo tiene tope (999.999.999) y un ingreso que lo pasaría lo recorta
- Delta 0 no genera movimiento

`DexTest`
- Ver una especie ya capturada no baja el estado a solo visto
- Capturar marca visto y capturado a la vez
- Capturar un variocolor marca las tres banderas
- Los contadores del entrenador cuentan especies distintas, no ejemplares

---

## Tarea 4c — Servicios y protocolo de estado

**Ficheros:** `ServicioEntrenador.java`, `ServicioEconomia.java`, ampliación de `ServicioPokedex` (catálogo de generación y learnsets), `PokemonAcciones`, `handlers/PokemonCommandHandler`.

Acciones nuevas, en los rangos ya reservados:

| Id | Acción |
|---|---|
| 3 | `ENTRENADOR_ESTADO` — saldo, insignias, contadores, seguidor, temporada |
| 20 | `EQUIPO_LISTAR` |
| 21 | `EQUIPO_REORDENAR` |
| 22 | `CAJAS_LISTAR` |
| 23 | `CAJA_VER` |
| 24 | `POKEMON_MOVER` |
| 25 | `POKEMON_DETALLE` |
| 26 | `POKEMON_MOTE` |
| 27 | `POKEMON_FAVORITO` |
| 28 | `CAJA_RENOMBRAR` |
| 40 | `MOCHILA_LISTAR` |
| 41 | `MOCHILA_TIRAR` |
| 42 | `OBJETO_DAR` — equipar un objeto a un Pokémon |
| 43 | `OBJETO_QUITAR` |
| 100 | `DEX_RESUMEN` |
| 101 | `DEX_ENTRADA` |

Reglas: toda acción comprueba que el Pokémon pertenece al usuario antes de tocarlo. `ServicioEconomia.aplicar` usa `SELECT ... FOR UPDATE` en la misma transacción que inserta en `pokemon_currency_log`, para que dos acciones simultáneas no dupliquen saldo.

**Pruebas:** `Economia` y `Almacenamiento` ya cubiertos en puro. De los servicios se prueba a mano contra el emulador aislado con `PokemonEngine.enviar(accion, datos)`.

---

## Tarea 4d — Seguidor

**Paquete puro `seguidor/`:**

| Clase | Responsabilidad |
|---|---|
| `RastroSeguidor` | La estela: `alPasar(desdeX, desdeY, haciaX, haciaY)` coloca al seguidor en la baldosa que el jugador acaba de dejar; salto de más de una baldosa lo teletransporta |
| `Direccion` | `desde(dx, dy) → 0-7` con el mapeo de Habbo, `opuesta` |
| `EstadoSeguidor` | Los estados vinculados y el interactivo, con animación y respaldo |
| `MaquinaAnimacion` | `resolver(EntradaAvatar) → EstadoSeguidor` con precedencia fija |

Precedencia de la máquina: combate > interacción en curso > tumbado > sentado > durmiendo > bailando > gesto puntual > caminando > parado. Un gesto puntual y una interacción caducan por tiempo y devuelven a `parado`.

**Capa de emulador:** `ServicioSeguidor.java` con `@EventHandler` de `UserTakeStepEvent`, `UserEnterRoomEvent`, `UserExitRoomEvent` y `UserIdleEvent`; `handlers/PokemonSeguidorHandler` para `6402`; `SeguidorPackets` para `6403`.

`6402` cliente → servidor: `int accion`, y según cuál:

- **1** pedir la foto de la sala, sin más argumentos
- **2** interactuar con el seguidor de alguien: `int userId`, `string codigo`. Solo vale con quien está en tu misma sala
- **3** gesto propio: `string codigo`. Existe porque la risa, el beso y el pulgar no dejan estado en el avatar y el servidor no puede verlos. Solo se aplica al seguidor de quien lo manda, así que lo peor que consigue un cliente manipulado es que su propio Pokémon salude de más

Activar o desactivar el seguidor y elegir cuál va por el 6400 (acciones 4 y 5), que es donde vive el estado.

`6403` servidor → cliente, binario: `int tipo` (1 foto, 2 paso, 3 alta, 4 baja, 5 animación), `int n`, y por entrada `userId, ownedId, speciesId, formId, shiny, x, y, zCentesimas, direccion, codigoEstado, animacion, respaldo, mote`.

El seguidor solo existe si la sala está en `pokemon_zone_rooms` con `seguidor_permitido = 1`. Al entrar en una sala sin zona no se crea nada y el cliente recibe una foto vacía.

### Casos de prueba

`RastroSeguidorTest`
- El seguidor ocupa la baldosa que el jugador deja, no la que pisa
- Dos pasos seguidos dejan al seguidor siempre a una baldosa
- Un salto de más de una baldosa (rodillo o teletransporte) lo coloca encima del jugador sin animación de paso
- La dirección es la del vector del paso, no la del jugador
- Al aparecer arranca en la baldosa del jugador, sin paso

`DireccionTest`
- Las 8 direcciones coinciden con `Rotation.Calculate` de Arcturus para los 8 vectores
- Un vector nulo mantiene la dirección anterior

`MaquinaAnimacionTest`
- Andar da `caminando`; quieto, `parado`
- Idle del avatar da `durmiendo`, y salir del idle pasa por `despertando`
- Tumbado gana a sentado, y sentado a durmiendo
- Bailar gana a parado pero pierde contra sentado
- Un gesto puntual (saludo) dura lo suyo y vuelve a `parado`
- Una interacción pedida por el jugador gana al gesto puntual
- Estar en combate gana a todo
- Cada estado vinculado tiene animación y respaldo no vacíos
- Ningún estado interactivo pisa un vínculo de Habbo

---

## Tarea 4e — Cliente mínimo de validación

**Ficheros:** `submodules/renderer/.../pokemonengine/` (compositor y evento de `6402/6403`), registro en `OutgoingHeader`, `IncomingHeader` y **`NitroMessages.ts` en `_events` y en `_composers`**, y `src/api/pokemon/PokemonEngineAdapter.ts`.

No es la interfaz del hito 7: es el oyente de depuración que permite comprobar que el seguidor se mueve. Se replica a mano en `node_modules/@nitrots/nitro-renderer` — **nunca `yarn install`**.

**Prueba:** en una sala dada de alta en `pokemon_zone_rooms`, andar y ver en consola la posición del seguidor una baldosa detrás, y el estado cambiando al sentarse, bailar y quedarse quieto.
