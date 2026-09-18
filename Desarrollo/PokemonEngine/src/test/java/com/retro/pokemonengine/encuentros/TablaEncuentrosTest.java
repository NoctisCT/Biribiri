package com.retro.pokemonengine.encuentros;

import com.retro.pokemonengine.combate.RngCombate;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TablaEncuentrosTest
{
    private static final int TIRADAS = 10_000;

    private Map<Integer, Integer> repartir(List<Encuentro> encuentros, long semilla)
    {
        RngCombate rng = new RngCombate(semilla);
        Map<Integer, Integer> cuenta = new HashMap<>();

        for(int i = 0; i < TIRADAS; i++)
        {
            Encuentro salida = TablaEncuentros.sortear(encuentros, rng);

            cuenta.merge(salida.especieId(), 1, Integer::sum);
        }

        return cuenta;
    }

    @Test
    void cadaEspecieSaleEnProporcionASuPeso()
    {
        List<Encuentro> tabla = List.of(
                Encuentro.de(16, 2, 4, 70),
                Encuentro.de(19, 2, 4, 25),
                Encuentro.de(25, 3, 5, 5));

        Map<Integer, Integer> cuenta = repartir(tabla, 20260919L);

        for(Encuentro encuentro : tabla)
        {
            double porcentaje = (cuenta.getOrDefault(encuentro.especieId(), 0) * 100.0) / TIRADAS;

            assertTrue(Math.abs(porcentaje - encuentro.peso()) <= 3.0,
                    "La especie " + encuentro.especieId() + " sale un " + porcentaje
                            + "% y su peso es " + encuentro.peso());
        }
    }

    @Test
    void unaListaVaciaDevuelveNullYNoRevienta()
    {
        RngCombate rng = new RngCombate(1L);

        assertNull(TablaEncuentros.sortear(List.of(), rng));
        assertNull(TablaEncuentros.sortear(null, rng));
    }

    @Test
    void unSoloEncuentroSaleSiempre()
    {
        Encuentro unico = Encuentro.de(129, 5, 15, 1);
        RngCombate rng = new RngCombate(7L);

        for(int i = 0; i < 1_000; i++)
        {
            assertSame(unico, TablaEncuentros.sortear(List.of(unico), rng));
        }
    }

    @Test
    void losPesosACeroNuncaSalen()
    {
        List<Encuentro> tabla = List.of(
                Encuentro.de(10, 2, 4, 100),
                Encuentro.de(144, 50, 50, 0));

        Map<Integer, Integer> cuenta = repartir(tabla, 99L);

        assertEquals(TIRADAS, cuenta.getOrDefault(10, 0));
        assertEquals(0, cuenta.getOrDefault(144, 0), "Un peso cero no puede aparecer nunca");
    }

    @Test
    void todosLosPesosACeroNoSorteanNada()
    {
        List<Encuentro> tabla = List.of(
                Encuentro.de(10, 2, 4, 0),
                Encuentro.de(13, 2, 4, 0));

        assertNull(TablaEncuentros.sortear(tabla, new RngCombate(3L)));
    }

    @Test
    void laMismaSemillaDaLaMismaSecuencia()
    {
        List<Encuentro> tabla = List.of(
                Encuentro.de(16, 2, 4, 45),
                Encuentro.de(19, 2, 4, 45),
                Encuentro.de(25, 3, 5, 10));

        List<Integer> primera = new ArrayList<>();
        List<Integer> segunda = new ArrayList<>();

        RngCombate unRng = new RngCombate(4242L);
        RngCombate otroRng = new RngCombate(4242L);

        for(int i = 0; i < 200; i++)
        {
            Encuentro uno = TablaEncuentros.sortear(tabla, unRng);
            Encuentro otro = TablaEncuentros.sortear(tabla, otroRng);

            primera.add(uno.especieId() * 100 + TablaEncuentros.nivel(uno, unRng));
            segunda.add(otro.especieId() * 100 + TablaEncuentros.nivel(otro, otroRng));
        }

        assertEquals(primera, segunda);
    }

    @Test
    void elNivelCaeDentroDelRangoYLlegaALosExtremos()
    {
        Encuentro encuentro = Encuentro.de(16, 3, 6, 1);
        RngCombate rng = new RngCombate(11L);

        boolean minimo = false;
        boolean maximo = false;

        for(int i = 0; i < 5_000; i++)
        {
            int nivel = TablaEncuentros.nivel(encuentro, rng);

            assertTrue(nivel >= 3 && nivel <= 6, "Nivel fuera de rango: " + nivel);

            if(nivel == 3) minimo = true;
            if(nivel == 6) maximo = true;
        }

        assertTrue(minimo, "Nunca salio el nivel minimo");
        assertTrue(maximo, "Nunca salio el nivel maximo");
    }

    @Test
    void unRangoDeUnSoloNivelSiempreDaEseNivel()
    {
        Encuentro encuentro = Encuentro.de(25, 5, 5, 1);
        RngCombate rng = new RngCombate(12L);

        for(int i = 0; i < 100; i++)
        {
            assertEquals(5, TablaEncuentros.nivel(encuentro, rng));
        }
    }

    @Test
    void soloEntranLosEncuentrosDelMetodoPedido()
    {
        List<Encuentro> tabla = List.of(
                new Encuentro(16, 0, 2, 4, 70, MetodoEncuentro.HIERBA, null),
                new Encuentro(129, 0, 5, 15, 30, MetodoEncuentro.PESCA, null));

        List<Encuentro> hierba = TablaEncuentros.disponibles(tabla, MetodoEncuentro.HIERBA, Franja.DIA);

        assertEquals(1, hierba.size());
        assertEquals(16, hierba.get(0).especieId());
    }

    @Test
    void soloEntranLosEncuentrosDeLaFranjaActual()
    {
        List<Encuentro> tabla = List.of(
                new Encuentro(16, 0, 2, 4, 70, MetodoEncuentro.HIERBA, null),
                new Encuentro(41, 0, 3, 5, 20, MetodoEncuentro.HIERBA, Franja.NOCHE),
                new Encuentro(21, 0, 3, 5, 20, MetodoEncuentro.HIERBA, Franja.DIA));

        List<Encuentro> deNoche = TablaEncuentros.disponibles(tabla, MetodoEncuentro.HIERBA, Franja.NOCHE);

        assertEquals(2, deNoche.size(), "El encuentro sin franja aparece a cualquier hora");
        assertTrue(deNoche.stream().anyMatch(e -> e.especieId() == 16));
        assertTrue(deNoche.stream().anyMatch(e -> e.especieId() == 41));
    }

    @Test
    void unaZonaSinFilasParaEsaFranjaNoSorteaNada()
    {
        List<Encuentro> tabla = List.of(
                new Encuentro(41, 0, 3, 5, 20, MetodoEncuentro.HIERBA, Franja.NOCHE));

        List<Encuentro> deDia = TablaEncuentros.disponibles(tabla, MetodoEncuentro.HIERBA, Franja.DIA);

        assertTrue(deDia.isEmpty());
        assertNull(TablaEncuentros.sortear(deDia, new RngCombate(5L)));
    }

    @Test
    void lasFranjasCubrenLasVeinticuatroHoras()
    {
        for(int hora = 0; hora < 24; hora++)
        {
            assertNotNull(Franja.deHora(hora));
        }

        assertEquals(Franja.MANANA, Franja.deHora(4));
        assertEquals(Franja.MANANA, Franja.deHora(9));
        assertEquals(Franja.DIA, Franja.deHora(10));
        assertEquals(Franja.DIA, Franja.deHora(17));
        assertEquals(Franja.TARDE, Franja.deHora(18));
        assertEquals(Franja.TARDE, Franja.deHora(20));
        assertEquals(Franja.NOCHE, Franja.deHora(21));
        assertEquals(Franja.NOCHE, Franja.deHora(3));
        assertEquals(Franja.NOCHE, Franja.deHora(24 + 2), "La hora se normaliza");
    }
}
