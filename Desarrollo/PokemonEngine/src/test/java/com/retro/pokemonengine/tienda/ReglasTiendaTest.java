package com.retro.pokemonengine.tienda;

import com.retro.pokemonengine.entrenador.Bolsillo;
import com.retro.pokemonengine.entrenador.Mochila;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ReglasTiendaTest
{
    private static final int POKE_BALL = 4;
    private static final int POCION = 17;
    private static final int BICI = 427;

    private ReglasTienda.Articulo pokeBall()
    {
        return new ReglasTienda.Articulo(POKE_BALL, Bolsillo.BALLS, 200, 100, 0,
                ReglasTienda.EXISTENCIAS_ILIMITADAS);
    }

    @Test
    void comprarCobraLoJustoYEntregaElObjeto()
    {
        Mochila mochila = new Mochila();

        ReglasTienda.Resultado compra = ReglasTienda.comprar(pokeBall(), 5, 10_000L, 0, mochila);

        assertTrue(compra.ok());
        assertEquals(1_000, compra.dinero());
        assertEquals(5, compra.unidades());
        assertEquals(5, mochila.cantidad(POKE_BALL));
    }

    @Test
    void comprarMasDeLoQueCabeEnElBolsilloFallaYNoCobra()
    {
        Mochila mochila = new Mochila();

        mochila.anadir(POKE_BALL, Bolsillo.BALLS, Bolsillo.TOPE_PILA - 2);

        ReglasTienda.Resultado compra = ReglasTienda.comprar(pokeBall(), 5, 10_000L, 0, mochila);

        assertFalse(compra.ok());
        assertEquals(ReglasTienda.SIN_SITIO, compra.codigo());
        assertEquals(0, compra.dinero());
        assertEquals(Bolsillo.TOPE_PILA - 2, mochila.cantidad(POKE_BALL), "No debe entregar nada");
    }

    @Test
    void sinSaldoSuficienteFallaYNoEntrega()
    {
        Mochila mochila = new Mochila();

        ReglasTienda.Resultado compra = ReglasTienda.comprar(pokeBall(), 3, 500L, 0, mochila);

        assertFalse(compra.ok());
        assertEquals(ReglasTienda.SIN_SALDO, compra.codigo());
        assertEquals(0, mochila.cantidad(POKE_BALL));
    }

    @Test
    void justoElSaldoExactoSiCompra()
    {
        Mochila mochila = new Mochila();

        ReglasTienda.Resultado compra = ReglasTienda.comprar(pokeBall(), 3, 600L, 0, mochila);

        assertTrue(compra.ok());
        assertEquals(600, compra.dinero());
    }

    @Test
    void unObjetoConInsigniaRequeridaSeRechazaSinElla()
    {
        ReglasTienda.Articulo superPocion = new ReglasTienda.Articulo(
                POCION, Bolsillo.MEDICINAS, 700, 350, 3, ReglasTienda.EXISTENCIAS_ILIMITADAS);

        Mochila mochila = new Mochila();

        ReglasTienda.Resultado sinInsignias = ReglasTienda.comprar(superPocion, 1, 10_000L, 2, mochila);

        assertFalse(sinInsignias.ok());
        assertEquals(ReglasTienda.SIN_INSIGNIAS, sinInsignias.codigo());
        assertEquals(0, mochila.cantidad(POCION));

        assertTrue(ReglasTienda.comprar(superPocion, 1, 10_000L, 3, mochila).ok());
    }

    @Test
    void elLimiteDeExistenciasSeRespeta()
    {
        ReglasTienda.Articulo limitado = new ReglasTienda.Articulo(
                POCION, Bolsillo.MEDICINAS, 300, 150, 0, 2);

        Mochila mochila = new Mochila();

        assertFalse(ReglasTienda.comprar(limitado, 3, 10_000L, 0, mochila).ok());
        assertEquals(ReglasTienda.SIN_EXISTENCIAS,
                ReglasTienda.comprar(limitado, 3, 10_000L, 0, mochila).codigo());

        ReglasTienda.Resultado compra = ReglasTienda.comprar(limitado, 2, 10_000L, 0, mochila);

        assertTrue(compra.ok());
        assertEquals(2, compra.unidades());
    }

    @Test
    void unaTiendaSinExistenciasNoVendeNada()
    {
        ReglasTienda.Articulo agotado = new ReglasTienda.Articulo(
                POCION, Bolsillo.MEDICINAS, 300, 150, 0, 0);

        assertEquals(ReglasTienda.SIN_EXISTENCIAS,
                ReglasTienda.comprar(agotado, 1, 10_000L, 0, new Mochila()).codigo());
    }

    @Test
    void venderDaLaMitadDelPrecioDeCompra()
    {
        Mochila mochila = new Mochila();

        mochila.anadir(POCION, Bolsillo.MEDICINAS, 4);

        ReglasTienda.Articulo pocion = new ReglasTienda.Articulo(
                POCION, Bolsillo.MEDICINAS, 300, 150, 0, ReglasTienda.EXISTENCIAS_ILIMITADAS);

        ReglasTienda.Resultado venta = ReglasTienda.vender(pocion, 2, mochila);

        assertTrue(venta.ok());
        assertEquals(300, venta.dinero(), "Dos pociones a 150 de venta");
        assertEquals(2, mochila.cantidad(POCION));
    }

    @Test
    void noSePuedeVenderLoQueNoSeTiene()
    {
        ReglasTienda.Articulo pocion = new ReglasTienda.Articulo(
                POCION, Bolsillo.MEDICINAS, 300, 150, 0, ReglasTienda.EXISTENCIAS_ILIMITADAS);

        Mochila mochila = new Mochila();

        mochila.anadir(POCION, Bolsillo.MEDICINAS, 1);

        ReglasTienda.Resultado venta = ReglasTienda.vender(pocion, 2, mochila);

        assertFalse(venta.ok());
        assertEquals(ReglasTienda.NO_TIENES, venta.codigo());
        assertEquals(1, mochila.cantidad(POCION), "Un intento fallido no puede vaciar la mochila");
    }

    @Test
    void losObjetosClaveNoSeVenden()
    {
        Mochila mochila = new Mochila();

        mochila.anadir(BICI, Bolsillo.CLAVE, 1);

        ReglasTienda.Articulo bici = new ReglasTienda.Articulo(BICI, Bolsillo.CLAVE, 0, 0, 0,
                ReglasTienda.EXISTENCIAS_ILIMITADAS);

        ReglasTienda.Resultado venta = ReglasTienda.vender(bici, 1, mochila);

        assertFalse(venta.ok());
        assertEquals(ReglasTienda.NO_SE_VENDE, venta.codigo());
        assertEquals(1, mochila.cantidad(BICI));
    }

    @Test
    void lasCantidadesImposiblesSeRechazan()
    {
        Mochila mochila = new Mochila();

        assertEquals(ReglasTienda.CANTIDAD_INVALIDA,
                ReglasTienda.comprar(pokeBall(), 0, 10_000L, 0, mochila).codigo());
        assertEquals(ReglasTienda.CANTIDAD_INVALIDA,
                ReglasTienda.comprar(pokeBall(), -3, 10_000L, 0, mochila).codigo());
        assertEquals(ReglasTienda.CANTIDAD_INVALIDA,
                ReglasTienda.comprar(pokeBall(), ReglasTienda.UNIDADES_MAX + 1, 10_000_000L, 0, mochila)
                        .codigo());
        assertEquals(0, mochila.cantidad(POKE_BALL));
    }

    @Test
    void unObjetoQueNoEstaALaVentaNoSeCompra()
    {
        Mochila mochila = new Mochila();

        assertEquals(ReglasTienda.NO_ESTA_A_LA_VENTA,
                ReglasTienda.comprar(null, 1, 10_000L, 0, mochila).codigo());

        ReglasTienda.Articulo master = new ReglasTienda.Articulo(1, Bolsillo.BALLS, 0, 0, 0,
                ReglasTienda.EXISTENCIAS_ILIMITADAS);

        assertEquals(ReglasTienda.NO_ESTA_A_LA_VENTA,
                ReglasTienda.comprar(master, 1, 10_000L, 0, mochila).codigo(),
                "Un objeto a precio cero no se vende en tienda");
    }
}
