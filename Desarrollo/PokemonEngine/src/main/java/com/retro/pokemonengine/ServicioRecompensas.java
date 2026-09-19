package com.retro.pokemonengine;

import com.eu.habbo.Emulator;
import com.retro.pokemonengine.batalla.Formato;
import com.retro.pokemonengine.batalla.Progreso;
import com.retro.pokemonengine.batalla.Recompensas;
import com.retro.pokemonengine.combate.EspecieCatalogo;
import com.retro.pokemonengine.combate.PokemonCombate;
import com.retro.pokemonengine.combate.Stat;
import com.retro.pokemonengine.entrenador.EspecieGeneracion;
import com.retro.pokemonengine.entrenador.PokemonPoseido;
import com.retro.pokemonengine.entrenador.ReglasEvolucion;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Types;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Cerrar un combate y repartir lo que haya dejado.
 *
 * Tres finales distintos y solo uno da premio:
 *
 * - **Ganado**: experiencia, EV, nivel, movimientos nuevos y evolucion.
 * - **Huida o captura**: no hay premio, pero el desgaste si se guarda — PS, PP
 *   y alteraciones. El combate ha pasado de verdad.
 * - **Anulado**: ni premio ni castigo, y tampoco se guarda el desgaste. Es lo
 *   acordado para cuando a alguien le echan de la sala a mitad: si anular
 *   costara algo, echar a alguien seria un arma.
 */
public final class ServicioRecompensas
{
    private ServicioRecompensas()
    {
    }

    public static void cerrar(ServicioBatalla.Sesion sesion, int ganadorBando, String motivo)
    {
        if(sesion == null) return;

        try
        {
            if(!ServicioBatalla.MOTIVO_ANULADA.equals(motivo)) guardarDesgaste(sesion);

            if(ganadorBando >= 0 && sesion.formato.daRecompensa()
                    && sesion.userIds[ganadorBando] != 0)
            {
                repartir(sesion, ganadorBando);
            }

            marcar(sesion, ganadorBando, motivo);
        }
        catch(Exception error)
        {
            System.out.println("[PokemonEngine] No se pudo cerrar el combate "
                    + sesion.id + ": " + error.getMessage());
        }
        finally
        {
            ServicioArena.soltar(sesion);
            ServicioBatalla.olvidar(sesion);
        }
    }

    /** Anular: el combate no ha ocurrido para nadie. */
    public static void anular(ServicioBatalla.Sesion sesion, String motivo)
    {
        if(sesion == null) return;

        ServicioBatalla.empujar(sesion, PokemonAcciones.BATALLA_EVENTOS,
                ServicioBatalla.unEvento(sesion, "combate_anulado", Map.of("motivo", motivo)));

        if(sesion.salvaje != null)
        {
            for(int userId : sesion.userIds)
            {
                if(userId != 0) ServicioEncuentros.limpiar(userId);
            }
        }

        cerrar(sesion, -1, ServicioBatalla.MOTIVO_ANULADA);
    }

    /** Los PS, los PP y el estado con los que sale cada Pokemon del combate. */
    private static void guardarDesgaste(ServicioBatalla.Sesion sesion) throws Exception
    {
        for(int bando = 0; bando < 2; bando++)
        {
            PokemonPoseido poseido = sesion.propios[bando];
            PokemonCombate enCampo = sesion.estado.bando(bando).activo(0);

            if(poseido == null || enCampo == null) continue;

            poseido.ponerPsActual(Math.max(0, enCampo.psActual()));
            poseido.ponerEstado(enCampo.estado());
            poseido.ponerEstadoTurnos(enCampo.contadorEstado());

            for(int i = 0; i < poseido.movimientos().size()
                    && i < enCampo.movimientos().size(); i++)
            {
                poseido.movimientos().get(i)
                        .ponerPpActual(enCampo.movimientos().get(i).ppActual());
            }

            ServicioEntrenador.guardar(poseido);
            ServicioEntrenador.guardarMovimientos(poseido);
        }
    }

    private static void repartir(ServicioBatalla.Sesion sesion, int ganadorBando) throws Exception
    {
        PokemonPoseido ganador = sesion.propios[ganadorBando];
        PokemonCombate derrotado = sesion.estado.bando(1 - ganadorBando).activo(0);

        if(ganador == null || derrotado == null) return;

        EspecieCatalogo especieDerrotado = ServicioPokedex.especie(derrotado.especieId());
        EspecieGeneracion especieGanador = ServicioGeneracion.instancia()
                .especie(ganador.especieId());

        if(especieDerrotado == null || especieGanador == null) return;

        long ganada = Recompensas.experiencia(
                especieDerrotado.baseExperience(),
                derrotado.nivelEfectivo(),
                1,
                sesion.formato != Formato.SALVAJE);

        Progreso.Resultado progreso = Progreso.aplicar(
                especieGanador.curva(),
                ganador.especieId(),
                ganador.nivel(),
                ganador.experiencia(),
                ganada,
                ServicioGeneracion.instancia(),
                evolucionesDe(ganador.especieId()));

        ganador.ponerExperiencia(progreso.experienciaFinal());
        ganador.ponerNivel(progreso.nivelDespues());

        aplicarEv(ganador, derrotado.especieId());

        List<Map<String, Object>> avisos = new ArrayList<>();

        avisos.add(evento("experiencia",
                Map.of("cantidad", ganada, "nivel", progreso.nivelDespues())));

        if(progreso.subio())
        {
            avisos.add(evento("sube_nivel", Map.of("nivel", progreso.nivelDespues())));
        }

        for(int moveId : progreso.movimientosAprendidos())
        {
            avisos.add(evento("aprende", Map.of("moveId", moveId)));
        }

        if(progreso.evolucionA() != null)
        {
            EspecieGeneracion nueva = ServicioGeneracion.instancia()
                    .especie(progreso.evolucionA());

            if(nueva != null)
            {
                ReglasEvolucion.evolucionar(
                        ganador, especieGanador.base(), nueva, variantesDe(nueva.id()));

                avisos.add(evento("evoluciona", Map.of("especieId", nueva.id())));

                ServicioEntrenador.registrarVisto(sesion.userIds[ganadorBando], nueva.id());
            }
        }

        ServicioEntrenador.guardar(ganador);

        ServicioBatalla.empujar(sesion, PokemonAcciones.BATALLA_EVENTOS,
                ServicioBatalla.sobre(sesion, avisos));
    }

    private static Map<String, Object> evento(String tipo, Map<String, Object> datos)
    {
        Map<String, Object> evento = new LinkedHashMap<>();

        evento.put("tipo", tipo);
        evento.put("datos", datos);

        return evento;
    }

    private static void aplicarEv(PokemonPoseido ganador, int especieDerrotadoId) throws Exception
    {
        Recompensas.Ev antes = new Recompensas.Ev(
                ganador.ev(Stat.PS), ganador.ev(Stat.ATAQUE), ganador.ev(Stat.DEFENSA),
                ganador.ev(Stat.ATAQUE_ESP), ganador.ev(Stat.DEFENSA_ESP),
                ganador.ev(Stat.VELOCIDAD));

        Recompensas.Ev despues = Recompensas.sumar(
                antes, repartoDe(especieDerrotadoId), ganador.pokerus());

        int[] evs = ganador.evs();

        evs[Stat.PS.ordinal()] = despues.ps();
        evs[Stat.ATAQUE.ordinal()] = despues.ataque();
        evs[Stat.DEFENSA.ordinal()] = despues.defensa();
        evs[Stat.ATAQUE_ESP.ordinal()] = despues.ataqueEsp();
        evs[Stat.DEFENSA_ESP.ordinal()] = despues.defensaEsp();
        evs[Stat.VELOCIDAD.ordinal()] = despues.velocidad();
    }

    private static List<Progreso.Evolucion> evolucionesDe(int especieId) throws Exception
    {
        List<Progreso.Evolucion> lista = new ArrayList<>();

        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            PreparedStatement p = c.prepareStatement(
                    "SELECT destino_id, nivel_minimo FROM pokemon_species_evolution" +
                    " WHERE origen_id = ? AND metodo = 'level-up'"))
        {
            p.setInt(1, especieId);

            try(ResultSet r = p.executeQuery())
            {
                while(r.next())
                {
                    int nivel = r.getObject("nivel_minimo") == null ? 0 : r.getInt("nivel_minimo");

                    lista.add(new Progreso.Evolucion(r.getInt("destino_id"), nivel));
                }
            }
        }

        return lista;
    }

    private static Recompensas.Ev repartoDe(int especieId) throws Exception
    {
        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            PreparedStatement p = c.prepareStatement(
                    "SELECT yield_hp, yield_attack, yield_defense, yield_sp_attack," +
                    " yield_sp_defense, yield_speed FROM pokemon_species WHERE id = ?"))
        {
            p.setInt(1, especieId);

            try(ResultSet r = p.executeQuery())
            {
                if(!r.next()) return new Recompensas.Ev(0, 0, 0, 0, 0, 0);

                return new Recompensas.Ev(
                        r.getInt("yield_hp"), r.getInt("yield_attack"),
                        r.getInt("yield_defense"), r.getInt("yield_sp_attack"),
                        r.getInt("yield_sp_defense"), r.getInt("yield_speed"));
            }
        }
    }

    /**
     * Las variantes que la especie nueva tiene dibujadas. Mientras no haya
     * sprites alternativos importados el conjunto es vacio, y cualquier disfraz
     * se pierde al evolucionar — que es la respuesta correcta por defecto.
     */
    private static Set<String> variantesDe(int especieId)
    {
        return new HashSet<>();
    }

    private static void marcar(ServicioBatalla.Sesion sesion, int ganadorBando, String motivo)
            throws Exception
    {
        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            PreparedStatement p = c.prepareStatement(
                    "UPDATE pokemon_battles SET estado = ?, ganador_user_id = ?," +
                    " motivo_fin = ?, terminada_en = CURRENT_TIMESTAMP WHERE id = ?"))
        {
            p.setString(1, ServicioBatalla.MOTIVO_ANULADA.equals(motivo) ? "anulada" : "terminada");

            if(ganadorBando < 0 || sesion.userIds[ganadorBando] == 0)
            {
                p.setNull(2, Types.INTEGER);
            }
            else
            {
                p.setInt(2, sesion.userIds[ganadorBando]);
            }

            p.setString(3, motivo);
            p.setLong(4, sesion.id);
            p.executeUpdate();
        }
    }
}
