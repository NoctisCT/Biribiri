# Estado de traducción de Biribiri

**Fecha:** 9 de septiembre de 2026  
**Proyecto activo:** `C:\Users\erale\Desktop\Habbo`  
**Copia congelada:** `C:\Users\erale\Desktop\Habbo 2` — no desarrollar ni modificar aquí.  
**Repositorio:** `NoctisCT/Habbo`

Este documento sirve como handoff para continuar la traducción y limpieza del catálogo en una conversación nueva sin reconstruir el contexto.

## Método de trabajo

Este método es parte del handoff y debe mantenerse en sesiones futuras.

### Regla principal
- **No cambiar cosas al azar.**
- Antes de modificar una pantalla, texto, categoría, paquete o comportamiento, inspeccionar primero la fuente real y/o el runtime.
- El estado instalado localmente es la fuente de verdad cuando puede diferir de GitHub, especialmente en `node_modules`, plugins, JARs, assets y configuración.
- GitHub sirve para investigar código y mantener historial, pero no sustituye la verificación del estado local cuando el problema depende del runtime.

### Proyecto y rutas
- Proyecto activo: `C:\Users\erale\Desktop\Habbo`.
- Copia congelada: `C:\Users\erale\Desktop\Habbo 2`.
- **Nunca desarrollar contra `Habbo 2`, nunca borrarla y nunca usarla como destino de scripts.**
- Nitro: `C:\Users\erale\Desktop\Habbo\xampp\htdocs\nitro-react`.
- Cliente público construido: `C:\Users\erale\Desktop\Habbo\xampp\htdocs\public\dist`.
- Renderer source: `...\nitro-react\submodules\renderer`.
- Renderer instalado: `...\nitro-react\node_modules\@nitrots\nitro-renderer\src`.
- Emulator: `C:\Users\erale\Desktop\Habbo\Emulator`.

### Scripts
- Los scripts que se entreguen al usuario deben ser **Python**, nunca PowerShell.
- El usuario los descarga y ejecuta desde `C:\Users\erale\Downloads`.
- Los scripts modifican directamente `C:\Users\erale\Desktop\Habbo`.
- Los backups se crean **fuera del repo**, normalmente en `Downloads`.
- No meter scripts auxiliares ni backups en Git.

### Flujo de cada cambio
1. **Auditar primero** cuando no esté claro el origen real del problema.
2. Identificar IDs, rutas, clases, keys, tablas o valores exactos.
3. No adivinar IDs de paquetes, páginas, packets ni recursos.
4. Preparar un cambio pequeño y controlado.
5. Hacer **preflight estricto**:
   - comprobar que existen las rutas/IDs esperados;
   - comprobar que el valor actual coincide con el esperado;
   - abortar si el estado real es distinto.
6. Crear backup externo antes de modificar.
7. Aplicar cambios de forma transaccional/atómica cuando sea posible.
8. Si hay build, usar únicamente el build necesario.
9. Ejecutar **smoke tests** después.
10. Si algo falla, hacer rollback y parar.
11. Dar **un solo comando de PowerShell cada vez** al usuario.
12. Esperar la salida del usuario antes de preparar el siguiente cambio.
13. Después del cambio técnico, validar visualmente en el cliente cuando corresponda.

### Node / Nitro
- **Nunca** ejecutar:
  - `yarn install`
  - `yarn install --force`
  - `npm install`
  - regeneraciones de `node_modules`.
- Build permitido:
  - `yarn vite build --base=/dist/`
- Si hay que sincronizar renderer, copiar únicamente los archivos exactos modificados desde `submodules/renderer` al renderer instalado.
- No sustituir `node_modules/@nitrots/nitro-renderer` completo.

### Emulator / Java
- No asumir APIs internas.
- Inspeccionar clases instaladas mediante `jar tf` / `javap` o decompilado antes de programar contra ellas.
- Packet IDs custom **nunca se adivinan**.
- Java target del proyecto: 16.
- JAR principal actual: `Habbo-3.6.0-jar-with-dependencies.jar`.
- Plugins: `Emulator\plugins`.

### Base de datos / catálogo
- `catalog_pages` puede quedar cacheado por Emulator; reiniciar Emulator después de cambios estructurales si el cliente sigue mostrando el estado antiguo.
- No traducir `item_name` ni `catalog_name` por patrón sin demostrar que son textos visibles y seguros.
- Para nombres y descripciones de furnis, priorizar las fuentes runtime activas del cliente.
- Antes de un update masivo, generar audit/comparativa y separar:
  - corrección segura;
  - traducción dudosa;
  - nombre propio;
  - identificador técnico.

### Filosofía de traducción
No traducir por diccionario. El objetivo es que Biribiri hable como una comunidad Habbo/retro real.

Convenciones:
- Wired → **Wired**.
- Duckets → **Duckets**.
- Furni(s) → **Furni(s)**.
- Rare(s) → **Rare(s)**.
- Biri Club → nombre definitivo del premium.
- Club Arquitecto → Builders' Club.
- STAFF → categoría administrativa del catálogo.
- `Habbo` / `Zabbo` → Biribiri cuando sea branding del hotel, no cuando sea un nombre histórico que deba conservarse.

Cada término dudoso se revisa por contexto antes de cambiarlo.

### Git / commits
- Antes de terminar un bloque importante, revisar `git status`.
- No commitear backups, scripts de auditoría/corrección descargables, `.env`, `node_modules`, caches ni archivos temporales.
- Los cambios funcionales y de traducción sí deben quedar versionados.
- Al cerrar una sesión larga, actualizar este documento de estado y hacer commit + push.

## Reglas y terminología

- El hotel se llama **Biribiri**.
- Premium definitivo: **Biri Club**.
- Builders' Club: **Club Arquitecto**.
- `Wired` se mantiene como **Wired**. Nunca `Cableado` / `Con cable`.
- `Duckets` se mantiene como **Duckets**. Nunca `Patitos`.
- `Furni / Furnis` se usa como jerga visible. Evitar `Mueble/Muebles` cuando se refiere a furnis.
- `Rare / Rares` se usa como jerga visible. Evitar `Raro/Raros` cuando se refiere a rares.
- La sección administrativa del catálogo se quiere llamar **STAFF**.
- Branding visible `Habbo`, `Zabbo`, etc. debe revisarse y sustituirse por Biribiri cuando sea branding del hotel.
- No traducir identificadores técnicos como `caption_save`, `item_name`, packet IDs, layouts o clases salvo necesidad funcional.
- No ejecutar `yarn install`, `npm install` ni regenerar `node_modules`.
- Build permitido: `yarn vite build --base=/dist/`.
- Scripts auxiliares: Python, backups fuera del repo en Downloads.
- Tras cambios en `catalog_pages`, reiniciar Emulator si el índice sigue mostrando valores antiguos por caché.

## Sectores ya cerrados o suficientemente cerrados

Cliente Nitro:
- Navegador.
- Acciones de usuario.
- Inventario.
- Ajustes.
- Menú inferior izquierdo.
- Consola, chat y amigos.
- Perfil / infostand / monedero.
- Cámara.
- Alertas y errores de sala.
- Timbre.
- Grupos.
- Intercambio / Mercadillo.
- Widgets de sala.
- Ayuda / Reportes.
- Wired UI.
- Moderación / Mod Tools.
- Restos pequeños visibles.

No tocar:
- RPGEngine.
- Subastas.
- Lift Shift.

CMS / Filament:
- CMS: cerrado.
- Filament: cerrado suficientemente.
- Quedan textos profundos de administración, sobre todo `Textos del emulador` y campos profundos de Catálogo/Furnis.

## Estado actual del catálogo

Sector activo: `catalog_pages`, estructura del catálogo y calidad de traducciones.

Ya aplicado:
- Primer lote de **41 captions** corregidos.
- Correcciones como:
  - Cableado → Wired.
  - Patitos → Duckets.
  - Personal → Equipo/STAFF según contexto.
  - Muebles → Furnis.
  - Raros → Rares.
  - Edificio raíz → Construcción.
  - Club de constructores → Club Arquitecto.
- Contadores `(número)` ocultados:
  - menú lateral;
  - pestañas superiores.
- Cambios posteriores:
  - `Club Habbo` → `Biri Club` en páginas conocidas.
  - `Muebles VIP` → `Furnis Biri Club`.
  - `Tienda VIP` → `Tienda Biri Club`.
  - `Regalos VIP` → `Regalos Biri Club`.
  - `Con cable` → `Wired`.
  - `Cómo usar con cable` → `Cómo usar Wired`.

Si el cliente sigue mostrando `Club Habbo` o `Muebles VIP`, reiniciar Emulator antes de concluir que la BD no cambió.

## Estructura de roots detectada

- `9965780` — `Página delantera` → objetivo: **Inicio**.
- `2` — `Furnis`.
- `5` — `Construcción`.
- `4` — `Mascotas`.
- `15` — `Economía`.
- `25` — `Insignias` → objetivo: **Placas**.
- `212345` — `personaje` → sacar de vista general.
- `7` — `Equipo` → objetivo: **STAFF**.
- `218` — `Wired` → sacar de Construcción y hacer root propio.
- `3078` — `Biri Club` → sacar de Furnis y hacer root propio.

Estructura superior deseada:

**Inicio · Furnis · Construcción · Economía · Mascotas · Placas · Wired · Biri Club · STAFF**

## Reorganización pendiente

### Inicio
- `id=9965780`
- Renombrar `Página delantera` → **Inicio**.

### Placas
- `id=25`
- Renombrar `Insignias` → **Placas**.
- Revisar hijos como `Exhibición de insignias`, `Insignias navideñas`, etc.

### STAFF
- Root `id=7`, `min_rank=7`.
- Renombrar visible a **STAFF**.
- Mantener restringido a staff.

### Personaje
Root `id=212345`, con 4 hijos:
- `11337` VIP supremo.
- `11596` Prada VIP.
- `212375` Fendi VIP.
- `1243339` Cabra VIP.

Objetivo:
- mover esos 4 hijos bajo `STAFF` (`parent_id=7`);
- ocultar/deshabilitar `id=212345`;
- no borrar datos.

### Wired
- `id=218`, `caption_save=wired`.
- Actualmente hijo de Construcción.
- Convertir en root superior.
- Árbol detectado:
  - Cómo usar Wired.
  - Desencadenantes.
  - Efectos.
  - Condiciones.
  - Tablas de clasificación.
  - Temporizadores.
  - Complementos.
  - Ofertas.
  - subcategorías de complementos.

### Biri Club
- Root candidato: `id=3078`.
- Actualmente hijo de Furnis.
- Convertir en root superior.
- Debe contener:
  - compra de Biri Club (`id=9429`, layout `vip_buy`);
  - Furnis Biri Club (`id=352`);
  - colecciones asociadas.

Restos visibles a revisar dentro del árbol:
- `ZC Vieja escuela`.
- `ZC Clásico`.
- `Ejecutivo de ZC`.
- `ZC Alhambra`.
- `ZC Neo`.
- `ZC 2024`.
- `HC futurista`.
- otros `HC`, `VIP`, `Habbo Club`.

Todo lo que represente la membresía debe terminar llamándose **Biri Club**. Los identificadores técnicos internos pueden quedarse si son necesarios.

## Seguridad de compra Biri Club

`catalog_items` tiene `club_only`.

El Emulator ya protege server-side:
- `CatalogItem` carga `club_only`.
- `CatalogManager` valida `isClubOnly()` contra `hasActiveClub()`.

Por tanto, la restricción correcta es usar `catalog_items.club_only=1`.

Estado encontrado:
- páginas con todos sus items ya `club_only=1`: 229, 349, 352, 354, 355, 358.
- páginas del árbol con items `club_only=0`: 1227, 1738, 88614, 2234625.

Objetivo:
- todos los furnis que realmente pertenezcan a Biri Club deben poder verse en esa sección;
- no deben poder comprarse sin membresía activa;
- deben usar `club_only=1`.

No marcar indiscriminadamente colecciones dudosas sin revisar su contexto.

## Traducciones malas todavía pendientes

La traducción automática anterior dejó categorías poco naturales.

Ejemplos:
- `Modo Vapor` probablemente debería ser **Vaporwave**.
- `Edificio de la ciudad`.
- `Edificio estructural`.
- `Delicioso`.
- `Costumbres aleatorias`.
- restos `Raras...` que deberían usar **Rares**.
- restos `HC`, `VIP`, `ZC`.
- restos Habbo/Zabbo.
- traducciones literales poco naturales.

Metodología:
1. detectar inglés residual;
2. detectar español mal traducido;
3. aplicar terminología real de Habbo/retros;
4. corregir branding viejo;
5. preservar nombres propios de colecciones.

No hacer reemplazos globales a ciegas.

## Furnis: nombres y descripciones pendientes

Fuentes runtime activas:
- `xampp/htdocs/public/nitro-assets/gamedata/FurnitureData.json`
- `xampp/htdocs/public/nitro-assets/gamedata/ProductData.json`

Mirrors:
- `xampp/htdocs/nitro-assets/gamedata/...`

Importante:
- `FurnitureData.json` activo y mirror no son idénticos.
- `ProductData.json` gamedata y bundled no son equivalentes.
- No tocar `bundled/furniture/ProductData.json` sin demostrar consumo.
- No traducir `item_name`: es identidad técnica y se usa para rutas/iconos.
- No traducir `catalog_name` a ciegas.
- `FurnitureData.name`, `FurnitureData.description`, `ProductData.name` y `ProductData.description` sí llegan a UI.

Pendiente:
- traducir nombres visibles de furnis;
- traducir descripciones;
- revisar nombres de colecciones;
- eliminar branding antiguo;
- preservar nombres propios;
- sincronizar mirrors tras validar.

## Biri Club fuera del catálogo

Nombre definitivo: **Biri Club**.

Pendiente una pasada global para sustituir visible:
- Club Biribiri.
- Club Habbo / Habbo Club.
- HC cuando represente la membresía.
- VIP cuando represente la membresía.

No cambiar automáticamente:
- nombres históricos o de colección dudosos;
- identificadores internos;
- nombres de clases, keys o layouts funcionales.

Sistema de recompensa ya implementado:
- mes 1 → 1 crédito;
- mes 2 → 2;
- ...
- mes 10+ → 10 máximo;
- romper continuidad reinicia;
- comprar meses por adelantado no adelanta la racha;
- 1 mes = 80 créditos;
- 3 meses = 220 créditos;
- texto visible: **Recompensa por racha**.

## Otros pendientes

Después del catálogo/Furnis:
- rematar campos profundos de Catálogo/Furnis en Filament;
- revisar restos visibles de Textos del emulador;
- búsqueda global final de Habbo, Zabbo, Club Biribiri, HC, VIP, Cableado, Patitos, Personal, Mueble(s), Raro(s);
- QA visual final de todos los sectores.

## Próximo paso recomendado

1. `Página delantera` → `Inicio`.
2. `Insignias` → `Placas`.
3. `Equipo` → `STAFF`.
4. mover hijos de `Personaje` a STAFF y ocultar Personaje.
5. convertir Wired `id=218` en root.
6. convertir Biri Club `id=3078` en root.
7. mantener compra `9429` + páginas de furnis dentro de Biri Club.
8. revisar/activar `club_only=1` en furnis realmente Biri Club.
9. reiniciar Emulator y validar índice.
10. corregir categorías mal traducidas como `Modo Vapor` → probable `Vaporwave`.
11. pasar a nombres/descripciones de FurnitureData/ProductData.

## Resumen corto para iniciar el siguiente chat

> Estamos traduciendo y limpiando Biribiri (`C:\Users\erale\Desktop\Habbo`). Ya están cerrados Navigator, inventario, settings, chat, perfiles, cámara, grupos, mercado, widgets, ayuda, Wired UI, moderación, CMS y casi todo Filament. El sector activo es Catálogo/Furnis. Premium definitivo: **Biri Club**. Terminología: Wired, Duckets, Furnis, Rares, STAFF. Ya se corrigieron 41 captions + 8 de Wired/Biri Club y se ocultaron los contadores de las tabs. Ahora hay que reestructurar roots: `Página delantera`→Inicio, `Insignias`→Placas, `Equipo`→STAFF, mover los 4 hijos de Personaje a STAFF y ocultar Personaje, sacar Wired id=218 como root, sacar Biri Club id=3078 como root. Biri Club debe contener compra (`9429`) + furnis, y los items premium deben usar `catalog_items.club_only=1`; el Emulator ya bloquea server-side si no hay club activo. Después: corregir categorías mal traducidas como “Modo Vapor”→probable Vaporwave, revisar ZC/HC/VIP/Habbo/Zabbo visibles y por último traducir nombres/descripciones de FurnitureData/ProductData activos. No tocar item_name/catalog_name a ciegas ni bundled ProductData sin probar consumo. Reiniciar Emulator después de cambios de catalog_pages para limpiar caché.
