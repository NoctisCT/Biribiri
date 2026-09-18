package com.retro.pokemonengine.combate;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EjecutorMovimientoTest
{
    private final CatalogoFalso catalogo = new CatalogoFalso();

    private PokemonCombate electrico(String nombre)
    {
        return new PokemonCombate(1, 25, nombre, 50, CatalogoFalso.ELECTRICO, null, 200,
                new int[] { 200, 100, 100, 120, 100, 100 });
    }

    private PokemonCombate agua(String nombre)
    {
        return new PokemonCombate(2, 7, nombre, 50, CatalogoFalso.AGUA, null, 200,
                new int[] { 200, 100, 100, 100, 100, 90 });
    }

    private PokemonCombate tierra(String nombre)
    {
        return new PokemonCombate(3, 50, nombre, 50, CatalogoFalso.TIERRA, null, 200,
                new int[] { 200, 100, 100, 100, 100, 90 });
    }

    private EstadoCombate estado(PokemonCombate a, PokemonCombate b, long semilla)
    {
        Bando ba = new Bando(0);
        Bando bb = new Bando(1);
        ba.posiciones().add(a);
        bb.posiciones().add(b);

        return new EstadoCombate(ba, bb, new RngCombate(semilla));
    }

    private MovimientoCatalogo rayo()
    {
        return CatalogoFalso.mov(85, "Rayo", CatalogoFalso.ELECTRICO, "special", 90, 100, 0, "damage-ailment");
    }

    private boolean hay(List<Evento> eventos, String tipo)
    {
        return eventos.stream().anyMatch(e -> tipo.equals(e.tipo()));
    }

    @Test
    void unMovimientoDeDanoQuitaPsYAvisaDeLaEficacia()
    {
        PokemonCombate a = electrico("Pikachu");
        PokemonCombate b = agua("Squirtle");

        List<Evento> eventos = EjecutorMovimiento.ejecutar(
                estado(a, b, 1L), a, b, rayo(),
                EjecutorMovimiento.Mecanica.simple("damage"), catalogo);

        assertTrue(b.psActual() < b.psMax());
        assertTrue(hay(eventos, "dano"));
        assertTrue(hay(eventos, "muy_eficaz"), "Eléctrico contra Agua es x2");
    }

    @Test
    void laInmunidadCortaElMovimientoSinHacerDano()
    {
        PokemonCombate a = electrico("Pikachu");
        PokemonCombate b = tierra("Diglett");

        List<Evento> eventos = EjecutorMovimiento.ejecutar(
                estado(a, b, 1L), a, b, rayo(),
                EjecutorMovimiento.Mecanica.simple("damage"), catalogo);

        assertEquals(b.psMax(), b.psActual());
        assertTrue(hay(eventos, "sin_efecto"));
        assertFalse(hay(eventos, "dano"));
    }

    @Test
    void elStabAumentaElDanoFrenteAUnMovimientoDeOtroTipo()
    {
        PokemonCombate conStab = electrico("ConStab");
        PokemonCombate sinStab = agua("SinStab");
        PokemonCombate victimaA = agua("VictimaA");
        PokemonCombate victimaB = agua("VictimaB");

        EjecutorMovimiento.ejecutar(estado(conStab, victimaA, 5L), conStab, victimaA, rayo(),
                EjecutorMovimiento.Mecanica.simple("damage"), catalogo);
        EjecutorMovimiento.ejecutar(estado(sinStab, victimaB, 5L), sinStab, victimaB, rayo(),
                EjecutorMovimiento.Mecanica.simple("damage"), catalogo);

        assertTrue(victimaA.psActual() < victimaB.psActual(),
                "El del tipo del movimiento debe pegar más fuerte");
    }

    @Test
    void laDolenciaSeAplicaCuandoLaProbabilidadEsCien()
    {
        PokemonCombate a = electrico("Pikachu");
        PokemonCombate b = agua("Squirtle");

        EjecutorMovimiento.Mecanica m = new EjecutorMovimiento.Mecanica(
                "damage-ailment", PokemonCombate.PARALISIS, 100, null, null, null, null,
                0, 0, 0, 0, 0, List.of(), null, null);

        List<Evento> eventos = EjecutorMovimiento.ejecutar(estado(a, b, 1L), a, b, rayo(), m, catalogo);

        assertEquals(PokemonCombate.PARALISIS, b.estado());
        assertTrue(hay(eventos, "estado_aplicado"));
    }

    @Test
    void elSuenoRecibeSuContadorDeTurnos()
    {
        PokemonCombate a = electrico("Pikachu");
        PokemonCombate b = agua("Squirtle");

        EjecutorMovimiento.Mecanica m = new EjecutorMovimiento.Mecanica(
                "ailment", PokemonCombate.SUENO, 100, null, null, 2, 4,
                0, 0, 0, 0, 0, List.of(), null, null);

        MovimientoCatalogo canto = CatalogoFalso.mov(47, "Canto", CatalogoFalso.NORMAL, "status", null, 55, 0, "ailment");

        EjecutorMovimiento.ejecutar(estado(a, b, 9L), a, b, canto, m, catalogo);

        if(PokemonCombate.SUENO.equals(b.estado()))
        {
            assertTrue(b.contadorEstado() >= 2 && b.contadorEstado() <= 4,
                    "Contador fuera de rango: " + b.contadorEstado());
        }
    }

    @Test
    void laConfusionEsUnVolatilConTurnos()
    {
        PokemonCombate a = electrico("Pikachu");
        PokemonCombate b = agua("Squirtle");

        EjecutorMovimiento.Mecanica m = new EjecutorMovimiento.Mecanica(
                "ailment", PokemonCombate.CONFUSION, 100, null, null, 2, 5,
                0, 0, 0, 0, 0, List.of(), null, null);

        MovimientoCatalogo rayoConfuso = CatalogoFalso.mov(109, "Rayo Confuso", CatalogoFalso.NORMAL, "status", null, 100, 0, "ailment");

        EjecutorMovimiento.ejecutar(estado(a, b, 3L), a, b, rayoConfuso, m, catalogo);

        assertTrue(b.tieneVolatil(PokemonCombate.CONFUSION));
        assertTrue(b.volatil(PokemonCombate.CONFUSION) >= 2 && b.volatil(PokemonCombate.CONFUSION) <= 5);
        assertEquals(PokemonCombate.SIN_ESTADO, b.estado(), "La confusión no ocupa el hueco de estado");
    }

    @Test
    void losCambiosDeStatsPositivosVanAQuienUsaElMovimiento()
    {
        PokemonCombate a = electrico("Pikachu");
        PokemonCombate b = agua("Squirtle");

        EjecutorMovimiento.Mecanica m = new EjecutorMovimiento.Mecanica(
                "net-good-stats", "none", 0, null, null, null, null,
                0, 0, 0, 0, 0,
                List.of(new EjecutorMovimiento.CambioStat(Stat.ATAQUE, 2)), null, null);

        MovimientoCatalogo danzaEspada = CatalogoFalso.mov(14, "Danza Espada", CatalogoFalso.NORMAL, "status", null, null, 0, "net-good-stats");

        EjecutorMovimiento.ejecutar(estado(a, b, 1L), a, b, danzaEspada, m, catalogo);

        assertEquals(2, a.etapa(PokemonCombate.ETAPA_ATAQUE));
        assertEquals(0, b.etapa(PokemonCombate.ETAPA_ATAQUE));
    }

    @Test
    void losCambiosDeStatsNegativosVanAlRival()
    {
        PokemonCombate a = electrico("Pikachu");
        PokemonCombate b = agua("Squirtle");

        EjecutorMovimiento.Mecanica m = new EjecutorMovimiento.Mecanica(
                "damage-lower", "none", 0, null, null, null, null,
                0, 0, 0, 0, 100,
                List.of(new EjecutorMovimiento.CambioStat(Stat.DEFENSA, -1)), null, null);

        EjecutorMovimiento.ejecutar(estado(a, b, 1L), a, b, rayo(), m, catalogo);

        assertEquals(-1, b.etapa(PokemonCombate.ETAPA_DEFENSA));
    }

    @Test
    void elDrenajeCuraAlAtacante()
    {
        PokemonCombate a = electrico("Pikachu");
        PokemonCombate b = agua("Squirtle");

        a.recibirDano(150);
        int antes = a.psActual();

        EjecutorMovimiento.Mecanica m = new EjecutorMovimiento.Mecanica(
                "damage-heal", "none", 0, null, null, null, null,
                50, 0, 0, 0, 0, List.of(), null, null);

        List<Evento> eventos = EjecutorMovimiento.ejecutar(estado(a, b, 1L), a, b, rayo(), m, catalogo);

        assertTrue(a.psActual() > antes);
        assertTrue(hay(eventos, "drenaje"));
    }

    @Test
    void elRetrocesoDeDanoHiereAlAtacante()
    {
        PokemonCombate a = electrico("Pikachu");
        PokemonCombate b = agua("Squirtle");

        EjecutorMovimiento.Mecanica m = new EjecutorMovimiento.Mecanica(
                "damage", "none", 0, null, null, null, null,
                -33, 0, 0, 0, 0, List.of(), null, null);

        List<Evento> eventos = EjecutorMovimiento.ejecutar(estado(a, b, 1L), a, b, rayo(), m, catalogo);

        assertTrue(a.psActual() < a.psMax());
        assertTrue(hay(eventos, "retroceso_dano"));
    }

    @Test
    void elMultigolpeDeDosACincoRespetaElRango()
    {
        for(long semilla = 1; semilla <= 40; semilla++)
        {
            PokemonCombate a = electrico("Pikachu");
            PokemonCombate b = agua("Squirtle");

            EjecutorMovimiento.Mecanica m = new EjecutorMovimiento.Mecanica(
                    "damage", "none", 0, 2, 5, null, null,
                    0, 0, 0, 0, 0, List.of(), null, null);

            MovimientoCatalogo doblebofeton = CatalogoFalso.mov(3, "Doble Bofeton", CatalogoFalso.NORMAL, "physical", 15, 85, 0, "damage");

            List<Evento> eventos = EjecutorMovimiento.ejecutar(estado(a, b, semilla), a, b, doblebofeton, m, catalogo);

            for(Evento e : eventos)
            {
                if("multigolpe".equals(e.tipo()))
                {
                    int golpes = (int) e.datos().get("golpes");

                    assertTrue(golpes >= 2 && golpes <= 5, "Golpes fuera de rango: " + golpes);
                }
            }
        }
    }

    @Test
    void elStatDefensivoForzadoUsaLaDefensaFisica()
    {
        PokemonCombate a = electrico("Pikachu");
        PokemonCombate blandoFisico = new PokemonCombate(9, 9, "BlandoFisico", 50, CatalogoFalso.AGUA, null, 200,
                new int[] { 200, 100, 20, 100, 200, 90 });
        PokemonCombate blandoEspecial = new PokemonCombate(10, 10, "BlandoEspecial", 50, CatalogoFalso.AGUA, null, 200,
                new int[] { 200, 100, 200, 100, 20, 90 });

        EjecutorMovimiento.Mecanica psicocorte = new EjecutorMovimiento.Mecanica(
                "damage", "none", 0, null, null, null, null,
                0, 0, 0, 0, 0, List.of(), null, "def");

        EjecutorMovimiento.ejecutar(estado(a, blandoFisico, 7L), a, blandoFisico, rayo(), psicocorte, catalogo);
        EjecutorMovimiento.ejecutar(estado(a, blandoEspecial, 7L), a, blandoEspecial, rayo(), psicocorte, catalogo);

        assertTrue(blandoFisico.psActual() < blandoEspecial.psActual(),
                "Un movimiento especial con stat defensivo forzado debe pegar a la Defensa física");
    }

    @Test
    void unDebilitadoGeneraSuEvento()
    {
        PokemonCombate a = electrico("Pikachu");
        PokemonCombate b = agua("Squirtle");

        b.recibirDano(b.psMax() - 1);

        List<Evento> eventos = EjecutorMovimiento.ejecutar(
                estado(a, b, 1L), a, b, rayo(),
                EjecutorMovimiento.Mecanica.simple("damage"), catalogo);

        assertTrue(b.debilitado());
        assertTrue(hay(eventos, "debilitado"));
    }

    @Test
    void laProbabilidadDeCriticoSubeConElRatio()
    {
        assertEquals(4, EjecutorMovimiento.probabilidadCritico(0));
        assertTrue(EjecutorMovimiento.probabilidadCritico(1) > EjecutorMovimiento.probabilidadCritico(0));
        assertTrue(EjecutorMovimiento.probabilidadCritico(2) > EjecutorMovimiento.probabilidadCritico(1));
        assertEquals(100, EjecutorMovimiento.probabilidadCritico(9));
    }
}
