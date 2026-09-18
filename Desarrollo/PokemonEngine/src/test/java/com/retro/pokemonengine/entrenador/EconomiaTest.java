package com.retro.pokemonengine.entrenador;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EconomiaTest
{
    @Test
    void unGastoMayorQueElSaldoFallaYNoMueveNada()
    {
        Economia.Movimiento movimiento = Economia.gastar(100L, 150L, Economia.ORIGEN_TIENDA, "pocion");

        assertFalse(movimiento.ok());
        assertEquals(Economia.SALDO_INSUFICIENTE, movimiento.codigo());
        assertEquals(100L, movimiento.saldoResultante());
        assertEquals(0L, movimiento.delta());
    }

    @Test
    void gastarTodoElSaldoSiVale()
    {
        Economia.Movimiento movimiento = Economia.gastar(100L, 100L, Economia.ORIGEN_TIENDA, null);

        assertTrue(movimiento.ok());
        assertEquals(-100L, movimiento.delta());
        assertEquals(0L, movimiento.saldoResultante());
    }

    @Test
    void unIngresoDejaElSaldoQueToca()
    {
        Economia.Movimiento movimiento = Economia.ingresar(250L, 1000L, Economia.ORIGEN_COMBATE, "batalla-9");

        assertTrue(movimiento.ok());
        assertEquals(1000L, movimiento.delta());
        assertEquals(1250L, movimiento.saldoResultante());
        assertEquals(Economia.ORIGEN_COMBATE, movimiento.origen());
        assertEquals("batalla-9", movimiento.referencia());
    }

    @Test
    void elSaldoTieneTopeYElExcesoSeRecorta()
    {
        Economia.Movimiento movimiento = Economia.ingresar(
                Economia.SALDO_MAX - 10L, 500L, Economia.ORIGEN_TORNEO, null);

        assertTrue(movimiento.ok());
        assertEquals(Economia.SALDO_MAX, movimiento.saldoResultante());
        assertEquals(10L, movimiento.delta(), "El movimiento guarda lo que de verdad entro");
    }

    @Test
    void conElSaldoYaAlTopeNoHayMovimiento()
    {
        Economia.Movimiento movimiento = Economia.ingresar(
                Economia.SALDO_MAX, 500L, Economia.ORIGEN_TORNEO, null);

        assertFalse(movimiento.ok());
        assertEquals(Economia.SIN_CAMBIO, movimiento.codigo());
    }

    @Test
    void unDeltaCeroNoGeneraMovimiento()
    {
        Economia.Movimiento movimiento = Economia.aplicar(100L, 0L, Economia.ORIGEN_ADMIN, null);

        assertFalse(movimiento.ok());
        assertEquals(Economia.SIN_CAMBIO, movimiento.codigo());
    }

    @Test
    void ingresarYGastarNoDependenDelSignoQueLleguen()
    {
        assertEquals(50L, Economia.ingresar(0L, -50L, Economia.ORIGEN_ADMIN, null).delta(),
                "Ingresar siempre suma, venga el numero como venga");
        assertEquals(-50L, Economia.gastar(100L, -50L, Economia.ORIGEN_ADMIN, null).delta());
    }

    @Test
    void puedePagarNoAceptaPreciosNegativos()
    {
        assertTrue(Economia.puedePagar(100L, 100L));
        assertFalse(Economia.puedePagar(100L, 101L));
        assertFalse(Economia.puedePagar(100L, -1L));
    }

    @Test
    void unSaldoCorruptoNegativoSeTrataComoCero()
    {
        assertFalse(Economia.gastar(-500L, 1L, Economia.ORIGEN_TIENDA, null).ok());
        assertEquals(10L, Economia.ingresar(-500L, 10L, Economia.ORIGEN_ADMIN, null).saldoResultante());
    }
}
