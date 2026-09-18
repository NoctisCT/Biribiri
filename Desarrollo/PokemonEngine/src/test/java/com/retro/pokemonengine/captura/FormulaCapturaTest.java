package com.retro.pokemonengine.captura;

import com.retro.pokemonengine.combate.PokemonCombate;
import com.retro.pokemonengine.combate.RngCombate;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FormulaCapturaTest
{
    private static final int TIRADAS = 10_000;

    private static final int POKE_BALL = 10;
    private static final int SUPER_BALL = 15;
    private static final int ULTRA_BALL = 20;

    private double porcentajeCapturas(int psMax, int psActual, int catchRate, int ball,
                                      String estado, long semilla)
    {
        RngCombate rng = new RngCombate(semilla);
        int capturas = 0;

        for(int i = 0; i < TIRADAS; i++)
        {
            if(FormulaCaptura.intentar(psMax, psActual, catchRate, ball, estado, rng).capturado()) capturas++;
        }

        return (capturas * 100.0) / TIRADAS;
    }

    @Test
    void laMasterBallCapturaSiempreAunqueSeaUnLegendarioAPsLlenos()
    {
        RngCombate rng = new RngCombate(1L);

        for(int i = 0; i < 1_000; i++)
        {
            FormulaCaptura.Resultado resultado = FormulaCaptura.intentar(
                    300, 300, 3, FormulaCaptura.RATIO_CAPTURA_SEGURA, PokemonCombate.SIN_ESTADO, rng);

            assertTrue(resultado.capturado());
            assertEquals(FormulaCaptura.SACUDIDAS, resultado.sacudidas());
        }
    }

    @Test
    void unaPresaFacilACasiCeroPsConUltraBallCaeCasiSiempre()
    {
        double porcentaje = porcentajeCapturas(100, 1, 255, ULTRA_BALL, PokemonCombate.SIN_ESTADO, 7L);

        assertTrue(porcentaje > 95.0, "Capturo un " + porcentaje + "%");
    }

    @Test
    void unLegendarioAPsLlenosConPokeBallNoCaeCasiNunca()
    {
        double porcentaje = porcentajeCapturas(300, 300, 3, POKE_BALL, PokemonCombate.SIN_ESTADO, 7L);

        assertTrue(porcentaje < 2.0, "Capturo un " + porcentaje + "%");
    }

    @Test
    void bajarLosPsSubeLaProbabilidadDeFormaMonotona()
    {
        int anterior = 0;

        for(int ps = 200; ps >= 1; ps -= 10)
        {
            int b = FormulaCaptura.valorB(
                    FormulaCaptura.valorA(200, ps, 45, SUPER_BALL, PokemonCombate.SIN_ESTADO));

            assertTrue(b >= anterior, "Con " + ps + " PS la probabilidad bajo: " + b + " < " + anterior);

            anterior = b;
        }
    }

    @Test
    void dormirSubeLaProbabilidadFrenteAlMismoCasoSinEstado()
    {
        int sinEstado = FormulaCaptura.valorA(200, 60, 45, SUPER_BALL, PokemonCombate.SIN_ESTADO);
        int dormido = FormulaCaptura.valorA(200, 60, 45, SUPER_BALL, PokemonCombate.SUENO);
        int paralizado = FormulaCaptura.valorA(200, 60, 45, SUPER_BALL, PokemonCombate.PARALISIS);

        assertTrue(dormido > paralizado, "Dormido deberia superar a paralizado");
        assertTrue(paralizado > sinEstado, "Paralizado deberia superar a estar sano");

        double conEstado = porcentajeCapturas(200, 60, 45, SUPER_BALL, PokemonCombate.SUENO, 3L);
        double sano = porcentajeCapturas(200, 60, 45, SUPER_BALL, PokemonCombate.SIN_ESTADO, 3L);

        assertTrue(conEstado > sano, "Dormido capturo un " + conEstado + "% y sano un " + sano + "%");
    }

    @Test
    void elVenenoGraveCuentaComoVeneno()
    {
        assertEquals(15, FormulaCaptura.bonusEstadoX10(PokemonCombate.VENENO_GRAVE));
        assertEquals(15, FormulaCaptura.bonusEstadoX10(PokemonCombate.VENENO));
        assertEquals(25, FormulaCaptura.bonusEstadoX10(PokemonCombate.CONGELACION));
        assertEquals(10, FormulaCaptura.bonusEstadoX10(PokemonCombate.CONFUSION));
        assertEquals(10, FormulaCaptura.bonusEstadoX10(null));
    }

    @Test
    void laMismaSemillaDaElMismoResultadoYLasMismasSacudidas()
    {
        RngCombate unRng = new RngCombate(20260919L);
        RngCombate otroRng = new RngCombate(20260919L);

        for(int i = 0; i < 500; i++)
        {
            FormulaCaptura.Resultado uno = FormulaCaptura.intentar(
                    120, 40, 45, SUPER_BALL, PokemonCombate.SIN_ESTADO, unRng);
            FormulaCaptura.Resultado otro = FormulaCaptura.intentar(
                    120, 40, 45, SUPER_BALL, PokemonCombate.SIN_ESTADO, otroRng);

            assertEquals(uno.capturado(), otro.capturado());
            assertEquals(uno.sacudidas(), otro.sacudidas());
            assertEquals(uno.a(), otro.a());
            assertEquals(uno.b(), otro.b());
        }
    }

    @Test
    void conCeroPsNiDivideEntreCeroNiPasaDelCienPorCien()
    {
        double porcentaje = porcentajeCapturas(100, 0, 45, POKE_BALL, PokemonCombate.SIN_ESTADO, 11L);

        assertTrue(porcentaje > 0.0);
        assertTrue(porcentaje <= 100.0);

        // Y tampoco revienta con datos imposibles.
        assertEquals(1, FormulaCaptura.valorA(0, 0, 0, POKE_BALL, PokemonCombate.SIN_ESTADO));
        assertEquals(
                FormulaCaptura.valorA(100, 100, 45, POKE_BALL, PokemonCombate.SIN_ESTADO),
                FormulaCaptura.valorA(100, 500, 45, POKE_BALL, PokemonCombate.SIN_ESTADO),
                "Mas PS de los que caben se recortan al maximo");
        assertTrue(FormulaCaptura.valorB(1) > 0);
    }

    @Test
    void lasSacudidasCuadranConLaCaptura()
    {
        RngCombate rng = new RngCombate(99L);
        boolean vistoFallo = false;
        boolean vistaCaptura = false;

        for(int i = 0; i < 2_000; i++)
        {
            FormulaCaptura.Resultado resultado = FormulaCaptura.intentar(
                    120, 30, 45, SUPER_BALL, PokemonCombate.SIN_ESTADO, rng);

            assertTrue(resultado.sacudidas() >= 0 && resultado.sacudidas() <= FormulaCaptura.SACUDIDAS);

            if(resultado.capturado())
            {
                assertEquals(FormulaCaptura.SACUDIDAS, resultado.sacudidas());
                vistaCaptura = true;
            }
            else
            {
                assertTrue(resultado.sacudidas() < FormulaCaptura.SACUDIDAS);
                vistoFallo = true;
            }
        }

        assertTrue(vistaCaptura, "Nunca capturo");
        assertTrue(vistoFallo, "Nunca fallo");
    }

    @Test
    void conAAlMaximoLaBallNoFalla()
    {
        RngCombate rng = new RngCombate(5L);

        FormulaCaptura.Resultado resultado = FormulaCaptura.intentar(
                100, 1, 255, ULTRA_BALL, PokemonCombate.SUENO, rng);

        assertEquals(FormulaCaptura.A_MAXIMO, resultado.a());
        assertTrue(resultado.capturado());
    }

    @Test
    void unaBallMejorCapturaMas()
    {
        double conPoke = porcentajeCapturas(200, 50, 45, POKE_BALL, PokemonCombate.SIN_ESTADO, 21L);
        double conSuper = porcentajeCapturas(200, 50, 45, SUPER_BALL, PokemonCombate.SIN_ESTADO, 21L);
        double conUltra = porcentajeCapturas(200, 50, 45, ULTRA_BALL, PokemonCombate.SIN_ESTADO, 21L);

        assertTrue(conSuper > conPoke, "Super " + conSuper + "% vs Poke " + conPoke + "%");
        assertTrue(conUltra > conSuper, "Ultra " + conUltra + "% vs Super " + conSuper + "%");
    }

    @Test
    void unaBallSinMultiplicadorNoCapturaPorAccidente()
    {
        // ball_ratio NULL llega como cero: la formula no debe regalar capturas.
        RngCombate rng = new RngCombate(13L);

        FormulaCaptura.Resultado resultado = FormulaCaptura.intentar(
                200, 200, 45, 0, PokemonCombate.SIN_ESTADO, rng);

        assertEquals(1, resultado.a());
        assertFalse(resultado.capturado() && resultado.sacudidas() < FormulaCaptura.SACUDIDAS);
    }
}
