package com.retro.pokemonengine.batalla;

import java.util.ArrayList;
import java.util.List;

/**
 * Donde se coloca cada uno para pelear.
 *
 * La formacion es una linea: Entrenador - Pokemon - Pokemon - Entrenador en
 * PvP, y Entrenador - Pokemon - Salvaje contra la hierba. Los entrenadores en
 * los extremos, mirando al centro.
 *
 * Esta clase es geometria pura y no sabe nada de salas: la caminabilidad entra
 * como un predicado. Eso la hace probable con un tablero de mentira y deja
 * fuera la unica parte que de verdad necesita el emulador.
 *
 * La busqueda empieza por la baldosa del jugador, asi que si cabe donde esta,
 * no se le mueve. Solo si no cabe se mira alrededor, y nunca mas alla de
 * RADIO_BUSQUEDA: una formacion a nueve baldosas ya no es la de este combate.
 */
public final class PlanArena
{
    public static final String ROL_ENTRENADOR_A = "entrenador_a";
    public static final String ROL_POKEMON_A = "pokemon_a";
    public static final String ROL_POKEMON_B = "pokemon_b";
    public static final String ROL_ENTRENADOR_B = "entrenador_b";
    public static final String ROL_SALVAJE = "salvaje";

    /** Hasta donde se desplaza la formacion si no cabe donde esta el jugador. */
    public static final int RADIO_BUSQUEDA = 3;

    /** Lo lejos que pueden estar dos entrenadores para retarse. */
    public static final int DISTANCIA_RETO_MAX = 5;

    // Rotaciones de Habbo: 0 norte, 2 este, 4 sur, 6 oeste.
    private static final int[] DX = {0, 1, 1, 1, 0, -1, -1, -1};
    private static final int[] DY = {-1, -1, 0, 1, 1, 1, 0, -1};

    /** Solo las cuatro rectas: una linea en diagonal se ve torcida en sala. */
    private static final int[] CARDINALES = {0, 2, 4, 6};

    @FunctionalInterface
    public interface Transitable
    {
        boolean puede(int x, int y);
    }

    public record Hueco(String rol, int x, int y, int direccion)
    {
    }

    public record Formacion(int direccion, List<Hueco> huecos)
    {
        /** null si ese rol no existe en este formato. */
        public Hueco de(String rol)
        {
            for(Hueco hueco : this.huecos)
            {
                if(hueco.rol().equals(rol)) return hueco;
            }

            return null;
        }
    }

    private PlanArena()
    {
    }

    public static List<String> roles(Formato formato)
    {
        return formato == Formato.SALVAJE
                ? List.of(ROL_ENTRENADOR_A, ROL_POKEMON_A, ROL_SALVAJE)
                : List.of(ROL_ENTRENADOR_A, ROL_POKEMON_A, ROL_POKEMON_B, ROL_ENTRENADOR_B);
    }

    public static Formacion enLinea(int anclaX, int anclaY, int direccion, Formato formato)
    {
        List<String> roles = roles(formato);
        List<Hueco> huecos = new ArrayList<>();

        int opuesta = (direccion + 4) % 8;

        // Con tres roles el corte cae en 2: los dos primeros son del bando A.
        int mitad = (roles.size() + 1) / 2;

        for(int i = 0; i < roles.size(); i++)
        {
            huecos.add(new Hueco(
                    roles.get(i),
                    anclaX + DX[direccion] * i,
                    anclaY + DY[direccion] * i,
                    i < mitad ? direccion : opuesta));
        }

        return new Formacion(direccion, List.copyOf(huecos));
    }

    public static boolean cabe(Formacion formacion, Transitable transitable)
    {
        if(formacion == null || transitable == null) return false;

        for(Hueco hueco : formacion.huecos())
        {
            if(!transitable.puede(hueco.x(), hueco.y())) return false;
        }

        return true;
    }

    /** null si no cabe en ningun sitio cerca. Quien llama lo traduce a "en interfaz". */
    public static Formacion resolver(int origenX, int origenY, Formato formato,
                                     Transitable transitable)
    {
        for(int radio = 0; radio <= RADIO_BUSQUEDA; radio++)
        {
            for(int dx = -radio; dx <= radio; dx++)
            {
                for(int dy = -radio; dy <= radio; dy++)
                {
                    // Solo el borde del cuadrado: el interior ya se probo con un radio menor.
                    if(Math.max(Math.abs(dx), Math.abs(dy)) != radio) continue;

                    for(int direccion : CARDINALES)
                    {
                        Formacion formacion = enLinea(
                                origenX + dx, origenY + dy, direccion, formato);

                        if(cabe(formacion, transitable)) return formacion;
                    }
                }
            }
        }

        return null;
    }

    /** Distancia de Chebyshev, que es como anda un avatar de Habbo: la diagonal cuesta uno. */
    public static int distancia(int ax, int ay, int bx, int by)
    {
        return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
    }
}
