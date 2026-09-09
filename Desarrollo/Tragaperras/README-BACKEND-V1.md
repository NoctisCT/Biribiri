# Holo Tragaperras - Backend V4

## Estado de esta capa

Backend servidor autoritativo para la tragaperras de creditos.

Todavia NO modifica:

- Nitro UI
- items_base
- FurnitureData
- assets .nitro
- catalogo

## Economia V1

Cada tirada cuesta 5 creditos:

- 1 C: burn permanente
- 1 C: jackpot visible
- 3 C: tesoreria del casino

Seed inicial:

- jackpot: 1.000 C
- tesoreria: 1.000 C
- total_admin_injected contabilizado: 2.000 C

Premios normales:

- 6 C: 11%
- 10 C: 4%
- 20 C: 1,3%
- 50 C: 0,3%
- 100 C: 0,1%
- 250 C: 0,01%
- nada: 83,29%

EV normal: 1,595 C/tirada.

Jackpot:

- tesoreria < 1.000: bloqueado
- 1.000-1.499: 1/200.000
- 1.500-1.999: 1/100.000
- 2.000-2.499: 1/50.000
- 2.500-2.999: 1/25.000
- 3.000+: 1/11.000

Cuando sale:

1. se paga el jackpot visible acumulado;
2. la tesoreria aporta 1.000 C;
3. el jackpot visible vuelve a 1.000 C.

El jackpot sustituye al premio normal en esa tirada: no se apilan.

## Seguridad

- RNG solo en servidor.
- La tirada exige una sesion abierta mediante un furni real InteractionSlotMachine.
- Se valida misma sala + mismo item + interaction correcta.
- La sesion caduca a los 5 minutos y se renueva tras cada tirada.
- Lock por usuario evita doble procesamiento concurrente.
- El saldo online se mueve con Habbo.giveCredits(); tesoreria/auditoria usan transaccion SQL y compensacion inversa automatica si esa transaccion falla.
- No existe UPDATE directo sobre users.credits desde Tragaperras.
- Cada tirada queda auditada.

## Interaction

items_base.interaction_type que se usara en la capa DB/assets:

holo_slot_credits

No depende de un items.id concreto.

## Packets reservados

- 5042: Nitro -> servidor / SPIN (itemId)
- 5043: servidor -> Nitro / OPEN
- 5044: servidor -> Nitro / RESULT
- 5045: servidor -> Nitro / reservado para STATE

### 5043

1. itemId: int
2. bet: int
3. jackpot: int
4. credits: int

### 5044

1. success: boolean
2. message: string
3. itemId: int
4. creditsAfter: int
5. jackpotAfter: int
6. normalPrize: int
7. jackpotPrize: int
8. jackpotHit: boolean
9. symbol1: int
10. symbol2: int
11. symbol3: int

Simbolos:

- 0 cherry
- 1 lemon
- 2 bell
- 3 bar
- 4 diamond
- 5 seven
- 6 jackpot

## Tablas creadas al arrancar Arcturus

- holo_slots_state
- holo_slots_spins

La fila credits se crea con INSERT IGNORE, por lo que reiniciar el plugin NO vuelve a inyectar el seed si ya existe.