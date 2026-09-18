package com.retro.pokemonengine.seguidor;

import com.eu.habbo.util.pathfinding.Rotation;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class DireccionTest
{
    @Test
    void lasOchoDireccionesSonLasDeHabbo()
    {
        assertEquals(Direccion.NORTE, Direccion.desde(0, -1));
        assertEquals(Direccion.NORESTE, Direccion.desde(1, -1));
        assertEquals(Direccion.ESTE, Direccion.desde(1, 0));
        assertEquals(Direccion.SURESTE, Direccion.desde(1, 1));
        assertEquals(Direccion.SUR, Direccion.desde(0, 1));
        assertEquals(Direccion.SUROESTE, Direccion.desde(-1, 1));
        assertEquals(Direccion.OESTE, Direccion.desde(-1, 0));
        assertEquals(Direccion.NOROESTE, Direccion.desde(-1, -1));
    }

    /**
     * La prueba que de verdad importa: si Arcturus cambiase su mapeo de rotaciones,
     * el seguidor miraria hacia otro lado y esto lo cantaria.
     */
    @Test
    void coincideConRotationCalculateDelEmulador()
    {
        for(int dx = -3; dx <= 3; dx++)
        {
            for(int dy = -3; dy <= 3; dy++)
            {
                if(dx == 0 && dy == 0) continue;

                assertEquals(
                        Rotation.Calculate(0, 0, dx, dy),
                        Direccion.desde(dx, dy),
                        "Vector (" + dx + ", " + dy + ")");
            }
        }
    }

    @Test
    void sinDesplazamientoNoHayDireccionNueva()
    {
        assertEquals(Direccion.SIN_CAMBIO, Direccion.desde(0, 0));
        assertEquals(Direccion.SIN_CAMBIO, Direccion.entre(4, 4, 4, 4));
    }

    @Test
    void laOpuestaEsLaDeEnfrente()
    {
        assertEquals(Direccion.SUR, Direccion.opuesta(Direccion.NORTE));
        assertEquals(Direccion.NOROESTE, Direccion.opuesta(Direccion.SURESTE));
        assertEquals(Direccion.SIN_CAMBIO, Direccion.opuesta(Direccion.SIN_CAMBIO));
    }

    @Test
    void laDistanciaEsDeReyPorqueEnHabboSeAndaEnDiagonal()
    {
        assertEquals(1, Direccion.distancia(0, 0, 1, 1));
        assertEquals(1, Direccion.distancia(5, 5, 4, 5));
        assertEquals(3, Direccion.distancia(0, 0, 3, 1));
        assertEquals(0, Direccion.distancia(2, 2, 2, 2));
    }
}
