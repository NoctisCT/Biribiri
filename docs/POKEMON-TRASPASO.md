# PokemonEngine — Estado, hallazgos y trabajo pendiente

Última actualización: 18 de septiembre de 2026
Rama: `codex/pokemon-engine` · Worktree: `build/pokemon-engine` · Base: `dev`

**Este documento es el punto de entrada.** Está escrito para que alguien sin contexto de la conversación pueda continuar. Lo que no esté aquí, está en los documentos que enlaza.

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

`node_modules/@nitrots/nitro-renderer` está declarado como `file:submodules/renderer` pero en disco es una **copia de directorio** (verificado: `LinkType` vacío). Vite resuelve desde `node_modules`, así que **todo cambio en `submodules/renderer` hay que replicarlo a mano**. Verificar con `diff -r --strip-trailing-cr` (sin ese flag, los finales de línea marcan todo como distinto).

### 3.3 Registrar el composer, no solo el evento

En `NitroMessages.ts` hay dos registros: `_events.set(...)` para lo entrante y `_composers.set(...)` para lo saliente. Registrar solo el evento hace que **el cliente nunca envíe el paquete** y el fallo es silencioso.

### 3.4 Los packet ids se comprueban en el bytecode

Asignar el 5060 rompió Cinema: Arcturus rechaza el segundo registro del mismo id con `Header already registered` y el plugin que pierde la carrera se queda roto con una sola línea en el log. **La mayoría de plugins en ejecución no tienen su código en el repositorio**, así que la única lista fiable sale de desensamblar los JAR. Método en `docs/REGISTRO-PACKET-IDS.md`.

PokemonEngine tiene reservado **6400-6419**. En uso: 6400 (cliente→servidor) y 6401 (servidor→cliente).

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

### 4.5 Otros datos verificados

- PokéAPI devuelve **19 tipos**, no 18: incluye `stellar` (Astral, el Teracristal de gen 9). La tabla de efectividades son **361 combinaciones**, no 324
- **Agarre** (`vice-grip`) se perdía por grafía: PokéAPI usa la antigua, Showdown `visegrip`. Es un movimiento legítimo de Kanto (Krabby, Kingler, Pinsir). Corregido con `MapeadorMovimiento::ALIAS_SHOWDOWN`
- Los **54 movimientos sin correspondencia en Showdown** son todos movimientos Z (36), Oscuros de XD/Colosseum (18) y Maxi. `pokemon:verify-catalog` los separa del ruido y falla si aparece alguno legítimo

---

## 5. Estado actual: 4 de 8 hitos, 29 commits, 225 pruebas

### Hecho y verificado

| Hito | Contenido | Verificación |
|---|---|---|
| **1** | Plugin que carga, migraciones idempotentes, packets 6400/6401, adaptador de cliente | Saludo de punta a punta en el runtime aislado: devuelve el `userId` del usuario conectado, que el cliente nunca envía |
| **2** | Importador y verificador del catálogo | 1.025 especies, 937 movimientos, 133.067 learnsets, 576 evoluciones, 374 habilidades, 19 tipos, 361 combinaciones. `verify-catalog` → coherente |
| **3a** | Cálculo de stats, tabla de tipos, fórmula de daño, catálogo en memoria | 36 pruebas. Cero SQL en camino de combate |
| **3b** | Modelo de estado en 3 niveles, orden del turno, impedimentos, ejecución de movimientos, fin de turno, `ServicioCombate` | 101 pruebas. Misma semilla reproduce el combate evento por evento |
| **3c** | Mecánica real conectada, 12 condiciones de bando, 4 climas, 4 terrenos, volátiles | 138 pruebas |
| **4** | Entrenador, equipo, 32 cajas, mochila, pokédex, pokédólares y **el seguidor server-side**, adelantado del hito 8 | 225 pruebas. Migración 4 aplicada en el runtime aislado; 1.025 especies con habilidades y género y 36.336 aprendizajes por nivel en memoria |

**Invariante comprobada en cada commit**: ninguna clase de `combate/`, `entrenador/` ni `seguidor/` importa `com.eu.habbo`. Es lo que permite probar las reglas sin emulador y reutilizarlas en la fase 2. La única excepción deliberada es `DireccionTest`, que sí importa `Rotation` de Arcturus **a propósito**, para comprobar que las ocho direcciones del seguidor coinciden con las del emulador.

### Pendiente

| Hito | Contenido | Tamaño |
|---|---|---|
| **5** | Zonas de Kanto, gating por `pokemon_zone_rooms`, encuentros y spawns, captura con fórmula real, centros Pokémon, modelo de tiendas | Medio |
| **6** | Combate de punta a punta: salvaje y PvP, formación, `ServicioArena` con arenas predefinidas y resolución dinámica, bloqueo de posición, reserva de baldosas | Grande |
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
4. **Objetos**: `pokemon_items` existe desde la migración 4 pero **está vacía**. El importador es trabajo del hito 5. Hasta entonces la mochila funciona pero no hay nada que meter en ella
5. **El seguidor se ve, pero como una calcomanía encima de la sala.** Los sprites PMD de Pikachu (0025) están descargados y el seguidor camina, gira y cambia de animación en el cliente de pruebas. Lo que **no** tiene es profundidad: se dibuja en una capa de HTML sobre el lienzo, así que pasa por delante del furni y de los avatares aunque esté detrás.

   No hay atajo. `RoomSpriteCanvas` reconstruye su lista de sprites **en cada fotograma** a partir de los objetos de sala y la ordena por `z` (`_sortableSprites.sort((a, b) => (b.z - a.z))`), así que cualquier cosa inyectada a mano en el contenedor se borra o se reordena sola. Para que el Pokémon se ordene con los demás tiene que **ser un objeto de sala**: tipo propio, `RoomObjectVisualization`, `RoomObjectLogic` y alta en `RoomObjectVisualizationFactory` y `RoomObjectLogicFactory`, que viven en el submódulo del renderer. Eso es exactamente la capa de render de la fase 2
6. **`HotelNight.tsx` tiene un error de sintaxis heredado** (`<div .../><` partido en dos líneas, línea 32) que rompe cualquier `tsc` y cualquier build del cliente. No es de Pokémon y no se ha tocado: viene del commit de importación `35147830b`
7. **El `.gitignore` impide compilar Nitro desde un clon limpio** (§3.6)

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

## 8. Reglas de trabajo que conviene mantener

1. **Probar las probabilidades con miles de tiradas, no con una.** Las pruebas de parálisis (25%), descongelar (20%) y enamorado (50%) usan 2.000 iteraciones; una sola tirada no detecta una probabilidad invertida
2. **El desempate de velocidad usa el RNG**, no el orden de llegada, y hay una prueba que comprueba que no está sesgado a un bando en 40 semillas
3. **Nada de acentos en identificadores Java.** Da problemas de codificación
4. **El motor no escribe texto**: emite eventos con datos y el cliente traduce
5. **Truncado entero en cada paso** de las fórmulas, como en los juegos. Calcular en coma flotante de una pasada da valores distintos
