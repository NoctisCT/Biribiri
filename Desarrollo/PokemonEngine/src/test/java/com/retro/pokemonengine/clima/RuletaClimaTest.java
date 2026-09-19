package com.retro.pokemonengine.clima;

import com.retro.pokemonengine.combate.EstadoCombate;
import com.retro.pokemonengine.combate.RngCombate;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RuletaClimaTest
{
    private static final int TIRADAS = 10_000;

    private final List<RuletaClima.Peso> rutaUno = List.of(
            new RuletaClima.Peso(Clima.DESPEJADO, 70),
            new RuletaClima.Peso(Clima.LLUVIA, 20),
            new RuletaClima.Peso(Clima.SOL, 8),
            new RuletaClima.Peso(Clima.TORMENTA_ARENA, 2));

    private Map<Clima, Integer> reparto(List<RuletaClima.Peso> pesos, long semilla)
    {
        RngCombate rng = new RngCombate(semilla);
        Map<Clima, Integer> cuenta = new HashMap<>();

        for(int i = 0; i < TIRADAS; i++)
        {
            cuenta.merge(RuletaClima.sortear(pesos, rng), 1, Integer::sum);
        }

        return cuenta;
    }

    @Test
    void cadaClimaSaleEnProporcionASuPeso()
    {
        Map<Clima, Integer> cuenta = reparto(rutaUno, 20260919L);

        for(RuletaClima.Peso peso : rutaUno)
        {
            double porcentaje = (cuenta.getOrDefault(peso.clima(), 0) * 100.0) / TIRADAS;

            assertTrue(Math.abs(porcentaje - peso.peso()) <= 3.0,
                    peso.clima() + " sale un " + porcentaje + "% y su peso es " + peso.peso());
        }
    }

    @Test
    void sinPesosSiempreEstaDespejado()
    {
        assertEquals(Clima.DESPEJADO, RuletaClima.sortear(List.of(), new RngCombate(1L)));
        assertEquals(Clima.DESPEJADO, RuletaClima.sortear(null, new RngCombate(1L)));
    }

    @Test
    void todosLosPesosACeroDejanDespejado()
    {
        List<RuletaClima.Peso> pesos = List.of(
                new RuletaClima.Peso(Clima.LLUVIA, 0),
                new RuletaClima.Peso(Clima.NIEVE, 0));

        assertEquals(Clima.DESPEJADO, RuletaClima.sortear(pesos, new RngCombate(1L)));
    }

    @Test
    void unPesoACeroNuncaSale()
    {
        List<RuletaClima.Peso> pesos = List.of(
                new RuletaClima.Peso(Clima.DESPEJADO, 100),
                new RuletaClima.Peso(Clima.NIEVE, 0));

        assertEquals(0, reparto(pesos, 5L).getOrDefault(Clima.NIEVE, 0));
    }

    @Test
    void laMismaSemillaDaLaMismaSecuencia()
    {
        assertEquals(reparto(rutaUno, 42L), reparto(rutaUno, 42L));
    }

    @Test
    void elClimaSeTraduceAlMotorDeCombate()
    {
        assertEquals(EstadoCombate.SIN_CLIMA, Clima.DESPEJADO.aCampo());
        assertEquals("raindance", Clima.LLUVIA.aCampo());
        assertEquals("sunnyday", Clima.SOL.aCampo());
        assertEquals("sandstorm", Clima.TORMENTA_ARENA.aCampo());
        assertEquals("snowscape", Clima.NIEVE.aCampo());
        assertEquals("hail", Clima.GRANIZO.aCampo());
    }

    @Test
    void granizoYNieveSonClimasDistintosConNombresDistintos()
    {
        assertNotEquals(Clima.GRANIZO, Clima.NIEVE);
        assertNotEquals(Clima.GRANIZO.aCampo(), Clima.NIEVE.aCampo());
        assertEquals("Granizo", Clima.GRANIZO.nombreEs());
        assertEquals("Nieve", Clima.NIEVE.nombreEs());
        assertEquals("Tormenta de arena", Clima.TORMENTA_ARENA.nombreEs());
    }

    @Test
    void unNombreDesconocidoCaeEnDespejado()
    {
        assertEquals(Clima.LLUVIA, Clima.porNombre("LLUVIA"));
        assertEquals(Clima.LLUVIA, Clima.porNombre("lluvia"));
        assertEquals(Clima.DESPEJADO, Clima.porNombre("no-existe"));
        assertEquals(Clima.DESPEJADO, Clima.porNombre(null));
    }
}
