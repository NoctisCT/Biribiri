package com.retro.pokemonengine.entrenador;

import com.retro.pokemonengine.entrenador.Dex.EntradaDex;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DexTest
{
    @Test
    void verUnaEspecieYaCapturadaNoLaDegrada()
    {
        EntradaDex entrada = new EntradaDex(25);

        entrada.marcarCapturado(false);

        assertFalse(entrada.marcarVisto(), "Nada que escribir: ya estaba vista");
        assertTrue(entrada.capturado(), "Ver no puede borrar el capturado");
    }

    @Test
    void capturarMarcaVistoYCapturadoALaVez()
    {
        EntradaDex entrada = new EntradaDex(25);

        assertTrue(entrada.marcarCapturado(false));
        assertTrue(entrada.visto());
        assertTrue(entrada.capturado());
        assertFalse(entrada.shinyCapturado());
    }

    @Test
    void capturarUnVariocolorMarcaLasTresBanderas()
    {
        EntradaDex entrada = new EntradaDex(25);

        assertTrue(entrada.marcarCapturado(true));
        assertTrue(entrada.visto());
        assertTrue(entrada.capturado());
        assertTrue(entrada.shinyCapturado());
    }

    @Test
    void capturarUnVariocolorDespuesDeUnoNormalSiEsUnCambio()
    {
        EntradaDex entrada = new EntradaDex(25);

        entrada.marcarCapturado(false);

        assertTrue(entrada.marcarCapturado(true), "El shiny es nuevo, hay que escribirlo");
        assertFalse(entrada.marcarCapturado(true), "La segunda vez ya no cambia nada");
    }

    @Test
    void capturarUnoNormalDespuesDelShinyNoBorraElShiny()
    {
        EntradaDex entrada = new EntradaDex(25);

        entrada.marcarCapturado(true);
        entrada.marcarCapturado(false);

        assertTrue(entrada.shinyCapturado());
    }

    @Test
    void losContadoresCuentanEspeciesDistintas()
    {
        List<EntradaDex> entradas = List.of(
                new EntradaDex(1, true, true, false),
                new EntradaDex(4, true, false, false),
                new EntradaDex(7, true, true, true),
                new EntradaDex(10, false, false, false));

        assertEquals(3, Dex.vistos(entradas));
        assertEquals(2, Dex.capturados(entradas));
    }
}
