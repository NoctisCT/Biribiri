# Registro de packet ids del hotel

Última verificación: 18 de septiembre de 2026

Obtenido **desescamblando el bytecode de los 93 JAR de `Emulator/plugins`** (no de las fuentes, que están incompletas en el repositorio), más las cabeceras del renderer.

Método reproducible:

```bash
# 1. Extraer todos los plugins a una carpeta temporal (PowerShell, porque Expand-Archive falla con .jar)
#    [System.IO.Compression.ZipFile]::ExtractToDirectory($jar, $destino)

# 2. Localizar las clases que registran handlers
grep -rl "registerHandler" --include=*.class .

# 3. Sacar el id de cada registro
javap -c -p <clase>.class | grep -B4 "registerHandler" | grep -oE "sipush\s+[0-9]+"
```

Y el registro del lado cliente:

```bash
grep -rhoE "= ?[0-9]{4};" \
  xampp/htdocs/nitro-react/submodules/renderer/src/nitro/communication/messages/incoming/IncomingHeader.ts \
  xampp/htdocs/nitro-react/submodules/renderer/src/nitro/communication/messages/outgoing/OutgoingHeader.ts \
  | grep -oE "[0-9]{4}" | sort -n | uniq
```

## Ids ocupados

| Plugin | Ids de handler (cliente → servidor) |
|---|---|
| Camera | 1982, 2068, 2408, 3226 |
| CustomRateLimitForWalking | 3320 |
| BHRPG (heredado) | 3500 (`COMBAT_GRID`) |
| Subastas | 5000, 5002, 5004, 5006, 5008, 5010, 5012, 5015, 5017, 5019, 5021, 5023 |
| InventoryLock | 5030, 5032, 5034, 5036 |
| HoloGrid | 5040 |
| Tragaperras | 5042 |
| AvatarReactions | 5047, 5049, 5057, 5058 |
| RPGEngine | 5050 |
| **Cinema** | **5060** |
| **SocialInteractions** | **5059, 5061, 5063, 5066, 5068, 5070, 5071, 5073, 5075, 5076, 5077** |
| AirHockey | 6000, 6001, 6002 |
| SpaceInvaders / Arcade | 6101, 6103 |
| BiribiriWardrobe | 6200, 6202, 6204, 6205, 6207, 6209, 6210, 6212, 6214, 6216, 6220, 6222, 6224, 6226 |
| BuilderPro | 6300 a 6339 |
| **PokemonEngine** | **6400** (y 6401 de respuesta) |

Contando también los ids de respuesta declarados en las cabeceras del renderer, el rango ocupado llega hasta **6340**.

## Bloques libres

- 5025-5029, 5037-5039, 5052-5055
- 5079-5099
- 5101-5199, 5211-5999 (amplios)
- 6008-6099
- **6420 en adelante** (nada del hotel llega ahí)

## Bloque reservado por PokemonEngine

| Id | Uso |
|---|---|
| 6400 | Cliente → servidor: estado y UI |
| 6401 | Servidor → cliente: estado y UI |
| 6402 | Cliente → servidor: alta frecuencia (seguidor) |
| 6403 | Servidor → cliente: alta frecuencia (seguidor) |
| 6404-6419 | Reservados para las fases siguientes |

## Por qué existe este documento

El 18/09/2026 PokemonEngine se registró en el 5060 y **dejó a Cinema sin su handler**: Arcturus rechaza el segundo registro del mismo id con `Header already registered`, y el plugin que pierde la carrera se queda roto sin que nadie lo note salvo por una línea en el log de arranque.

El fallo vino de sondear solo las fuentes en `Desarrollo/` y una cabecera concreta del renderer. Muchos plugins en ejecución **no tienen sus fuentes en el repositorio**, así que la única lista fiable es la del bytecode desplegado.

**Antes de elegir un id nuevo, rehacer el barrido completo de este documento.**
