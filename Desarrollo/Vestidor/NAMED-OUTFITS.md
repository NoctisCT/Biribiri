# Biribiri Vestidor — conjuntos con nombre

## V4.1

Los nombres de conjuntos son persistentes y no usan localStorage.

### Persistencia

Tabla: `biribiri_wardrobe_outfit_meta`

Clave:
- `user_id`
- `slot_id`

Dato:
- `outfit_name` (`VARCHAR(32)`)

El look y género siguen guardándose en la tabla nativa `users_wardrobe`. No se duplican.

### Protocolo

- `6202`: solicitar nombres.
- `6203`: respuesta con nombres.
- `6204`: guardar/renombrar nombre.

El estado de slots existente sigue en `6200/6201` y no se modifica.

### UX

- La cuadrícula conserva exactamente su tamaño.
- El nombre aparece solo al hacer hover sobre un conjunto.
- Guardar abre un diálogo compacto con preview y nombre.
- El lápiz de hover permite renombrar sin sobrescribir el look.
- El nombre por defecto es `Conjunto N`.
- Máximo 32 caracteres.

### Seguridad

El servidor valida que el slot esté desbloqueado antes de aceptar el nombre.
No se usa localStorage.

## V4.1.1

- El preview del diálogo usa el avatar completo (`FULL`).
- `LayoutAvatarImageView` se renderiza con `scale={ .45 }`.
- El recuadro mantiene exactamente el mismo tamaño.

## V4.1.2

- Preview del conjunto ampliado al 65%.
- Centrado mediante un stage con `translate(-50%, -50%)`.
- Se eliminan offsets manuales del avatar.
- El diálogo y el recuadro mantienen el mismo tamaño.

## V4.1.3

- El diálogo reutiliza exactamente el tratamiento visual de la preview general.
- Escala `0.5`, offsets `-46/-9` e `image-rendering: auto !important`.
- Se elimina el wrapper escalado de V4.1.2, que producía clipping y pixelado.

## V4.1.4

- El recuadro del diálogo usa exactamente la geometría del slot general: `30x50`.
- Se conserva la misma escala `0.5`, offsets `-46/-9` e `image-rendering:auto`.
- Se elimina la diferencia `40x52` que hacía que los mismos offsets colocasen el avatar en otro sitio.

## V4.1.5

- Centrado medido sobre captura real del diálogo.
- Recuadro: `30x50`; huella visible aproximada del avatar: `19x42`.
- Ajuste: `+4px` derecha y `+3px` abajo (`margin-left -5`, `margin-top -43`).
- Escala `0.5` e `image-rendering:auto` permanecen intactos.
