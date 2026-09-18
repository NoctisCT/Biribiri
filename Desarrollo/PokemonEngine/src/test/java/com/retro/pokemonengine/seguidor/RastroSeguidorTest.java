package com.retro.pokemonengine.seguidor;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RastroSeguidorTest
{
    @Test
    void alAparecerSeColocaSobreElJugadorSinCaminar()
    {
        RastroSeguidor rastro = new RastroSeguidor();

        RastroSeguidor.Paso paso = rastro.aparecer(5, 5, Direccion.SUR);

        assertTrue(rastro.colocado());
        assertEquals(5, paso.x());
        assertEquals(5, paso.y());
        assertTrue(paso.teletransporte(), "Aparecer no es un paso, es una aparicion");
    }

    @Test
    void ocupaLaBaldosaQueElJugadorDejaNoLaQuePisa()
    {
        RastroSeguidor rastro = new RastroSeguidor();

        rastro.aparecer(5, 5, Direccion.SUR);

        RastroSeguidor.Paso paso = rastro.alPasar(5, 5, 6, 5);

        assertEquals(5, paso.x(), "El seguidor se queda donde estaba el jugador");
        assertEquals(5, paso.y());
        assertFalse(paso.teletransporte());
    }

    @Test
    void elPrimerPasoSinHaberAparecidoLoColocaDetras()
    {
        RastroSeguidor rastro = new RastroSeguidor();

        RastroSeguidor.Paso paso = rastro.alPasar(2, 3, 3, 3);

        assertTrue(rastro.colocado());
        assertEquals(2, paso.x());
        assertEquals(3, paso.y());
        assertEquals(Direccion.ESTE, paso.direccion());
    }

    @Test
    void variosPasosSeguidosLoDejanSiempreAUnaBaldosa()
    {
        RastroSeguidor rastro = new RastroSeguidor();

        rastro.aparecer(0, 0, Direccion.SUR);

        int[][] camino = { { 0, 0, 1, 0 }, { 1, 0, 2, 0 }, { 2, 0, 3, 1 }, { 3, 1, 3, 2 } };

        for(int[] tramo : camino)
        {
            rastro.alPasar(tramo[0], tramo[1], tramo[2], tramo[3]);

            assertEquals(1, Direccion.distancia(rastro.x(), rastro.y(), tramo[2], tramo[3]),
                    "Tras el paso a (" + tramo[2] + ", " + tramo[3] + ") deberia estar a una baldosa");
        }

        assertEquals(3, rastro.x());
        assertEquals(1, rastro.y());
    }

    @Test
    void laDireccionEsLaDelVectorDelSeguidorNoLaDelJugador()
    {
        RastroSeguidor rastro = new RastroSeguidor();

        rastro.aparecer(5, 5, Direccion.NORTE);

        // El jugador va al este; el seguidor no se mueve de sitio, asi que conserva la suya.
        RastroSeguidor.Paso quieto = rastro.alPasar(5, 5, 6, 5);

        assertEquals(Direccion.NORTE, quieto.direccion(),
                "Si el seguidor no cambia de baldosa, no cambia de direccion");

        RastroSeguidor.Paso anda = rastro.alPasar(6, 5, 7, 5);

        assertEquals(Direccion.ESTE, anda.direccion());
    }

    @Test
    void unRodilloOTeletransporteLoPoneEncimaDelJugador()
    {
        RastroSeguidor rastro = new RastroSeguidor();

        rastro.aparecer(1, 1, Direccion.SUR);

        RastroSeguidor.Paso paso = rastro.alPasar(1, 1, 9, 9);

        assertTrue(paso.teletransporte());
        assertEquals(9, paso.x(), "No camina ocho baldosas: aparece con el jugador");
        assertEquals(9, paso.y());
    }

    @Test
    void siElSeguidorSeQuedaDescolgadoDaElSaltoEnUnPaso()
    {
        RastroSeguidor rastro = new RastroSeguidor();

        rastro.aparecer(0, 0, Direccion.SUR);

        // El jugador ya esta lejos y da un paso normal: el seguidor salta hasta detras de el.
        RastroSeguidor.Paso paso = rastro.alPasar(8, 8, 8, 9);

        assertTrue(paso.teletransporte());
        assertEquals(8, paso.x());
        assertEquals(8, paso.y());
    }

    @Test
    void alRetirarseDejaDeEstarColocado()
    {
        RastroSeguidor rastro = new RastroSeguidor();

        rastro.aparecer(3, 3, Direccion.SUR);
        rastro.retirar();

        assertFalse(rastro.colocado());

        RastroSeguidor.Paso vuelta = rastro.alPasar(7, 7, 7, 8);

        assertTrue(vuelta.teletransporte(), "Al volver a la sala aparece, no camina");
        assertEquals(7, vuelta.x());
        assertEquals(7, vuelta.y());
    }

    @Test
    void mirarACambiaSoloLaDireccion()
    {
        RastroSeguidor rastro = new RastroSeguidor();

        rastro.aparecer(5, 5, Direccion.NORTE);
        rastro.mirarA(5, 7);

        assertEquals(Direccion.SUR, rastro.direccion());
        assertEquals(5, rastro.x());
        assertEquals(5, rastro.y());
    }
}
