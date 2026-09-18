package com.retro.pokemonengine.combate;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CondicionesBandoTest
{
    private final CatalogoFalso catalogo = new CatalogoFalso();

    private PokemonCombate luchador(String nombre, int tipo1, Integer tipo2)
    {
        return new PokemonCombate(nombre.hashCode(), 1, nombre, 50, tipo1, tipo2, 160,
                new int[] { 160, 100, 100, 100, 100, 100 });
    }

    private MovimientoCatalogo fisico()
    {
        return CatalogoFalso.mov(33, "Placaje", Tipos.NORMAL, "physical", 40, 100, 0, "damage");
    }

    private MovimientoCatalogo especial()
    {
        return CatalogoFalso.mov(85, "Rayo", Tipos.ELECTRICO, "special", 90, 100, 0, "damage");
    }

    private MovimientoCatalogo conPrioridad()
    {
        return CatalogoFalso.mov(98, "Ataque Rapido", Tipos.NORMAL, "physical", 40, 100, 1, "damage");
    }

    private MovimientoCatalogo aVarios()
    {
        return new MovimientoCatalogo(89, "Terremoto", Tipos.TIERRA, "physical", 100, 100,
                10, 0, "all-other-pokemon", "damage", true);
    }

    // --- Pantallas ---

    @Test
    void reflejoSoloReduceElDanoFisico()
    {
        Bando b = new Bando(1);
        b.ponerCondicion(CondicionesBando.REFLEJO, 5);

        assertEquals(0.5, CondicionesBando.modificadorPantalla(b, true, false));
        assertEquals(1.0, CondicionesBando.modificadorPantalla(b, false, false), "No cubre el especial");
    }

    @Test
    void pantallaLuzSoloReduceElDanoEspecial()
    {
        Bando b = new Bando(1);
        b.ponerCondicion(CondicionesBando.PANTALLA_LUZ, 5);

        assertEquals(0.5, CondicionesBando.modificadorPantalla(b, false, false));
        assertEquals(1.0, CondicionesBando.modificadorPantalla(b, true, false));
    }

    @Test
    void veloAuroraCubreLasDosClases()
    {
        Bando b = new Bando(1);
        b.ponerCondicion(CondicionesBando.VELO_AURORA, 5);

        assertEquals(0.5, CondicionesBando.modificadorPantalla(b, true, false));
        assertEquals(0.5, CondicionesBando.modificadorPantalla(b, false, false));
    }

    @Test
    void unCriticoAtraviesaLasPantallas()
    {
        Bando b = new Bando(1);
        b.ponerCondicion(CondicionesBando.VELO_AURORA, 5);

        assertEquals(1.0, CondicionesBando.modificadorPantalla(b, true, true),
                "Un critico ignora la pantalla");
    }

    // --- Protecciones ---

    @Test
    void veloSagradoBloqueaLosEstadosYNeblinaLasBajadas()
    {
        Bando conVelo = new Bando(1);
        Bando conNeblina = new Bando(1);
        Bando limpio = new Bando(1);

        conVelo.ponerCondicion(CondicionesBando.VELO_SAGRADO, 5);
        conNeblina.ponerCondicion(CondicionesBando.NEBLINA, 5);

        assertTrue(CondicionesBando.protegeDeEstados(conVelo));
        assertFalse(CondicionesBando.protegeDeEstados(limpio));
        assertTrue(CondicionesBando.protegeDeBajadas(conNeblina));
        assertFalse(CondicionesBando.protegeDeBajadas(limpio));
    }

    @Test
    void vientoAfinDuplicaLaVelocidad()
    {
        Bando b = new Bando(0);

        assertEquals(100, CondicionesBando.velocidadConViento(b, 100));

        b.ponerCondicion(CondicionesBando.VIENTO_AFIN, 4);

        assertEquals(200, CondicionesBando.velocidadConViento(b, 100));
    }

    @Test
    void anticipoBloqueaSoloLosMovimientosConPrioridad()
    {
        Bando b = new Bando(1);
        b.ponerCondicion(CondicionesBando.ANTICIPO, 1);

        assertEquals("quickguard", CondicionesBando.bloqueaMovimiento(b, conPrioridad()));
        assertEquals(null, CondicionesBando.bloqueaMovimiento(b, fisico()), "Sin prioridad no lo bloquea");
    }

    @Test
    void vastaGuardiaBloqueaSoloLosDeVariosObjetivos()
    {
        Bando b = new Bando(1);
        b.ponerCondicion(CondicionesBando.VASTA_GUARDIA, 1);

        assertEquals("wideguard", CondicionesBando.bloqueaMovimiento(b, aVarios()));
        assertEquals(null, CondicionesBando.bloqueaMovimiento(b, fisico()));
    }

    // --- Trampas de entrada ---

    @Test
    void puasEscalanConLasCapasYSeTopanEnTres()
    {
        Bando b = new Bando(0);

        assertTrue(CondicionesBando.anadirCapa(b, CondicionesBando.PUAS));
        assertTrue(CondicionesBando.anadirCapa(b, CondicionesBando.PUAS));
        assertTrue(CondicionesBando.anadirCapa(b, CondicionesBando.PUAS));
        assertFalse(CondicionesBando.anadirCapa(b, CondicionesBando.PUAS), "El maximo son 3 capas");
        assertEquals(3, b.condiciones().get(CondicionesBando.PUAS));
    }

    @Test
    void puasNoAfectanAlosVoladores()
    {
        Bando b = new Bando(0);
        CondicionesBando.anadirCapa(b, CondicionesBando.PUAS);

        PokemonCombate volador = luchador("Pidgey", Tipos.NORMAL, Tipos.VOLADOR);
        PokemonCombate terrestre = luchador("Rattata", Tipos.NORMAL, null);

        CondicionesBando.alEntrar(volador, b, catalogo);
        CondicionesBando.alEntrar(terrestre, b, catalogo);

        assertEquals(160, volador.psActual(), "Un Volador no pisa las puas");
        assertEquals(160 - 20, terrestre.psActual());
    }

    @Test
    void trampaRocasEscalaConLaEfectividadDeRocaYPegaAlosVoladores()
    {
        Bando b = new Bando(0);
        b.ponerCondicion(CondicionesBando.TRAMPA_ROCAS, 0);

        PokemonCombate volador = luchador("Pidgey", Tipos.NORMAL, Tipos.VOLADOR);

        List<Evento> eventos = CondicionesBando.alEntrar(volador, b, catalogo);

        assertTrue(volador.psActual() < 160, "Trampa Rocas si alcanza a los Voladores");
        assertTrue(eventos.stream().anyMatch(e -> "dano_trampa".equals(e.tipo())));
    }

    @Test
    void puasToxicasEnvenenanYConDosCapasGravemente()
    {
        Bando unaCapa = new Bando(0);
        Bando dosCapas = new Bando(0);

        CondicionesBando.anadirCapa(unaCapa, CondicionesBando.PUAS_TOXICAS);
        CondicionesBando.anadirCapa(dosCapas, CondicionesBando.PUAS_TOXICAS);
        CondicionesBando.anadirCapa(dosCapas, CondicionesBando.PUAS_TOXICAS);

        PokemonCombate a = luchador("A", Tipos.NORMAL, null);
        PokemonCombate c = luchador("C", Tipos.NORMAL, null);

        CondicionesBando.alEntrar(a, unaCapa, catalogo);
        CondicionesBando.alEntrar(c, dosCapas, catalogo);

        assertEquals(PokemonCombate.VENENO, a.estado());
        assertEquals(PokemonCombate.VENENO_GRAVE, c.estado());
    }

    @Test
    void unVenenoLimpiaLasPuasToxicasAlEntrar()
    {
        Bando b = new Bando(0);
        CondicionesBando.anadirCapa(b, CondicionesBando.PUAS_TOXICAS);

        PokemonCombate veneno = luchador("Grimer", Tipos.VENENO, null);

        assertTrue(CondicionesBando.absorbePuasToxicas(veneno, b));
        assertFalse(b.tieneCondicion(CondicionesBando.PUAS_TOXICAS));
        assertEquals(PokemonCombate.SIN_ESTADO, veneno.estado());
    }

    @Test
    void redViscosaBajaUnaEtapaDeVelocidad()
    {
        Bando b = new Bando(0);
        b.ponerCondicion(CondicionesBando.RED_VISCOSA, 0);

        PokemonCombate p = luchador("P", Tipos.NORMAL, null);

        CondicionesBando.alEntrar(p, b, catalogo);

        assertEquals(-1, p.etapa(PokemonCombate.ETAPA_VELOCIDAD));
    }

    // --- Clima y terreno ---

    @Test
    void elSolYLaLluviaSeCompensanEntreFuegoYAgua()
    {
        assertEquals(1.5, Campo.modificadorClima(Campo.SOL, Tipos.FUEGO));
        assertEquals(0.5, Campo.modificadorClima(Campo.SOL, Tipos.AGUA));
        assertEquals(1.5, Campo.modificadorClima(Campo.LLUVIA, Tipos.AGUA));
        assertEquals(0.5, Campo.modificadorClima(Campo.LLUVIA, Tipos.FUEGO));
        assertEquals(1.0, Campo.modificadorClima(Campo.SOL, Tipos.PLANTA));
    }

    @Test
    void laTormentaNoDanaARocaTierraNiAcero()
    {
        assertFalse(Campo.leDanaElClima(Campo.TORMENTA_ARENA, luchador("Onix", Tipos.ROCA, Tipos.TIERRA)));
        assertFalse(Campo.leDanaElClima(Campo.TORMENTA_ARENA, luchador("Magnemite", Tipos.ACERO, null)));
        assertTrue(Campo.leDanaElClima(Campo.TORMENTA_ARENA, luchador("Pikachu", Tipos.ELECTRICO, null)));
    }

    @Test
    void laTormentaSubeLaDefensaEspecialDeLosRoca()
    {
        assertEquals(1.5, Campo.defensaEspecialPorClima(Campo.TORMENTA_ARENA, luchador("Onix", Tipos.ROCA, null)));
        assertEquals(1.0, Campo.defensaEspecialPorClima(Campo.TORMENTA_ARENA, luchador("Pikachu", Tipos.ELECTRICO, null)));
    }

    @Test
    void laNieveSubeLaDefensaDeLosHielo()
    {
        assertEquals(1.5, Campo.defensaPorClima(Campo.NIEVE, luchador("Lapras", Tipos.AGUA, Tipos.HIELO)));
        assertEquals(1.0, Campo.defensaPorClima(Campo.NIEVE, luchador("Pikachu", Tipos.ELECTRICO, null)));
    }

    @Test
    void losTerrenosSubenUnTreintaPorCientoSuTipoAfin()
    {
        PokemonCombate terrestre = luchador("A", Tipos.NORMAL, null);
        PokemonCombate otro = luchador("B", Tipos.NORMAL, null);

        assertEquals(1.3, Campo.modificadorTerreno(Campo.TERRENO_ELECTRICO, Tipos.ELECTRICO, terrestre, otro));
        assertEquals(1.3, Campo.modificadorTerreno(Campo.TERRENO_PLANTA, Tipos.PLANTA, terrestre, otro));
        assertEquals(1.3, Campo.modificadorTerreno(Campo.TERRENO_PSIQUICO, Tipos.PSIQUICO, terrestre, otro));
        assertEquals(0.5, Campo.modificadorTerreno(Campo.TERRENO_NIEBLA, Tipos.DRAGON, terrestre, otro));
    }

    @Test
    void elTerrenoNoAfectaAQuienNoPisaElSuelo()
    {
        PokemonCombate volador = luchador("Pidgey", Tipos.NORMAL, Tipos.VOLADOR);
        PokemonCombate otro = luchador("B", Tipos.NORMAL, null);

        assertEquals(1.0, Campo.modificadorTerreno(Campo.TERRENO_ELECTRICO, Tipos.ELECTRICO, volador, otro),
                "Un Volador no se beneficia del terreno");
    }

    @Test
    void elTerrenoElectricoImpideDormirYElDeNieblaCualquierEstado()
    {
        PokemonCombate terrestre = luchador("A", Tipos.NORMAL, null);

        assertTrue(Campo.terrenoImpideEstado(Campo.TERRENO_ELECTRICO, PokemonCombate.SUENO, terrestre));
        assertFalse(Campo.terrenoImpideEstado(Campo.TERRENO_ELECTRICO, PokemonCombate.PARALISIS, terrestre));
        assertTrue(Campo.terrenoImpideEstado(Campo.TERRENO_NIEBLA, PokemonCombate.PARALISIS, terrestre));
    }

    @Test
    void elTerrenoPsiquicoBloqueaLaPrioridad()
    {
        PokemonCombate terrestre = luchador("A", Tipos.NORMAL, null);
        PokemonCombate volador = luchador("Pidgey", Tipos.NORMAL, Tipos.VOLADOR);

        assertTrue(Campo.terrenoBloqueaPrioridad(Campo.TERRENO_PSIQUICO, conPrioridad(), terrestre));
        assertFalse(Campo.terrenoBloqueaPrioridad(Campo.TERRENO_PSIQUICO, fisico(), terrestre),
                "Sin prioridad no lo bloquea");
        assertFalse(Campo.terrenoBloqueaPrioridad(Campo.TERRENO_PSIQUICO, conPrioridad(), volador),
                "A un Volador no le protege el terreno");
    }
}
