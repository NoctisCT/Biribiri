package com.retro.pokemonengine.batalla;

import com.retro.pokemonengine.combate.RngCombate;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ReglasHuidaTest
{
    private int veces(int propia, int rival, int intentos, int tiradas)
    {
        RngCombate rng = new RngCombate(20260919L);
        int salidas = 0;

        for(int i = 0; i < tiradas; i++)
        {
            if(ReglasHuida.intentar(propia, rival, intentos, rng)) salidas++;
        }

        return salidas;
    }

    @Test
    void siEresMasRapidoHuyesSiempre()
    {
        assertEquals(1000, veces(100, 50, 1, 1000),
                "Ser mas rapido es huida garantizada en los juegos");
    }

    @Test
    void contraUnRivalMuchoMasRapidoCuestaALaPrimera()
    {
        int salidas = veces(10, 200, 1, 10000);

        assertTrue(salidas > 0, "Nunca poder huir seria una jaula");
        assertTrue(salidas < 4000,
                "Con esa diferencia de velocidad no puede salir casi siempre: " + salidas);
    }

    @Test
    void cadaIntentoLoPoneMasFacil()
    {
        int primero = veces(10, 200, 1, 10000);
        int cuarto = veces(10, 200, 4, 10000);

        assertTrue(cuarto > primero,
                "El cuarto intento debe salir mas que el primero: " + primero + " -> " + cuarto);
    }

    @Test
    void contraUnRivalLentisimoSeHuyeSeguro()
    {
        // Velocidad 3: 3/4 = 0, y ahi la formula original dividiria por cero.
        assertEquals(500, veces(1, 3, 1, 500));
    }

    @Test
    void delEntrenadorNoSeHuye()
    {
        assertTrue(Formato.SALVAJE.huidaPermitida());
        assertFalse(Formato.PVP_AMISTOSO.huidaPermitida());
    }

    @Test
    void soloElSalvajeSeCapturaYSoloElSalvajeDaPremio()
    {
        assertTrue(Formato.SALVAJE.capturaPermitida());
        assertFalse(Formato.PVP_AMISTOSO.capturaPermitida());

        assertTrue(Formato.SALVAJE.daRecompensa());
        assertFalse(Formato.PVP_AMISTOSO.daRecompensa(),
                "Un amistoso que diera experiencia se farmearia con una segunda cuenta");
    }

    @Test
    void unFormatoDesconocidoCaeEnSalvaje()
    {
        assertEquals(Formato.SALVAJE, Formato.porNombre("lo-que-sea"));
        assertEquals(Formato.SALVAJE, Formato.porNombre(null));
        assertEquals(Formato.PVP_AMISTOSO, Formato.porNombre("pvp_amistoso"));
    }
}
