package com.retro.pokemonengine.entrenador;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Las reglas del equipo y de las cajas.
 *
 * Trabaja sobre la lista completa de Pokemon de un jugador y solo cambia los
 * campos de ubicacion: quien persiste es el servicio. Asi las reglas se pueden
 * probar sin base de datos.
 */
public final class Almacenamiento
{
    public static final int CAJAS = 32;
    public static final int HUECOS_POR_CAJA = 30;
    public static final int CAPACIDAD_CAJAS = CAJAS * HUECOS_POR_CAJA;

    public static final String OK = "OK";
    public static final String EQUIPO_LLENO = "EQUIPO_LLENO";
    public static final String ALMACEN_LLENO = "ALMACEN_LLENO";
    public static final String EQUIPO_MINIMO = "EQUIPO_MINIMO";
    public static final String DESTINO_INVALIDO = "DESTINO_INVALIDO";
    public static final String NO_ENCONTRADO = "NO_ENCONTRADO";

    private Almacenamiento()
    {
    }

    public record Resultado(boolean ok, String codigo)
    {
        public static Resultado bien()
        {
            return new Resultado(true, OK);
        }

        public static Resultado mal(String codigo)
        {
            return new Resultado(false, codigo);
        }
    }

    public record Hueco(String ubicacion, int caja, int hueco)
    {
        public static Hueco enEquipo(int hueco)
        {
            return new Hueco(PokemonPoseido.EQUIPO, 0, hueco);
        }

        public static Hueco enCaja(int caja, int hueco)
        {
            return new Hueco(PokemonPoseido.CAJA, caja, hueco);
        }
    }

    public static List<PokemonPoseido> equipo(List<PokemonPoseido> todos)
    {
        List<PokemonPoseido> salida = new ArrayList<>();

        for(PokemonPoseido p : todos)
        {
            if(p.enEquipo()) salida.add(p);
        }

        salida.sort(Comparator.comparingInt(PokemonPoseido::hueco));

        return salida;
    }

    public static List<PokemonPoseido> caja(List<PokemonPoseido> todos, int caja)
    {
        List<PokemonPoseido> salida = new ArrayList<>();

        for(PokemonPoseido p : todos)
        {
            if(!p.enEquipo() && p.caja() == caja) salida.add(p);
        }

        salida.sort(Comparator.comparingInt(PokemonPoseido::hueco));

        return salida;
    }

    public static PokemonPoseido en(List<PokemonPoseido> todos, Hueco destino)
    {
        boolean equipo = PokemonPoseido.EQUIPO.equals(destino.ubicacion());

        for(PokemonPoseido p : todos)
        {
            if(p.enEquipo() != equipo) continue;
            if(!equipo && p.caja() != destino.caja()) continue;
            if(p.hueco() == destino.hueco()) return p;
        }

        return null;
    }

    public static int huecoLibreEnEquipo(List<PokemonPoseido> todos)
    {
        List<PokemonPoseido> actual = equipo(todos);

        if(actual.size() >= PokemonPoseido.EQUIPO_MAX) return -1;

        for(int hueco = 0; hueco < PokemonPoseido.EQUIPO_MAX; hueco++)
        {
            if(en(todos, Hueco.enEquipo(hueco)) == null) return hueco;
        }

        return -1;
    }

    /** La primera caja con sitio, recorridas en orden, como el sistema de almacenamiento del juego. */
    public static Hueco primerHuecoLibreEnCajas(List<PokemonPoseido> todos)
    {
        for(int caja = 0; caja < CAJAS; caja++)
        {
            for(int hueco = 0; hueco < HUECOS_POR_CAJA; hueco++)
            {
                if(en(todos, Hueco.enCaja(caja, hueco)) == null) return Hueco.enCaja(caja, hueco);
            }
        }

        return null;
    }

    /** Cuenta los Pokemon en condiciones de combatir, sin contar al excluido. */
    public static int combatientesEnEquipo(List<PokemonPoseido> todos, PokemonPoseido excluido)
    {
        int total = 0;

        for(PokemonPoseido p : equipo(todos))
        {
            if(excluido != null && p == excluido) continue;
            if(p.puedeCombatir()) total++;
        }

        return total;
    }

    /**
     * Mete un Pokemon nuevo: al equipo si cabe y, si no, a la primera caja libre.
     * Devuelve donde ha caido, o ALMACEN_LLENO si no cabe en ningun sitio.
     */
    public static Resultado anadir(List<PokemonPoseido> todos, PokemonPoseido nuevo)
    {
        int hueco = huecoLibreEnEquipo(todos);

        if(hueco >= 0)
        {
            colocar(nuevo, Hueco.enEquipo(hueco));
            todos.add(nuevo);

            return Resultado.bien();
        }

        Hueco enCaja = primerHuecoLibreEnCajas(todos);

        if(enCaja == null) return Resultado.mal(ALMACEN_LLENO);

        colocar(nuevo, enCaja);
        todos.add(nuevo);

        return Resultado.bien();
    }

    /**
     * Mueve un Pokemon a un hueco concreto. Si el hueco esta ocupado, los dos
     * intercambian su sitio, que es lo que hace el sistema de cajas del juego.
     */
    public static Resultado mover(List<PokemonPoseido> todos, PokemonPoseido quien, Hueco destino)
    {
        if(quien == null || !todos.contains(quien)) return Resultado.mal(NO_ENCONTRADO);
        if(!destinoValido(destino)) return Resultado.mal(DESTINO_INVALIDO);

        boolean saleDelEquipo = quien.enEquipo()
                && !PokemonPoseido.EQUIPO.equals(destino.ubicacion());

        PokemonPoseido ocupante = en(todos, destino);

        if(ocupante == quien) return Resultado.bien();

        // Solo se comprueba el minimo cuando de verdad sale del equipo: un
        // intercambio con otro del equipo no cambia cuantos combatientes quedan.
        if(saleDelEquipo && (ocupante == null || !ocupante.puedeCombatir())
                && combatientesEnEquipo(todos, quien) == 0)
        {
            return Resultado.mal(EQUIPO_MINIMO);
        }

        Hueco origen = new Hueco(quien.ubicacion(), quien.caja(), quien.hueco());

        colocar(quien, destino);

        if(ocupante != null) colocar(ocupante, origen);

        compactarEquipo(todos);

        return Resultado.bien();
    }

    /** Deposita en la primera caja libre. */
    public static Resultado depositar(List<PokemonPoseido> todos, PokemonPoseido quien)
    {
        if(quien == null || !todos.contains(quien)) return Resultado.mal(NO_ENCONTRADO);
        if(!quien.enEquipo()) return Resultado.bien();

        Hueco destino = primerHuecoLibreEnCajas(todos);

        if(destino == null) return Resultado.mal(ALMACEN_LLENO);

        return mover(todos, quien, destino);
    }

    /** Saca al equipo, al primer hueco libre. */
    public static Resultado retirar(List<PokemonPoseido> todos, PokemonPoseido quien)
    {
        if(quien == null || !todos.contains(quien)) return Resultado.mal(NO_ENCONTRADO);
        if(quien.enEquipo()) return Resultado.bien();

        int hueco = huecoLibreEnEquipo(todos);

        if(hueco < 0) return Resultado.mal(EQUIPO_LLENO);

        return mover(todos, quien, Hueco.enEquipo(hueco));
    }

    /** El equipo no deja agujeros: si sale el segundo, el tercero pasa a ser el segundo. */
    public static void compactarEquipo(List<PokemonPoseido> todos)
    {
        List<PokemonPoseido> actual = equipo(todos);

        for(int i = 0; i < actual.size(); i++)
        {
            actual.get(i).ponerHueco(i);
        }
    }

    private static boolean destinoValido(Hueco destino)
    {
        if(destino == null) return false;

        if(PokemonPoseido.EQUIPO.equals(destino.ubicacion()))
        {
            return destino.hueco() >= 0 && destino.hueco() < PokemonPoseido.EQUIPO_MAX;
        }

        if(!PokemonPoseido.CAJA.equals(destino.ubicacion())) return false;

        return destino.caja() >= 0 && destino.caja() < CAJAS
                && destino.hueco() >= 0 && destino.hueco() < HUECOS_POR_CAJA;
    }

    private static void colocar(PokemonPoseido quien, Hueco destino)
    {
        quien.ponerUbicacion(destino.ubicacion());
        quien.ponerCaja(PokemonPoseido.EQUIPO.equals(destino.ubicacion()) ? 0 : destino.caja());
        quien.ponerHueco(destino.hueco());
    }
}
