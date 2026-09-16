# Biribiri - Documentacion tecnica de Vestidor, Comunidad y ropa canjeable
Estado documentado: 2026-09-16

## 1. Alcance

Este documento describe la arquitectura actualmente implementada alrededor de:

- Avatar Editor / Vestidor
- categorias extendidas de ropa
- slots y Biri Club
- favoritos
- nombres y busqueda
- carpetas
- Random y preview avanzada
- Comunidad de looks
- ropa custom canjeable
- ownership de ropa
- pipeline futuro de importacion

No es documentacion del hotel completo.

## 2. Rutas principales

Repo:
C:\Users\erale\Desktop\Habbo

Nitro source:
xampp/htdocs/nitro-react

Nitro runtime/build:
xampp/htdocs/public/dist

Nitro assets:
xampp/htdocs/public/nitro-assets

Gamedata:
xampp/htdocs/public/nitro-assets/gamedata

Avatar figure bundles:
xampp/htdocs/public/nitro-assets/bundled/figure

Furniture bundles:
xampp/htdocs/public/nitro-assets/bundled/furniture

Wardrobe backend:
Desarrollo/Vestidor/Backend/WardrobeCore

JAR desplegado:
Emulator/plugins/BiribiriWardrobe.jar

## 3. Modelo de categorias de ropa

Archivo central:
xampp/htdocs/nitro-react/src/api/avatar/ClothingCategoryRegistry.ts

### Cabeza
hr, bn, ha, he, ea, fa, er, mu, be

### Torso
ch, cp, cc, ca, nk, gl, wr, ba, bp, ce, wi

### Piernas
lg, sh, wa, tl

### Extras
pe

### Regla conceptual

logical setType != physical parts

Esto permite que una pieza se presente donde tiene sentido para el usuario aunque internamente use sprites/parts de otro tipo.

Ejemplos:

Chimuelo:
- logical: pe
- fisico: cc/lc/rc

Amigo Conejo:
- logical: pe
- fisico: he 130000016 + he 130000017

bp debe usarse para mochilas/accesorios de espalda, no para cualquier objeto que visualmente este detras del avatar.

## 4. Biri Club

Biri Club es el nombre premium de producto.

No debe confundirse con el antiguo HC visualmente.

Regla:
la ropa clasica/legacy HC no se bloquea por HC.

### Ropa Biri Club

Biri Club puede ser requisito para comprar un furni de ropa en una tienda Biri Club.

No concede automaticamente esa ropa al armario.

Flujo:

1. usuario tiene Biri Club activo
2. puede comprar el furni exclusivo
3. recibe el furni
4. doble click / canje
5. se registra ownership
6. la ropa ya es suya

Si expira Biri Club despues:
la ropa ya canjeada sigue siendo propiedad del usuario.

Por tanto, la autorizacion para VESTIR/GUARDAR una prenda no debe preguntar si el club sigue activo.

Debe preguntar si la prenda canjeable esta adquirida en su wardrobe ownership.

## 5. Vestidor

### Funciones

- slots base
- slots premium/Biri Club
- compra de slots extra
- nombres
- busqueda
- favoritos
- filtros
- colores RGB/HEX
- Random
- locks Random
- preview avanzada
- guardar
- borrar
- Undo
- carpetas
- Extras/PET

### Delete + Undo

Undo conserva una unica instantanea del ultimo borrado.

Debe preservar:
- slot
- figure
- gender
- nombre
- carpeta cuando sea posible

Un nuevo delete reemplaza la instantanea.
Reutilizar el slot invalida la instantanea.
Cerrar el editor limpia Undo.

## 6. Carpetas

Tablas:
- biribiri_wardrobe_folders
- biribiri_wardrobe_folder_slots

Limites:
- 10 carpetas
- 10 looks por carpeta

Una asignacion a carpeta no duplica un look.
Apunta al slot real.

Consecuencias:
- borrar carpeta no borra el look
- borrar look elimina la asignacion
- Undo puede restaurar asignacion
- datos premium pueden conservarse aunque temporalmente no haya acceso

UX final:
- Mis carpetas
- folder icon-only
- sin numeracion visual 1-10
- browser propio

## 7. Community Outfits

Comunidad es una feature social separada del Vestidor.

Se abre desde el Avatar Editor, pero no forma parte de la fila de slots.

### Tabs

Orden final:
- Nuevos
- Populares
- General
- Cosplay
- Aesthetic
- Streetwear
- Elegante
- Fantasia

Nuevos:
orden cronologico global.

Populares:
orden por likes.

General:
category='normal'.

Resto:
filtro por categoria.

### Acciones

Publicar:
publica un slot real.

Actualizar:
puede cambiar la categoria de la publicacion.

Like:
toggle persistente.

Probar:
preview temporal.
No cierra Comunidad.
No implica ownership ni guardado.

Guardar:
copia al primer slot libre desbloqueado.
No sobrescribe automaticamente.

Despublicar:
- autor: su propio look
- rango 6-7: look ajeno

Moderacion:
motivo opcional y registro.

### Diseño

La UI final usa:
- hero
- cards grandes
- 3 columnas
- accent por categoria
- avatar central
- autor
- contador de likes
- botones Probar / Guardar / Despublicar
- estado vacio
- dialogo publicar
- textos legibles

No reintroducir [INSPIRATE].

## 8. Protocolo Community

App-local message registration.

6220 BIRIBIRI_COMMUNITY_FEED_REQUEST
6221 BIRIBIRI_COMMUNITY_FEED_RESPONSE
6222 BIRIBIRI_COMMUNITY_MINE_REQUEST
6223 BIRIBIRI_COMMUNITY_MINE_RESPONSE
6224 BIRIBIRI_COMMUNITY_MUTATION_REQUEST
6225 BIRIBIRI_COMMUNITY_MUTATION_RESULT
6226 BIRIBIRI_COMMUNITY_ACTION_REQUEST
6227 BIRIBIRI_COMMUNITY_ACTION_RESULT

No se modifico node_modules para registrar estos mensajes.

## 9. Persistencia Community

### biribiri_wardrobe_community_posts

Relaciona publicacion con:
- user
- slot real
- categoria
- hash del look
- estado activo

No se usa como copia independiente completa del outfit.

El hash sirve para detectar que el slot ha cambiado.

### biribiri_wardrobe_community_likes

PK logica:
- publication_id
- user_id

Evita doble like.

### biribiri_wardrobe_community_moderation

Registra:
- publication
- author
- moderator
- action
- reason
- timestamp

## 10. Ropa canjeable

Arcturus ya dispone de un flujo de clothing furni.

Conceptos relevantes:
- catalog_clothing
- furniture con interaction_type clothing
- RedeemClothingEvent
- users_clothing
- WardrobeComponent.clothingSets

Un furni de ropa canjeable representa el derecho a adquirir uno o varios setId.

Al canjear:
- se consume/gestiona el item segun Arcturus
- se registra clothing ownership
- clothingSets del usuario se actualiza

## 11. Ownership S1

Archivo:
Desarrollo/Vestidor/Backend/WardrobeCore/src/main/java/com/biribiri/wardrobe/WardrobeClothingOwnership.java

Objetivo:
evitar que Community, F12, paquetes manipulados o el Vestidor permitan persistir una ropa canjeable que el usuario no ha adquirido.

### Regla

Para ropa que pertenece al circuito catalog_clothing:

si el setId usado por el look no esta en clothingSets del usuario:
NO se puede persistir/usar realmente.

No existe una regla especial de Biri Club aqui.

### Puertas protegidas

Guardar cambios:
bloquea look no autorizado.

Guardar en Vestidor:
bloquea/restaura.

Guardar copia Community:
bloquea.

Publicar Community:
bloquea un look no autorizado.

### Puerta deliberadamente abierta

Probar:
SI.

El usuario puede previsualizar una ropa antes de comprarla.

Esto es UX, no ownership.

## 12. Amigo Conejo - caso de validacion

Se eligio como primera prueba real de ownership.

Semantica:
- name: Amigo Conejo
- logical: pe
- companion
- physical:
  - he 130000016
  - he 130000017

Libraries:
- acc_head_U_tv26AmigoConejo
- tv_hobba_26_AmigoConejo

Ultimos IDs usados en los planes de import:
- figure set 1900000001
- items_base 2000000002
- catalog item 1996671574

Reauditarlos antes de reutilizarlos.

### Estado

El item llego a mostrarse en catalogo.

Problema actual:
- preview furni incorrecta/vacia
- furni en sala = cubo negro

Hasta que eso se arregle:
NO se puede considerar validado el flujo de canje.

La siguiente sesion debe comparar FurnitureData + furniture .nitro contra un clothing furni conocido que renderice bien.

Catalog page:
usar Biribiri.

No usar una pagina arbitraria para superar un preflight.

## 13. Build y deploy

Nitro:

cd C:\Users\erale\Desktop\Habbo\xampp\htdocs\nitro-react
yarn build

No hacer yarn install salvo aprobacion.

Wardrobe backend:

cd C:\Users\erale\Desktop\Habbo\Desarrollo\Vestidor\Backend\WardrobeCore
mvn -o -DskipTests package

JAR esperado:
target/wardrobe-core-0.1.0.jar

Deploy:
Emulator/plugins/BiribiriWardrobe.jar

Tras backend:
reiniciar Emulator.

Tras solo frontend:
Ctrl+F5 suele bastar.

## 14. QA minimo antes de declarar estable

### Community
- tabs
- General
- likes
- Populares
- publicar
- actualizar
- probar
- guardar
- owner unpublish
- mod 6
- mod 7
- no-mod
- invalidacion por cambio de slot

### Ownership
Antes de canjear:
- preview SI
- persistencia NO

Despues de canjear:
- persistencia SI

Probar:
- siempre permitido

### Vestidor
- slots
- nombres
- favoritos
- busqueda
- filtros
- Random
- preview
- colores
- folders
- delete
- Undo
- persistencia

## 15. Clothing Importer - siguiente gran fase

El Importer debe convertir una importacion manual en una operacion determinista.

Entrada:
- metadata de la prenda
- categoria logica
- parts
- figure bundle
- furni bundle
- pagina catalogo
- precio
- flags de tienda
- IDs opcionales

Pipeline:
1. audit
2. collision check
3. id allocation
4. backup
5. FigureData
6. FigureMap
7. avatar bundle
8. FurnitureData
9. furniture bundle
10. items_base
11. catalog_items
12. catalog_clothing
13. metadata wardrobe
14. postcheck
15. rollback

No debe seleccionar paginas de catalogo de forma heuristica cuando el destino es conocido.

## 16. Clothing Builder - futuro

El Builder sera una capa superior al Importer.

No debe reemplazar ni duplicar el pipeline seguro.

Posibles campos:
- nombre
- categoria
- parts
- preview
- palette/colors
- ids
- furni canjeable
- tienda
- precio
- requisito Biri Club
- export/import
- validacion
- rollback

Ownership final:
siempre se basa en la adquisicion/canje real de la ropa.

## 17. Deuda conocida

Football Gate:
requiere auditoria end-to-end porque el furni historicamente no abria el editor al doble click.

No parchear sin localizar primero:
furni -> interaction -> packet/event -> Nitro -> AvatarEditorView.

## 18. Convenciones para futuras sesiones

- local runtime > GitHub stale
- read-only audit antes de arreglos inciertos
- no dependency installs
- no node_modules edits
- no force push
- no master
- backup + rollback
- commit solo con orden expresa
- no mezclar categoria logica con physical part type
- no usar Biri Club como ownership de una prenda ya canjeada
