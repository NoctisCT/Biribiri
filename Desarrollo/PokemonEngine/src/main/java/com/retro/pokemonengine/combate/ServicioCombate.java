package com.retro.pokemonengine.combate;

import java.util.ArrayList;
import java.util.List;
import java.util.function.IntFunction;

/**
 * El motor de turnos.
 *
 * Es una función: entra un estado y las acciones de ambos bandos, salen el estado
 * avanzado y la lista de eventos que el cliente reproducirá. No toca base de datos,
 * red ni el emulador, así que se prueba entero con JUnit y se reutiliza tal cual
 * en la lucha en sala de la fase 2.
 */
public final class ServicioCombate
{
    private final CatalogoCombate catalogo;
    private final IntFunction<EjecutorMovimiento.Mecanica> mecanicaPorMovimiento;

    public ServicioCombate(CatalogoCombate catalogo,
                           IntFunction<EjecutorMovimiento.Mecanica> mecanicaPorMovimiento)
    {
        this.catalogo = catalogo;
        this.mecanicaPorMovimiento = mecanicaPorMovimiento;
    }

    public List<Evento> resolverTurno(EstadoCombate estado, List<Accion> acciones)
    {
        List<Evento> eventos = new ArrayList<>();

        if(estado.terminado()) return eventos;

        estado.avanzarTurno();
        eventos.add(new Evento("turno_inicio").con("turno", estado.turno()));

        for(Accion accion : OrdenTurno.ordenar(estado, acciones, this.catalogo))
        {
            if(estado.terminado()) break;

            eventos.addAll(resolverAccion(estado, accion));
        }

        if(!estado.terminado())
        {
            eventos.addAll(FinDeTurno.resolver(estado));
        }

        return eventos;
    }

    private List<Evento> resolverAccion(EstadoCombate estado, Accion accion)
    {
        List<Evento> eventos = new ArrayList<>();

        PokemonCombate quien = estado.bando(accion.bando()).activo(accion.posicion());

        if(quien == null || quien.debilitado()) return eventos;

        switch(accion.tipo())
        {
            case HUIDA ->
            {
                eventos.add(new Evento("huida").con("pokemon", quien.nombre()));
                estado.terminar(1 - accion.bando());
                eventos.add(new Evento("combate_terminado").con("ganador", 1 - accion.bando()));
            }
            case CAMBIO -> eventos.addAll(cambiar(estado, accion, quien));
            case OBJETO ->
            {
                if(Volatiles.puedeUsarObjetos(quien))
                {
                    eventos.add(new Evento("objeto_usado")
                            .con("pokemon", quien.nombre()).con("item", accion.parametro()));
                }
                else
                {
                    eventos.add(new Evento("objeto_bloqueado")
                            .con("pokemon", quien.nombre()).con("motivo", "embargo"));
                }
            }
            case MOVIMIENTO -> eventos.addAll(mover(estado, accion, quien));
        }

        return eventos;
    }

    private List<Evento> cambiar(EstadoCombate estado, Accion accion, PokemonCombate saliente)
    {
        List<Evento> eventos = new ArrayList<>();

        Bando bando = estado.bando(accion.bando());
        int indice = accion.parametro();

        if(indice < 0 || indice >= bando.banquillo().size()) return eventos;

        PokemonCombate entrante = bando.banquillo().get(indice);

        if(entrante.debilitado()) return eventos;

        saliente.alSalir();

        bando.banquillo().set(indice, saliente);
        bando.posiciones().set(accion.posicion(), entrante);

        eventos.add(new Evento("cambio")
                .con("sale", saliente.nombre())
                .con("entra", entrante.nombre()));

        if(CondicionesBando.absorbePuasToxicas(entrante, bando))
        {
            eventos.add(new Evento("trampa_absorbida")
                    .con("pokemon", entrante.nombre()).con("trampa", "toxicspikes"));
        }

        eventos.addAll(CondicionesBando.alEntrar(entrante, bando, this.catalogo));

        if(entrante.debilitado())
        {
            eventos.add(new Evento("debilitado").con("pokemon", entrante.nombre()));
        }

        return eventos;
    }

    private List<Evento> mover(EstadoCombate estado, Accion accion, PokemonCombate atacante)
    {
        List<Evento> eventos = new ArrayList<>();

        Impedimentos.Resultado impedimento = Impedimentos.comprobar(atacante, estado.rng());
        eventos.addAll(impedimento.eventos());

        if(!impedimento.puedeActuar()) return eventos;

        if(accion.indiceMovimiento() < 0 || accion.indiceMovimiento() >= atacante.movimientos().size())
        {
            return eventos;
        }

        MovimientoEnCombate slot = atacante.movimientos().get(accion.indiceMovimiento());

        if(!slot.tienePp())
        {
            eventos.add(new Evento("sin_pp").con("pokemon", atacante.nombre()));
            return eventos;
        }

        MovimientoCatalogo movimiento = this.catalogo.movimiento(slot.moveId());

        if(movimiento == null) return eventos;

        Volatiles.Restriccion restriccion = Volatiles.puedeUsar(atacante, movimiento);

        if(!restriccion.permitido())
        {
            eventos.add(new Evento("movimiento_bloqueado")
                    .con("pokemon", atacante.nombre())
                    .con("movimiento", movimiento.nombreEs())
                    .con("motivo", restriccion.motivo()));

            return eventos;
        }

        slot.gastarPp();
        atacante.registrarMovimientoUsado(movimiento.id());

        Bando bandoDefensor = estado.bando(accion.bandoObjetivo());
        PokemonCombate defensor = bandoDefensor.activo(accion.posicionObjetivo());

        if(defensor == null || defensor.debilitado())
        {
            eventos.add(new Evento("sin_objetivo").con("pokemon", atacante.nombre()));
            return eventos;
        }

        String bloqueo = CondicionesBando.bloqueaMovimiento(bandoDefensor, movimiento);

        if(bloqueo != null)
        {
            eventos.add(new Evento("movimiento_bloqueado")
                    .con("pokemon", atacante.nombre())
                    .con("movimiento", movimiento.nombreEs())
                    .con("motivo", bloqueo));

            return eventos;
        }

        if(Campo.terrenoBloqueaPrioridad(estado.terreno(), movimiento, defensor))
        {
            eventos.add(new Evento("movimiento_bloqueado")
                    .con("pokemon", atacante.nombre())
                    .con("movimiento", movimiento.nombreEs())
                    .con("motivo", "psychicterrain"));

            return eventos;
        }

        EjecutorMovimiento.Mecanica mecanica = this.mecanicaPorMovimiento.apply(movimiento.id());

        if(mecanica == null) mecanica = EjecutorMovimiento.Mecanica.simple("damage");

        eventos.addAll(EjecutorMovimiento.ejecutar(
                estado, atacante, defensor, movimiento, mecanica, this.catalogo,
                estado.bando(accion.bando()), bandoDefensor));

        return eventos;
    }
}
