package com.retro.pokemonengine.batalla;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PlanArenaTest
{
    /** Una sala de 10x10 entera caminable. */
    private final PlanArena.Transitable salaLibre = (x, y) -> x >= 0 && x < 10 && y >= 0 && y < 10;

    @Test
    void elCombateSalvajeSonTresHuecos()
    {
        // Entrenador, Pokemon, hueco, salvaje.
        assertEquals(4, PlanArena.roles(Formato.SALVAJE).size());

        // Entrenador, Pokemon, hueco, Pokemon, entrenador.
        assertEquals(5, PlanArena.roles(Formato.PVP_AMISTOSO).size());
    }

    @Test
    void laLineaSalvajeVaEntrenadorPokemonSalvaje()
    {
        // Direccion 2 es el este: cada hueco una baldosa mas a la derecha.
        PlanArena.Formacion f = PlanArena.enLinea(4, 4, 2, Formato.SALVAJE);

        assertEquals(4, f.de(PlanArena.ROL_ENTRENADOR_A).x());
        assertEquals(5, f.de(PlanArena.ROL_POKEMON_A).x());
        assertEquals(6, f.de(PlanArena.ROL_HUECO).x(), "El hueco del medio no lo ocupa nadie");
        assertEquals(7, f.de(PlanArena.ROL_SALVAJE).x());

        for(PlanArena.Hueco hueco : f.huecos()) assertEquals(4, hueco.y());
    }

    @Test
    void cadaBandoMiraAlContrario()
    {
        PlanArena.Formacion f = PlanArena.enLinea(4, 4, 2, Formato.SALVAJE);

        assertEquals(2, f.de(PlanArena.ROL_ENTRENADOR_A).direccion());
        assertEquals(2, f.de(PlanArena.ROL_POKEMON_A).direccion());
        assertEquals(6, f.de(PlanArena.ROL_SALVAJE).direccion(),
                "El salvaje mira al oeste, que es de donde viene el jugador");
    }

    @Test
    void enPvpLosEntrenadoresQuedanEnLosExtremos()
    {
        PlanArena.Formacion f = PlanArena.enLinea(2, 5, 2, Formato.PVP_AMISTOSO);

        assertEquals(2, f.de(PlanArena.ROL_ENTRENADOR_A).x());
        assertEquals(3, f.de(PlanArena.ROL_POKEMON_A).x());
        assertEquals(4, f.de(PlanArena.ROL_HUECO).x());
        assertEquals(5, f.de(PlanArena.ROL_POKEMON_B).x());
        assertEquals(6, f.de(PlanArena.ROL_ENTRENADOR_B).x());

        assertEquals(6, f.de(PlanArena.ROL_ENTRENADOR_B).direccion());
        assertEquals(6, f.de(PlanArena.ROL_POKEMON_B).direccion(),
                "El Pokemon mira al rival, no a la espalda de su entrenador");
    }

    @Test
    void enSalaLibreLaFormacionEmpiezaDondeEstaElJugador()
    {
        PlanArena.Formacion f = PlanArena.resolver(4, 4, Formato.SALVAJE, this.salaLibre);

        assertNotNull(f);
        assertEquals(4, f.de(PlanArena.ROL_ENTRENADOR_A).x());
        assertEquals(4, f.de(PlanArena.ROL_ENTRENADOR_A).y(),
                "Si cabe sin moverse, el jugador no se mueve");
    }

    @Test
    void siUnaDireccionNoCabeSeProbaraOtra()
    {
        // Solo cabe hacia el oeste: hay una sola fila de suelo.
        PlanArena.Transitable pasillo = (x, y) -> y == 4 && x >= 0 && x <= 9;

        PlanArena.Formacion f = PlanArena.resolver(9, 4, Formato.SALVAJE, pasillo);

        assertNotNull(f);
        assertEquals(6, f.direccion());
        assertEquals(6, f.de(PlanArena.ROL_SALVAJE).x());
    }

    @Test
    void siNoCabeEnNingunSitioDevuelveNulo()
    {
        // Una sola baldosa suelta: no hay linea de tres en ningun sentido.
        PlanArena.Transitable unaBaldosa = (x, y) -> x == 4 && y == 4;

        assertNull(PlanArena.resolver(4, 4, Formato.SALVAJE, unaBaldosa));
    }

    @Test
    void siNoCabeJustoDondeEstaSeBuscaCerca()
    {
        // Hueco de sobra en la fila 6; el jugador esta en (4,4), en una isla.
        PlanArena.Transitable apartado = (x, y) ->
                (x == 4 && y == 4) || (y == 6 && x >= 2 && x <= 9);

        PlanArena.Formacion f = PlanArena.resolver(4, 4, Formato.SALVAJE, apartado);

        assertNotNull(f);
        assertTrue(PlanArena.cabe(f, apartado));
        assertEquals(6, f.de(PlanArena.ROL_ENTRENADOR_A).y());
    }

    @Test
    void masAlladelRadioDeBusquedaYaNoSeBusca()
    {
        PlanArena.Transitable lejos = (x, y) ->
                (x == 0 && y == 0) || (y == 9 && x >= 0 && x <= 8);

        assertNull(PlanArena.resolver(0, 0, Formato.SALVAJE, lejos),
                "A nueve baldosas la formacion ya no es la de este jugador");
    }

    @Test
    void elRetadorCaminaHaciaElLadoEnElQueYaEsta()
    {
        // El que ancla esta en (5,5) y el rival al este, en (9,5). La linea
        // tiene que salir hacia el este para que el rival casi no ande.
        PlanArena.Formacion f = PlanArena.resolverHacia(
                5, 5, 9, 5, Formato.PVP_AMISTOSO, this.salaLibre);

        assertNotNull(f);
        assertEquals(5, f.de(PlanArena.ROL_ENTRENADOR_A).x(), "El que ancla no se mueve");
        assertEquals(5, f.de(PlanArena.ROL_ENTRENADOR_A).y());
        assertEquals(9, f.de(PlanArena.ROL_ENTRENADOR_B).x(), "Y el otro se planta enfrente");
        assertEquals(5, f.de(PlanArena.ROL_ENTRENADOR_B).y());
    }

    @Test
    void siElRivalEstaAlOtroLadoLaLineaSeDaLaVuelta()
    {
        PlanArena.Formacion f = PlanArena.resolverHacia(
                5, 5, 1, 5, Formato.PVP_AMISTOSO, this.salaLibre);

        assertNotNull(f);
        assertEquals(6, f.direccion(), "Hacia el oeste, que es donde esta el rival");
        assertEquals(1, f.de(PlanArena.ROL_ENTRENADOR_B).x());
    }

    @Test
    void losEntrenadoresAcabanACuatroBaldosas()
    {
        PlanArena.Formacion f = PlanArena.resolverHacia(
                5, 5, 9, 5, Formato.PVP_AMISTOSO, this.salaLibre);

        assertNotNull(f);
        assertEquals(4, PlanArena.distancia(
                f.de(PlanArena.ROL_ENTRENADOR_A).x(), f.de(PlanArena.ROL_ENTRENADOR_A).y(),
                f.de(PlanArena.ROL_ENTRENADOR_B).x(), f.de(PlanArena.ROL_ENTRENADOR_B).y()),
                "Entrenador - Pokemon - hueco - Pokemon - Entrenador son cuatro"
                        + " de distancia, y por eso el reto llega hasta cinco");
    }

    @Test
    void siNoCabeEnNingunSitioResolverHaciaTambienDevuelveNulo()
    {
        PlanArena.Transitable unaBaldosa = (x, y) -> x == 4 && y == 4;

        assertNull(PlanArena.resolverHacia(4, 4, 6, 4, Formato.PVP_AMISTOSO, unaBaldosa));
    }

    @Test
    void laDistanciaEsLaQueAndaUnAvatar()
    {
        // En diagonal se anda igual de rapido que en recto: distancia de Chebyshev.
        assertEquals(3, PlanArena.distancia(0, 0, 3, 3));
        assertEquals(5, PlanArena.distancia(2, 2, 7, 4));
    }

    @Test
    void cabeDiceQueNoCuandoAlgunHuecoEstaOcupado()
    {
        PlanArena.Formacion f = PlanArena.enLinea(4, 4, 2, Formato.SALVAJE);

        assertTrue(PlanArena.cabe(f, this.salaLibre));
        assertFalse(PlanArena.cabe(f, (x, y) -> this.salaLibre.puede(x, y) && x != 5));
    }
}
