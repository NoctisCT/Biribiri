package com.retro.pokemonengine.entrenador;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MochilaTest
{
    private static final int POCION = 17;
    private static final int POKEBALL = 4;
    private static final int BICI = 450;

    @Test
    void dosAltasDelMismoObjetoSeSumanEnUnaEntrada()
    {
        Mochila mochila = new Mochila();

        mochila.anadir(POCION, Bolsillo.MEDICINAS, 5);
        mochila.anadir(POCION, Bolsillo.MEDICINAS, 5);

        assertEquals(10, mochila.cantidad(POCION));
        assertEquals(1, mochila.delBolsillo(Bolsillo.MEDICINAS).size());
    }

    @Test
    void elTopeDePilaEsNovecientosNoventaYNueveYElRestoSobra()
    {
        Mochila mochila = new Mochila();

        Mochila.Resultado primero = mochila.anadir(POKEBALL, Bolsillo.BALLS, 995);

        assertTrue(primero.ok());
        assertEquals(995, primero.aplicado());
        assertEquals(0, primero.sobrante());

        Mochila.Resultado segundo = mochila.anadir(POKEBALL, Bolsillo.BALLS, 10);

        assertTrue(segundo.ok());
        assertEquals(4, segundo.aplicado(), "Solo caben cuatro mas");
        assertEquals(6, segundo.sobrante());
        assertEquals(Bolsillo.TOPE_PILA, mochila.cantidad(POKEBALL));
    }

    @Test
    void conLaPilaLlenaAnadirFalla()
    {
        Mochila mochila = new Mochila();

        mochila.anadir(POKEBALL, Bolsillo.BALLS, 999);

        Mochila.Resultado resultado = mochila.anadir(POKEBALL, Bolsillo.BALLS, 1);

        assertFalse(resultado.ok());
        assertEquals(Mochila.SIN_SITIO, resultado.codigo());
    }

    @Test
    void losObjetosClaveNoSeTiranYSoloCabeUno()
    {
        Mochila mochila = new Mochila();

        Mochila.Resultado alta = mochila.anadir(BICI, Bolsillo.CLAVE, 3);

        assertEquals(1, alta.aplicado(), "Un objeto clave no se apila");
        assertEquals(2, alta.sobrante());

        Mochila.Resultado tirar = mochila.tirar(BICI, 1);

        assertFalse(tirar.ok());
        assertEquals(Mochila.NO_SE_PUEDE_TIRAR, tirar.codigo());
        assertEquals(1, mochila.cantidad(BICI));
        assertFalse(Bolsillo.CLAVE.sePuedeVender());
    }

    @Test
    void quitarMasDeLoQueHayFallaSinDejarNegativos()
    {
        Mochila mochila = new Mochila();

        mochila.anadir(POCION, Bolsillo.MEDICINAS, 2);

        Mochila.Resultado resultado = mochila.quitar(POCION, 3);

        assertFalse(resultado.ok());
        assertEquals(Mochila.NO_TIENES, resultado.codigo());
        assertEquals(2, mochila.cantidad(POCION));
    }

    @Test
    void quitarHastaCeroBorraLaEntrada()
    {
        Mochila mochila = new Mochila();

        mochila.anadir(POCION, Bolsillo.MEDICINAS, 2);

        assertTrue(mochila.quitar(POCION, 2).ok());
        assertEquals(0, mochila.cantidad(POCION));
        assertTrue(mochila.todas().isEmpty());
    }

    @Test
    void lasCantidadesNoPositivasSeRechazan()
    {
        Mochila mochila = new Mochila();

        assertEquals(Mochila.CANTIDAD_INVALIDA, mochila.anadir(POCION, Bolsillo.MEDICINAS, 0).codigo());
        assertEquals(Mochila.CANTIDAD_INVALIDA, mochila.anadir(POCION, Bolsillo.MEDICINAS, -5).codigo());
        assertEquals(Mochila.NO_TIENES, mochila.quitar(POCION, 1).codigo());
    }

    @Test
    void cadaObjetoRecuerdaSuBolsillo()
    {
        Mochila mochila = new Mochila();

        mochila.anadir(POCION, Bolsillo.MEDICINAS, 1);
        mochila.anadir(POKEBALL, Bolsillo.BALLS, 1);

        assertEquals(Bolsillo.MEDICINAS, mochila.bolsilloDe(POCION));
        assertEquals(Bolsillo.BALLS, mochila.bolsilloDe(POKEBALL));
        assertEquals(1, mochila.delBolsillo(Bolsillo.BALLS).size());
        assertTrue(mochila.delBolsillo(Bolsillo.BAYAS).isEmpty());
    }
}
