# PokemonEngine — Hito 1: cimientos del plugin

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un plugin Java que carga en Arcturus, aplica migraciones idempotentes y responde a un saludo del cliente Nitro por los paquetes 6400/6401, con el `userId` tomado de la conexión.

**Architecture:** Plugin independiente `com.retro.pokemonengine` siguiendo el patrón de `Desarrollo/RPGEngine`: `HabboPlugin` que registra un `MessageHandler` único en `EmulatorLoadedEvent`, capa de datos con runner de migraciones numeradas, y cuerpo de respuesta en JSON en lugar de los once parámetros posicionales de `RpgEnginePackets.result()`. El cliente registra composer, evento y parser en el submódulo local del renderer.

**Tech Stack:** Java 16, Maven 3.9.16, Arcturus Morningstar 3.6.1 (`com.eu.habbo:Habbo:3.6.0`, scope `provided`), Gson 2.10.1 (sombreado y reubicado), JUnit 5.10.2, MariaDB, TypeScript / Nitro React.

## Global Constraints

- Paquete Java raíz: `com.retro.pokemonengine`
- `maven.compiler.release` = **16**
- Packet cliente→servidor: **6400**. Packet servidor→cliente: **6401**. Bloque reservado 6400-6419 (ver `docs/REGISTRO-PACKET-IDS.md`)
- Versión de protocolo inicial: **1**
- Prefijo de tablas: `pokemon_`
- **El `userId` se obtiene siempre de `this.client.getHabbo().getHabboInfo().getId()`, nunca del paquete**
- Motor de tablas: `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
- Maven: `C:\Users\erale\Downloads\apache-maven-3.9.16-bin\apache-maven-3.9.16\bin\mvn.cmd`
- Build del cliente: `yarn build` desde `xampp/htdocs/nitro-react`
- **Prohibido ejecutar `yarn install`**: rompió Subastas, Arcade y otros sistemas la última vez. `node_modules/@nitrots/nitro-renderer` es una copia física, no un enlace, así que todo cambio en `submodules/renderer` debe replicarse a mano en `node_modules` (ver tarea 5, paso 7)
- Todo el trabajo ocurre en el worktree `build/pokemon-engine`, rama `codex/pokemon-engine`

## Preparación del worktree para compilar el cliente

Dos archivos necesarios para el build **no están en git** y hay que copiarlos desde la copia principal:

1. **`node_modules`** (341 MB). Copiar con robocopy, nunca instalar:
   ```bash
   robocopy "C:\Users\erale\Desktop\Habbo\xampp\htdocs\nitro-react\node_modules" "C:\Users\erale\Desktop\Habbo\build\pokemon-engine\xampp\htdocs\nitro-react\node_modules" /E /NFL /NDL /NJH /NJS /MT:16
   ```
2. **`src/assets/styles/bootstrap/vendor/_rfs.scss`**. La regla `**/vendor/` del `.gitignore` (línea 12), pensada para Composer, también excluye esta hoja SCSS, que es código fuente del cliente. Sin ella el build muere con `Can't find stylesheet to import: vendor/rfs`.
   ```bash
   cp -r "xampp/htdocs/nitro-react/src/assets/styles/bootstrap/vendor" "build/pokemon-engine/xampp/htdocs/nitro-react/src/assets/styles/bootstrap/"
   ```

**Defecto pendiente del repositorio**: por ese `.gitignore`, un clon limpio no puede compilar el cliente. Se arregla con una excepción (`!xampp/htdocs/nitro-react/src/assets/styles/bootstrap/vendor/`) y añadiendo el archivo al repositorio. Queda fuera del alcance de este hito.

**Nota sobre `diff -r`**: al comparar `submodules/renderer` con `node_modules`, `diff -r` marca todos los archivos como distintos por el final de línea (CRLF en el checkout, LF en `node_modules`). Usar siempre `diff -r --strip-trailing-cr` para ver diferencias reales.

## Aviso de despliegue (leer antes de la tarea 6)

Las tareas 1 a 5 no tocan nada en ejecución: compilan y prueban dentro del worktree.

La tarea 6 sí necesita un cliente compilado. **El `dist` compilado en este worktree no debe copiarse sobre `xampp/htdocs/public/dist` de la copia principal** mientras haya trabajo paralelo en `dev`: lo machacaría. El JAR del plugin sí puede copiarse a `Emulator/plugins` de la copia principal, porque es aditivo y no altera ningún plugin existente.

Antes de ejecutar la tarea 6 hay que acordar con el propietario cómo se sirve el cliente de prueba. Hasta entonces, las tareas 1-5 son ejecutables sin coordinación.

---

## Estructura de archivos

**Plugin** — `Desarrollo/PokemonEngine/`

| Archivo | Responsabilidad |
|---|---|
| `pom.xml` | Build Maven, dependencias, sombreado de Gson, surefire |
| `src/main/resources/plugin.json` | Manifiesto que Arcturus lee para encontrar la clase principal |
| `src/main/java/com/retro/pokemonengine/PokemonEnginePlugin.java` | Ciclo de vida: registra eventos, arranca migraciones, registra el handler 6400 |
| `src/main/java/com/retro/pokemonengine/BaseDatosPokemon.java` | Runner de migraciones contra la conexión del emulador |
| `src/main/java/com/retro/pokemonengine/migraciones/Migracion.java` | Interfaz de una migración numerada |
| `src/main/java/com/retro/pokemonengine/migraciones/PlanMigracion.java` | Lógica pura: qué migraciones faltan por aplicar |
| `src/main/java/com/retro/pokemonengine/migraciones/M001Base.java` | Primera migración: tabla de versión de esquema |
| `src/main/java/com/retro/pokemonengine/PokemonCuerpo.java` | Serialización JSON del cuerpo de respuesta. Pura |
| `src/main/java/com/retro/pokemonengine/PokemonAcciones.java` | Constantes de acción del protocolo |
| `src/main/java/com/retro/pokemonengine/PokemonPackets.java` | Construcción del `ServerMessage` 6401 |
| `src/main/java/com/retro/pokemonengine/handlers/PokemonCommandHandler.java` | Punto de entrada del 6400: lee la acción y despacha |
| `src/test/java/com/retro/pokemonengine/migraciones/PlanMigracionTest.java` | Pruebas del plan de migración |
| `src/test/java/com/retro/pokemonengine/PokemonCuerpoTest.java` | Pruebas del cuerpo JSON |

**Renderer** — `xampp/htdocs/nitro-react/submodules/renderer/src/nitro/communication/`

| Archivo | Responsabilidad |
|---|---|
| `messages/outgoing/pokemonengine/PokemonCommandComposer.ts` | Composer del 6400 |
| `messages/outgoing/pokemonengine/index.ts` | Reexport |
| `messages/parser/pokemonengine/PokemonResultParser.ts` | Parser del 6401 |
| `messages/parser/pokemonengine/index.ts` | Reexport |
| `messages/incoming/pokemonengine/PokemonResultEvent.ts` | Evento del 6401 |
| `messages/incoming/pokemonengine/index.ts` | Reexport |

**Cliente** — `xampp/htdocs/nitro-react/src/api/pokemon/`

| Archivo | Responsabilidad |
|---|---|
| `PokemonEngineAdapter.ts` | Envío de acciones, escucha de resultados, API de depuración |
| `index.ts` | Reexport |

---

### Task 1: Proyecto Maven y plugin que carga

**Files:**
- Create: `Desarrollo/PokemonEngine/pom.xml`
- Create: `Desarrollo/PokemonEngine/src/main/resources/plugin.json`
- Create: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/PokemonEnginePlugin.java`

**Interfaces:**
- Consumes: nada
- Produces: clase `com.retro.pokemonengine.PokemonEnginePlugin`, artefacto `pokemon-engine-1.0.0.jar`

- [ ] **Step 1: Crear el `pom.xml`**

Gson se sombrea y se reubica a propósito: así el plugin no depende de que Arcturus exponga su propia copia en el classloader de plugins.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">

    <modelVersion>4.0.0</modelVersion>

    <groupId>com.retro</groupId>
    <artifactId>pokemon-engine</artifactId>
    <version>1.0.0</version>

    <properties>
        <maven.compiler.release>16</maven.compiler.release>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    </properties>

    <dependencies>
        <dependency>
            <groupId>com.eu.habbo</groupId>
            <artifactId>Habbo</artifactId>
            <version>3.6.0</version>
            <scope>provided</scope>
        </dependency>

        <dependency>
            <groupId>com.google.code.gson</groupId>
            <artifactId>gson</artifactId>
            <version>2.10.1</version>
        </dependency>

        <dependency>
            <groupId>org.junit.jupiter</groupId>
            <artifactId>junit-jupiter</artifactId>
            <version>5.10.2</version>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-surefire-plugin</artifactId>
                <version>3.2.5</version>
            </plugin>

            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-shade-plugin</artifactId>
                <version>3.5.2</version>
                <executions>
                    <execution>
                        <phase>package</phase>
                        <goals>
                            <goal>shade</goal>
                        </goals>
                        <configuration>
                            <createDependencyReducedPom>false</createDependencyReducedPom>
                            <relocations>
                                <relocation>
                                    <pattern>com.google.gson</pattern>
                                    <shadedPattern>com.retro.pokemonengine.shaded.gson</shadedPattern>
                                </relocation>
                            </relocations>
                        </configuration>
                    </execution>
                </executions>
            </plugin>
        </plugins>
    </build>

</project>
```

- [ ] **Step 2: Crear el manifiesto `plugin.json`**

```json
{
  "main": "com.retro.pokemonengine.PokemonEnginePlugin",
  "name": "PokemonEngine",
  "author": "Retro"
}
```

- [ ] **Step 3: Crear la clase del plugin**

En este paso el plugin solo carga y avisa. Las migraciones y el handler llegan en las tareas 2 y 4.

```java
package com.retro.pokemonengine;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.plugin.EventHandler;
import com.eu.habbo.plugin.EventListener;
import com.eu.habbo.plugin.HabboPlugin;
import com.eu.habbo.plugin.events.emulator.EmulatorLoadedEvent;

public class PokemonEnginePlugin extends HabboPlugin implements EventListener
{
    public static final int PACKET_POKEMON_COMMAND = 6400;
    public static final int VERSION_PROTOCOLO = 1;

    @Override
    public void onEnable()
    {
        Emulator.getPluginManager().registerEvents(this, this);
    }

    @EventHandler
    public void onEmulatorLoaded(EmulatorLoadedEvent event) throws Exception
    {
        System.out.println("[PokemonEngine] Cargado. Protocolo v" + VERSION_PROTOCOLO + ".");
    }

    @Override
    public void onDisable()
    {
    }

    @Override
    public boolean hasPermission(Habbo habbo, String permission)
    {
        return false;
    }
}
```

- [ ] **Step 4: Compilar**

Run:
```bash
"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -f "Desarrollo/PokemonEngine/pom.xml" clean package
```
Expected: `BUILD SUCCESS` y el fichero `Desarrollo/PokemonEngine/target/pokemon-engine-1.0.0.jar`.

- [ ] **Step 5: Comprobar que el JAR lleva el manifiesto y no lleva Gson sin reubicar**

Run:
```bash
unzip -l "Desarrollo/PokemonEngine/target/pokemon-engine-1.0.0.jar" | grep -E "plugin.json|gson" | head -10
```
Expected: aparece `plugin.json`; las clases de Gson aparecen bajo `com/retro/pokemonengine/shaded/gson/`, y **no** bajo `com/google/gson/`.

- [ ] **Step 6: Commit**

```bash
git add Desarrollo/PokemonEngine/pom.xml Desarrollo/PokemonEngine/src/main/resources/plugin.json Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/PokemonEnginePlugin.java
git commit -m "feat(pokemon): scaffold PokemonEngine maven plugin"
```

---

### Task 2: Runner de migraciones idempotente

**Files:**
- Create: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/migraciones/Migracion.java`
- Create: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/migraciones/PlanMigracion.java`
- Create: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/migraciones/M001Base.java`
- Create: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/BaseDatosPokemon.java`
- Test: `Desarrollo/PokemonEngine/src/test/java/com/retro/pokemonengine/migraciones/PlanMigracionTest.java`
- Modify: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/PokemonEnginePlugin.java`

**Interfaces:**
- Consumes: `PokemonEnginePlugin` de la tarea 1
- Produces:
  - `interface Migracion { int version(); String nombre(); void aplicar(Connection conexion) throws Exception; }`
  - `static List<Migracion> PlanMigracion.pendientes(int versionActual, List<Migracion> todas)`
  - `static void BaseDatosPokemon.inicializar() throws Exception`
  - `static int BaseDatosPokemon.versionActual(Connection conexion) throws Exception`

- [ ] **Step 1: Escribir la prueba que falla**

Archivo `src/test/java/com/retro/pokemonengine/migraciones/PlanMigracionTest.java`:

```java
package com.retro.pokemonengine.migraciones;

import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PlanMigracionTest
{
    private static Migracion falsa(int version)
    {
        return new Migracion()
        {
            @Override
            public int version()
            {
                return version;
            }

            @Override
            public String nombre()
            {
                return "falsa" + version;
            }

            @Override
            public void aplicar(Connection conexion)
            {
            }
        };
    }

    @Test
    void desdeCeroAplicaTodas()
    {
        List<Migracion> todas = Arrays.asList(falsa(1), falsa(2), falsa(3));

        List<Migracion> pendientes = PlanMigracion.pendientes(0, todas);

        assertEquals(3, pendientes.size());
        assertEquals(1, pendientes.get(0).version());
        assertEquals(3, pendientes.get(2).version());
    }

    @Test
    void desdeVersionIntermediaAplicaSoloLasPosteriores()
    {
        List<Migracion> todas = Arrays.asList(falsa(1), falsa(2), falsa(3));

        List<Migracion> pendientes = PlanMigracion.pendientes(2, todas);

        assertEquals(1, pendientes.size());
        assertEquals(3, pendientes.get(0).version());
    }

    @Test
    void desdeVersionAdelantadaNoAplicaNada()
    {
        List<Migracion> todas = Arrays.asList(falsa(1), falsa(2), falsa(3));

        assertTrue(PlanMigracion.pendientes(5, todas).isEmpty());
    }

    @Test
    void ordenaAunqueLleguenDesordenadas()
    {
        List<Migracion> todas = Arrays.asList(falsa(3), falsa(1), falsa(2));

        List<Migracion> pendientes = PlanMigracion.pendientes(0, todas);

        assertEquals(1, pendientes.get(0).version());
        assertEquals(2, pendientes.get(1).version());
        assertEquals(3, pendientes.get(2).version());
    }

    @Test
    void rechazaVersionesDuplicadas()
    {
        List<Migracion> todas = Arrays.asList(falsa(1), falsa(1));

        try
        {
            PlanMigracion.pendientes(0, todas);
            org.junit.jupiter.api.Assertions.fail("Debería rechazar versiones duplicadas");
        }
        catch(IllegalStateException esperada)
        {
            assertTrue(esperada.getMessage().contains("1"));
        }
    }
}
```

- [ ] **Step 2: Ejecutar la prueba y verificar que falla**

Run:
```bash
"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -f "Desarrollo/PokemonEngine/pom.xml" test
```
Expected: FALLO de compilación, `cannot find symbol: class Migracion`.

- [ ] **Step 3: Escribir la interfaz `Migracion`**

```java
package com.retro.pokemonengine.migraciones;

import java.sql.Connection;

public interface Migracion
{
    int version();

    String nombre();

    void aplicar(Connection conexion) throws Exception;
}
```

- [ ] **Step 4: Escribir `PlanMigracion`**

```java
package com.retro.pokemonengine.migraciones;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public final class PlanMigracion
{
    private PlanMigracion()
    {
    }

    public static List<Migracion> pendientes(int versionActual, List<Migracion> todas)
    {
        Set<Integer> vistas = new HashSet<>();

        for(Migracion migracion : todas)
        {
            if(!vistas.add(migracion.version()))
            {
                throw new IllegalStateException(
                        "Versión de migración duplicada: " + migracion.version());
            }
        }

        List<Migracion> resultado = new ArrayList<>();

        for(Migracion migracion : todas)
        {
            if(migracion.version() > versionActual) resultado.add(migracion);
        }

        resultado.sort(Comparator.comparingInt(Migracion::version));

        return resultado;
    }
}
```

- [ ] **Step 5: Ejecutar las pruebas y verificar que pasan**

Run:
```bash
"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -f "Desarrollo/PokemonEngine/pom.xml" test
```
Expected: `Tests run: 5, Failures: 0, Errors: 0` y `BUILD SUCCESS`.

- [ ] **Step 6: Escribir la primera migración**

```java
package com.retro.pokemonengine.migraciones;

import java.sql.Connection;
import java.sql.Statement;

public final class M001Base implements Migracion
{
    @Override
    public int version()
    {
        return 1;
    }

    @Override
    public String nombre()
    {
        return "base";
    }

    @Override
    public void aplicar(Connection conexion) throws Exception
    {
        try(Statement statement = conexion.createStatement())
        {
            statement.executeUpdate(
                    "CREATE TABLE IF NOT EXISTS pokemon_schema_version (" +
                    "version INT NOT NULL," +
                    "nombre VARCHAR(64) NOT NULL," +
                    "aplicada_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
                    "PRIMARY KEY (version)" +
                    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
            );
        }
    }
}
```

- [ ] **Step 7: Escribir el runner `BaseDatosPokemon`**

La tabla de versión se crea antes de consultar la versión, porque la migración 1 es la que la define y aún no se ha aplicado la primera vez.

```java
package com.retro.pokemonengine;

import com.eu.habbo.Emulator;
import com.retro.pokemonengine.migraciones.M001Base;
import com.retro.pokemonengine.migraciones.Migracion;
import com.retro.pokemonengine.migraciones.PlanMigracion;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.Arrays;
import java.util.List;

public final class BaseDatosPokemon
{
    private BaseDatosPokemon()
    {
    }

    private static List<Migracion> migraciones()
    {
        return Arrays.asList(
                new M001Base()
        );
    }

    public static int versionActual(Connection conexion) throws Exception
    {
        try(Statement statement = conexion.createStatement())
        {
            statement.executeUpdate(
                    "CREATE TABLE IF NOT EXISTS pokemon_schema_version (" +
                    "version INT NOT NULL," +
                    "nombre VARCHAR(64) NOT NULL," +
                    "aplicada_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
                    "PRIMARY KEY (version)" +
                    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
            );
        }

        try(Statement statement = conexion.createStatement();
            ResultSet resultado = statement.executeQuery(
                    "SELECT COALESCE(MAX(version), 0) FROM pokemon_schema_version"))
        {
            return resultado.next() ? resultado.getInt(1) : 0;
        }
    }

    public static void inicializar() throws Exception
    {
        try(Connection conexion = Emulator.getDatabase().getDataSource().getConnection())
        {
            int actual = versionActual(conexion);

            List<Migracion> pendientes = PlanMigracion.pendientes(actual, migraciones());

            if(pendientes.isEmpty())
            {
                System.out.println("[PokemonEngine] Esquema al día en la versión " + actual + ".");
                return;
            }

            for(Migracion migracion : pendientes)
            {
                migracion.aplicar(conexion);

                try(PreparedStatement statement = conexion.prepareStatement(
                        "INSERT INTO pokemon_schema_version (version, nombre) VALUES (?, ?)"))
                {
                    statement.setInt(1, migracion.version());
                    statement.setString(2, migracion.nombre());
                    statement.executeUpdate();
                }

                System.out.println("[PokemonEngine] Migración "
                        + migracion.version() + " (" + migracion.nombre() + ") aplicada.");
            }
        }
    }
}
```

- [ ] **Step 8: Llamar al runner desde el plugin**

En `PokemonEnginePlugin.java`, sustituir el cuerpo de `onEmulatorLoaded` por:

```java
    @EventHandler
    public void onEmulatorLoaded(EmulatorLoadedEvent event) throws Exception
    {
        BaseDatosPokemon.inicializar();

        System.out.println("[PokemonEngine] Cargado. Protocolo v" + VERSION_PROTOCOLO + ".");
    }
```

- [ ] **Step 9: Compilar y ejecutar todas las pruebas**

Run:
```bash
"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -f "Desarrollo/PokemonEngine/pom.xml" clean package
```
Expected: `Tests run: 5, Failures: 0, Errors: 0` y `BUILD SUCCESS`.

- [ ] **Step 10: Commit**

```bash
git add Desarrollo/PokemonEngine/src
git commit -m "feat(pokemon): add idempotent migration runner"
```

---

### Task 3: Cuerpo JSON de respuesta

**Files:**
- Create: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/PokemonCuerpo.java`
- Test: `Desarrollo/PokemonEngine/src/test/java/com/retro/pokemonengine/PokemonCuerpoTest.java`

**Interfaces:**
- Consumes: Gson sombreado de la tarea 1
- Produces:
  - `static String PokemonCuerpo.datos(Object payload)`
  - `static String PokemonCuerpo.error(String codigo, String mensaje)`

`PokemonCuerpo` se mantiene separado de `PokemonPackets` a propósito: la serialización es pura y se prueba sin tocar clases del emulador.

- [ ] **Step 1: Escribir la prueba que falla**

```java
package com.retro.pokemonengine;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PokemonCuerpoTest
{
    static class Saludo
    {
        int protocolVersion;
        int userId;

        Saludo(int protocolVersion, int userId)
        {
            this.protocolVersion = protocolVersion;
            this.userId = userId;
        }
    }

    @Test
    void serializaLosDatos()
    {
        String json = PokemonCuerpo.datos(new Saludo(1, 42));

        assertTrue(json.contains("\"protocolVersion\":1"), json);
        assertTrue(json.contains("\"userId\":42"), json);
    }

    @Test
    void elPayloadNuloDaObjetoVacio()
    {
        assertEquals("{}", PokemonCuerpo.datos(null));
    }

    @Test
    void serializaElError()
    {
        String json = PokemonCuerpo.error("ZONA_NO_ACTIVA", "Esta sala no es de Kanto");

        assertTrue(json.contains("\"code\":\"ZONA_NO_ACTIVA\""), json);
        assertTrue(json.contains("\"message\":\"Esta sala no es de Kanto\""), json);
    }
}
```

- [ ] **Step 2: Ejecutar la prueba y verificar que falla**

Run:
```bash
"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -f "Desarrollo/PokemonEngine/pom.xml" test
```
Expected: FALLO de compilación, `cannot find symbol: class PokemonCuerpo`.

- [ ] **Step 3: Escribir `PokemonCuerpo`**

```java
package com.retro.pokemonengine;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

import java.util.LinkedHashMap;
import java.util.Map;

public final class PokemonCuerpo
{
    private static final Gson GSON = new GsonBuilder().create();

    private PokemonCuerpo()
    {
    }

    public static String datos(Object payload)
    {
        if(payload == null) return "{}";

        return GSON.toJson(payload);
    }

    public static String error(String codigo, String mensaje)
    {
        Map<String, String> cuerpo = new LinkedHashMap<>();

        cuerpo.put("code", codigo == null ? "ERROR" : codigo);
        cuerpo.put("message", mensaje == null ? "" : mensaje);

        return GSON.toJson(cuerpo);
    }
}
```

- [ ] **Step 4: Ejecutar las pruebas y verificar que pasan**

Run:
```bash
"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -f "Desarrollo/PokemonEngine/pom.xml" test
```
Expected: `Tests run: 8, Failures: 0, Errors: 0`.

- [ ] **Step 5: Commit**

```bash
git add Desarrollo/PokemonEngine/src
git commit -m "feat(pokemon): add json response body serializer"
```

---

### Task 4: Handler 6400 y acción de saludo

**Files:**
- Create: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/PokemonAcciones.java`
- Create: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/PokemonPackets.java`
- Create: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/handlers/PokemonCommandHandler.java`
- Modify: `Desarrollo/PokemonEngine/src/main/java/com/retro/pokemonengine/PokemonEnginePlugin.java`

**Interfaces:**
- Consumes: `PokemonCuerpo.datos`, `PokemonCuerpo.error`, `PokemonEnginePlugin.PACKET_POKEMON_COMMAND`, `PokemonEnginePlugin.VERSION_PROTOCOLO`
- Produces:
  - `static final int PokemonAcciones.SALUDO = 1`
  - `static ServerMessage PokemonPackets.resultado(int accion, boolean exito, String cuerpoJson)`
  - Handler registrado en el packet 6400

El formato del 6401 es: `int accion`, `boolean exito`, `string cuerpoJson`.

- [ ] **Step 1: Escribir `PokemonAcciones`**

```java
package com.retro.pokemonengine;

public final class PokemonAcciones
{
    // 1-19 sesión, zona y seguidor
    public static final int SALUDO = 1;

    private PokemonAcciones()
    {
    }
}
```

- [ ] **Step 2: Escribir `PokemonPackets`**

```java
package com.retro.pokemonengine;

import com.eu.habbo.messages.ServerMessage;

public final class PokemonPackets
{
    public static final int RESULT_PACKET = 6401;

    private PokemonPackets()
    {
    }

    public static ServerMessage resultado(int accion, boolean exito, String cuerpoJson)
    {
        ServerMessage respuesta = new ServerMessage(RESULT_PACKET);

        respuesta.appendInt(accion);
        respuesta.appendBoolean(exito);
        respuesta.appendString(cuerpoJson == null ? "{}" : cuerpoJson);

        return respuesta;
    }
}
```

- [ ] **Step 3: Escribir el handler**

El `userId` sale de `this.client`, nunca del paquete. Las excepciones no escapan: se registran y el jugador recibe un error genérico.

```java
package com.retro.pokemonengine.handlers;

import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.messages.incoming.MessageHandler;
import com.retro.pokemonengine.PokemonAcciones;
import com.retro.pokemonengine.PokemonCuerpo;
import com.retro.pokemonengine.PokemonEnginePlugin;
import com.retro.pokemonengine.PokemonPackets;

import java.util.LinkedHashMap;
import java.util.Map;

public class PokemonCommandHandler extends MessageHandler
{
    @Override
    public void handle()
    {
        if(this.client == null || this.client.getHabbo() == null) return;

        Habbo habbo = this.client.getHabbo();
        int userId = habbo.getHabboInfo().getId();
        int accion = this.packet.readInt().intValue();

        boolean exito = false;
        String cuerpo = PokemonCuerpo.error("ACCION_DESCONOCIDA", "Acción no reconocida");

        try
        {
            switch(accion)
            {
                case PokemonAcciones.SALUDO:
                {
                    Map<String, Object> datos = new LinkedHashMap<>();

                    datos.put("protocolVersion", PokemonEnginePlugin.VERSION_PROTOCOLO);
                    datos.put("userId", userId);
                    datos.put("serverTimeEpoch", System.currentTimeMillis() / 1000L);

                    exito = true;
                    cuerpo = PokemonCuerpo.datos(datos);
                    break;
                }

                default:
                    break;
            }
        }
        catch(Exception error)
        {
            System.out.println("[PokemonEngine] Error en la acción " + accion
                    + " del usuario " + userId + ": " + error.getMessage());

            exito = false;
            cuerpo = PokemonCuerpo.error("ERROR_INTERNO", "No se ha podido completar la acción");
        }

        this.client.sendResponse(PokemonPackets.resultado(accion, exito, cuerpo));
    }
}
```

- [ ] **Step 4: Registrar el handler en el plugin**

En `PokemonEnginePlugin.java`, añadir el import y sustituir `onEmulatorLoaded`:

```java
import com.retro.pokemonengine.handlers.PokemonCommandHandler;
```

```java
    @EventHandler
    public void onEmulatorLoaded(EmulatorLoadedEvent event) throws Exception
    {
        BaseDatosPokemon.inicializar();

        Emulator.getGameServer().getPacketManager()
                .registerHandler(PACKET_POKEMON_COMMAND, PokemonCommandHandler.class);

        System.out.println("[PokemonEngine] Cargado. Protocolo v" + VERSION_PROTOCOLO + ".");
    }
```

- [ ] **Step 5: Compilar**

Run:
```bash
"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -f "Desarrollo/PokemonEngine/pom.xml" clean package
```
Expected: `Tests run: 8, Failures: 0, Errors: 0` y `BUILD SUCCESS`.

- [ ] **Step 6: Desplegar el JAR y reiniciar el emulador**

Run:
```bash
cp "Desarrollo/PokemonEngine/target/pokemon-engine-1.0.0.jar" "/c/Users/erale/Desktop/Habbo/Emulator/plugins/"
```

Reiniciar el emulador y observar la consola.

Expected, en el arranque:
```
[PokemonEngine] Migración 1 (base) aplicada.
[PokemonEngine] Cargado. Protocolo v1.
```

En un segundo reinicio, la línea de migración cambia a:
```
[PokemonEngine] Esquema al día en la versión 1.
```
Esto es lo que demuestra que el runner es idempotente.

- [ ] **Step 7: Verificar la tabla en la base de datos**

Run:
```bash
"/c/Users/erale/Desktop/Habbo/xampp/mysql/bin/mysql.exe" -u root habbo -e "SELECT * FROM pokemon_schema_version"
```
Expected: una fila con `version = 1`, `nombre = base` y su marca de tiempo.

- [ ] **Step 8: Commit**

```bash
git add Desarrollo/PokemonEngine/src
git commit -m "feat(pokemon): add 6400 command handler with handshake action"
```

---

### Task 5: Registro de paquetes en el renderer

**Files:**
- Create: `xampp/htdocs/nitro-react/submodules/renderer/src/nitro/communication/messages/outgoing/pokemonengine/PokemonCommandComposer.ts`
- Create: `xampp/htdocs/nitro-react/submodules/renderer/src/nitro/communication/messages/outgoing/pokemonengine/index.ts`
- Create: `xampp/htdocs/nitro-react/submodules/renderer/src/nitro/communication/messages/parser/pokemonengine/PokemonResultParser.ts`
- Create: `xampp/htdocs/nitro-react/submodules/renderer/src/nitro/communication/messages/parser/pokemonengine/index.ts`
- Create: `xampp/htdocs/nitro-react/submodules/renderer/src/nitro/communication/messages/incoming/pokemonengine/PokemonResultEvent.ts`
- Create: `xampp/htdocs/nitro-react/submodules/renderer/src/nitro/communication/messages/incoming/pokemonengine/index.ts`
- Modify: `xampp/htdocs/nitro-react/submodules/renderer/src/nitro/communication/messages/outgoing/index.ts`
- Modify: `xampp/htdocs/nitro-react/submodules/renderer/src/nitro/communication/messages/parser/index.ts`
- Modify: `xampp/htdocs/nitro-react/submodules/renderer/src/nitro/communication/messages/incoming/index.ts`
- Modify: `xampp/htdocs/nitro-react/submodules/renderer/src/nitro/communication/messages/outgoing/OutgoingHeader.ts`
- Modify: `xampp/htdocs/nitro-react/submodules/renderer/src/nitro/communication/messages/incoming/IncomingHeader.ts`
- Modify: `xampp/htdocs/nitro-react/submodules/renderer/src/nitro/communication/NitroMessages.ts`

**Interfaces:**
- Consumes: el formato del 6401 de la tarea 4 (`int accion`, `boolean exito`, `string cuerpoJson`)
- Produces:
  - `class PokemonCommandComposer` con `constructor(action: number, ...args: Array<string | number | boolean>)`
  - `class PokemonResultParser` con `get action(): number`, `get success(): boolean`, `get payload(): PokemonResultPayload`
  - `class PokemonResultEvent` con `getParser(): PokemonResultParser`
  - `OutgoingHeader.POKEMON_COMMAND = 6400`, `IncomingHeader.POKEMON_RESULT = 6401`

- [ ] **Step 1: Crear el composer**

```typescript
import { IMessageComposer } from '../../../../../api';

export class PokemonCommandComposer implements IMessageComposer<ConstructorParameters<typeof PokemonCommandComposer>>
{
    private _data: ConstructorParameters<typeof PokemonCommandComposer>;

    constructor(action: number, ...args: Array<string | number | boolean>)
    {
        this._data = [ action, ...args ];
    }

    public getMessageArray()
    {
        return this._data;
    }

    public dispose(): void
    {
        return;
    }
}
```

Y su `index.ts`:

```typescript
export * from './PokemonCommandComposer';
```

- [ ] **Step 2: Crear el parser**

El cuerpo llega como texto JSON. Si viniera malformado, el parser no revienta: deja `payload` en `null` y marca `success` a `false`.

```typescript
import { IMessageDataWrapper, IMessageParser } from '../../../../../api';

export interface PokemonResultError
{
    code: string;
    message: string;
}

export type PokemonResultPayload = Record<string, unknown> | null;

export class PokemonResultParser implements IMessageParser
{
    private _action = 0;
    private _success = false;
    private _payload: PokemonResultPayload = null;

    public flush(): boolean
    {
        this._action = 0;
        this._success = false;
        this._payload = null;

        return true;
    }

    public parse(wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;

        this._action = wrapper.readInt();
        this._success = wrapper.readBoolean();

        const raw = wrapper.readString();

        try
        {
            this._payload = JSON.parse(raw) as PokemonResultPayload;
        }
        catch
        {
            this._payload = null;
            this._success = false;
        }

        return true;
    }

    public get action(): number
    {
        return this._action;
    }

    public get success(): boolean
    {
        return this._success;
    }

    public get payload(): PokemonResultPayload
    {
        return this._payload;
    }

    public get error(): PokemonResultError | null
    {
        if(this._success || !this._payload) return null;

        return this._payload as unknown as PokemonResultError;
    }
}
```

Y su `index.ts`:

```typescript
export * from './PokemonResultParser';
```

- [ ] **Step 3: Crear el evento**

```typescript
import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { PokemonResultParser } from '../../parser/pokemonengine';

export class PokemonResultEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(callBack, PokemonResultParser);
    }

    public getParser(): PokemonResultParser
    {
        return this.parser as PokemonResultParser;
    }
}
```

Y su `index.ts`:

```typescript
export * from './PokemonResultEvent';
```

- [ ] **Step 4: Reexportar los tres módulos**

En `messages/outgoing/index.ts`, junto a la línea 79 que ya dice `export * from './rpgengine';`, añadir:

```typescript
export * from './pokemonengine';
```

Repetir lo mismo en `messages/parser/index.ts` (junto a su línea 83) y en `messages/incoming/index.ts` (junto a su línea 82).

- [ ] **Step 5: Declarar los ids de paquete**

En `messages/outgoing/OutgoingHeader.ts`, junto a `RPG_ENGINE_COMMAND = 5050` (línea 513):

```typescript
    public static POKEMON_COMMAND = 6400;
```

En `messages/incoming/IncomingHeader.ts`, junto a `RPG_ENGINE_RESULT = 5051` (línea 573):

```typescript
public static POKEMON_RESULT = 6401;
```

- [ ] **Step 6: Registrar el evento en `NitroMessages.ts`**

Añadir el import junto al de `RpgEngineResultEvent` (línea 34):

```typescript
import { PokemonResultEvent } from './messages/incoming/pokemonengine';
```

Y el registro justo después de la línea 147:

```typescript
        this._events.set(IncomingHeader.POKEMON_RESULT, PokemonResultEvent);
```

- [ ] **Step 7: Replicar los archivos en `node_modules`**

**No ejecutar `yarn install` en ningún caso.** Rompió Subastas, Arcade y otras cosas la última vez que se hizo.

`node_modules/@nitrots/nitro-renderer` **no es un enlace simbólico: es una copia física** del directorio, comprobado con `Get-Item`. Vite resuelve el paquete desde `node_modules`, así que los cambios en `submodules/renderer` **no llegan al build por sí solos**. Los doce archivos de esta tarea tienen que existir en las dos rutas, con contenido idéntico.

Run, desde la raíz del checkout donde se vaya a compilar:
```bash
cp -r xampp/htdocs/nitro-react/submodules/renderer/src/nitro/communication/messages/outgoing/pokemonengine xampp/htdocs/nitro-react/node_modules/@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/
cp -r xampp/htdocs/nitro-react/submodules/renderer/src/nitro/communication/messages/parser/pokemonengine xampp/htdocs/nitro-react/node_modules/@nitrots/nitro-renderer/src/nitro/communication/messages/parser/
cp -r xampp/htdocs/nitro-react/submodules/renderer/src/nitro/communication/messages/incoming/pokemonengine xampp/htdocs/nitro-react/node_modules/@nitrots/nitro-renderer/src/nitro/communication/messages/incoming/
cp xampp/htdocs/nitro-react/submodules/renderer/src/nitro/communication/NitroMessages.ts xampp/htdocs/nitro-react/node_modules/@nitrots/nitro-renderer/src/nitro/communication/NitroMessages.ts
cp xampp/htdocs/nitro-react/submodules/renderer/src/nitro/communication/messages/incoming/IncomingHeader.ts xampp/htdocs/nitro-react/node_modules/@nitrots/nitro-renderer/src/nitro/communication/messages/incoming/IncomingHeader.ts
cp xampp/htdocs/nitro-react/submodules/renderer/src/nitro/communication/messages/outgoing/OutgoingHeader.ts xampp/htdocs/nitro-react/node_modules/@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/OutgoingHeader.ts
cp xampp/htdocs/nitro-react/submodules/renderer/src/nitro/communication/messages/incoming/index.ts xampp/htdocs/nitro-react/node_modules/@nitrots/nitro-renderer/src/nitro/communication/messages/incoming/index.ts
cp xampp/htdocs/nitro-react/submodules/renderer/src/nitro/communication/messages/outgoing/index.ts xampp/htdocs/nitro-react/node_modules/@nitrots/nitro-renderer/src/nitro/communication/messages/outgoing/index.ts
cp xampp/htdocs/nitro-react/submodules/renderer/src/nitro/communication/messages/parser/index.ts xampp/htdocs/nitro-react/node_modules/@nitrots/nitro-renderer/src/nitro/communication/messages/parser/index.ts
```

Verificar que no queda ninguna diferencia:
```bash
diff -r xampp/htdocs/nitro-react/submodules/renderer/src/nitro/communication xampp/htdocs/nitro-react/node_modules/@nitrots/nitro-renderer/src/nitro/communication
```
Expected: sin salida.

- [ ] **Step 8: Compilar el cliente**

Run:
```bash
cd xampp/htdocs/nitro-react && yarn build
```
Expected: build sin errores de TypeScript. Si aparece `Cannot find module './pokemonengine'`, falta una de las copias del paso 7 o uno de los `index.ts` del paso 4.

- [ ] **Step 9: Commit**

Solo se versiona `submodules/renderer`; `node_modules` está ignorado por git y es una copia de trabajo.

```bash
git add xampp/htdocs/nitro-react/submodules/renderer/src/nitro/communication
git commit -m "feat(pokemon): register 6400/6401 packets in nitro renderer"
```

---

### Task 6: Adaptador de cliente y verificación de ida y vuelta

**Depende del acuerdo de despliegue descrito al principio del plan.** No ejecutar hasta tenerlo.

**Files:**
- Create: `xampp/htdocs/nitro-react/src/api/pokemon/PokemonEngineAdapter.ts`
- Create: `xampp/htdocs/nitro-react/src/api/pokemon/index.ts`
- Modify: `xampp/htdocs/nitro-react/src/App.tsx:5` y `:78`

**Interfaces:**
- Consumes: `PokemonCommandComposer`, `PokemonResultEvent` de la tarea 5
- Produces:
  - `function InstallPokemonEngineAdapter(): boolean`
  - `function sendPokemonCommand(action: number, ...args: Array<string | number | boolean>): void`
  - `function addPokemonResultListener(listener: PokemonResultListener): () => void`
  - `globalThis.PokemonEngine.saludo()` para verificación manual

- [ ] **Step 1: Escribir el adaptador**

```typescript
import { PokemonCommandComposer, PokemonResultEvent } from '@nitrots/nitro-renderer';
import { GetCommunication } from '../nitro/GetCommunication';
import { SendMessageComposer } from '../nitro/SendMessageComposer';

export const ACTION_SALUDO = 1;

export interface PokemonResult
{
    action: number;
    success: boolean;
    payload: Record<string, unknown> | null;
}

export type PokemonResultListener = (result: PokemonResult) => void;

const listeners = new Set<PokemonResultListener>();

let installed = false;

export function sendPokemonCommand(action: number, ...args: Array<string | number | boolean>): void
{
    SendMessageComposer(new PokemonCommandComposer(action, ...args));
}

export function addPokemonResultListener(listener: PokemonResultListener): () => void
{
    listeners.add(listener);

    return () => { listeners.delete(listener); };
}

function onServerResult(event: PokemonResultEvent): void
{
    const parser = event.getParser();

    if(!parser) return;

    const result: PokemonResult = {
        action: parser.action,
        success: parser.success,
        payload: parser.payload
    };

    for(const listener of listeners) listener(result);
}

export function InstallPokemonEngineAdapter(): boolean
{
    if(installed) return true;

    const communication = GetCommunication();

    if(!communication) return false;

    communication.registerMessageEvent(new PokemonResultEvent(onServerResult));

    (globalThis as any).PokemonEngine = {
        saludo: () => sendPokemonCommand(ACTION_SALUDO),
        enviar: (action: number, ...args: Array<string | number | boolean>) =>
            sendPokemonCommand(action, ...args),
        onResult: (listener: PokemonResultListener) => addPokemonResultListener(listener)
    };

    addPokemonResultListener(result =>
    {
        console.log('[PokemonEngine] resultado', result);
    });

    installed = true;

    return true;
}
```

Y su `index.ts`:

```typescript
export * from './PokemonEngineAdapter';
```

- [ ] **Step 2: Instalar el adaptador en el arranque**

En `src/App.tsx`, junto al import de la línea 5:

```typescript
import { InstallPokemonEngineAdapter } from './api/pokemon';
```

Y en el caso `RoomEngineEvent.ENGINE_INITIALIZED`, justo debajo de `InstallRpgEngineAdapter();` (línea 78):

```typescript
                InstallPokemonEngineAdapter();
```

- [ ] **Step 3: Compilar el cliente**

Run:
```bash
cd xampp/htdocs/nitro-react && yarn build
```
Expected: build sin errores.

- [ ] **Step 4: Verificar la ida y vuelta**

Con el emulador arrancado y el cliente servido según lo acordado, entrar al hotel, abrir la consola del navegador y ejecutar:

```javascript
PokemonEngine.saludo()
```

Expected: aparece en consola

```
[PokemonEngine] resultado { action: 1, success: true, payload: { protocolVersion: 1, userId: <tu id>, serverTimeEpoch: <epoch> } }
```

**La comprobación que importa**: el `userId` devuelto es el del usuario conectado, y el cliente nunca lo ha enviado. Eso demuestra que la autoridad está en el servidor.

- [ ] **Step 5: Verificar el camino de error**

En la consola:

```javascript
PokemonEngine.enviar(999)
```

Expected:

```
[PokemonEngine] resultado { action: 999, success: false, payload: { code: "ACCION_DESCONOCIDA", message: "Acción no reconocida" } }
```

- [ ] **Step 6: Commit**

```bash
git add xampp/htdocs/nitro-react/src/api/pokemon xampp/htdocs/nitro-react/src/App.tsx
git commit -m "feat(pokemon): add client adapter and handshake round trip"
```

---

## Hecho cuando

- El emulador arranca con `[PokemonEngine] Cargado. Protocolo v1.`
- `pokemon_schema_version` existe y tiene la fila de la migración 1
- Un segundo arranque imprime `Esquema al día en la versión 1` en vez de reaplicar
- `mvn clean package` pasa las 8 pruebas
- `PokemonEngine.saludo()` devuelve el `userId` del usuario conectado
- Una acción desconocida devuelve `success: false` con código `ACCION_DESCONOCIDA`

## Siguiente hito

Hito 2: importador y verificador del catálogo (`pokemon:import-catalog`, `pokemon:verify-catalog`), con sus migraciones de las tablas del catálogo.
