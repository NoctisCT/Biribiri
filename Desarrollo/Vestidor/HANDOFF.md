# Biribiri - HANDOFF de sesion
Fecha: 2026-09-16
Rama de trabajo: dev
HEAD antes del cierre: 9b1e05711c4f76c490fee6e85a81bcb7a32d7215

## 1. Objetivo de este handoff

Este archivo debe permitir abrir una sesion nueva y continuar sin reconstruir el contexto desde cero.

El punto actual es:

1. El Vestidor avanzado esta funcional y las carpetas se consideran terminadas.
2. La ventana Comunidad esta funcional: publicar, likes, probar, guardar copia, despublicar y moderacion.
3. La proteccion de propiedad de ropa canjeable (Ownership S1) esta instalada en source y JAR.
4. Falta validar S1 de extremo a extremo con una prenda canjeable real.
5. Se eligio "Amigo Conejo" como prenda de prueba.
6. El avatar asset y la entrada de catalogo existen, pero el furni de Amigo Conejo renderiza como cubo negro en sala y la preview de catalogo no muestra correctamente el furni.
7. Por tanto, el PRIMER trabajo de la siguiente sesion es arreglar el furni canjeable de Amigo Conejo. No continuar con mas features hasta que pueda colocarse, verse y canjearse.

## 2. Reglas de trabajo no negociables

- Repo local: C:\Users\erale\Desktop\Habbo
- Rama: dev. No trabajar sobre master.
- Runtime Nitro:
  - source: xampp/htdocs/nitro-react
  - build real: xampp/htdocs/public/dist
  - launcher real: /dist/index.html
- No ejecutar yarn install, npm install, pnpm install ni tocar node_modules sin aprobacion expresa.
- No cambiar dependencias para resolver un problema local.
- No clonar ni sustituir el proyecto.
- Antes de parches delicados: auditoria read-only de estado local real.
- El runtime local es la autoridad. GitHub puede ir por detras.
- Backups y rollback en scripts.
- Validaciones habituales:
  - git diff --check
  - yarn build
  - Maven offline para WardrobeCore: mvn -o -DskipTests package
  - smoke del JAR
- No hacer commit/push salvo peticion expresa.
- El usuario pidio en este cierre commit + push.
- No sobreescribir personalizaciones ajenas al cambio.
- Los warnings LF -> CRLF de Git son benignos.
- No usar CSS/textos diminutos: la legibilidad se prioriza sobre compactar por compactar.

## 3. Git / remote

El remote local aparece como:

https://github.com/NoctisCT/Habbo.git

No cambiarlo automaticamente.

GitHub confirma que esa URL antigua resuelve al repositorio actual:

NoctisCT/Biribiri
repository id: 1272592520

La rama remota dev existe y, antes del cierre, apuntaba exactamente a:

9b1e05711c4f76c490fee6e85a81bcb7a32d7215

Por tanto, el remote local es una URL anterior/alias de un repo renombrado, no otro proyecto distinto. Es valido hacer push por origin sin reescribir el remote si Git sigue resolviendo la redireccion.

## 4. Vestidor - estado funcional

### 4.1 Arquitectura de categorias

Registry:
xampp/htdocs/nitro-react/src/api/avatar/ClothingCategoryRegistry.ts

Categorias logicas:

Cabeza:
- hr
- bn
- ha
- he
- ea
- fa
- er
- mu
- be

Torso:
- ch
- cp
- cc
- ca
- nk
- gl
- wr
- ba
- bp
- ce
- wi

Piernas:
- lg
- sh
- wa
- tl

Extras:
- pe

Regla importante:
la categoria logica y las partes fisicas son cosas distintas.

Ejemplo ya validado:
Chimuelo es logicamente pe, aunque renderiza partes fisicas cc/lc/rc.

Para Amigo Conejo:
- categoria logica decidida: pe
- concepto: companion/mascota
- partes fisicas del paquete: he 130000016 + he 130000017

No convertirlo en bp solo porque va agarrado a la espalda. bp queda para mochilas/accesorios de espalda reales.

### 4.2 Funciones ya implementadas

- compra de slots extra
- slots Biri Club
- favoritos
- nombres de outfits
- busqueda
- filtros
- borrado de outfit
- Undo de un nivel
- carpetas
- Random
- locks de Random
- preview avanzada
- postura:
  - De pie
  - Caminando
  - Sentado
  - Tumbado
- acciones de preview
- colores RGB/HEX
- extended clothing registry
- Extras/PET

### 4.3 Carpetas

Se consideran terminadas.

UX final:
- tab de carpeta icon-only
- navegador propio de carpetas
- sin numeros 1-10 visibles
- flechas no deben desplazar el avatar
- Mis carpetas
- hasta 10 carpetas
- hasta 10 looks por carpeta
- asignacion = referencia al slot real, no copia del outfit
- borrar carpeta no borra outfits
- borrar outfit elimina su asignacion de carpeta
- Undo intenta restaurar carpeta
- datos de carpetas se conservan si expira Biri Club, pero el acceso premium queda bloqueado segun la politica ya implementada

Tablas:
- biribiri_wardrobe_folders
- biribiri_wardrobe_folder_slots

## 5. Comunidad - estado actual

Comunidad es una ventana independiente grande, pero su boton de entrada esta integrado en la barra superior del editor de avatar, al extremo derecho, con icono de personas.

No debe volver a colocarse en la fila de looks del Vestidor.

### 5.1 Funciones terminadas

- feed autoritativo desde backend
- publicar look
- actualizar categoria
- despublicar propio
- like / unlike persistente
- orden Popular por likes
- Probar
- Guardar copia
- moderacion para rangos 6-7
- despublicar look ajeno por moderacion
- motivo opcional
- registro de moderacion
- ventana Comunidad NO se cierra al pulsar Probar
- Guardar copia usa el primer slot libre desbloqueado
- no sobrescribe un slot ocupado automaticamente

### 5.2 Categorias / tabs

Orden final esperado en UNA sola fila:

1. Nuevos
2. Populares
3. General
4. Cosplay
5. Aesthetic
6. Streetwear
7. Elegante
8. Fantasia

General es una categoria real:
- UI mode 7
- backend filtra category='normal'

Nuevos sigue mostrando todos los recientes.

### 5.3 Visual actual

El rediseño C2.3 + pulidos posteriores esta aceptado.

Incluye:
- hero "Looks de la comunidad"
- cards grandes en 3 columnas
- colores por categoria
- corazon de likes
- autor
- Probar
- Guardar
- Despublicar
- estado vacio legible
- dialogo de publicacion
- textos ampliados
- avatar/iconos suavizados
- corazon superior centrado opticamente

No volver a introducir el kicker [INSPIRATE].

### 5.4 Protocolos Comunidad

Packets app-local:

6220 feed request
6221 feed response
6222 mine request
6223 mine response
6224 publish mutation request
6225 publish mutation result
6226 card action request
6227 card action result

No fue necesario modificar node_modules ni el renderer instalado para estos packets.

### 5.5 Tablas Comunidad

- biribiri_wardrobe_community_posts
- biribiri_wardrobe_community_likes
- biribiri_wardrobe_community_moderation

Publicacion:
- referencia user_id + slot_id real
- no es un almacenamiento paralelo completo del outfit
- usa hash del look para invalidar publicaciones obsoletas cuando el slot cambia

## 6. Ownership S1 - modelo correcto

Esta parte es CRITICA para monetizacion de ropa custom.

Regla de producto:

NO preguntar:
- si es Biri Club
- si es una lista especial de restricted sets

Preguntar conceptualmente:
"Esta ropa canjeable esta en el armario/ownership del usuario?"

Flujo de una prenda custom:
1. existe un furni clothing
2. el usuario lo compra/obtiene
3. doble click / canje
4. Arcturus registra ownership en users_clothing
5. el setId entra en WardrobeComponent.clothingSets
6. desde ese momento puede usar/guardar la prenda

Biri Club solo puede ser un REQUISITO DE COMPRA del furni.

Ejemplo:
- usuario es Biri Club
- entra en tienda Biri Club
- compra un furni de ropa
- canjea el furni
- adquiere permanentemente la ropa

Si mas tarde deja de ser Biri Club, NO pierde una prenda que ya compro y canjeo.

La ropa semanal normal, limitada, de evento y Biri Club debe compartir el mismo ownership una vez canjeada.

### 6.1 Comportamiento S1 esperado

Sin poseer la prenda:
- Probar desde Comunidad: SI
- Guardar cambios / vestirla realmente: NO
- Guardar el look en Vestidor: NO
- Guardar copia desde Comunidad: NO
- Publicar un look explotado/antiguo que la contenga: NO

Despues de canjear:
- todo lo anterior que persiste el look debe quedar permitido

Archivo central:
Desarrollo/Vestidor/Backend/WardrobeCore/src/main/java/com/biribiri/wardrobe/WardrobeClothingOwnership.java

S1 estaba presente en source y JAR desplegado durante el audit de Amigo Conejo.

IMPORTANTE:
el smoke real todavia NO se ha completado porque el furni de prueba sigue roto visualmente.

## 7. Amigo Conejo - estado exacto y bloqueo actual

Nombre:
Amigo Conejo

Decision semantica:
- Extras
- logical setType: pe
- companion / mascota

Paquete:
- avatar library: acc_head_U_tv26AmigoConejo
- furni library: tv_hobba_26_AmigoConejo
- physical parts:
  - he 130000016
  - he 130000017

Ultimos IDs planificados/observados durante el import:
- Figure set: 1900000001
- items_base: 2000000002
- catalog item: 1996671574

Estos IDs deben REAUDITARSE al empezar la siguiente sesion antes de asumir que siguen siendo los definitivos, porque hubo instaladores con rollback y varias iteraciones.

Audit inicial:
- avatar .nitro path estaba libre
- furniture .nitro path estaba libre
- Ownership S1 source: SI
- Ownership S1 JAR: SI
- catalog_clothing existia y tenia cientos de rows
- interaction_type clothing existia

Problemas encontrados durante import:
- V1.0 fallo buscando plantilla
- V1.1 fallo enlazando clothing con FurnitureData
- V1.2 fallo buscando catalog_item normal visible
- V1.3 encontro plan, instalo staging + DB, pero postcheck no encontraba FurnitureData; hizo rollback
- iteraciones posteriores consiguieron mostrar "Amigo Conejo" en catalogo y colocar el furni, pero:
  - preview del catalogo aparece vacia / fondo generico
  - furni colocado aparece como cubo negro
  - por tanto no se ha podido hacer el canje real y validar Ownership S1

Regla de catalogo:
Amigo Conejo debe estar en la pagina de catalogo BIRIBIRI.

No volver a usar "Efectos" como fallback silencioso.

### 7.1 PRIMERA TAREA DE LA PROXIMA SESION

NO tocar Community ni Ownership S1 primero.

Hacer auditoria read-only, pequena y dirigida, de:

1. entry actual de FurnitureData para tv_hobba_26_AmigoConejo
2. items_base actual
3. catalog_items actual
4. catalog_clothing actual
5. asset exacto:
   xampp/htdocs/public/nitro-assets/bundled/furniture/tv_hobba_26_AmigoConejo.nitro
6. asset avatar:
   xampp/htdocs/public/nitro-assets/bundled/figure/acc_head_U_tv26AmigoConejo.nitro
7. comparar el furniture .nitro y FurnitureData con UN furni clothing conocido que renderice correctamente

Sintoma:
cubo negro = el renderer no esta resolviendo la visualizacion/asset del furni como debe.

No confundir esto con ownership. El ownership no pinta el furni.

Objetivo:
- preview correcta en catalogo
- furni correcto al colocarlo
- doble click reconocido como InteractionClothing
- canje consume furni
- users_clothing recibe ownership
- clothingSets se actualiza
- avatar editor puede persistir ese set a partir de ahi

## 8. Smoke test obligatorio cuando Amigo Conejo renderice

Usar una cuenta que NO lo haya canjeado.

A. Antes de canjear
1. abrir Comunidad
2. Probar un look que contenga Amigo Conejo
3. debe poder previsualizarlo
4. Guardar cambios -> debe fallar
5. Guardar en Vestidor -> debe fallar/restaurar
6. Guardar copia desde Comunidad -> debe fallar
7. publicar un look no autorizado -> debe fallar

B. Canje
1. comprar/obtener furni
2. colocar furni
3. doble click
4. confirmar que desaparece/consume segun comportamiento Arcturus
5. confirmar users_clothing
6. confirmar clothingSets

C. Despues de canjear
Repetir A:
- Guardar cambios -> SI
- Guardar Vestidor -> SI
- Guardar copia Comunidad -> SI
- publicar -> SI

D. Persistencia
- relog
- reinicio Emulator si hace falta
- confirmar que sigue poseyendo la prenda

## 9. QA posterior

Cuando Ownership S1 quede validado, hacer QA global antes del Importer.

Vestidor:
- slots base
- extra comprados
- Biri Club slots
- nombres
- favoritos
- busqueda
- filtros
- colores
- Random
- locks Random
- Extras/PET
- delete
- Undo
- carpetas
- relog
- Ctrl+F5
- persistencia

Community:
- Nuevos
- Populares
- General
- todas categorias
- publicar
- actualizar categoria
- like/unlike
- popular ranking
- Probar sin cerrar Comunidad
- Guardar copia
- no sobrescribir slots
- despublicar propio
- mod 6
- mod 7
- usuario sin rango no puede moderar
- registro de moderacion
- publicación se invalida al cambiar/borrar su slot real

Ownership:
- prenda no poseida
- prenda poseida
- mezcla de prendas gratis + una canjeable no poseida
- mezcla de varias canjeables, falta solo una
- relog
- expiracion Biri Club despues de haber canjeado

### Football Gate

Sigue siendo una pieza a revalidar por separado.

Estado historico:
- el editor tiene soporte Football Gate
- categorias limitadas y allowlists
- pero el doble click del furni no estaba abriendo el editor en runtime

Cuando se retome:
auditoria read-only del camino:
double click furni -> Arcturus -> packet/event -> Nitro -> AvatarEditorView

No parchear a ciegas.

## 10. Siguiente fase: Clothing Importer

Solo despues del QA.

Objetivo:
convertir el proceso manual de Chimuelo/Amigo Conejo en un importador seguro y repetible.

Debe aceptar como entrada un paquete de ropa y su metadata.

Contrato deseado:
- nombre
- logical category
- libraries avatar/furni
- parts fisicas
- figure set id opcional o AUTO
- revision opcional o AUTO
- nombre furni
- catalog page destino EXPLICITA
- precio
- currencies
- sellable/canjeable
- biri_club_item metadata si se usa para tienda
- source=importer
- assets .nitro

El Importer debe:
1. auditar colisiones
2. asignar IDs
3. backup
4. merge seguro FigureData
5. merge seguro FigureMap
6. colocar figure .nitro
7. colocar furni .nitro
8. merge seguro FurnitureData
9. crear items_base
10. crear catalog_items
11. crear catalog_clothing
12. crear metadata exacta
13. postchecks
14. build/refresh solo si corresponde
15. rollback completo si cualquier postcheck falla

Nunca elegir una pagina de catalogo aleatoria para "hacer que pase".
El destino debe ser explicito, por ejemplo Biribiri.

El importador debe tratar categoria logica y parts fisicas por separado.

## 11. Futuro: Clothing Builder

NO implementar antes de estabilizar el Importer.

Idea:
una capa superior para crear/publicar ropa custom sin editar JSON/SQL manualmente.

Debe apoyarse en el Importer, no duplicar su logica.

Posibles responsabilidades:
- seleccionar/crear paquete
- preview
- nombre
- categoria logica
- piezas fisicas
- colores
- set ID/revision
- furni canjeable
- pagina de catalogo
- precio
- requisito de tienda, incluido Biri Club
- validacion
- export
- import
- rollback
- historial

La fuente de verdad de ownership debe seguir siendo el canje/armario del usuario.

## 12. Orden recomendado de la proxima sesion

1. Audit read-only del furni negro Amigo Conejo.
2. Arreglar FurnitureData/.nitro del furni.
3. Confirmar pagina Biribiri.
4. Canjear Amigo Conejo.
5. Ejecutar matriz S1 completa.
6. Corregir S1 SOLO si el smoke demuestra un bypass.
7. QA global Vestidor + Community.
8. Cerrar bugs.
9. Diseñar Importer.
10. Implementar Importer.
11. Clothing Builder mucho mas adelante.

FIN DEL HANDOFF.
