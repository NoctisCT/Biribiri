package com.retro.pokemonengine.entrenador;

import com.retro.pokemonengine.combate.PokemonCombate;
import com.retro.pokemonengine.combate.RngCombate;
import com.retro.pokemonengine.combate.Stat;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.HashSet;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GeneradorPokemonTest
{
    private static final int PIKACHU = 25;

    private EspecieGeneracion pikachu()
    {
        return CatalogoGeneracionFalso.especie(
                PIKACHU, "Pikachu", "medium", 9, null, 31, 50.0, 70);
    }

    private GeneradorPokemon.Opciones opciones()
    {
        return GeneradorPokemon.Opciones.salvaje(7, 1, 1);
    }

    @Test
    void losIvsCaenEnElRangoYSonReproducibles()
    {
        PokemonPoseido a = GeneradorPokemon.generar(pikachu(), 10, opciones(), new RngCombate(99L));
        PokemonPoseido b = GeneradorPokemon.generar(pikachu(), 10, opciones(), new RngCombate(99L));

        for(int iv : a.ivs())
        {
            assertTrue(iv >= 0 && iv <= PokemonPoseido.IV_MAX, "IV fuera de rango: " + iv);
        }

        assertTrue(Arrays.equals(a.ivs(), b.ivs()), "La misma semilla debe dar los mismos IV");
        assertEquals(a.naturaleza(), b.naturaleza());
        assertEquals(a.genero(), b.genero());
    }

    @Test
    void sinRatioDeHembrasNoHayGenero()
    {
        EspecieGeneracion magnemite = CatalogoGeneracionFalso.especie(
                81, "Magnemite", "medium", 42, null, null, null, 70);

        for(long semilla = 1; semilla <= 50; semilla++)
        {
            PokemonPoseido p = GeneradorPokemon.generar(magnemite, 10, opciones(), new RngCombate(semilla));

            assertEquals(PokemonCombate.GENERO_NINGUNO, p.genero());
        }
    }

    @Test
    void losRatiosExtremosNoTiranElDado()
    {
        EspecieGeneracion soloMacho = CatalogoGeneracionFalso.especie(
                128, "Tauros", "slow", 22, null, null, 0.0, 70);
        EspecieGeneracion soloHembra = CatalogoGeneracionFalso.especie(
                113, "Chansey", "fast", 30, null, null, 100.0, 140);

        for(long semilla = 1; semilla <= 50; semilla++)
        {
            assertEquals(PokemonCombate.GENERO_MACHO,
                    GeneradorPokemon.generar(soloMacho, 10, opciones(), new RngCombate(semilla)).genero());
            assertEquals(PokemonCombate.GENERO_HEMBRA,
                    GeneradorPokemon.generar(soloHembra, 10, opciones(), new RngCombate(semilla)).genero());
        }
    }

    @Test
    void unRatioDeUnOctavoDaCercaDeUnOctavoDeHembras()
    {
        EspecieGeneracion especie = CatalogoGeneracionFalso.especie(
                PIKACHU, "Pikachu", "medium", 9, null, null, 12.5, 70);

        RngCombate rng = new RngCombate(20260918L);
        int hembras = 0;

        for(int i = 0; i < 4000; i++)
        {
            if(GeneradorPokemon.generar(especie, 5, opciones(), rng).genero()
                    == PokemonCombate.GENERO_HEMBRA)
            {
                hembras++;
            }
        }

        assertTrue(hembras > 320 && hembras < 680,
                "Con 12,5% deberian salir unas 500 hembras de 4000, salieron " + hembras);
    }

    @Test
    void elShinyEsRaroPeroSale()
    {
        RngCombate rng = new RngCombate(4096L);
        int shinies = 0;

        for(int i = 0; i < 400_000; i++)
        {
            if(GeneradorPokemon.generar(pikachu(), 5, opciones(), rng).shiny()) shinies++;
        }

        // 400.000 tiradas a 1/4096 son unos 98 de media.
        assertTrue(shinies > 55 && shinies < 150,
                "Con 1/4096 deberian salir unos 98 shinies de 400.000, salieron " + shinies);
    }

    @Test
    void laHabilidadOcultaNoSaleSolaEnUnEncuentroNormal()
    {
        for(long semilla = 1; semilla <= 300; semilla++)
        {
            PokemonPoseido p = GeneradorPokemon.generar(pikachu(), 10, opciones(), new RngCombate(semilla));

            assertFalse(p.habilidadSlot() == 3, "La oculta no puede salir sin pedirla");
        }
    }

    @Test
    void laHabilidadOcultaSaleCuandoSePideAlCien()
    {
        GeneradorPokemon.Opciones conOculta = new GeneradorPokemon.Opciones(7, 100, 1, 1, 4, 1);

        PokemonPoseido p = GeneradorPokemon.generar(pikachu(), 10, conOculta, new RngCombate(3L));

        assertEquals(3, p.habilidadSlot());
        assertEquals(31, p.habilidadId());
    }

    @Test
    void unaEspecieConUnaSolaHabilidadSiempreRecibeEsa()
    {
        for(long semilla = 1; semilla <= 100; semilla++)
        {
            PokemonPoseido p = GeneradorPokemon.generar(pikachu(), 10, opciones(), new RngCombate(semilla));

            assertEquals(1, p.habilidadSlot());
            assertEquals(9, p.habilidadId());
        }
    }

    @Test
    void conDosHabilidadesSalenLasDos()
    {
        EspecieGeneracion especie = CatalogoGeneracionFalso.especie(
                PIKACHU, "Pikachu", "medium", 9, 31, null, 50.0, 70);

        boolean vistaPrimera = false;
        boolean vistaSegunda = false;

        for(long semilla = 1; semilla <= 60; semilla++)
        {
            int slot = GeneradorPokemon.generar(especie, 10, opciones(), new RngCombate(semilla)).habilidadSlot();

            if(slot == 1) vistaPrimera = true;
            if(slot == 2) vistaSegunda = true;
        }

        assertTrue(vistaPrimera && vistaSegunda, "Con dos habilidades deben salir las dos");
    }

    @Test
    void laExperienciaCuadraConElNivelYLosPsArrancanALlenar()
    {
        EspecieGeneracion especie = pikachu();

        PokemonPoseido p = GeneradorPokemon.generar(especie, 23, opciones(), new RngCombate(5L));

        assertEquals(23, p.nivel());
        assertEquals(TablaExperiencia.expParaNivel(especie.curva(), 23), p.experiencia());
        assertEquals(p.psMax(especie.base()), p.psActual());
        assertEquals(70, p.amistad());
        assertEquals(especie.base().baseHp(), 50, "La especie de prueba usa 50 de PS base");
        assertTrue(p.puedeCombatir());
    }

    @Test
    void losMovimientosSonLosCuatroUltimosAprendidos()
    {
        CatalogoGeneracionFalso catalogo = new CatalogoGeneracionFalso()
                .con(pikachu())
                .aprende(PIKACHU, 1, 1, 35)    // Impactrueno
                .aprende(PIKACHU, 2, 5, 30)
                .aprende(PIKACHU, 3, 10, 20)
                .aprende(PIKACHU, 4, 15, 15)
                .aprende(PIKACHU, 5, 20, 10)
                .aprende(PIKACHU, 6, 40, 5);   // fuera de nivel

        PokemonPoseido p = GeneradorPokemon.generar(pikachu(), 20, opciones(), new RngCombate(1L));
        GeneradorPokemon.asignarMovimientosIniciales(p, catalogo);

        assertEquals(4, p.movimientos().size());
        assertEquals(2, p.movimientos().get(0).moveId());
        assertEquals(5, p.movimientos().get(3).moveId());
        assertEquals(10, p.movimientos().get(3).ppBase(), "El PP base sale del catalogo");
        assertEquals(10, p.movimientos().get(3).ppActual(), "Nace con los PP llenos");
    }

    @Test
    void unMovimientoRepetidoEnElLearnsetNoOcupaDosHuecos()
    {
        // El learnset real trae movimientos repetidos: el Rattata de la prueba del
        // hito 5 nacio con el mismo ataque dos veces.
        CatalogoGeneracionFalso catalogo = new CatalogoGeneracionFalso()
                .con(pikachu())
                .aprende(PIKACHU, 1, 1, 35)
                .aprende(PIKACHU, 2, 4, 30)
                .aprende(PIKACHU, 2, 7, 30)
                .aprende(PIKACHU, 3, 10, 20)
                .aprende(PIKACHU, 4, 13, 15);

        PokemonPoseido p = GeneradorPokemon.generar(pikachu(), 20, opciones(), new RngCombate(1L));
        GeneradorPokemon.asignarMovimientosIniciales(p, catalogo);

        List<Integer> ids = p.movimientos().stream().map(MovimientoPoseido::moveId).toList();

        assertEquals(4, ids.size());
        assertEquals(4, new HashSet<>(ids).size(), "Ningun movimiento puede salir dos veces: " + ids);
        assertEquals(List.of(1, 2, 3, 4), ids, "Se quedan los mas recientes, en orden de aprendizaje");
    }

    @Test
    void siSolohayTresMovimientosDistintosNoInventaElCuarto()
    {
        CatalogoGeneracionFalso catalogo = new CatalogoGeneracionFalso()
                .con(pikachu())
                .aprende(PIKACHU, 1, 1, 35)
                .aprende(PIKACHU, 2, 4, 30)
                .aprende(PIKACHU, 1, 7, 35)
                .aprende(PIKACHU, 3, 10, 20);

        PokemonPoseido p = GeneradorPokemon.generar(pikachu(), 20, opciones(), new RngCombate(1L));
        GeneradorPokemon.asignarMovimientosIniciales(p, catalogo);

        assertEquals(List.of(2, 1, 3), p.movimientos().stream().map(MovimientoPoseido::moveId).toList());
    }

    @Test
    void conMenosDeCuatroMovimientosNoRellenaHuecos()
    {
        CatalogoGeneracionFalso catalogo = new CatalogoGeneracionFalso()
                .con(pikachu())
                .aprende(PIKACHU, 1, 1, 35)
                .aprende(PIKACHU, 2, 3, 30);

        PokemonPoseido p = GeneradorPokemon.generar(pikachu(), 5, opciones(), new RngCombate(1L));
        GeneradorPokemon.asignarMovimientosIniciales(p, catalogo);

        assertEquals(2, p.movimientos().size());
    }

    @Test
    void laConversionACombateArrastraPsEstadoYMovimientos()
    {
        CatalogoGeneracionFalso catalogo = new CatalogoGeneracionFalso()
                .con(pikachu())
                .aprende(PIKACHU, 1, 1, 35);

        EspecieGeneracion especie = pikachu();
        PokemonPoseido p = GeneradorPokemon.generar(especie, 50, opciones(), new RngCombate(8L));
        GeneradorPokemon.asignarMovimientosIniciales(p, catalogo);

        p.ponerPsActual(7);
        p.ponerEstado(PokemonCombate.QUEMADURA);

        PokemonCombate combatiente = p.aCombate(especie.base(), 50);

        assertEquals(7, combatiente.psActual(), "Entra al combate con los PS que tenia");
        assertEquals(PokemonCombate.QUEMADURA, combatiente.estado());
        assertEquals(1, combatiente.movimientos().size());
        assertEquals(50, p.nivel(), "El nivel efectivo no debe machacar el nivel real");
    }

    @Test
    void elNivelEfectivoDeTorneoNoCambiaElNivelGuardado()
    {
        EspecieGeneracion especie = pikachu();
        PokemonPoseido p = GeneradorPokemon.generar(especie, 100, opciones(), new RngCombate(8L));

        PokemonCombate a100 = p.aCombate(especie.base(), 100);
        PokemonCombate a50 = p.aCombate(especie.base(), 50);

        assertEquals(100, p.nivel());
        assertTrue(a50.psMax() < a100.psMax(), "A nivel 50 debe tener menos PS que a 100");
    }

    @Test
    void losEvRespetanElTopePorStatYElTotal()
    {
        PokemonPoseido p = GeneradorPokemon.generar(pikachu(), 10, opciones(), new RngCombate(1L));

        assertEquals(255, p.sumarEv(Stat.ATAQUE, 300), "El tope por stat es 255");
        assertEquals(0, p.sumarEv(Stat.ATAQUE, 10), "Ya esta al tope");
        assertEquals(255, p.sumarEv(Stat.VELOCIDAD, 300));
        assertEquals(0, p.sumarEv(Stat.DEFENSA, 10), "El total 510 ya esta agotado");
        assertEquals(PokemonPoseido.EV_MAX_TOTAL, p.evTotal());
    }

    @Test
    void elGeneradorNoDejaLaHabilidadSinAsignar()
    {
        PokemonPoseido p = GeneradorPokemon.generar(pikachu(), 10, opciones(), new RngCombate(2L));

        assertNotNull(p.habilidadId());
    }
}
