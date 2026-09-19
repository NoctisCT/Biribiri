package com.retro.pokemonengine.batalla;

import java.util.ArrayList;
import java.util.List;

/**
 * Donde se coloca cada uno para pelear.
 *
 * La formacion es una linea con un hueco en medio:
 *
 *     Entrenador - Pokemon - (hueco) - Pokemon - Entrenador
 *
 * y contra la hierba, Entrenador - Pokemon - (hueco) - Salvaje. Los
 * entrenadores en los extremos, y todo el mundo mirando al centro.
 *
 * El hueco del medio no lo ocupa nadie y aun asi se reserva: dos Pokemon
 * pegados el uno al otro se tapan y no se ve quien pelea contra quien.
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
    /** El hueco del medio: no lo ocupa nadie, pero se reserva. */
    public static final String ROL_HUECO = "hueco";

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

    /**
     * Los roles de la linea, en orden y contando el hueco del medio.
     *
     * Se escriben uno a uno en vez de calcularse: con un hueco que no es de
     * nadie, cualquier aritmetica de indices acaba dandole al Pokemon de un
     * bando la orientacion del otro, que es exactamente el fallo que esto evita.
     */
    public static List<String> roles(Formato formato)
    {
        return formato == Formato.SALVAJE
                ? List.of(ROL_ENTRENADOR_A, ROL_POKEMON_A, ROL_HUECO, ROL_SALVAJE)
                : List.of(ROL_ENTRENADOR_A, ROL_POKEMON_A, ROL_HUECO,
                        ROL_POKEMON_B, ROL_ENTRENADOR_B);
    }

    /** true si ese rol es del bando que ancla la formacion. */
    private static boolean esDelBandoA(String rol)
    {
        return ROL_ENTRENADOR_A.equals(rol) || ROL_POKEMON_A.equals(rol);
    }

    public static Formacion enLinea(int anclaX, int anclaY, int direccion, Formato formato)
    {
        List<String> roles = roles(formato);
        List<Hueco> huecos = new ArrayList<>();

        int opuesta = (direccion + 4) % 8;

        for(int i = 0; i < roles.size(); i++)
        {
            String rol = roles.get(i);

            huecos.add(new Hueco(
                    rol,
                    anclaX + DX[direccion] * i,
                    anclaY + DY[direccion] * i,
                    esDelBandoA(rol) ? direccion : opuesta));
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

    /**
     * Como `resolver`, pero eligiendo la formacion que deje al **segundo**
     * combatiente lo mas cerca posible de donde ya esta.
     *
     * Existe porque en un reto solo debe moverse uno. Con `resolver` a secas la
     * linea sale en la primera direccion que quepa, que puede mandar al rival a
     * dar la vuelta a la sala; asi, de todas las que caben, se queda la que le
     * pilla mas a mano.
     */
    public static Formacion resolverHacia(int origenX, int origenY, int rivalX, int rivalY,
                                          Formato formato, Transitable transitable)
    {
        Formacion mejor = null;
        int mejorCoste = Integer.MAX_VALUE;

        for(int radio = 0; radio <= RADIO_BUSQUEDA; radio++)
        {
            for(int dx = -radio; dx <= radio; dx++)
            {
                for(int dy = -radio; dy <= radio; dy++)
                {
                    if(Math.max(Math.abs(dx), Math.abs(dy)) != radio) continue;

                    for(int direccion : CARDINALES)
                    {
                        Formacion formacion = enLinea(
                                origenX + dx, origenY + dy, direccion, formato);

                        if(!cabe(formacion, transitable)) continue;

                        Hueco suyo = formacion.de(ROL_ENTRENADOR_B);

                        if(suyo == null) continue;

                        // Lo que anda el rival, y a igualdad lo que se mueve el
                        // que ancla, que en principio no deberia moverse nada.
                        int coste = distancia(suyo.x(), suyo.y(), rivalX, rivalY) * 100
                                + Math.max(Math.abs(dx), Math.abs(dy));

                        if(coste < mejorCoste)
                        {
                            mejorCoste = coste;
                            mejor = formacion;
                        }
                    }
                }
            }

            // Con el ancla encontrada no hace falta seguir abriendo el radio:
            // alejar mas la formacion solo empeora el paseo de los dos.
            if(mejor != null) return mejor;
        }

        return mejor;
    }

    /** Distancia de Chebyshev, que es como anda un avatar de Habbo: la diagonal cuesta uno. */
    public static int distancia(int ax, int ay, int bx, int by)
    {
        return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
    }
}
