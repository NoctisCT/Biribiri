package com.retro.pokemonengine;

import com.eu.habbo.habbohotel.users.Habbo;
import com.google.gson.JsonObject;
import com.retro.pokemonengine.combate.Accion;
import com.retro.pokemonengine.combate.PokemonCombate;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Las acciones de combate del paquete 6400.
 *
 * Aqui no se decide ninguna regla: se comprueba que lo que manda el cliente
 * tiene sentido y se traduce a una `Accion` del motor. Un cliente modificado
 * puede mandar el indice 99 o elegir dos veces en el mismo turno; que eso no
 * rompa nada es el trabajo de esta clase.
 */
public final class AccionesBatalla
{
    private AccionesBatalla()
    {
    }

    public static boolean esAccionDeBatalla(int accion)
    {
        return accion == PokemonAcciones.BATALLA_ESTADO
                || accion == PokemonAcciones.BATALLA_ACCION
                || accion == PokemonAcciones.BATALLA_RENDIRSE
                || accion == PokemonAcciones.BATALLA_RETAR
                || accion == PokemonAcciones.BATALLA_RETO_RESPONDER;
    }

    public static Respuesta ejecutar(Habbo habbo, int userId, int accion, JsonObject datos)
            throws Exception
    {
        return switch(accion)
        {
            case PokemonAcciones.BATALLA_ESTADO -> estado(userId);
            case PokemonAcciones.BATALLA_ACCION -> actuar(userId, datos);
            case PokemonAcciones.BATALLA_RENDIRSE -> rendirse(userId);
            case PokemonAcciones.BATALLA_RETAR ->
                    ServicioRetos.retar(habbo, entero(datos, "rivalId", 0));
            case PokemonAcciones.BATALLA_RETO_RESPONDER ->
                    ServicioRetos.responder(userId, booleano(datos, "acepta", false));
            default -> Respuesta.mal("ACCION_DESCONOCIDA", "Accion no reconocida");
        };
    }

    private static Respuesta estado(int userId)
    {
        ServicioBatalla.Sesion sesion = ServicioBatalla.de(userId);

        if(sesion == null) return Respuesta.mal(ServicioBatalla.SIN_BATALLA, "No estas en combate");

        return Respuesta.bien(ServicioBatalla.cuerpo(sesion, userId));
    }

    private static Respuesta actuar(int userId, JsonObject datos) throws Exception
    {
        ServicioBatalla.Sesion sesion = ServicioBatalla.de(userId);

        if(sesion == null) return Respuesta.mal(ServicioBatalla.SIN_BATALLA, "No estas en combate");

        if(sesion.estado.terminado())
        {
            return Respuesta.mal(ServicioBatalla.SIN_BATALLA, "El combate ya termino");
        }

        int bando = sesion.bandoDe(userId);

        if(bando < 0) return Respuesta.mal(ServicioBatalla.SIN_BATALLA, "No estas en combate");

        if(sesion.elegidas[bando] != null)
        {
            return Respuesta.mal(ServicioBatalla.NO_ES_TU_TURNO, "Ya has elegido este turno");
        }

        String tipo = texto(datos, "tipo", "movimiento");

        switch(tipo)
        {
            case "movimiento":
            {
                int indice = entero(datos, "indice", -1);
                PokemonCombate mio = sesion.estado.bando(bando).activo(0);

                if(mio == null || indice < 0 || indice >= mio.movimientos().size())
                {
                    return Respuesta.mal("MOVIMIENTO_INVALIDO", "Ese movimiento no existe");
                }

                ServicioBatalla.elegir(userId, Accion.movimiento(bando, 0, indice, 1 - bando, 0));

                break;
            }

            case "huida":
                return ServicioBatalla.huir(userId);

            case "captura":
                return ServicioCaptura.enCombate(userId, entero(datos, "ballId", 0));

            case "objeto":
                ServicioBatalla.elegir(userId, Accion.objeto(bando, 0, entero(datos, "itemId", 0)));
                break;

            default:
                return Respuesta.mal("ACCION_INVALIDA", "No se que es " + tipo);
        }

        ServicioBatalla.Sesion despues = ServicioBatalla.de(userId);

        // Si el combate acabo en este mismo turno, la sesion ya no esta.
        if(despues == null) return Respuesta.bien(terminado());

        return Respuesta.bien(ServicioBatalla.cuerpo(despues, userId));
    }

    private static Respuesta rendirse(int userId)
    {
        ServicioBatalla.Sesion sesion = ServicioBatalla.de(userId);

        if(sesion == null) return Respuesta.mal(ServicioBatalla.SIN_BATALLA, "No estas en combate");

        int bando = sesion.bandoDe(userId);

        if(sesion.salvaje != null) ServicioEncuentros.limpiar(userId);

        ServicioRecompensas.cerrar(sesion, bando < 0 ? -1 : 1 - bando,
                ServicioBatalla.MOTIVO_ABANDONO);

        return Respuesta.bien(terminado());
    }

    private static Map<String, Object> terminado()
    {
        Map<String, Object> fin = new LinkedHashMap<>();

        fin.put("terminado", true);

        return fin;
    }

    private static int entero(JsonObject datos, String clave, int porDefecto)
    {
        return datos != null && datos.has(clave) && datos.get(clave).isJsonPrimitive()
                ? datos.get(clave).getAsInt()
                : porDefecto;
    }

    private static boolean booleano(JsonObject datos, String clave, boolean porDefecto)
    {
        return datos != null && datos.has(clave) && datos.get(clave).isJsonPrimitive()
                ? datos.get(clave).getAsBoolean()
                : porDefecto;
    }

    private static String texto(JsonObject datos, String clave, String porDefecto)
    {
        return datos != null && datos.has(clave) && datos.get(clave).isJsonPrimitive()
                ? datos.get(clave).getAsString()
                : porDefecto;
    }
}
