package com.retro.pokemonengine.entrenador;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ReglasIntercambioTest
{
    private final ReglasIntercambio.Requisitos requisitos = new ReglasIntercambio.Requisitos(5, 0);

    private PokemonPoseido pokemon(boolean intercambiable)
    {
        PokemonPoseido p = new PokemonPoseido();

        p.ponerEspecieId(25);
        p.ponerIntercambiable(intercambiable);

        return p;
    }

    @Test
    void unPokemonMarcadoNoSeIntercambiaNiConTodoCumplido()
    {
        assertEquals(ReglasIntercambio.NO_INTERCAMBIABLE,
                ReglasIntercambio.puede(pokemon(false), 50, 8, requisitos));
    }

    @Test
    void sinLasCapturasMinimasNoSeIntercambia()
    {
        assertEquals(ReglasIntercambio.FALTA_DEX,
                ReglasIntercambio.puede(pokemon(true), 4, 8, requisitos));
    }

    @Test
    void conLasCapturasJustasSiSeIntercambia()
    {
        assertEquals(ReglasIntercambio.OK,
                ReglasIntercambio.puede(pokemon(true), 5, 0, requisitos));
    }

    @Test
    void lasInsigniasSoloFrenanCuandoSeExigen()
    {
        ReglasIntercambio.Requisitos conMedallas = new ReglasIntercambio.Requisitos(5, 3);

        assertEquals(ReglasIntercambio.FALTAN_INSIGNIAS,
                ReglasIntercambio.puede(pokemon(true), 10, 2, conMedallas));
        assertEquals(ReglasIntercambio.OK,
                ReglasIntercambio.puede(pokemon(true), 10, 3, conMedallas));
    }

    @Test
    void porDefectoUnPokemonNaceIntercambiableYSinDisfraz()
    {
        PokemonPoseido recien = new PokemonPoseido();

        assertTrue(recien.intercambiable());
        assertEquals("normal", recien.variante());
    }

    @Test
    void laVarianteVaciaVuelveANormal()
    {
        PokemonPoseido p = new PokemonPoseido();

        p.ponerVariante("pikachu_disfraz");
        assertEquals("pikachu_disfraz", p.variante());

        p.ponerVariante("  ");
        assertEquals("normal", p.variante(), "Una variante en blanco es no tener disfraz");

        p.ponerVariante(null);
        assertEquals("normal", p.variante());
    }

    @Test
    void elDisfrazYElVariocolorSonIndependientes()
    {
        PokemonPoseido p = new PokemonPoseido();

        p.ponerVariante("mewtwo_oscuro");
        p.ponerShiny(true);

        assertEquals("mewtwo_oscuro", p.variante());
        assertTrue(p.shiny(), "Un disfraz no deja de ser variocolor");

        p.ponerShiny(false);

        assertEquals("mewtwo_oscuro", p.variante());
        assertFalse(p.shiny());
    }
}
