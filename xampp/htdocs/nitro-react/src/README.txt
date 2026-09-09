HOLO HOBBA CLASSIC v3
=====================

Esta versión NO es otro recolor de la v2.

Qué cambia de verdad
--------------------
1. ToolbarView.tsx:
   - Reestructura la barra inferior.
   - Los sprites de iconos quedan dentro de contenedores propios.
   - Ya no se pinta background sobre .icon, por lo que NO deberían desaparecer.
   - Barra continua al estilo cliente Flash/Hobba.
   - Chat centrado y friend bar integrado.

2. ToolbarMeView.tsx:
   - Reestructura el menú desplegable del avatar.
   - Mantiene sprites originales.

3. RoomToolsWidgetView.tsx:
   - Elimina la estructura "dos columnas iconos/texto".
   - Cada opción pasa a ser una fila clásica icono + texto.
   - Mantiene historial, zoom, link, mute, etc.

4. PurseView.tsx:
   - Reestructura el HUD superior derecho:
     monedas | HC | acciones.
   - Más parecido a la distribución de retros clásicos.

5. holo-hobba-classic-v3.scss:
   - Estilo clásico Habbo/Hobba mejorado.
   - Menús oscuros compactos.
   - Ventanas Flash con header azul/teal.
   - Friend bar verde clásica.
   - Sin look dashboard / WordPress.

INSTALACIÓN MANUAL
------------------
Raíz esperada:
C:\Users\erale\Desktop\Habbo\xampp\htdocs\nitro-react

Copia estos archivos reemplazando los existentes:

files\components\toolbar\ToolbarView.tsx
 -> src\components\toolbar\ToolbarView.tsx

files\components\toolbar\ToolbarMeView.tsx
 -> src\components\toolbar\ToolbarMeView.tsx

files\components\room\widgets\room-tools\RoomToolsWidgetView.tsx
 -> src\components\room\widgets\room-tools\RoomToolsWidgetView.tsx

files\components\purse\PurseView.tsx
 -> src\components\purse\PurseView.tsx

files\holo-hobba-classic-v3.scss
 -> src\holo-hobba-classic-v3.scss

Después en src\index.scss:
- elimina/comenta las pruebas anteriores:
  @import './holo-2015.scss';
  @import './holo-classic-clean.scss';
  @import './holo-flash-classic-v2.scss';

- deja al FINAL:
  @import './holo-hobba-classic-v3.scss';

Luego:
cd "C:\Users\erale\Desktop\Habbo\xampp\htdocs\nitro-react"
yarn build

Ctrl+F5.

RECOMENDADO
-----------
Haz copia de los cuatro .tsx antes de reemplazarlos.
También se incluye install.ps1 para instalar automáticamente con backup.

REVERTIR
--------
install.ps1 crea una carpeta _holo_backup_YYYYMMDD-HHMMSS dentro de nitro-react.
Para volver atrás, copia los archivos de esa carpeta a su ubicación original y quita el import v3.
