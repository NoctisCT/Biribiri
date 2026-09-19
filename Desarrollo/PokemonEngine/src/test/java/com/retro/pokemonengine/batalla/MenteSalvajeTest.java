package com.retro.pokemonengine.batalla;

import com.retro.pokemonengine.combate.Accion;
import com.retro.pokemonengine.combate.MovimientoEnCombate;
import com.retro.pokemonengine.combate.PokemonCombate;
import com.retro.pokemonengine.combate.RngCombate;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MenteSalvajeTest
{
    private PokemonCombate rattata(int... ppPorMovimiento)
    {
        PokemonCombate p = new PokemonCombate(
                0, 19, "Rattata", 2, 0, null, 15, new int[]{15, 8, 7, 5, 6, 9});

        for(int i = 0; i < ppPorMovimiento.length; i++)
        {
            p.movimientos().add(new MovimientoEnCombate(30 + i, 35, ppPorMovimiento[i]));
        }

        return p;
    }

    @Test
    void ataqueAlBandoContrarioYAlPokemonDeEnfrente()
    {
        Accion accion = MenteSalvaje.elegir(rattata(35, 35), 1, 0, new RngCombate(7L));

        assertEquals(Accion.Tipo.MOVIMIENTO, accion.tipo());
        assertEquals(1, accion.bando());
        assertEquals(0, accion.bandoObjetivo());
        assertEquals(0, accion.posicionObjetivo());
    }

    @Test
    void conElTiempoUsaTodosLosQueTiene()
    {
        RngCombate rng = new RngCombate(20260919L);
        Set<Integer> vistos = new HashSet<>();

        for(int i = 0; i < 500; i++)
        {
            vistos.add(MenteSalvaje.elegir(rattata(35, 35, 35, 35), 1, 0, rng).indiceMovimiento());
        }

        assertEquals(Set.of(0, 1, 2, 3), vistos, "Elegir siempre el mismo no es elegir");
    }

    @Test
    void nuncaUsaUnMovimientoSinPp()
    {
        RngCombate rng = new RngCombate(3L);

        for(int i = 0; i < 500; i++)
        {
            // Solo al tercero le quedan PP.
            assertEquals(2, MenteSalvaje.elegir(rattata(0, 0, 12, 0), 1, 0, rng)
                    .indiceMovimiento());
        }
    }

    @Test
    void sinPpEnNingunoSigueDevolviendoAlgoValido()
    {
        Accion accion = MenteSalvaje.elegir(rattata(0, 0), 1, 0, new RngCombate(1L));

        assertEquals(Accion.Tipo.MOVIMIENTO, accion.tipo());
        assertTrue(accion.indiceMovimiento() >= 0,
                "El motor ya emite sin_pp; lo que no puede es recibir un indice imposible");
    }

    @Test
    void sinMovimientosNoRevienta()
    {
        Accion accion = MenteSalvaje.elegir(rattata(), 1, 0, new RngCombate(1L));

        assertEquals(Accion.Tipo.MOVIMIENTO, accion.tipo());
    }
}
