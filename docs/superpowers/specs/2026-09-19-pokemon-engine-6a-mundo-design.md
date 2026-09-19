# Hito 6a — El mundo se mueve

Fecha: 19 de septiembre de 2026
Rama: `codex/pokemon-engine` · Base: `dev`
Estado: diseño aprobado, pendiente de plan

**Contexto obligatorio antes de tocar nada:** `docs/POKEMON-TRASPASO.md`, sobre todo la sección 3 (restricciones del entorno). La spec de la fase 1 es `docs/superpowers/specs/2026-09-18-pokemon-engine-fase1-design.md` y lo que aquí se decide la amplía, no la contradice.

---

## 1. Qué resuelve

Al terminar el hito 5, un Pokémon salvaje aparecía porque el cliente pedía uno. Eso no es un juego: es un botón.

Este hito hace que el mundo tenga iniciativa propia. Pisas hierba alta en una sala Pokémon y **puede** salirte algo, según la zona, la hora y el clima que haga en ese momento. El encuentro sigue terminando en el flujo de captura que ya funciona; el combate por turnos es el hito 6b.

**Criterio de terminado:** un jugador que no conoce el sistema entra en la Ruta 1, camina por la hierba, y al cabo de unos pasos le salta un Rattata sin haber pulsado nada. Si es de noche y llueve, le pueden saltar cosas que de día no salen.

---

## 2. Alcance

Entra:

- Disparador de encuentros por furni, con doble llave de sala Pokémon
- Probabilidad por paso, por zona y método, con enfriamiento y silenciado
- Clima por zona, sorteado en ciclos, persistido y anunciado
- Franja horaria clavada a `Europe/Madrid`
- Condición de clima en la tabla de encuentros, junto a la de franja
- Cimientos de datos que son baratos ahora y caros después (§8)

No entra, y es el hito 6b:

- Turnos, movimientos y daño contra un salvaje
- Huida, bloqueo de posición, arena y reserva de baldosas
- Abandono, reconexión y anulación por expulsión
- La captura como acción **dentro** del combate

---

## 3. Disparador

### 3.1 La regla

Un encuentro se tira cuando se cumplen las tres cosas a la vez:

1. La sala tiene fila en `pokemon_zone_rooms` — la misma llave que decide si el seguidor puede existir
2. La baldosa a la que el jugador acaba de llegar tiene un furni dado de alta como disparador
3. La tirada de probabilidad sale

La doble llave es deliberada: un jardín con hierba alta en una sala de decoración no saca Pokémon. El furni no es la autoridad, es la señal; la autoridad es la zona.

### 3.2 Dónde se engancha

`UserTakeStepEvent`, el mismo evento que ya mueve al seguidor. Se evalúa la **baldosa de destino**, no la de salida.

`ServicioSeguidor` ya vive en ese evento, así que el orden importa: primero el paso del seguidor, después la tirada de encuentro. Si un día la tirada bloquea al jugador (hito 6b), el seguidor ya habrá llegado a su sitio.

### 3.3 Tabla de furnis disparadores

`pokemon_encounter_furni`

| Columna | Tipo | Nota |
|---|---|---|
| `sprite_id` | INT, PK | El `items_base.sprite_id` del furni |
| `metodo` | VARCHAR(16) | `HIERBA`, `CUEVA`, `SURF`, `PESCA` |
| `activo` | TINYINT(1) | Apagar un furni sin borrar la fila |
| `nota` | VARCHAR(80) NULL | Para el staff: de qué furni se trata |

Se carga en memoria al arrancar, junto al resto de catálogos. Cambiarla requiere reinicio, igual que las zonas; es una tabla de configuración que toca el staff, no un dato caliente.

Siembra inicial: el furni de hierba alta que el hotel ya tiene, como `HIERBA`. Los de cueva y agua se dan de alta cuando existan.

### 3.4 Qué furni hay en una baldosa

Se pregunta a la sala por los objetos de esa baldosa y se mira el `sprite_id` de su `items_base`. **No se mira si el furni es caminable**: si el jugador ha llegado a la baldosa, por definición podía pisarla.

---

## 4. Probabilidad, enfriamiento y silenciado

### 4.1 Probabilidad por paso

`pokemon_zone_encounter_rates`

| Columna | Tipo | Nota |
|---|---|---|
| `zone_id` | INT, PK con `metodo` | |
| `metodo` | VARCHAR(16), PK con `zone_id` | |
| `por_mil` | SMALLINT | Probabilidad por paso, en milésimas |

En milésimas y no en porcentaje para poder afinar por debajo del 1% sin decimales. Una ruta normal ronda 120 (12%); una cueva con un legendario, 5.

Sin fila para esa zona y método, **no hay encuentros**. El silencio es el valor por defecto: una zona nueva no empieza a escupir Pokémon por olvidarse de configurarla.

### 4.2 Enfriamiento

Tras un encuentro, ese jugador no vuelve a tirar durante un número de pasos y de segundos, los dos a la vez. Vive en memoria, por jugador, y se limpia al desconectar.

Sin esto, tres encuentros en cinco baldosas son perfectamente posibles y el juego se vuelve insoportable.

### 4.3 Silenciado

Un contador de pasos por jugador durante los cuales no se tira nada. Es el enganche del Repelente.

**En este hito el contador existe y se respeta, pero nada lo rellena**: los objetos no tienen efecto todavía. Cuando lo tengan, usar un Repelente será llamar a `silenciar(userId, pasos)`.

### 4.4 Lo puro

`TiradaEncuentro` decide, sin base de datos ni emulador: recibe la probabilidad, el estado de enfriamiento y silenciado y el RNG, y responde si toca encuentro. Se prueba con 10.000 tiradas, como la tabla de encuentros y la fórmula de captura.

---

## 5. Clima

### 5.1 Por qué zona por zona

Sorteando el clima de la región entera, llueve en las cuarenta y cinco rutas a la vez y deja de ser un detalle para ser un interruptor global. Zona por zona, con el despejado muy cargado, en cualquier momento hay dos o tres sitios con lluvia y el resto al sol.

### 5.2 Tablas

`pokemon_zone_weather` — los pesos

| Columna | Tipo | Nota |
|---|---|---|
| `zone_id` | INT, PK con `clima` | |
| `clima` | VARCHAR(16), PK con `zone_id` | `DESPEJADO`, `LLUVIA`, `SOL`, `TORMENTA_ARENA`, `NIEVE`, `GRANIZO` |
| `peso` | SMALLINT | Relativo a las demás filas de la zona |

`pokemon_zone_weather_state` — lo que hace ahora

| Columna | Tipo | Nota |
|---|---|---|
| `zone_id` | INT, PK | |
| `clima` | VARCHAR(16) | |
| `desde` | TIMESTAMP | |
| `hasta` | TIMESTAMP | Cuándo toca volver a sortear |

El estado se guarda porque un reinicio del emulador no debe cambiar el tiempo. Si el emulador estuvo caído más de una ventana, al arrancar se sortea de nuevo en vez de arrastrar un clima viejo.

Una zona sin filas de peso está **siempre despejada**. Las cuevas y los interiores se resuelven así, sin código especial.

### 5.3 Ciclo

Cada 4 horas por zona. El reloj lo lleva el propio estado: un latido de un minuto mira qué zonas tienen la ventana vencida, las sortea y avisa. No hace falta un planificador ni que los ciclos de todas las zonas estén alineados.

Siembra para la Ruta 1: despejado 70, lluvia 20, sol 8, tormenta de arena 2. Ciudad Verde y Pueblo Paleta, despejado 100 por ahora.

### 5.4 Qué hace el clima

Dos cosas, y la segunda es gratis:

1. **Filtra encuentros.** `pokemon_zone_encounters` gana una columna `clima VARCHAR(16) NULL`, hermana de la `franja` que ya tiene. `NULL` significa "con cualquier tiempo". Un Pokémon de lluvia es una fila con `clima = 'LLUVIA'`, sin código nuevo.
2. **Arranca el combate con ese clima puesto** — hito 6b. El motor tiene los climas implementados y esto es pasar un parámetro, no escribir mecánica.

**Granizo y nieve son dos climas, no dos nombres del mismo.** El granizo de las generaciones 2 a 8 (`hail`) hace 1/16 de daño por turno a quien no sea de tipo Hielo; la nieve de la novena (`snowscape`) no hace daño y les sube la Defensa un 50%. El motor tenía solo la nieve; el granizo se añadió al implementar este hito, con su prueba en `FinDeTurnoTest`.

El nombre que ve el jugador vive en el enum `Clima`, no en la tabla: es global por clima y duplicarlo por zona solo daría ocasión de que se desincronizara.

### 5.5 Aviso

Al entrar en una sala Pokémon, el clima viaja en la respuesta de `ZONA_INFO`, que ya devuelve la franja.

Al cambiar el clima de una zona, el servidor empuja un `ZONA_INFO` no solicitado a quien esté en salas de esa zona. El cliente de la fase 1 lo registra en consola; la interfaz llega en el hito 7 y **el efecto visual en la sala, en la fase 2**, que necesita la capa de render.

### 5.6 Lo puro

`RuletaClima`: pesos dentro, clima fuera, con RNG sembrado. Misma semilla, misma secuencia. Se prueba igual que la tabla de encuentros: proporciones sobre 10.000 tiradas, lista vacía sin reventar, pesos a cero que nunca salen.

---

## 6. Franja horaria

`Franja.deHora` sigue siendo pura y recibiendo una hora. Lo que cambia es quién se la da: `ZonedDateTime.now(ZoneId.of("Europe/Madrid"))` en vez de la hora de la máquina.

Hoy son la misma, pero clavarla evita que mudar el hotel de servidor mueva el ciclo día/noche sin que nadie lo toque.

---

## 7. Protocolo

Sin packets nuevos: todo va por el 6400/6401 que ya existe.

| Acción | Cambio |
|---|---|
| `ZONA_INFO` (7) | La respuesta gana `clima`, `climaHasta` y los métodos disponibles en la zona |
| `ENCUENTRO_BUSCAR` (60) | **Deja de ser la vía normal.** El servidor lo empuja sin que nadie lo pida cuando salta la tirada al pisar. Invocarlo a mano queda restringido a **rango 7**, como herramienta de prueba |
| `ZONA_INFO` empujado | Al cambiar el clima, a quien esté en la zona |

El empujón reutiliza el formato de respuesta que el cliente ya sabe leer: `{action, success, payload}`. No hace falta tocar el adaptador del cliente.

**Restringir el 60 importa.** Mientras se pueda pedir un encuentro a voluntad, la hierba es decorativa y el enfriamiento no significa nada.

Rango 7 y no 6 a propósito: los co-administradores son jugadores como los demás y deben poder jugar sin tener a mano un botón que les saque el Pokémon que quieran.

---

## 8. Cimientos que no pueden esperar

Nada de esto es del mundo, pero todo es barato ahora y caro cuando haya miles de capturas que migrar. Van en la misma migración.

### 8.1 Especies

| Columna | Origen | Para qué |
|---|---|---|
| `descripcion_es` | `flavor_text_entries` en español | La ficha de la Pokédex |
| `categoria_es` | `genera` en español: «Pokémon Ratón» | La ficha de la Pokédex |
| `numero_regional` | `pokedex_numbers`, entrada `kanto` | Hoy coincide con el nacional porque Kanto es 1-151; en Johto dejaría de coincidir |
| `cry_url` | `cries.latest` | Los cries de la fase 2 |
| `escala_visual` | Manual, `NULL` por defecto | Anula la escala derivada de la altura |

Lo rellena una pasada más del importador, que es idempotente.

### 8.2 Los cuatro tamaños de sprite

No se etiquetan 1.025 especies a mano: el tamaño sale de `altura`, que ya está importada.

| Tamaño | Altura | Ejemplo |
|---|---|---|
| Pequeño | menos de 0,35 m | Pichu, 0,3 |
| Mediano | menos de 0,80 m | Pikachu, 0,4 |
| Grande | menos de 1,50 m | Lucario, 1,2 |
| Muy grande | 1,50 m o más | Snorlax, 2,1 |

`escala_visual` manda cuando está rellena, para los casos en que la altura miente — Onix mide 8,8 m y no puede ocupar media sala.

El consumidor es el cargador de sprites del cliente; aquí solo se decide el dato y de dónde sale.

### 8.3 Pokémon poseído

| Columna | Por defecto | Para qué |
|---|---|---|
| `variante` | `normal` | Disfraces de evento: Pikachu disfrazado, Mewtwo oscuro. PMD los sirve en carpetas aparte, igual que los variocolores |
| `intercambiable` | 1 | Los iniciales y los premios de evento nacen a 0 |

**El variocolor no se toca.** `es_shiny` se queda como está: es un estado del juego, cuenta para la Pokédex y tiene valor. `variante` es solo la piel. El sprite se resuelve con especie, variante y variocolor.

Al ser columnas separadas, **se pueden dar a la vez**: un Pikachu disfrazado que además salga variocolor es un caso válido, no una contradicción. Si PMD tiene la carpeta variocolor de ese disfraz, se usa; si no la tiene, se cae al disfraz normal antes que a perder el disfraz, porque el disfraz es lo que el jugador ve y presume. El orden de búsqueda queda escrito en el cargador de sprites de la fase 2: disfraz variocolor → disfraz normal → especie variocolor → especie normal.

### 8.4 Tiempo jugado

`pokemon_trainers.jugado_segundos` existe desde la migración 4, se lee y se envía al cliente, pero **nada lo escribía**: estaba a cero para todo el mundo.

Se empieza a contar **tiempo en salas Pokémon**, no tiempo de hotel: se acumula al salir de sala y al desconectar, con un tope por sesión para que una conexión caída no regale ocho horas. Contar el hotel entero premiaría a quien deja el navegador abierto en la plaza.

Arcturus no guarda un acumulado propio — en `users` solo hay `last_login`, `last_online` y `online` — así que esto hay que llevarlo nosotros de todas formas.

**Es un dato de vitrina, no una llave.** Se muestra en la ficha del entrenador, junto a las capturas y las insignias, y no decide nada: ni intercambios, ni recompensas, ni acceso. Se farmea dejando el avatar quieto, así que cualquier cosa que dependiera de él sería regalarla.

### 8.5 Llaves del intercambio

El intercambio es el hito 8; aquí solo quedan puestas las llaves.

Son **dos, y las dos cuentan**: capturas distintas en la Pokédex e insignias.

| Llave | Valor de salida | Nota |
|---|---|---|
| `intercambio.dex_capturados_minimos` | Encendida | Exige pisar hierba y gastar balls. Es lo que un multicuenta no puede farmear dormido |
| `intercambio.insignias_minimas` | 0 hasta la fase 3 | **Los gimnasios son fase 3.** Se sube en cuanto existan; hasta entonces la llave está puesta pero no pide nada |

El tiempo jugado **no es una llave**: es un dato que se muestra en la ficha del entrenador y nada más. Un contador de tiempo se farmea dejando el avatar quieto toda la noche, así que no sirve para decidir quién puede intercambiar.

La llave que de verdad corta el negocio de los eventos no es ninguna de las dos, sino `intercambiable` en el propio Pokémon: si el Jolteon del aniversario nace intransferible, reclamarlo con diez cuentas no sirve de nada.

---

## 9. Datos nuevos, de un vistazo

Migración **M007**:

- `pokemon_encounter_furni` — nueva
- `pokemon_zone_encounter_rates` — nueva
- `pokemon_zone_weather` — nueva
- `pokemon_zone_weather_state` — nueva
- `pokemon_zone_encounters` — columna `clima`
- `pokemon_species` — columnas `descripcion_es`, `categoria_es`, `numero_regional`, `cry_url`, `escala_visual`
- `pokemon_owned` — columnas `variante`, `intercambiable`

Idempotente como las seis anteriores: `CREATE TABLE IF NOT EXISTS`, columnas añadidas solo si faltan, siembras con `INSERT IGNORE` o `NOT EXISTS`.

---

## 10. Clases

| Clase | Paquete | Depende del emulador |
|---|---|---|
| `TiradaEncuentro` | `encuentros/` | No |
| `RuletaClima` | `clima/` | No |
| `Clima` | `clima/` | No |
| `ServicioClima` | raíz | Sí: base de datos y latido |
| `ServicioEncuentros` | raíz | Ya existe; gana la tirada al pisar y el enfriamiento |
| `ServicioTiempoJugado` | raíz | Sí: entrar y salir de sala |
| `DisparadorEncuentros` | raíz | Sí: `UserTakeStepEvent` y consulta del furni |

La regla de siempre: `combate/`, `entrenador/`, `seguidor/`, `encuentros/`, `captura/`, `tienda/` y el nuevo `clima/` **no importan `com.eu.habbo`**, y el grep lo comprueba en cada commit.

---

## 11. Pruebas

Automáticas, sin emulador:

- `TiradaEncuentroTest`: la probabilidad sale dentro de margen en 10.000 pasos; el enfriamiento bloquea por pasos y por segundos; el silenciado gana al enfriamiento; probabilidad cero no dispara nunca; misma semilla, misma secuencia
- `RuletaClimaTest`: proporciones dentro de margen, lista vacía sin reventar, pesos a cero que no salen, misma semilla misma secuencia
- `FranjaTest`: ya existe; se amplía con el cambio de horario de `Europe/Madrid`
- PHPUnit del importador: descripción, categoría y número regional de una especie de ejemplo; especie sin traducción al español que cae al nombre inglés

A mano, en el runtime aislado, porque no se puede automatizar:

1. Entrar en la sala 203 y caminar por la hierba hasta que salte un encuentro sin pulsar nada
2. Caminar por una baldosa sin hierba: no salta nunca
3. Poner el mismo furni en una sala sin zona: no salta nunca
4. Encadenar encuentros: el segundo no salta hasta pasar el enfriamiento
5. Forzar un clima desde base de datos y comprobar que el aviso llega y que un encuentro condicionado a ese clima empieza a salir
6. Reiniciar el emulador y comprobar que el clima sobrevive
7. Pedir el 60 a mano con una cuenta sin rango: rechazado

---

## 12. Riesgos

**El furni disparador dependía de la API de sala de Arcturus, y ya está verificado** contra el JAR de este hotel: `Room.getItemsAt(int, int)` devuelve los objetos de la baldosa, `HabboItem.getBaseItem()` da el `Item` y de ahí salen `getSpriteId()` y `getName()`. `UserTakeStepEvent` trae `fromLocation` y `toLocation` como `RoomTile`, con `x` e `y` públicos. El riesgo queda cerrado.

**El evento de paso es camino caliente.** Se dispara en cada paso de cada jugador de cada sala del hotel. La primera comprobación tiene que ser la más barata: si la sala no tiene zona, salir. El catálogo de furnis va en memoria, no en una consulta por paso.

**El latido del clima no puede acumularse.** Si una ventana venció mientras el emulador estaba caído, se sortea una vez y se abre ventana nueva; no se compensan las que faltan.
