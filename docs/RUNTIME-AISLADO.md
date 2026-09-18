# Runtime aislado de PokemonEngine

Creado el 18 de septiembre de 2026, siguiendo el patrón de `build/cinema-test-runtime` que ya usaba el proyecto.

**Todo el desarrollo de Pokémon se prueba aquí, nunca en el emulador de producción.**

## Qué es

Un emulador Arcturus completo e independiente, con su propia base de datos y sus propios puertos, que carga **solo dos plugins**.

| | Producción | Runtime Pokémon |
|---|---|---|
| Carpeta | `Emulator/` | `build/pokemon-test-runtime/` |
| Puerto de juego | 3000 | **3200** |
| RCON | 3001 | **3201** |
| WebSocket de Nitro | 2096 | **2196** |
| Base de datos | `habbo` | **`habbo_pokemon_test_20260918`** |
| Plugins | 93 | **2**: NitroWebsockets y pokemon-engine |

El puerto del websocket **no está en `config.ini`**: vive en la tabla `emulator_settings`, clave `ws.nitro.port`. Por eso basta con cambiarlo en la copia de la base de datos para que los dos runtimes conviva sin chocar.

`build/` está en el `.gitignore`, así que esta carpeta no se versiona. Este documento es lo que la hace reproducible.

## Arrancarlo

```bash
cd build/pokemon-test-runtime && ./start.bat
```

### Nunca redirigir la salida sin filtrar

El emulador imprime `Waiting for command:` **en bucle** cuando su consola interactiva no tiene un terminal detras. Lanzarlo en segundo plano redirigiendo la salida a un fichero genero **95 GB de log** el 18/09/2026.

Para arrancarlo en segundo plano, filtrar esa linea:

```bash
java -Dfile.encoding=UTF8 -jar Habbo-3.6.0-jar-with-dependencies.jar 2>&1   | grep --line-buffered -v "Waiting for command" > runtime.log
```

El filtro mantiene la tuberia abierta, asi que el emulador no recibe SIGPIPE y el log se queda en unos KB.

Arranque correcto:

```
HABBO DATABASE: habbo_pokemon_test_20260918
Plugin Manager -> Loaded! 2 plugins!
Started GameServer on 0.0.0.0:3200@Game Server
Started GameServer on 127.0.0.1:3201@RCON Server
[PokemonEngine] Cargado. Protocolo v1.
Nitro Websockets Listening on ws://0.0.0.0:2196
```

Los dos errores de `ItemManager` (items 996661129 y 56561623) son datos defectuosos heredados de `habbo` y salen también en producción. No son del runtime.

## Recrearlo desde cero

```bash
# 1. Carpeta y plugins
R=build/pokemon-test-runtime
mkdir -p $R/plugins $R/logging/errors
cp Emulator/Habbo-3.6.0-jar-with-dependencies.jar $R/
cp Emulator/config.ini $R/config.ini
cp Emulator/plugins/NitroWebsockets-3.1.jar $R/plugins/
cp build/pokemon-engine/Desarrollo/PokemonEngine/target/pokemon-engine-1.0.0.jar $R/plugins/

# 2. Puertos y base de datos
sed -i 's/^game.port=3000/game.port=3200/; s/^rcon.port=3001/rcon.port=3201/; s/^db.database=habbo$/db.database=habbo_pokemon_test_20260918/' $R/config.ini

# 3. Copia de la base de datos
M=./xampp/mysql/bin
$M/mysql.exe -u root -e "CREATE DATABASE IF NOT EXISTS habbo_pokemon_test_20260918 CHARACTER SET utf8mb4;"
$M/mysqldump.exe -u root --single-transaction --routines --triggers habbo > snapshot.sql
$M/mysql.exe -u root habbo_pokemon_test_20260918 < snapshot.sql

# 4. Aislar el websocket
$M/mysql.exe -u root -e "UPDATE habbo_pokemon_test_20260918.emulator_settings SET value='2196' WHERE \`key\`='ws.nitro.port';"
```

## Desplegar una versión nueva del plugin

```bash
"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd" -f "Desarrollo/PokemonEngine/pom.xml" clean package
cp Desarrollo/PokemonEngine/target/pokemon-engine-1.0.0.jar ../pokemon-test-runtime/plugins/
```

Y reiniciar **solo este runtime**, nunca el de producción.

## Por qué existe

El 18/09/2026 se desplegó PokemonEngine directamente en el emulador de producción y su packet id chocó con el de Cinema, que se quedó sin handler. Un runtime aislado hace que un fallo así no pueda tocar el hotel real.

No sustituye al registro de ids: en un runtime con dos plugins nadie compite por un id, así que las colisiones solo se detectan consultando `docs/REGISTRO-PACKET-IDS.md` antes de elegir.

## Pendiente

El JAR de pruebas sigue en `Emulator/plugins/pokemon-engine-1.0.0.jar` de producción porque el emulador lo tiene bloqueado mientras corre. **Borrarlo con el emulador parado**:

```bash
rm -f Emulator/plugins/pokemon-engine-1.0.0.jar
```

Se regenera cuando haga falta con un `mvn clean package`.

## Cliente de pruebas

El `dist` compilado en el worktree se sirve por un alias de Apache propio, para no tocar el `dist` de producción ni el ajuste `nitro_path` del sitio web (que vale `http://localhost/dist` y lo lee la base de datos **de producción**, no la copia).

Ficheros:

- `xampp/apache/conf/extra/httpd-pokemon-dev.conf` — el alias
- Una línea `Include` al final de `xampp/apache/conf/httpd.conf`

```apache
Alias /pokemon-dist "/Users/erale/Desktop/Habbo/build/pokemon-engine/xampp/htdocs/public/dist"

<Directory "/Users/erale/Desktop/Habbo/build/pokemon-engine/xampp/htdocs/public/dist">
    Options Indexes FollowSymLinks
    AllowOverride None
    Require local
</Directory>
```

Acceso: `http://localhost/pokemon-dist/index.html?sso=<ticket>`, con el ticket puesto en `users.auth_ticket` de la base de datos **de pruebas**.

El `renderer-config.json` del dist del worktree apunta a `ws://localhost:2196`; el de producción sigue en 2096.

**Apache corre como aplicación de consola desde el panel de XAMPP, no como servicio**, así que `httpd -k graceful` no funciona: hay que reiniciarlo desde el panel para que tome cambios de configuración.

Para retirarlo todo: borrar el fichero, borrar la línea `Include` y reiniciar Apache.

### Pasos obligatorios después de cada `yarn build`

El build sobrescribe dos ficheros del dist. Sin esto el cliente de pruebas se conecta a producción:

```bash
cd build/pokemon-engine/xampp/htdocs/nitro-react
MSYS_NO_PATHCONV=1 yarn vite build --base=/pokemon-dist/

cd ../public/dist
V=$(date +%s)
sed -i 's|"socket.url": "ws://localhost:2096"|"socket.url": "ws://localhost:2196"|' renderer-config.json
sed -i "s|'/renderer-config.json', '/ui-config.json'|'/pokemon-dist/renderer-config.json?v=$V', '/pokemon-dist/ui-config.json?v=$V'|" index.html
```

Por qué cada uno:

1. **`--base=/pokemon-dist/`**: el script `yarn build` usa `--base=/dist/`, así que los assets se pedirían al dist de producción y darían 404. En Git Bash hace falta `MSYS_NO_PATHCONV=1` o MSYS convierte el argumento en una ruta de Windows.
2. **`socket.url`**: el build lo regenera apuntando a 2096.
3. **`config.urls` con `?v=`**: el `index.html` compilado carga la configuración desde la **raíz** del servidor (`/renderer-config.json`), que es la de producción. El parámetro de versión es necesario porque el navegador cachea el JSON entre pruebas.

### Ticket de acceso

Arcturus **consume el `auth_ticket` en el primer login**, así que hace falta uno nuevo por cada sesión de prueba:

```bash
T="pkdev-$(date +%s)"
./xampp/mysql/bin/mysql.exe -u root habbo_pokemon_test_20260918 -e "UPDATE users SET auth_ticket='$T' WHERE id=5;"
# abrir http://localhost/pokemon-dist/index.html?sso=$T
```

Si el log del runtime dice `Someone tried to login with a non-existing SSO token`, el ticket ya se gastó.


---

## El ciclo completo de una prueba

Lo que hay que hacer, en orden, para ver un cambio en el cliente de pruebas. Saltarse un paso da síntomas confusos: el cliente se conecta a producción, o carga el `dist` viejo, o el ticket ya está gastado.

```bash
cd build/pokemon-engine

# 1. Plugin
"/c/Users/erale/Downloads/apache-maven-3.9.16-bin/apache-maven-3.9.16/bin/mvn.cmd"     -o -q -f Desarrollo/PokemonEngine/pom.xml clean package

# 2. Cliente (si se ha tocado). Replicar antes a node_modules lo del renderer.
cd xampp/htdocs/nitro-react
MSYS_NO_PATHCONV=1 node_modules/.bin/vite build --base=/pokemon-dist/

# 3. Los dos parches obligatorios del dist
cd ../public/dist
V=$(date +%s)
sed -i 's|"socket.url": "ws://localhost:2096"|"socket.url": "ws://localhost:2196"|' renderer-config.json
sed -i "s|'/renderer-config.json', '/ui-config.json'|'/pokemon-dist/renderer-config.json?v=$V', '/pokemon-dist/ui-config.json?v=$V'|" index.html

# 4. Parar SOLO el emulador de pruebas, por su puerto
#    PowerShell: Get-NetTCPConnection -State Listen | ? LocalPort -eq 3200 | % { Stop-Process -Id $_.OwningProcess -Force }

# 5. Desplegar y arrancar, con el filtro que impide el log de 95 GB
cd ../../../../..
cp build/pokemon-engine/Desarrollo/PokemonEngine/target/pokemon-engine-1.0.0.jar build/pokemon-test-runtime/plugins/
cd build/pokemon-test-runtime
java -Dfile.encoding=UTF8 -jar Habbo-3.6.0-jar-with-dependencies.jar 2>&1     | grep --line-buffered -v "Waiting for command" > runtime.log &

# 6. Ticket nuevo, que Arcturus lo gasta en el primer login
T="pkdev-$(date +%s)"
./xampp/mysql/bin/mysql.exe -u root habbo_pokemon_test_20260918     -e "UPDATE users SET auth_ticket='$T' WHERE id=5;"
echo "http://localhost/pokemon-dist/index.html?sso=$T"
```

**Parar el emulador por su puerto, nunca por el nombre del proceso**: hay más de un `java.exe` corriendo y matar el equivocado se lleva por delante el hotel o el runtime de otra persona.

```powershell
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -eq 3200 } |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

## Datos de prueba sembrados

En `habbo_pokemon_test_20260918`, para el usuario 5 (Hokusei):

| Qué | Dónde |
|---|---|
| Zona `ruta-1` | `pokemon_zones` id 1 |
| Sala 203 («Prueba») dada de alta | `pokemon_zone_rooms` |
| Entrenador con 3.000 pokédólares | `pokemon_trainers` |
| Un Pikachu de nivel 12 en el equipo, puesto de seguidor | `pokemon_owned` id 1 |

Sin la fila en `pokemon_zone_rooms` **no pasa nada de Pokémon en esa sala**, que es justo el gating.

## Sprites

Los de Pikachu están en `xampp/htdocs/public/dist/pokemon/sprite/0025/`, bajados de `PMDCollab/SpriteCollab`:

```bash
D=xampp/htdocs/public/dist/pokemon/sprite/0025
BASE=https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite/0025
curl -s -o $D/AnimData.xml $BASE/AnimData.xml
for a in Walk Idle Sleep Sit Laying Hop Nod Eat ... ; do
    curl -s -f -o "$D/$a-Anim.png" "$BASE/$a-Anim.png"
done
```

Como el `dist` se construye con `emptyOutDir: false`, un build nuevo **no** se los lleva por delante.
