package com.retro.pokemonengine.entrenador;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AlmacenamientoTest
{
    private long siguienteId = 1L;

    private PokemonPoseido uno()
    {
        PokemonPoseido p = new PokemonPoseido();

        p.ponerId(this.siguienteId++);
        p.ponerUserId(7);
        p.ponerEspecieId(25);
        p.ponerNivel(10);
        p.ponerPsActual(30);

        return p;
    }

    private List<PokemonPoseido> conEquipoDe(int cuantos)
    {
        List<PokemonPoseido> todos = new ArrayList<>();

        for(int i = 0; i < cuantos; i++) Almacenamiento.anadir(todos, uno());

        return todos;
    }

    @Test
    void elEquipoAceptaSeisYElSeptimoVaALaCaja()
    {
        List<PokemonPoseido> todos = conEquipoDe(6);

        assertEquals(6, Almacenamiento.equipo(todos).size());
        assertEquals(-1, Almacenamiento.huecoLibreEnEquipo(todos));

        PokemonPoseido septimo = uno();

        assertTrue(Almacenamiento.anadir(todos, septimo).ok());
        assertFalse(septimo.enEquipo(), "El septimo va a la caja, no se pierde");
        assertEquals(0, septimo.caja());
        assertEquals(0, septimo.hueco());
    }

    @Test
    void depositarCompactaElEquipoSinDejarAgujeros()
    {
        List<PokemonPoseido> todos = conEquipoDe(4);
        PokemonPoseido segundo = Almacenamiento.equipo(todos).get(1);

        assertTrue(Almacenamiento.depositar(todos, segundo).ok());

        List<PokemonPoseido> equipo = Almacenamiento.equipo(todos);

        assertEquals(3, equipo.size());

        for(int i = 0; i < equipo.size(); i++)
        {
            assertEquals(i, equipo.get(i).hueco(), "El equipo no puede tener huecos sueltos");
        }
    }

    @Test
    void noSePuedeDepositarElUltimoQueCombate()
    {
        List<PokemonPoseido> todos = conEquipoDe(1);
        PokemonPoseido unico = Almacenamiento.equipo(todos).get(0);

        Almacenamiento.Resultado resultado = Almacenamiento.depositar(todos, unico);

        assertFalse(resultado.ok());
        assertEquals(Almacenamiento.EQUIPO_MINIMO, resultado.codigo());
        assertTrue(unico.enEquipo(), "Un intento fallido no puede mover nada");
    }

    @Test
    void unHuevoNoCuentaComoCombatiente()
    {
        List<PokemonPoseido> todos = conEquipoDe(2);
        List<PokemonPoseido> equipo = Almacenamiento.equipo(todos);

        equipo.get(1).ponerHuevo(true);

        assertEquals(1, Almacenamiento.combatientesEnEquipo(todos, null));
        assertFalse(Almacenamiento.depositar(todos, equipo.get(0)).ok(),
                "Dejar solo un huevo no vale");
    }

    @Test
    void unDebilitadoTampocoCuenta()
    {
        List<PokemonPoseido> todos = conEquipoDe(2);
        List<PokemonPoseido> equipo = Almacenamiento.equipo(todos);

        equipo.get(1).ponerPsActual(0);

        assertTrue(equipo.get(1).debilitado());
        assertEquals(1, Almacenamiento.combatientesEnEquipo(todos, null));
        assertFalse(Almacenamiento.depositar(todos, equipo.get(0)).ok());
    }

    @Test
    void siQuedaOtroSanoSiSePuedeDepositar()
    {
        List<PokemonPoseido> todos = conEquipoDe(2);
        PokemonPoseido primero = Almacenamiento.equipo(todos).get(0);

        assertTrue(Almacenamiento.depositar(todos, primero).ok());
        assertFalse(primero.enEquipo());
    }

    @Test
    void elPrimerHuecoLibreRecorreLasCajasEnOrden()
    {
        List<PokemonPoseido> todos = new ArrayList<>();

        Almacenamiento.Hueco hueco = Almacenamiento.primerHuecoLibreEnCajas(todos);

        assertEquals(0, hueco.caja());
        assertEquals(0, hueco.hueco());

        PokemonPoseido ocupa = uno();
        todos.add(ocupa);
        ocupa.ponerUbicacion(PokemonPoseido.CAJA);
        ocupa.ponerCaja(0);
        ocupa.ponerHueco(0);

        assertEquals(1, Almacenamiento.primerHuecoLibreEnCajas(todos).hueco());
    }

    @Test
    void conTodoLlenoLaCapturaSeRechaza()
    {
        List<PokemonPoseido> todos = conEquipoDe(PokemonPoseido.EQUIPO_MAX);

        for(int caja = 0; caja < Almacenamiento.CAJAS; caja++)
        {
            for(int hueco = 0; hueco < Almacenamiento.HUECOS_POR_CAJA; hueco++)
            {
                PokemonPoseido p = uno();

                p.ponerUbicacion(PokemonPoseido.CAJA);
                p.ponerCaja(caja);
                p.ponerHueco(hueco);
                todos.add(p);
            }
        }

        assertEquals(Almacenamiento.CAPACIDAD_CAJAS + PokemonPoseido.EQUIPO_MAX, todos.size());
        assertNull(Almacenamiento.primerHuecoLibreEnCajas(todos));

        Almacenamiento.Resultado resultado = Almacenamiento.anadir(todos, uno());

        assertFalse(resultado.ok());
        assertEquals(Almacenamiento.ALMACEN_LLENO, resultado.codigo());
    }

    @Test
    void moverAUnHuecoOcupadoIntercambia()
    {
        List<PokemonPoseido> todos = conEquipoDe(2);
        List<PokemonPoseido> equipo = Almacenamiento.equipo(todos);
        PokemonPoseido a = equipo.get(0);
        PokemonPoseido b = equipo.get(1);

        assertTrue(Almacenamiento.mover(todos, a, Almacenamiento.Hueco.enEquipo(1)).ok());

        assertEquals(1, a.hueco());
        assertEquals(0, b.hueco());
    }

    @Test
    void sacarDeLaCajaConElEquipoLlenoFallaSinTocarNada()
    {
        List<PokemonPoseido> todos = conEquipoDe(6);
        PokemonPoseido enCaja = uno();

        todos.add(enCaja);
        enCaja.ponerUbicacion(PokemonPoseido.CAJA);
        enCaja.ponerCaja(3);
        enCaja.ponerHueco(4);

        Almacenamiento.Resultado resultado = Almacenamiento.retirar(todos, enCaja);

        assertFalse(resultado.ok());
        assertEquals(Almacenamiento.EQUIPO_LLENO, resultado.codigo());
        assertEquals(3, enCaja.caja());
        assertEquals(4, enCaja.hueco());
    }

    @Test
    void unDestinoFueraDeRangoSeRechaza()
    {
        List<PokemonPoseido> todos = conEquipoDe(1);
        PokemonPoseido p = Almacenamiento.equipo(todos).get(0);

        assertEquals(Almacenamiento.DESTINO_INVALIDO,
                Almacenamiento.mover(todos, p, Almacenamiento.Hueco.enEquipo(9)).codigo());
        assertEquals(Almacenamiento.DESTINO_INVALIDO,
                Almacenamiento.mover(todos, p, Almacenamiento.Hueco.enCaja(99, 0)).codigo());
        assertEquals(Almacenamiento.DESTINO_INVALIDO,
                Almacenamiento.mover(todos, p, Almacenamiento.Hueco.enCaja(0, 30)).codigo());
    }

    @Test
    void intercambiarDentroDelEquipoNoDisparaElMinimo()
    {
        List<PokemonPoseido> todos = conEquipoDe(1);
        PokemonPoseido unico = Almacenamiento.equipo(todos).get(0);

        assertTrue(Almacenamiento.mover(todos, unico, Almacenamiento.Hueco.enEquipo(3)).ok(),
                "Moverse dentro del equipo no deja al equipo sin nadie");
    }
}
