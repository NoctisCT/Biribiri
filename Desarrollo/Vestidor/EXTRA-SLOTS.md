# Biribiri Vestidor — slots EXTRA comprables

## V4.2

Precios permanentes por slot:

- EXTRA 1–10: 25 créditos.
- EXTRA 11–20: 50 créditos.
- EXTRA 21–40: 75 créditos.
- EXTRA 41–80: 100 créditos.

Máximo: 80 EXTRA (100 posiciones totales contando 10 Base + 10 HC).

## Seguridad

- 6205 solicita comprar el siguiente slot.
- 6206 devuelve resultado.
- El cliente no envía ni slot ni precio.
- El servidor bloquea entitlement + fila de créditos con `FOR UPDATE`.
- Descuento de créditos e incremento de `purchased_slots` van en la misma transacción SQL.
- Después del commit se sincroniza `HabboInfo.credits` y se envía `UserCreditsComposer`.
- No usa localStorage.

## V4.2.2 — purchase acknowledgement

- El éxito se confirma por `6201` (estado de slots), canal estable desde V1.
- `6206` permanece como detalle/error, pero no bloquea la UX.
- Se elimina `FOR UPDATE`; la transacción usa updates con valor esperado.
- Backend emite logs `[BiribiriWardrobe][BUY]`.
- El frontend abandona `Comprando...` tras 4 s si no existe confirmación.

## V4.2.3 — compra basada en sistemas probados + polish

La compra de EXTRA deja de usar el experimento optimista de V4.2.2.

Backend:
- replica el patron transaccional ya usado por Subastas;
- bloquea entitlement con `SELECT ... FOR UPDATE`;
- bloquea saldo con `SELECT id, credits FROM users ... FOR UPDATE`;
- actualiza `users.credits` y `purchased_slots` dentro de una sola transaccion;
- hace `commit`;
- despues sincroniza el Habbo online con `setCredits` + `UserCreditsComposer`, igual que Subastas;
- cualquier excepcion hace rollback y deja stack trace `[BiribiriWardrobe][BUY] ERROR`.

Frontend:
- `6201` sigue siendo la confirmacion estable del incremento real;
- el timeout de V4.2.2 sigue como red de seguridad.

UI:
- los EXTRA bloqueados muestran solo el rayado;
- desaparece la caja central con `x`;
- el siguiente comprable muestra solo `+` y el precio sobre el propio rayado;
- el dialogo pasa a tipografia legible manteniendo aspecto compacto.

