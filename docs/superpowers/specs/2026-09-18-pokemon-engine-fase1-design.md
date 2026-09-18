# PokemonEngine — Diseño de la fase 1

Fecha: 18 de septiembre de 2026
Rama: `codex/pokemon-engine` · Worktree: `build/pokemon-engine` · Base: `dev`
Estado: aprobado

---

## 1. Contexto y estado actual

El sistema Pokémon del hotel es hoy un prototipo desconectado de la arquitectura del resto del retro.

**Backend actual** — `PokemonBackend/`, 1.217 líneas:

- Servidor Node + `ws` en el puerto 8085, fuera del emulador
- Conexión MySQL directa con `mysql2`
- `combatHandler.js` (537), `healingHandler.js` (235), `server.js` (311), `statCalculator.js` (87), `CombatExperience.js` (47)
- Recibe el `userId` **dentro del mensaje del cliente**: `getUserPokemon(data.userId, …)`. Cualquier cliente puede leer y modificar los Pokémon de otro usuario cambiando un número

**Cliente actual** — 1.863 líneas en 5 vistas:

- `PokemonEncounterManager.tsx` (646), `PokemonPCView.tsx` (360), `PokemonInventoryView.tsx` (259), `PokemonMenu.tsx` (185), `PokemonHealingView.tsx` (164)
- `hooks/usePokemonSocket.ts` (249): cuatro variables globales mutables y un `Set` de listeners notificados a mano
- Estilos inline en todas las vistas, `any[]` como tipo de datos
- Sprites: iconos estáticos de furni, `/swf/dcr/hof_furni/icons/pokeweebz###_icon.png`
- El botón "En Sala" es un `alert` de marcador de posición (`PokemonEncounterManager.tsx:414`)

**Datos actuales**:

| Tabla | Filas |
|---|---|
| `pokemon_pokedex` | 4 |
| `pokemon_abilities` | 8 |
| `pokemon_routes` | 1 |
| `pokemon_items` | 10 |
| `pokemon_storage` | 18 |
| `pokemon_trainers` | 2 |
| `pokemon_inventory` | 10 |
| `pokemon_natures` | 25 (completa) |

No existe tabla de movimientos ni de learnsets. Los 18 Pokémon de `pokemon_storage` son datos de prueba y se descartan.

**Patrón de referencia** — el plugin `Desarrollo/RPGEngine`: plugin Java para Arcturus 3.6.1, paquete `com.retro.*`, packet par para cliente→servidor (5050) e impar para servidor→cliente (5051), un handler único que despacha por `action`, servicio de datos, y push en tiempo real. El cliente registra composers y eventos en el submódulo local `@nitrots/nitro-renderer` (`file:submodules/renderer`).

**RPGEngine no se reutiliza.** Está diseñado para que los usuarios construyan RPGs de combate por casillas; Pokémon es combate estático estilo juegos. Su subsistema `Encounter` es gestión de sesión (entrada, reconexión con plazo, posición guardada, reserva de baldosa), no un motor de turnos. No hay nada que heredar, ni en la fase 1 ni en la 2.

---

## 2. Objetivo

Rediseñar Pokémon como un **juego completo y multijugador integrado en el holo**, server-side, con el emulador como única autoridad, alta fidelidad a las mecánicas de los juegos, y preparado para crecer por temporadas con regiones nuevas.

La fase 1 entrega el núcleo jugable completo en Kanto, con interfaz nueva, y mata el backend de Node.

---

## 3. Fases

| Fase | Contenido |
|---|---|
| **1** | Plugin, catálogo, motor de combate, captura, equipo y cajas, mochila, dex, pokédólares, zonas de Kanto con gating, centros Pokémon, modelo de tiendas, intercambio, ranking de temporada, cliente nuevo completo, MOs de interfaz (Destello, Vuelo, Surf), seguidor server-side |
| **2** | Capa de render de entidades Pokémon en sala. Primer entregable: **seguidor visible**. Después: combate en sala, espectadores, cries, interfaz de tiendas, MOs restantes (Corte, Fuerza, Golpe Roca, Cascada, Buceo) |
| **3** | Gimnasios e insignias |
| **4** | Torneos trimestrales |
| Futuro | Crianza y huevos, zona Safari, regiones nuevas por temporada, megas y formas alternativas |

El seguidor va en la fase 2 y **antes** del combate en sala a propósito: necesita la misma capa de render, es mucho más simple (posición y dirección, sin estado de combate), y valida el pipeline de sprites completo sin poner en riesgo ningún combate.

---

## 4. Decisiones tomadas

| Decisión | Elección |
|---|---|
| Arquitectura | Plugin Java independiente, sin dependencias de otros plugins |
| Fidelidad | Alta, fiel a los juegos (IVs, EVs, naturalezas, habilidades, PP, estados, clima, prioridad) |
| Origen de datos | Híbrido: PokéAPI (catálogo, learnsets, evoluciones, nombres en español) + datos de Showdown (mecánica de movimientos) |
| Alcance del catálogo | Se importa completo (~1.025 especies); la disponibilidad se controla por temporada |
| Contenido de la fase 1 | Solo Kanto |
| Cliente | Interfaz nueva completa |
| Moneda | Pokédólares propios, separados de los créditos del hotel |
| Temporadas | Progreso del jugador permanente; ranking y logros por temporada |
| Combates dobles | El motor los soporta desde el día uno; el contenido de la fase 1 es individual |
| Nivel efectivo | El motor calcula stats a un nivel efectivo que le pasa el controlador (torneos a 50) |
| MOs | Estado por jugador, con opción de marcar una zona como global para puzles cooperativos |

### Nota legal sobre los sprites (fase 2)

Los sprites de pmdcollab (repositorio `PMDCollab/SpriteCollab`) están bajo **CC BY-NC 4.0 con atribución obligatoria**, verificado en su política de envío. Implicaciones:

- La atribución por artista es obligatoria y se cumple con una lista de créditos en la interfaz de combate
- La cláusula no comercial choca con la monetización del hotel (`MONETIZACION.md`)
- El riesgo mayor no es esa cláusula, sino que los Pokémon son IP de Nintendo y Game Freak: ni los artistas de pmdcollab ni el hotel tienen derechos sobre los personajes. Es el mismo terreno en el que ya está todo el retro

Decisión del propietario: se usan, con créditos.

---

## 5. Arquitectura del plugin

`PokemonEngine`, paquete `com.retro.pokemonengine`, Maven propio contra `Habbo-3.6.0.jar`, Java 16, desplegado como JAR en `Emulator/plugins`.

| Clase | Responsabilidad |
|---|---|
| `PokemonEnginePlugin` | Ciclo de vida, registro de handlers, eventos de login y logout |
| `PokemonCommandHandler` | Único punto de entrada del packet 6400: lee `action` y despacha. Sin lógica |
| `BaseDatosPokemon` | Pool de conexiones, migraciones idempotentes al arrancar |
| `ServicioPokedex` | Catálogo en memoria (especies, movimientos, tipos, habilidades, objetos), solo lectura |
| `ServicioEntrenador` | Entrenador, equipo de 6, cajas, mochila, pokédex del jugador |
| `ServicioCombate` | Motor de turnos. Función pura, sin SQL ni red |
| `ServicioEncuentros` | Zonas, spawns, tiradas de variocolor, captura |
| `ServicioArena` | Formación de combate: arenas predefinidas y resolución dinámica |
| `ServicioEconomia` | Punto único de toda transacción de pokédólares, con registro |
| `ServicioIntercambio` | Ofertas, doble confirmación, registro inmutable |
| `ServicioTemporada` | Temporada activa, regiones abiertas, ranking, logros |
| `PokemonPackets` | Serialización |
| `PokemonRealtime` | Push a clientes concretos |

### Límites invariantes

1. **`ServicioCombate` es puro.** Recibe un estado y una acción, devuelve un estado nuevo y una lista de eventos. No toca base de datos, red ni `Emulator`. Se prueba sin emulador y se reutiliza tal cual en la fase 2.
2. **El catálogo es de solo lectura y vive en memoria.** Se carga una vez al arrancar. Cero consultas SQL en camino de combate.
3. **El servidor es la única autoridad.** El cliente manda intenciones (usar el movimiento 2, lanzar una pokéball), nunca resultados.
4. **El `userId` sale de la conexión del cliente, nunca del paquete.**

### Qué se elimina

`PokemonBackend/` completo y `hooks/usePokemonSocket.ts`. Se borran en la fase 1, no se dejan en el árbol.

---

## 6. Modelo de datos

Prefijo `pokemon_`. Tres grupos:

- **Se sustituyen** los prototipos: `pokemon_pokedex` (por `pokemon_species`), `pokemon_storage` (por `pokemon_owned`), `pokemon_routes` (por `pokemon_zone_encounters`), `pokemon_inventory` (por `pokemon_bag`)
- **Se amplían** con columnas nuevas, conservando las filas: `pokemon_abilities`, `pokemon_items`, `pokemon_trainers`
- **Se conserva sin cambios**: `pokemon_natures`

### 6.1 Catálogo (importado, solo lectura, cargado en memoria)

| Tabla | Contenido | Volumen |
|---|---|---|
| `pokemon_species` | Stats base, tipos, habilidad 1/2/oculta, yields de EV, catch_rate, base_exp, growth_rate, ratio de género, egg groups, egg_steps, altura, peso, color, categoría, generación, forma | ~1.025 |
| `pokemon_species_evolution` | Origen → destino, método (nivel, objeto, intercambio, amistad, otros), parámetro, condición | ~500 |
| `pokemon_moves` | Tipo, categoría, potencia, precisión, PP, prioridad, objetivo, `effect_id`, `effect_chance`, flags (contacto, sonido, puño…), ratio de crítico, `field_effect` | ~937 |
| `pokemon_move_effects` | Catálogo de efectos que el motor implementa, con flag `implemented` | ~150 |
| `pokemon_learnsets` | Especie × movimiento × método (nivel, MT, huevo, tutor) × nivel | ~100.000 |
| `pokemon_type_chart` | Atacante × defensor → multiplicador | 324 |
| `pokemon_abilities` | `effect_id`, descripción | ~300 |
| `pokemon_items` | Categoría, precio de compra y venta, `effect_id`, `effect_param`, `field_effect`, usable en combate, consumible | ~200 |
| `pokemon_natures` | Sin cambios | 25 |

Las 100.000 filas de learnsets son triviales para MariaDB y ocupan pocos MB agrupadas por especie en memoria.

### 6.2 Regiones y temporadas

| Tabla | Contenido |
|---|---|
| `pokemon_regions` | Kanto, Johto, Hoenn…, con `is_open` |
| `pokemon_seasons` | Nombre, `starts_at`, `ends_at`, activa |
| `pokemon_season_regions` | Qué regiones abre cada temporada |
| `pokemon_species_release` | Especie × temporada de liberación, `is_legendary`, `release_state` |
| `pokemon_season_rankings` | Temporada × usuario × formato: elo, victorias, derrotas, combates |
| `pokemon_season_achievements` | Catálogo de logros conmemorativos |
| `pokemon_trainer_achievements` | Usuario × logro × temporada, fecha |
| `pokemon_season_history` | Cierre de cada temporada por jugador: puesto final, recompensas |

En la fase 1 se siembran solo las zonas de Kanto y se libera la dex de gen 1. El resto del catálogo está en base de datos, invisible hasta que una temporada lo abra. Los movimientos se importan todos, porque las especies de Kanto aprenden movimientos de generaciones posteriores.

### 6.3 Estado del jugador

**`pokemon_owned`** — el Pokémon individual, tabla crítica:

- `species_id`, `form_id`, `nickname`, `level`, `exp`
- 6 columnas de IV (0-31) y 6 de EV (0-252, tope global 510)
- `nature_id`, `ability_id`, `gender`, `is_shiny`
- `pokerus_state` (sano, infectado, inmune), `pokerus_strain`, `pokerus_infected_at`
- `friendship`, `current_hp`, `status_condition`, `held_item_id`
- `ball_id`, `met_zone_id`, `met_level`, `met_at`, `original_trainer_user_id`
- `storage_location` (equipo, caja), `box_number`, `slot`, `is_favorite`
- `is_egg`, `egg_steps_remaining`, `parent_a_id`, `parent_b_id` — existen desde el día uno, vacías hasta que llegue la crianza

Tablas asociadas:

| Tabla | Contenido |
|---|---|
| `pokemon_owned_moves` | 4 huecos con `move_id`, `pp_current`, `pp_up` |
| `pokemon_owned_ribbons` | Cintas obtenidas (las premiarán los torneos de la fase 4) |
| `pokemon_trainers` | Pokédólares, `badges_bitmask`, zona actual, `follower_owned_id`, contadores de dex, inicio, tiempo jugado |
| `pokemon_boxes` | 32 cajas de 30, ampliables, con nombre y fondo |
| `pokemon_bag` | Objeto × cantidad × bolsillo |
| `pokemon_dex_entries` | Usuario × especie: visto, capturado, variocolor capturado, fechas |
| `pokemon_currency_log` | Toda transacción de pokédólares: origen, importe, saldo resultante |
| `pokemon_trade_offers` | Ofertas de intercambio con estado y confirmación de ambas partes |
| `pokemon_trade_log` | Registro inmutable de intercambios cerrados |

### 6.4 Mundo

| Tabla | Contenido |
|---|---|
| `pokemon_zones` | `region_id`, nombre, tipo (ruta, ciudad, cueva, gimnasio, centro) |
| `pokemon_zone_rooms` | **`room_id` → `zone_id`. Esta tabla es el gating** |
| `pokemon_zone_encounters` | Zona × especie × rango de nivel × peso × método (hierba, surf, pesca, fijo) × franja horaria |
| `pokemon_zone_obstacles` | Baldosa o furni, tipo de obstáculo, MO que lo resuelve, alcance del estado (jugador o sala) |
| `pokemon_shops` | Zona, nombre, tipo |
| `pokemon_shop_stock` | Tienda × objeto, precio, `badge_requirement`, límite de existencias |
| `pokemon_battle_arenas` | Zona, sala, ancla, orientación, formato |
| `pokemon_battle_arena_slots` | Arena × rol (entrenador A/B, pokémon A1/A2/B1/B2) × baldosa × dirección |

El gating es de doble llave: al entrar en una sala el servidor resuelve la zona y, si no hay, el cliente esconde toda la interfaz Pokémon **y** el servidor rechaza cualquier acción que requiera zona.

### 6.5 Combate

| Tabla | Contenido |
|---|---|
| `pokemon_battles` | Tipo (salvaje, PvP, entrenador), formato, zona, sala, arena, `season_id`, estado, turno, `rng_seed`, `state_snapshot`, ganador, fechas |
| `pokemon_battle_sides` | Bando × combate × participante |
| `pokemon_battle_log` | Un evento por fila: combate, turno, evento |

El estado volátil del turno vive en memoria en `ServicioCombate`; a disco solo va el `state_snapshot` para sobrevivir a una reconexión. El log sirve para auditoría anticheat, repetición, y como sustrato de los torneos.

### 6.6 Importadores

Comandos Artisan de Laravel, siguiendo la convención de `app/Console/Commands/`:

- **`php artisan pokemon:import-catalog`** — PokéAPI para catálogo, learnsets, evoluciones y nombres oficiales en español; datos de Showdown para la mecánica de movimientos. Idempotente, reanudable, con caché local para no machacar las APIs
- **`php artisan pokemon:verify-catalog`** — comprueba que todo movimiento de un learnset existe y que su `effect_id` está implementado
- **`php artisan pokemon:protocol-dump`** — emite un ejemplo de cada carga del protocolo, para las pruebas del cliente

De los ~937 movimientos no todos tendrán efecto implementado en la fase 1. Los que no, quedan marcados `implemented = 0`, se excluyen de los movesets salvajes y aparecen en el informe del verificador. Es preferible a movimientos que se usan y no hacen nada.

---

## 7. Motor de combate

### 7.1 Forma

`ServicioCombate` es una función pura: **(EstadoCombate, Acción) → (EstadoCombate, lista de Eventos)**.

Todo lo que el cliente ve son esos eventos serializados (usó tal movimiento, es muy eficaz, crítico, se debilitó). Consecuencias: el cliente solo reproduce eventos, el log es el mismo objeto que se persiste, y la lucha en sala de la fase 2 consume exactamente los mismos eventos.

### 7.2 Estado, en tres niveles

1. **Por Pokémon**: niveles de stat (-6 a +6), volátiles (confusión, drenadoras, protección, contadores de sueño, semi-invulnerabilidad)
2. **Por bando**: Púas, Trampa Rocas, Reflejo, Pantalla Luz, Velo Sagrado, Cuenta Atrás, con sus contadores; sobreviven a los cambios de Pokémon
3. **Global**: clima con turnos restantes, terreno (hueco preparado, sin contenido en la fase 1), número de turno

Cada bando es **una lista de posiciones**, no un `pokemonActivo`, para que los dobles no exijan reescribir el motor.

### 7.3 RNG

Sembrado por combate, con la semilla guardada en `pokemon_battles.rng_seed`. Con la semilla y el log, cualquier combate se reproduce bit a bit. Es la base para resolver disputas de torneo.

### 7.4 Resolución del turno

1. **Recogida de acciones** de ambos bandos, con temporizador de 30 segundos. Al expirar: movimiento por defecto en salvaje, derrota por inacción en ranked
2. **Orden**: huida, objetos y cambios primero; luego movimientos por prioridad; a igual prioridad, por Velocidad efectiva (con parálisis y objetos aplicados); empate exacto, RNG
3. **Por movimiento**: impedimentos de estado (paralizado, dormido, congelado, confuso, retroceso) → precisión con modificadores → inmunidad por tipo → daño → efecto secundario según su `effect_chance`
4. **Fin de turno**, en orden fijo: clima, objetos residuales, veneno y quemadura, drenadoras, bayas, comprobación de debilitados, cambio forzado
5. **Cierre**: experiencia (por participación y por KO, más Repartir Exp), reparto de EV con pokerus ×2 y contagio al equipo, tope 510 global y 252 por stat, subida de nivel, aprendizaje de movimientos, evolución

Daño con la fórmula de gen 5 en adelante: nivel, Ataque y Defensa efectivos, STAB, tabla de tipos, crítico, variación 85-100%, clima, objetos y habilidades.

Los stats se calculan a un **nivel efectivo** que aporta el controlador del bando, no al nivel real del Pokémon.

### 7.5 Captura

Fórmula real: `catch_rate`, HP restante, estado alterado, multiplicador de la ball, con las sacudidas calculadas de verdad en vez de decididas de golpe. Tirada de variocolor propia, 1/4096 base, ajustable por configuración.

### 7.6 Movimientos, habilidades y objetos

**Los movimientos son datos; los efectos son código.** Cada movimiento lleva un `effect_id` y parámetros; en Java hay un registro de unos 150 efectos con interfaz común. Unos 45 efectos cubren más del 80% de los movimientos (daño simple, cambio de stat, inflige estado, multigolpe, drenaje, retroceso, dos turnos, golpe fijo). El mismo patrón sirve para habilidades y objetos equipados.

Los puntos de enganche son cerrados y explícitos. Una habilidad, un objeto o un efecto solo pueden engancharse aquí:

`alEntrar` · `alInicioDeTurno` · `antesDeMover` · `alModificarDaño` · `alRecibirDaño` · `alAplicarEstado` · `alFinDeTurno` · `alSalir` · `alDebilitarse` · `alCambiarClima` · `alCambiarForma` · `alIntentarCaptura`

`alCambiarForma` existe porque el cambio de forma en combate (Castform con el clima, Aegislash al atacar) implica sustituir stats y tipos a mitad de combate.

### 7.7 Controladores de bando

Un motor, tres controladores: **Jugador**, **IA salvaje** e **IA entrenador**. Los gimnasios de la fase 3 y los torneos de la fase 4 no tocan el motor: aportan su controlador y su configuración. La misma abstracción cubre el PvP por invitación.

### 7.8 Desconexión

Snapshot JSON del estado al cerrar cada turno. Al reconectar, el jugador vuelve al combate donde lo dejó. Si expira el plazo, derrota por abandono, con penalización de ranking si era ranked.

---

## 8. Formación de combate

La formación es **Entrenador — Pokémon — Pokémon — Entrenador** en línea, con los entrenadores en los extremos mirando al centro y los Pokémon enfrentados. En salvaje son tres posiciones: Entrenador — Pokémon — Salvaje. En dobles la huella deja de ser una línea y pasa a ser un área.

Dos mecanismos, ambos implementados:

- **Arenas predefinidas** (`pokemon_battle_arenas` + `pokemon_battle_arena_slots`): el staff marca ancla, orientación y baldosa de cada rol. Es lo indicado en ciudades y gimnasios, donde el encuadre importa
- **Resolución dinámica** para rutas: busca una línea o área libre con ambos entrenadores a 5 baldosas o menos. Si no la encuentra, **rechaza el reto con motivo** en vez de colocar a nadie en un sitio absurdo

**La caminabilidad se evalúa con el estado real de la baldosa de la sala** (`RoomTileState.OPEN` y altura de pila), no con la presencia de furni. Un césped pisable, una alfombra o un suelo decorativo no bloquean; solo bloquea lo que de verdad impide caminar.

Reglas de ejecución:

1. **Proximidad obligatoria** para retar: misma zona y a 5 baldosas o menos
2. **Bloqueo de posición**: se guarda la posición original, se mueve al jugador a su hueco, se fija la rotación mirando al centro y se le retira el movimiento durante el combate. Al terminar vuelve a su sitio, o al libre más cercano, y se desbloquea
3. **Las baldosas de la arena quedan reservadas** mientras dura el combate, para que un espectador no se plante en medio de la formación

El modelo, el validador y el bloqueo entran en la fase 1; lo visual, en la fase 2.

---

## 9. Protocolo

### 9.1 Paquetes

La firma de `RpgEnginePackets.result()` tiene once parámetros posicionales. Pokémon tendría más de veinticinco. Ese patrón no se copia.

| Paquete | Uso | Formato |
|---|---|---|
| **6400 / 6401** | Estado y UI: equipo, cajas, mochila, dex, tiendas, eventos de turno | JSON en un campo string |
| **6402 / 6403** | Alta frecuencia: posición y dirección del seguidor, y en la fase 2 la animación en sala | Binario compacto |

Razonamiento: el estado de la UI es poco frecuente y muy variado (un equipo de 6 con movimientos son unos 3 KB) y ahí la flexibilidad vale más que los bytes. El seguidor es un paquete por paso de cada jugador de la sala, y ahí JSON sería un desperdicio real.

Lo que se pierde con JSON es la comprobación de tipos en compilación. Se compensa con `pokemon:protocol-dump` y pruebas del cliente que validan sus interfaces TypeScript contra esos ejemplos. El saludo inicial lleva `protocol_version`, para que un cliente cacheado viejo reciba un error claro.

### 9.2 Rangos de acción reservados

| Rango | Familia |
|---|---|
| 1-19 | Sesión, zona y seguidor |
| 20-39 | Equipo y cajas |
| 40-59 | Mochila y objetos |
| 60-99 | Combate |
| 100-119 | Pokédex |
| 120-139 | Tiendas |
| 140-159 | Intercambio |
| 160-179 | Temporada y ranking |

### 9.3 Reproducción de eventos

**El servidor manda los eventos de todo el turno de una vez, y el cliente los reproduce en cola con su propia temporización.** No un paquete por mensaje. La animación fluye sin depender de la latencia, el servidor no espera al ritmo del cliente, y en la fase 2 los `HitFrame` del `AnimData.xml` sincronizan el golpe con el evento de daño que ya venía en la cola.

### 9.4 Push en tiempo real

`PokemonRealtime` empuja: aparición salvaje, eventos del turno del rival, oferta de intercambio, fin de curación, reto recibido, y aviso en sala cuando alguien captura un variocolor.

### 9.5 Registro en el submódulo del renderer

Archivos nuevos en `xampp/htdocs/nitro-react/submodules/renderer/src/nitro/communication/messages/`:

- `outgoing/pokemonengine/PokemonCommandComposer.ts`
- `incoming/pokemonengine/PokemonResultEvent.ts`
- `parser/pokemonengine/PokemonResultParser.ts`
- Y los equivalentes para el par binario 6402/6403

Registro en `IncomingHeader.ts` (6401, 6403), `OutgoingHeader.ts` (6400, 6402) y `NitroMessages.ts`.

---

## 10. Cliente Nitro

`src/api/pokemon/` para adaptador, tipos y hooks; `src/components/pokemon/` para vistas. Siguiendo la convención de `src/api/rpg/engine/`.

| Vista | Contenido |
|---|---|
| `PokemonHudView` | Indicador y acceso; solo existe si la sala tiene zona |
| `PokemonTeamView` | Equipo de 6, reordenable |
| `PokemonBoxView` | 32 cajas × 30, arrastre entre caja y equipo, búsqueda y filtros |
| `PokemonDetailView` | Ficha completa: IVs y EVs con gráfico, naturaleza, habilidad, amistad, pokerus, cintas, 4 movimientos con PP |
| `PokemonBagView` | Mochila por bolsillos |
| `PokemonBattleView` | Reproduce la cola de eventos. Montable en ventana en la fase 1 y en la sala en la fase 2 |
| `PokemonDexView` | Pokédex por región, visto y capturado |
| `PokemonTradeView` | Intercambio con doble confirmación |
| `PokemonCenterView` | Curación |
| `PokemonSeasonView` | Ranking y logros de la temporada |
| `PokemonShopView` | Modelo en la fase 1, interfaz en la fase 2 |

Tres reglas, que son la diferencia con lo que hay hoy:

1. **Un solo estado**: `PokemonStateProvider` con contexto y reducer, alimentado por el adaptador. Desaparecen las variables globales mutables y el `Set` de listeners de `usePokemonSocket.ts`
2. **Cero estilos inline**: SCSS integrado en el sistema del holo (`holo-hobba-classic-v14.scss`)
3. **Cero `any`**: interfaces reales para cada carga del protocolo

---

## 11. Seguridad

- El `userId` sale de la conexión del cliente, **nunca del paquete**. Esto cierra el agujero actual del backend de Node
- Validación por acción: sala con zona activa, propiedad del Pokémon, movimiento presente en sus cuatro huecos, PP disponible, objeto en la mochila, turno correcto
- Límite de acciones en el packet 6400, con corte progresivo
- Enfriamiento entre encuentros y tope de spawns por jugador y hora
- **Toda transacción de pokédólares pasa por `ServicioEconomia` con registro en `pokemon_currency_log`.** Sin eso, el primer fallo de duplicación de dinero es indetectable
- Intercambio con registro inmutable y bloqueo al modificar la oferta después de aceptar
- Obediencia por insignias: un Pokémon intercambiado por encima del tope de insignias desobedece

---

## 12. Errores

Ningún fallo silencioso. Toda respuesta lleva `success` y, si es `false`, un código y un mensaje traducible: `ZONA_NO_ACTIVA`, `NO_ES_TU_TURNO`, `SIN_PP`, `SIN_ESPACIO_ARENA`, `EQUIPO_VACIO`, `FUERA_DE_ALCANCE`, `POKEMON_AJENO`.

Las excepciones no escapan del handler: se capturan, se registran con usuario y acción, y el jugador recibe un error genérico.

Las migraciones son idempotentes al arrancar. **Si una falla, el plugin no se habilita**: es preferible el sistema caído a medio migrar.

---

## 13. Pruebas

`ServicioCombate` es puro, así que se prueba con JUnit sin levantar el emulador:

- Los 324 casos de la tabla de tipos
- Orden de prioridad y de velocidad, incluidos empates
- Fórmula de daño contra valores conocidos de los juegos
- Cada efecto marcado como implementado
- Tope de EV 510 global y 252 por stat, y duplicado por pokerus
- Distribución de capturas
- Dobles y nivel efectivo

El importador se prueba contra ficheros de ejemplo, no contra la API en vivo. El cliente valida sus interfaces contra las salidas de `pokemon:protocol-dump`. Lo que no se puede automatizar — formación, bloqueo de posición, gating — va en una lista de verificación manual en sala.

---

## 14. Hitos de la fase 1

1. Plugin que carga, 6400/6401 de ida y vuelta, migraciones aplicadas
2. Importador y verificador del catálogo. Comprobable: ~1.025 especies, ~937 movimientos, learnsets, informe de efectos sin implementar
3. `ServicioCombate` con su batería de pruebas, todavía sin cliente
4. Entrenador, equipo, cajas, mochila, dex, pokédólares
5. Zonas de Kanto, gating, encuentros, captura, centros, modelo de tiendas
6. Combate de punta a punta en ventana: salvaje y PvP, con formación y bloqueo de posición
7. Cliente nuevo completo. Eliminación de `PokemonBackend/` y `usePokemonSocket.ts`
8. MOs de interfaz (Destello, Vuelo, Surf), intercambio, ranking de temporada, seguidor server-side

---

## 15. Fuera de la fase 1

Render en sala y sprites PMD, seguidor visible, combate en sala, espectadores, cries, interfaz de tiendas, las cinco MOs restantes (Corte, Fuerza, Golpe Roca, Cascada, Buceo), gimnasios e insignias, torneos, crianza y huevos, zona Safari, regiones más allá de Kanto, megas y formas alternativas.

---

## 16. Notas verificadas para la fase 2

Datos comprobados en el repositorio `PMDCollab/SpriteCollab`, carpeta `sprite/0025`:

- **35 animaciones por Pokémon**: Walk, Attack, QuickStrike, Charge, Hurt, Faint, Idle, Sleep, Eat, Hop, Cringe, y más. Muchas más de las necesarias
- **`AnimData.xml` incluye `HitFrame`, `RushFrame` y `ReturnFrame`**: el frame exacto en que el golpe conecta. Sincroniza la animación con el evento de daño del motor sin adivinar tiempos
- **Los variocolores son carpetas de sprite aparte** (`0025/0000` normal, `0025/0001`): no hay que recolorear nada
- **El tamaño de frame varía por animación** (Walk 32×40, Attack 80×80, QuickStrike 120×136): el empaquetador debe leer el XML, no asumir una rejilla fija
- Las 8 direcciones del formato dan tanto la vista de frente para el rival como la de espaldas para el Pokémon propio, con el mismo estilo de arte. Es lo que un combate estático necesita y lo que otras fuentes de sprites no ofrecen

Pendiente de decidir en la fase 2: si las entidades en sala se sirven como assets `.nitro` convertidos o como una capa de render propia que lea las hojas PNG en tiempo de ejecución.
