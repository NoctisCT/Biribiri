package com.retro.pokemonengine.entrenador;

import com.retro.pokemonengine.combate.EspecieCatalogo;
import com.retro.pokemonengine.combate.Stat;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ReglasEvolucionTest
{
    private EspecieGeneracion especie(int id, int baseHp, Integer h1, Integer h2, Integer oculta)
    {
        EspecieCatalogo base = new EspecieCatalogo(
                id, "Especie" + id, 13, null, baseHp, 55, 40, 50, 50, 90, 190, 112, "medium");

        return new EspecieGeneracion(base, h1, h2, oculta, 50.0, 70, 2560);
    }

    private PokemonPoseido criatura(EspecieCatalogo base)
    {
        PokemonPoseido p = new PokemonPoseido();

        p.ponerEspecieId(base.id());
        p.ponerNivel(30);
        p.ponerShiny(true);
        p.ivs()[Stat.PS.ordinal()] = 31;
        p.ponerPsActual(p.psMax(base) - 5);

        return p;
    }

    @Test
    void conservaLoQueDefineAlPokemon()
    {
        EspecieGeneracion antes = especie(172, 20, 9, null, 31);
        EspecieGeneracion despues = especie(25, 35, 9, null, 31);

        PokemonPoseido p = criatura(antes.base());

        ReglasEvolucion.evolucionar(p, antes.base(), despues, Set.of());

        assertEquals(25, p.especieId());
        assertEquals(30, p.nivel(), "El nivel no cambia al evolucionar");
        assertTrue(p.shiny(), "Un variocolor sigue siendo variocolor despues de evolucionar");
        assertEquals(31, p.iv(Stat.PS), "Los IV son del individuo, no de la especie");
        assertEquals(5, p.psMax(despues.base()) - p.psActual(),
                "Los PS maximos suben con las bases nuevas, pero el dano recibido se arrastra");
    }

    @Test
    void laHabilidadSeVuelveAResolverPorElHueco()
    {
        EspecieGeneracion antes = especie(172, 20, 9, null, 31);
        EspecieGeneracion despues = especie(25, 35, 900, 901, 902);

        PokemonPoseido p = criatura(antes.base());
        p.ponerHabilidadSlot(2);

        ReglasEvolucion.evolucionar(p, antes.base(), despues, Set.of());

        assertEquals(901, p.habilidadId(),
                "El hueco 2 pasa a ser la segunda habilidad de la especie nueva");
    }

    @Test
    void laOcultaSigueSiendoOculta()
    {
        EspecieGeneracion antes = especie(172, 20, 9, null, 31);
        EspecieGeneracion despues = especie(25, 35, 900, 901, 902);

        PokemonPoseido p = criatura(antes.base());
        p.ponerHabilidadSlot(3);

        ReglasEvolucion.evolucionar(p, antes.base(), despues, Set.of());

        assertEquals(902, p.habilidadId());
        assertEquals(3, p.habilidadSlot());
    }

    @Test
    void siLaEspecieNuevaNoTieneEsaHabilidadCaeEnLaPrimera()
    {
        EspecieGeneracion antes = especie(172, 20, 9, null, 31);
        EspecieGeneracion despues = especie(25, 35, 900, null, null);

        PokemonPoseido p = criatura(antes.base());
        p.ponerHabilidadSlot(2);

        ReglasEvolucion.evolucionar(p, antes.base(), despues, Set.of());

        assertEquals(900, p.habilidadId());
    }

    @Test
    void elDisfrazSobreviveSiLaEspecieNuevaLoTiene()
    {
        EspecieGeneracion antes = especie(172, 20, 9, null, 31);
        EspecieGeneracion despues = especie(25, 35, 9, null, 31);

        PokemonPoseido p = criatura(antes.base());
        p.ponerVariante("pikachu_disfraz");

        ReglasEvolucion.evolucionar(p, antes.base(), despues, Set.of("pikachu_disfraz"));

        assertEquals("pikachu_disfraz", p.variante());
    }

    @Test
    void siLaEspecieNuevaNoTieneEsaVarianteSeVuelveNormal()
    {
        EspecieGeneracion antes = especie(25, 35, 9, null, 31);
        EspecieGeneracion despues = especie(26, 60, 9, null, 31);

        PokemonPoseido p = criatura(antes.base());
        p.ponerVariante("pikachu_disfraz");

        ReglasEvolucion.evolucionar(p, antes.base(), despues, Set.of());

        assertEquals("normal", p.variante(),
                "Un Raichu no puede llevar el disfraz que solo existe dibujado para Pikachu");
    }

    @Test
    void unPokemonDebilitadoSigueDebilitado()
    {
        EspecieGeneracion antes = especie(172, 20, 9, null, 31);
        EspecieGeneracion despues = especie(25, 35, 9, null, 31);

        PokemonPoseido p = criatura(antes.base());
        p.ponerPsActual(0);

        ReglasEvolucion.evolucionar(p, antes.base(), despues, Set.of());

        assertEquals(0, p.psActual(), "Evolucionar no cura");
    }
}
