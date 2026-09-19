package com.retro.pokemonengine.entrenador;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class EscalaVisualTest
{
    @Test
    void losCuatroTamanosSalenDeLaAltura()
    {
        assertEquals("pequeno", EscalaVisual.de(0.30, null), "Pichu");
        assertEquals("mediano", EscalaVisual.de(0.40, null), "Pikachu");
        assertEquals("grande", EscalaVisual.de(1.20, null), "Lucario");
        assertEquals("muy_grande", EscalaVisual.de(2.10, null), "Snorlax");
    }

    @Test
    void losBordesCaenDelLadoCorrecto()
    {
        assertEquals("pequeno", EscalaVisual.de(0.34, null));
        assertEquals("mediano", EscalaVisual.de(0.35, null));
        assertEquals("mediano", EscalaVisual.de(0.79, null));
        assertEquals("grande", EscalaVisual.de(0.80, null));
        assertEquals("grande", EscalaVisual.de(1.49, null));
        assertEquals("muy_grande", EscalaVisual.de(1.50, null));
    }

    @Test
    void laAnulacionManualMandaSobreLaAltura()
    {
        assertEquals("grande", EscalaVisual.de(8.80, "grande"), "Onix mide 8,8 metros");
        assertEquals("muy_grande", EscalaVisual.de(8.80, null));
    }

    @Test
    void unaAnulacionInvalidaSeIgnora()
    {
        assertEquals("mediano", EscalaVisual.de(0.40, "gigantesco"));
        assertEquals("mediano", EscalaVisual.de(0.40, ""));
    }

    @Test
    void unaAlturaAusenteCaeEnMediano()
    {
        assertEquals("mediano", EscalaVisual.de(0.0, null));
        assertEquals("mediano", EscalaVisual.de(-1.0, null));
    }
}
