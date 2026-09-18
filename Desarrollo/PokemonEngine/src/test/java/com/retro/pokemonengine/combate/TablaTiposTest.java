package com.retro.pokemonengine.combate;

import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class TablaTiposTest
{
    private static final int ELECTRICO = 13;
    private static final int AGUA = 11;
    private static final int VOLADOR = 3;
    private static final int TIERRA = 5;
    private static final int PLANTA = 12;

    private TablaTipos tabla()
    {
        Map<Long, Double> m = new HashMap<>();

        m.put(TablaTipos.clave(ELECTRICO, AGUA), 2.0);
        m.put(TablaTipos.clave(ELECTRICO, VOLADOR), 2.0);
        m.put(TablaTipos.clave(ELECTRICO, TIERRA), 0.0);
        m.put(TablaTipos.clave(ELECTRICO, PLANTA), 0.5);

        return new TablaTipos(m);
    }

    @Test
    void unSoloTipoDefensor()
    {
        assertEquals(2.0, tabla().multiplicador(ELECTRICO, AGUA, null));
    }

    @Test
    void losDosTiposSeMultiplican()
    {
        // Gyarados es Agua/Volador: doblemente débil a Eléctrico.
        assertEquals(4.0, tabla().multiplicador(ELECTRICO, AGUA, VOLADOR));
    }

    @Test
    void laInmunidadGanaSobreLaDebilidad()
    {
        // Un Tierra/Volador es inmune a Eléctrico pese al x2 de Volador.
        assertEquals(0.0, tabla().multiplicador(ELECTRICO, TIERRA, VOLADOR));
    }

    @Test
    void debilidadYResistenciaSeCancelan()
    {
        assertEquals(1.0, tabla().multiplicador(ELECTRICO, AGUA, PLANTA));
    }

    @Test
    void loNoDeclaradoEsNeutro()
    {
        assertEquals(1.0, tabla().multiplicador(ELECTRICO, 99, null));
    }

    @Test
    void laClaveNoColisionaEntreTipos()
    {
        assertEquals(
                TablaTipos.clave(1, 2) == TablaTipos.clave(2, 1),
                false,
                "La clave debe distinguir atacante de defensor");
    }

    @Test
    void laTablaEsInmutableDesdeFuera()
    {
        Map<Long, Double> original = new HashMap<>();
        original.put(TablaTipos.clave(ELECTRICO, AGUA), 2.0);

        TablaTipos tabla = new TablaTipos(original);
        original.put(TablaTipos.clave(ELECTRICO, AGUA), 0.5);

        assertEquals(2.0, tabla.multiplicador(ELECTRICO, AGUA, null));
    }
}
