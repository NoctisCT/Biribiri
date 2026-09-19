package com.retro.pokemonengine;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.users.Habbo;
import com.google.gson.JsonObject;
import com.retro.pokemonengine.clima.Clima;
import com.retro.pokemonengine.encuentros.MetodoEncuentro;
import com.retro.pokemonengine.entrenador.PokemonPoseido;
import com.retro.pokemonengine.tienda.ReglasTienda;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Las acciones del mundo: zona, encuentros, captura, tiendas y centros.
 *
 * La sala sale de la sesion, no del paquete: un cliente no puede decir que esta
 * en la Ruta 1 desde el vestibulo. Y una sala sin fila en pokemon_zone_rooms no
 * tiene zona, asi que no tiene nada de esto.
 */
public final class AccionesMundo
{
    public static final String FUERA_DE_ZONA = "FUERA_DE_ZONA";
    public static final String SIN_ENCUENTROS = "SIN_ENCUENTROS";

    private AccionesMundo()
    {
    }

    public static boolean esAccionDeMundo(int accion)
    {
        return accion == PokemonAcciones.ZONA_INFO
                || accion == PokemonAcciones.ENCUENTRO_BUSCAR
                || accion == PokemonAcciones.CAPTURA_INTENTAR
                || accion == PokemonAcciones.ENCUENTRO_HUIR
                || accion == PokemonAcciones.TIENDA_VER
                || accion == PokemonAcciones.TIENDA_COMPRAR
                || accion == PokemonAcciones.TIENDA_VENDER
                || accion == PokemonAcciones.CENTRO_CURAR;
    }

    public static Respuesta ejecutar(Habbo habbo, int userId, int accion, JsonObject datos)
            throws Exception
    {
        return switch(accion)
        {
            case PokemonAcciones.ZONA_INFO -> zonaInfo(habbo);
            case PokemonAcciones.ENCUENTRO_BUSCAR -> buscarEncuentro(habbo, userId, datos);
            case PokemonAcciones.CAPTURA_INTENTAR -> capturar(userId, entero(datos, "ballId", 0));
            case PokemonAcciones.ENCUENTRO_HUIR -> huir(userId);
            case PokemonAcciones.TIENDA_VER -> verTienda(habbo, entero(datos, "tiendaId", 0));
            case PokemonAcciones.TIENDA_COMPRAR -> comprar(userId, datos);
            case PokemonAcciones.TIENDA_VENDER -> vender(userId, datos);
            case PokemonAcciones.CENTRO_CURAR -> curar(habbo, userId, entero(datos, "tiendaId", 0));
            default -> Respuesta.mal("ACCION_DESCONOCIDA", "Accion no reconocida");
        };
    }

    // --- Zona ---

    private static Respuesta zonaInfo(Habbo habbo)
    {
        return Respuesta.bien(cuerpoZona(salaActual(habbo)));
    }

    /**
     * El cuerpo de ZONA_INFO. Lo usan la accion y el aviso de cambio de clima:
     * un solo sitio para que las dos digan exactamente lo mismo.
     */
    public static Map<String, Object> cuerpoZona(int roomId)
    {
        Integer zonaId = roomId == 0 ? null : ServicioZonas.zonaDeSala(roomId);

        Map<String, Object> salida = new LinkedHashMap<>();

        salida.put("roomId", roomId);
        salida.put("zonaId", zonaId);

        if(zonaId == null)
        {
            salida.put("salaPokemon", false);

            return salida;
        }

        ServicioZonas.Zona zona = ServicioZonas.zona(zonaId);
        Clima clima = ServicioClima.clima(zonaId);

        salida.put("salaPokemon", true);
        salida.put("codigo", zona == null ? null : zona.codigo());
        salida.put("nombreEs", zona == null ? null : zona.nombreEs());
        salida.put("tipo", zona == null ? null : zona.tipo());
        salida.put("seguidorPermitido", ServicioZonas.permiteSeguidor(roomId));
        salida.put("tieneEncuentros", ServicioEncuentros.zonaTieneEncuentros(zonaId));
        salida.put("franja", ServicioEncuentros.franjaActual().name());
        salida.put("clima", clima.name());
        salida.put("climaNombre", clima.nombreEs());
        salida.put("climaHasta", ServicioClima.hasta(zonaId));

        List<Map<String, Object>> tiendas = new ArrayList<>();

        for(ServicioTienda.Tienda tienda : ServicioTienda.deZona(zonaId))
        {
            Map<String, Object> fila = new LinkedHashMap<>();

            fila.put("tiendaId", tienda.id());
            fila.put("codigo", tienda.codigo());
            fila.put("nombreEs", tienda.nombreEs());
            fila.put("tipo", tienda.tipo());
            fila.put("insigniasRequeridas", tienda.insigniasRequeridas());

            tiendas.add(fila);
        }

        salida.put("tiendas", tiendas);

        return salida;
    }

    /** Empuja el estado de la zona a quien este dentro, sin que nadie lo pida. */
    public static void avisarClima(int zonaId)
    {
        for(int roomId : ServicioZonas.salasDeZona(zonaId))
        {
            Room room = Emulator.getGameEnvironment().getRoomManager().getRoom(roomId);

            if(room == null) continue;

            room.sendComposer(PokemonPackets.resultado(
                    PokemonAcciones.ZONA_INFO, true, PokemonCuerpo.datos(cuerpoZona(roomId))));
        }
    }

    // --- Encuentros ---

    /**
     * Pedir un encuentro a mano es herramienta de pruebas: mientras se pueda, la
     * hierba es decorativa y el enfriamiento no significa nada. Rango 7 y no 6,
     * porque los co-administradores son jugadores y deben poder jugar sin tener
     * a mano un boton que les saque el Pokemon que quieran.
     */
    private static final int RANGO_DUENO = 7;

    private static Respuesta buscarEncuentro(Habbo habbo, int userId, JsonObject datos) throws Exception
    {
        if(habbo.getHabboInfo().getRank() == null
                || habbo.getHabboInfo().getRank().getId() < RANGO_DUENO)
        {
            return Respuesta.mal("SIN_PERMISO", "Camina por la hierba");
        }

        int roomId = salaActual(habbo);
        Integer zonaId = roomId == 0 ? null : ServicioZonas.zonaDeSala(roomId);

        if(zonaId == null) return Respuesta.mal(FUERA_DE_ZONA, "Esta sala no es una sala Pokemon");

        ServicioEntrenador.Entrenador entrenador = ServicioEntrenador.cargar(userId);

        MetodoEncuentro metodo = MetodoEncuentro.porNombre(texto(datos, "metodo", "HIERBA"));

        ServicioEncuentros.Salvaje salvaje =
                ServicioEncuentros.buscar(userId, zonaId, roomId, metodo, entrenador.temporadaId);

        if(salvaje == null) return Respuesta.mal(SIN_ENCUENTROS, "Aqui no aparece nada ahora mismo");

        ServicioEntrenador.registrarVisto(userId, salvaje.pokemon().especieId());

        return Respuesta.bien(cuerpoSalvaje(salvaje));
    }

    private static Respuesta huir(int userId)
    {
        boolean habia = ServicioEncuentros.activo(userId) != null;

        ServicioEncuentros.limpiar(userId);

        Map<String, Object> salida = new LinkedHashMap<>();

        salida.put("habiaEncuentro", habia);

        return Respuesta.bien(salida);
    }

    private static Respuesta capturar(int userId, int ballId) throws Exception
    {
        ServicioCaptura.Resultado resultado = ServicioCaptura.intentar(userId, ballId);

        if(!resultado.ok()) return Respuesta.mal(resultado.codigo(), mensajeCaptura(resultado.codigo()));

        Map<String, Object> salida = new LinkedHashMap<>();

        salida.put("capturado", resultado.capturado());
        salida.put("sacudidas", resultado.sacudidas());
        salida.put("especieId", resultado.especieId());
        salida.put("ubicacion", resultado.ubicacion());
        salida.put("ballsRestantes", resultado.ballsRestantes());

        return Respuesta.bien(salida);
    }

    private static Map<String, Object> cuerpoSalvaje(ServicioEncuentros.Salvaje salvaje)
    {
        PokemonPoseido pokemon = salvaje.pokemon();
        Map<String, Object> salida = new LinkedHashMap<>();

        salida.put("especieId", pokemon.especieId());
        salida.put("nombreEs", salvaje.especie().nombreEs());
        salida.put("nivel", pokemon.nivel());
        salida.put("genero", pokemon.genero());
        salida.put("shiny", pokemon.shiny());
        salida.put("psMax", salvaje.psMax());
        salida.put("psActual", salvaje.psActual());
        salida.put("estado", salvaje.estado());
        salida.put("catchRate", salvaje.especie().catchRate());
        salida.put("zonaId", salvaje.zonaId());

        return salida;
    }

    private static String mensajeCaptura(String codigo)
    {
        return switch(codigo)
        {
            case ServicioCaptura.SIN_ENCUENTRO -> "No hay ningun Pokemon delante";
            case ServicioCaptura.NO_ES_BALL -> "Eso no es una ball";
            case ServicioCaptura.NO_TIENES -> "No te quedan de esas";
            case ServicioCaptura.ALMACEN_LLENO -> "No tienes donde meterlo";
            default -> "No se ha podido lanzar la ball";
        };
    }

    // --- Tiendas y centros ---

    private static Respuesta verTienda(Habbo habbo, int tiendaId) throws Exception
    {
        ServicioTienda.Tienda tienda = ServicioTienda.tienda(tiendaId);

        if(tienda == null || !tienda.activa())
        {
            return Respuesta.mal(ServicioTienda.NO_EXISTE, "Esa tienda no existe");
        }

        if(!enLaZonaDe(habbo, tienda))
        {
            return Respuesta.mal(FUERA_DE_ZONA, "Tienes que estar en la zona de la tienda");
        }

        List<Map<String, Object>> articulos = new ArrayList<>();

        for(ServicioTienda.Articulo articulo : ServicioTienda.articulos(tienda.id()))
        {
            Map<String, Object> fila = new LinkedHashMap<>();

            fila.put("itemId", articulo.objeto().id());
            fila.put("nombreEs", articulo.objeto().nombreEs());
            fila.put("bolsillo", articulo.objeto().bolsillo().name());
            fila.put("precio", articulo.precio());
            fila.put("precioVenta", articulo.objeto().precioVenta());
            fila.put("insigniasRequeridas", articulo.insigniasRequeridas());
            fila.put("existencias", articulo.existencias());

            articulos.add(fila);
        }

        Map<String, Object> salida = new LinkedHashMap<>();

        salida.put("tiendaId", tienda.id());
        salida.put("nombreEs", tienda.nombreEs());
        salida.put("tipo", tienda.tipo());
        salida.put("articulos", articulos);

        return Respuesta.bien(salida);
    }

    private static Respuesta comprar(int userId, JsonObject datos) throws Exception
    {
        ReglasTienda.Resultado resultado = ServicioTienda.comprar(
                userId,
                entero(datos, "tiendaId", 0),
                entero(datos, "itemId", 0),
                entero(datos, "cantidad", 1));

        if(!resultado.ok()) return Respuesta.mal(resultado.codigo(), mensajeTienda(resultado.codigo()));

        Map<String, Object> salida = new LinkedHashMap<>();

        salida.put("unidades", resultado.unidades());
        salida.put("gastado", resultado.dinero());
        salida.put("pokedollars", ServicioEconomia.saldo(userId));

        return Respuesta.bien(salida);
    }

    private static Respuesta vender(int userId, JsonObject datos) throws Exception
    {
        ReglasTienda.Resultado resultado = ServicioTienda.vender(
                userId, entero(datos, "itemId", 0), entero(datos, "cantidad", 1));

        if(!resultado.ok()) return Respuesta.mal(resultado.codigo(), mensajeTienda(resultado.codigo()));

        Map<String, Object> salida = new LinkedHashMap<>();

        salida.put("unidades", resultado.unidades());
        salida.put("ingresado", resultado.dinero());
        salida.put("pokedollars", ServicioEconomia.saldo(userId));

        return Respuesta.bien(salida);
    }

    private static Respuesta curar(Habbo habbo, int userId, int tiendaId) throws Exception
    {
        ServicioTienda.Tienda centro = ServicioTienda.tienda(tiendaId);

        if(centro == null || !centro.activa() || !ServicioTienda.TIPO_CENTRO.equals(centro.tipo()))
        {
            return Respuesta.mal(ServicioTienda.NO_EXISTE, "Ahi no hay ningun Centro Pokemon");
        }

        if(!enLaZonaDe(habbo, centro))
        {
            return Respuesta.mal(FUERA_DE_ZONA, "Tienes que estar en el Centro Pokemon");
        }

        ServicioCentro.Curacion curacion = ServicioCentro.curar(userId);

        Map<String, Object> salida = new LinkedHashMap<>();

        salida.put("curados", curacion.curados());
        salida.put("equipo", curacion.total());

        return Respuesta.bien(salida);
    }

    private static String mensajeTienda(String codigo)
    {
        return switch(codigo)
        {
            case ReglasTienda.SIN_SALDO -> "No te llega el dinero";
            case ReglasTienda.SIN_SITIO -> "No te cabe en la mochila";
            case ReglasTienda.SIN_EXISTENCIAS -> "No quedan existencias";
            case ReglasTienda.SIN_INSIGNIAS -> "Te faltan insignias para eso";
            case ReglasTienda.NO_TIENES -> "No tienes tantos";
            case ReglasTienda.NO_SE_VENDE -> "Eso no se vende";
            case ReglasTienda.NO_ESTA_A_LA_VENTA -> "Eso no esta a la venta";
            case ReglasTienda.CANTIDAD_INVALIDA -> "Esa cantidad no vale";
            case ServicioTienda.CERRADA -> "La tienda esta cerrada";
            default -> "No se ha podido completar la compra";
        };
    }

    // --- Utilidades ---

    /**
     * Una tienda de zona exige estar en una sala de esa zona. Una tienda de sala
     * concreta exige estar en esa sala.
     */
    private static boolean enLaZonaDe(Habbo habbo, ServicioTienda.Tienda tienda)
    {
        int roomId = salaActual(habbo);

        if(roomId == 0) return false;

        if(tienda.roomId() != null) return tienda.roomId() == roomId;

        Integer zonaId = ServicioZonas.zonaDeSala(roomId);

        return zonaId != null && tienda.zonaId() != null && zonaId.equals(tienda.zonaId());
    }

    private static int salaActual(Habbo habbo)
    {
        if(habbo == null || habbo.getHabboInfo() == null) return 0;

        return habbo.getHabboInfo().getCurrentRoom() == null
                ? 0 : habbo.getHabboInfo().getCurrentRoom().getId();
    }

    private static int entero(JsonObject datos, String campo, int porDefecto)
    {
        if(datos == null || !datos.has(campo) || datos.get(campo).isJsonNull()) return porDefecto;

        try
        {
            return datos.get(campo).getAsInt();
        }
        catch(Exception error)
        {
            return porDefecto;
        }
    }

    private static String texto(JsonObject datos, String campo, String porDefecto)
    {
        if(datos == null || !datos.has(campo) || datos.get(campo).isJsonNull()) return porDefecto;

        try
        {
            return datos.get(campo).getAsString();
        }
        catch(Exception error)
        {
            return porDefecto;
        }
    }
}
