package com.retro.pokemonengine;

import com.eu.habbo.habbohotel.users.Habbo;
import com.google.gson.JsonObject;
import com.retro.pokemonengine.combate.EspecieCatalogo;
import com.retro.pokemonengine.entrenador.Almacenamiento;
import com.retro.pokemonengine.entrenador.Bolsillo;
import com.retro.pokemonengine.entrenador.Dex;
import com.retro.pokemonengine.entrenador.Mochila;
import com.retro.pokemonengine.entrenador.MovimientoPoseido;
import com.retro.pokemonengine.entrenador.PokemonPoseido;
import com.retro.pokemonengine.entrenador.TablaExperiencia;
import com.retro.pokemonengine.seguidor.CatalogoAnimaciones;
import com.retro.pokemonengine.seguidor.EstadoSeguidor;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Las acciones del entrenador: equipo, cajas, mochila, pokedex y seguidor.
 *
 * Ninguna se fia del cliente. El userId llega del handler, que lo saca de la
 * sesion, y todo lo que se toca se comprueba que sea del jugador antes de tocarlo.
 */
public final class AccionesEntrenador
{
    private static final int MOTE_MAX = 24;

    private AccionesEntrenador()
    {
    }

    public static Respuesta ejecutar(Habbo habbo, int userId, int accion, JsonObject datos)
            throws Exception
    {
        return switch(accion)
        {
            case PokemonAcciones.ENTRENADOR_ESTADO -> estado(userId);
            case PokemonAcciones.SEGUIDOR_ELEGIR -> elegirSeguidor(habbo, userId, datos);
            case PokemonAcciones.SEGUIDOR_ACTIVAR -> activarSeguidor(habbo, userId, datos);
            case PokemonAcciones.SEGUIDOR_ANIMACIONES -> animaciones();
            case PokemonAcciones.EQUIPO_LISTAR -> listarEquipo(userId);
            case PokemonAcciones.CAJAS_LISTAR -> listarCajas(userId);
            case PokemonAcciones.CAJA_VER -> verCaja(userId, entero(datos, "caja", 0));
            case PokemonAcciones.POKEMON_MOVER -> mover(userId, datos);
            case PokemonAcciones.POKEMON_DEPOSITAR -> depositar(userId, datos);
            case PokemonAcciones.POKEMON_RETIRAR -> retirar(userId, datos);
            case PokemonAcciones.POKEMON_DETALLE -> detalle(userId, largo(datos, "ownedId", 0L));
            case PokemonAcciones.POKEMON_MOTE -> ponerMote(userId, datos);
            case PokemonAcciones.POKEMON_FAVORITO -> favorito(userId, datos);
            case PokemonAcciones.CAJA_RENOMBRAR -> renombrarCaja(userId, datos);
            case PokemonAcciones.MOCHILA_LISTAR -> listarMochila(userId);
            case PokemonAcciones.MOCHILA_TIRAR -> tirar(userId, datos);
            case PokemonAcciones.OBJETO_DAR -> darObjeto(userId, datos);
            case PokemonAcciones.OBJETO_QUITAR -> quitarObjeto(userId, datos);
            case PokemonAcciones.DEX_RESUMEN -> resumenDex(userId);
            case PokemonAcciones.DEX_ENTRADA -> entradaDex(userId, entero(datos, "especieId", 0));
            default -> Respuesta.mal("ACCION_DESCONOCIDA", "Accion no reconocida");
        };
    }

    // --- Sesion y seguidor ---

    private static Respuesta estado(int userId) throws Exception
    {
        ServicioEntrenador.Entrenador entrenador = ServicioEntrenador.cargar(userId);
        Map<String, Object> salida = new LinkedHashMap<>();

        salida.put("userId", entrenador.userId);
        salida.put("pokedollars", entrenador.pokedollars);
        salida.put("insignias", entrenador.insignias);
        salida.put("zonaActualId", entrenador.zonaActualId);
        salida.put("seguidorOwnedId", entrenador.seguidorOwnedId);
        salida.put("seguidorActivo", entrenador.seguidorActivo);
        salida.put("dexVistos", entrenador.dexVistos);
        salida.put("dexCapturados", entrenador.dexCapturados);
        salida.put("temporadaId", entrenador.temporadaId);
        salida.put("jugadoSegundos", entrenador.jugadoSegundos);

        return Respuesta.bien(salida);
    }

    private static Respuesta elegirSeguidor(Habbo habbo, int userId, JsonObject datos) throws Exception
    {
        long ownedId = largo(datos, "ownedId", 0L);

        if(ownedId <= 0L)
        {
            ServicioEntrenador.ponerSeguidor(userId, null);
            ServicioSeguidor.refrescar(habbo);

            return Respuesta.bien(Map.of("seguidorOwnedId", 0));
        }

        PokemonPoseido pokemon = ServicioEntrenador.cargarUno(userId, ownedId);

        if(pokemon == null) return Respuesta.mal("NO_ES_TUYO", "Ese Pokemon no es tuyo");
        if(pokemon.huevo()) return Respuesta.mal("ES_HUEVO", "Un huevo no puede seguirte");
        if(!pokemon.enEquipo()) return Respuesta.mal("NO_EN_EQUIPO", "Solo te sigue uno del equipo");

        ServicioEntrenador.ponerSeguidor(userId, ownedId);
        ServicioSeguidor.refrescar(habbo);

        return Respuesta.bien(Map.of("seguidorOwnedId", ownedId));
    }

    private static Respuesta activarSeguidor(Habbo habbo, int userId, JsonObject datos) throws Exception
    {
        boolean activo = booleano(datos, "activo", true);

        ServicioEntrenador.ponerSeguidorActivo(userId, activo);
        ServicioSeguidor.refrescar(habbo);

        return Respuesta.bien(Map.of("seguidorActivo", activo));
    }

    /** El menu de «Interactuar»: las animaciones sin vinculo con ningun gesto de Habbo. */
    private static Respuesta animaciones()
    {
        List<Map<String, Object>> salida = new ArrayList<>();

        for(EstadoSeguidor estado : CatalogoAnimaciones.interactivos())
        {
            Map<String, Object> fila = new LinkedHashMap<>();

            fila.put("codigo", estado.codigo());
            fila.put("nombre", estado.nombreEs());
            fila.put("animacion", estado.animacion());
            fila.put("respaldo", estado.respaldo());
            fila.put("duracionMs", estado.duracionMs());

            salida.add(fila);
        }

        return Respuesta.bien(Map.of("animaciones", salida));
    }

    // --- Equipo y cajas ---

    private static Respuesta listarEquipo(int userId) throws Exception
    {
        List<PokemonPoseido> todos = ServicioEntrenador.cargarPokemon(userId);
        List<Map<String, Object>> equipo = new ArrayList<>();

        for(PokemonPoseido pokemon : Almacenamiento.equipo(todos)) equipo.add(resumen(pokemon));

        return Respuesta.bien(Map.of("equipo", equipo));
    }

    private static Respuesta listarCajas(int userId) throws Exception
    {
        List<PokemonPoseido> todos = ServicioEntrenador.cargarPokemon(userId);
        Map<Integer, String> nombres = ServicioEntrenador.cajas(userId);
        List<Map<String, Object>> cajas = new ArrayList<>();

        for(int caja = 0; caja < Almacenamiento.CAJAS; caja++)
        {
            Map<String, Object> fila = new LinkedHashMap<>();

            fila.put("caja", caja);
            fila.put("nombre", nombres.getOrDefault(caja, "Caja " + (caja + 1)));
            fila.put("ocupados", Almacenamiento.caja(todos, caja).size());

            cajas.add(fila);
        }

        return Respuesta.bien(Map.of("cajas", cajas, "huecosPorCaja", Almacenamiento.HUECOS_POR_CAJA));
    }

    private static Respuesta verCaja(int userId, int caja) throws Exception
    {
        if(caja < 0 || caja >= Almacenamiento.CAJAS)
        {
            return Respuesta.mal("CAJA_INVALIDA", "Esa caja no existe");
        }

        List<PokemonPoseido> todos = ServicioEntrenador.cargarPokemon(userId);
        List<Map<String, Object>> contenido = new ArrayList<>();

        for(PokemonPoseido pokemon : Almacenamiento.caja(todos, caja)) contenido.add(resumen(pokemon));

        return Respuesta.bien(Map.of("caja", caja, "pokemon", contenido));
    }

    private static Respuesta mover(int userId, JsonObject datos) throws Exception
    {
        List<PokemonPoseido> todos = ServicioEntrenador.cargarPokemon(userId);
        PokemonPoseido quien = buscar(todos, largo(datos, "ownedId", 0L));

        if(quien == null) return Respuesta.mal("NO_ES_TUYO", "Ese Pokemon no es tuyo");

        String ubicacion = texto(datos, "ubicacion", PokemonPoseido.EQUIPO);
        Almacenamiento.Hueco destino = PokemonPoseido.EQUIPO.equals(ubicacion)
                ? Almacenamiento.Hueco.enEquipo(entero(datos, "hueco", 0))
                : Almacenamiento.Hueco.enCaja(entero(datos, "caja", 0), entero(datos, "hueco", 0));

        return aplicarMovimiento(userId, todos, Almacenamiento.mover(todos, quien, destino));
    }

    private static Respuesta depositar(int userId, JsonObject datos) throws Exception
    {
        List<PokemonPoseido> todos = ServicioEntrenador.cargarPokemon(userId);
        PokemonPoseido quien = buscar(todos, largo(datos, "ownedId", 0L));

        if(quien == null) return Respuesta.mal("NO_ES_TUYO", "Ese Pokemon no es tuyo");

        return aplicarMovimiento(userId, todos, Almacenamiento.depositar(todos, quien));
    }

    private static Respuesta retirar(int userId, JsonObject datos) throws Exception
    {
        List<PokemonPoseido> todos = ServicioEntrenador.cargarPokemon(userId);
        PokemonPoseido quien = buscar(todos, largo(datos, "ownedId", 0L));

        if(quien == null) return Respuesta.mal("NO_ES_TUYO", "Ese Pokemon no es tuyo");

        return aplicarMovimiento(userId, todos, Almacenamiento.retirar(todos, quien));
    }

    private static Respuesta aplicarMovimiento(
            int userId, List<PokemonPoseido> todos, Almacenamiento.Resultado resultado) throws Exception
    {
        if(!resultado.ok()) return Respuesta.mal(resultado.codigo(), mensajeDe(resultado.codigo()));

        ServicioEntrenador.guardarUbicaciones(todos);

        return listarEquipo(userId);
    }

    private static String mensajeDe(String codigo)
    {
        return switch(codigo)
        {
            case Almacenamiento.EQUIPO_LLENO -> "El equipo esta lleno";
            case Almacenamiento.ALMACEN_LLENO -> "No queda sitio en las cajas";
            case Almacenamiento.EQUIPO_MINIMO -> "Tienes que quedarte con al menos uno que pueda combatir";
            case Almacenamiento.DESTINO_INVALIDO -> "Ese hueco no existe";
            default -> "No se ha podido mover";
        };
    }

    private static Respuesta detalle(int userId, long ownedId) throws Exception
    {
        PokemonPoseido pokemon = ServicioEntrenador.cargarUno(userId, ownedId);

        if(pokemon == null) return Respuesta.mal("NO_ES_TUYO", "Ese Pokemon no es tuyo");

        EspecieCatalogo especie = ServicioPokedex.especie(pokemon.especieId());
        Map<String, Object> salida = new LinkedHashMap<>(resumen(pokemon));

        salida.put("ivs", pokemon.ivs());
        salida.put("evs", pokemon.evs());
        salida.put("naturaleza", pokemon.naturaleza().name().toLowerCase());
        salida.put("habilidadId", pokemon.habilidadId());
        salida.put("habilidadSlot", pokemon.habilidadSlot());
        salida.put("amistad", pokemon.amistad());
        salida.put("pokerus", pokemon.pokerus());
        salida.put("objetoId", pokemon.objetoId());
        salida.put("ballId", pokemon.ballId());
        salida.put("zonaCapturaId", pokemon.zonaCapturaId());
        salida.put("nivelCaptura", pokemon.nivelCaptura());
        salida.put("entrenadorOriginalId", pokemon.entrenadorOriginalId());
        salida.put("stats", ServicioEntrenador.statsDe(pokemon));

        if(especie != null)
        {
            TablaExperiencia.Curva curva = TablaExperiencia.porNombre(especie.growthRate());

            salida.put("expSiguienteNivel", TablaExperiencia.faltaParaSiguiente(curva, pokemon.experiencia()));
            salida.put("tipo1", especie.tipo1());
            salida.put("tipo2", especie.tipo2());
        }

        List<Map<String, Object>> movimientos = new ArrayList<>();

        for(MovimientoPoseido movimiento : pokemon.movimientos())
        {
            Map<String, Object> fila = new LinkedHashMap<>();

            fila.put("moveId", movimiento.moveId());
            fila.put("ppActual", movimiento.ppActual());
            fila.put("ppMaximo", movimiento.ppMaximo());
            fila.put("ppUp", movimiento.ppUp());

            movimientos.add(fila);
        }

        salida.put("movimientos", movimientos);

        return Respuesta.bien(salida);
    }

    private static Respuesta ponerMote(int userId, JsonObject datos) throws Exception
    {
        PokemonPoseido pokemon = ServicioEntrenador.cargarUno(userId, largo(datos, "ownedId", 0L));

        if(pokemon == null) return Respuesta.mal("NO_ES_TUYO", "Ese Pokemon no es tuyo");

        String mote = texto(datos, "mote", "").trim();

        if(mote.length() > MOTE_MAX)
        {
            return Respuesta.mal("MOTE_LARGO", "El mote no puede pasar de " + MOTE_MAX + " letras");
        }

        pokemon.ponerMote(mote.isEmpty() ? null : mote);
        ServicioEntrenador.guardar(pokemon);

        return Respuesta.bien(resumen(pokemon));
    }

    private static Respuesta favorito(int userId, JsonObject datos) throws Exception
    {
        PokemonPoseido pokemon = ServicioEntrenador.cargarUno(userId, largo(datos, "ownedId", 0L));

        if(pokemon == null) return Respuesta.mal("NO_ES_TUYO", "Ese Pokemon no es tuyo");

        pokemon.ponerFavorito(booleano(datos, "favorito", !pokemon.favorito()));
        ServicioEntrenador.guardar(pokemon);

        return Respuesta.bien(resumen(pokemon));
    }

    private static Respuesta renombrarCaja(int userId, JsonObject datos) throws Exception
    {
        int caja = entero(datos, "caja", -1);
        String nombre = texto(datos, "nombre", "").trim();

        if(caja < 0 || caja >= Almacenamiento.CAJAS)
        {
            return Respuesta.mal("CAJA_INVALIDA", "Esa caja no existe");
        }

        if(nombre.isEmpty() || nombre.length() > MOTE_MAX)
        {
            return Respuesta.mal("NOMBRE_INVALIDO", "El nombre tiene que tener entre 1 y " + MOTE_MAX);
        }

        ServicioEntrenador.renombrarCaja(userId, caja, nombre);

        return listarCajas(userId);
    }

    // --- Mochila ---

    private static Respuesta listarMochila(int userId) throws Exception
    {
        Mochila mochila = ServicioEntrenador.cargarMochila(userId);
        Map<String, List<Map<String, Object>>> porBolsillo = new LinkedHashMap<>();

        for(Bolsillo bolsillo : Bolsillo.values())
        {
            List<Map<String, Object>> objetos = new ArrayList<>();

            for(Mochila.Entrada entrada : mochila.delBolsillo(bolsillo))
            {
                Map<String, Object> fila = new LinkedHashMap<>();

                fila.put("itemId", entrada.itemId());
                fila.put("cantidad", entrada.cantidad());

                objetos.add(fila);
            }

            porBolsillo.put(bolsillo.name(), objetos);
        }

        return Respuesta.bien(Map.of("bolsillos", porBolsillo));
    }

    private static Respuesta tirar(int userId, JsonObject datos) throws Exception
    {
        Mochila mochila = ServicioEntrenador.cargarMochila(userId);
        Mochila.Resultado resultado = mochila.tirar(entero(datos, "itemId", 0), entero(datos, "cantidad", 1));

        if(!resultado.ok())
        {
            return Respuesta.mal(resultado.codigo(), switch(resultado.codigo())
            {
                case Mochila.NO_SE_PUEDE_TIRAR -> "Ese objeto no se puede tirar";
                case Mochila.NO_TIENES -> "No tienes tantos";
                default -> "No se ha podido tirar";
            });
        }

        ServicioEntrenador.escribirMochila(userId, mochila);

        return listarMochila(userId);
    }

    private static Respuesta darObjeto(int userId, JsonObject datos) throws Exception
    {
        PokemonPoseido pokemon = ServicioEntrenador.cargarUno(userId, largo(datos, "ownedId", 0L));

        if(pokemon == null) return Respuesta.mal("NO_ES_TUYO", "Ese Pokemon no es tuyo");

        int itemId = entero(datos, "itemId", 0);
        Mochila mochila = ServicioEntrenador.cargarMochila(userId);

        if(mochila.cantidad(itemId) <= 0) return Respuesta.mal("NO_TIENES", "No tienes ese objeto");

        Bolsillo bolsillo = mochila.bolsilloDe(itemId);

        if(bolsillo == Bolsillo.CLAVE)
        {
            return Respuesta.mal("OBJETO_CLAVE", "Un objeto clave no se puede equipar");
        }

        // Si ya llevaba uno, vuelve a la mochila antes de poner el nuevo.
        if(pokemon.objetoId() != null) mochila.anadir(pokemon.objetoId(), Bolsillo.OBJETOS, 1);

        mochila.quitar(itemId, 1);
        pokemon.ponerObjetoId(itemId);

        ServicioEntrenador.guardar(pokemon);
        ServicioEntrenador.escribirMochila(userId, mochila);

        return Respuesta.bien(resumen(pokemon));
    }

    private static Respuesta quitarObjeto(int userId, JsonObject datos) throws Exception
    {
        PokemonPoseido pokemon = ServicioEntrenador.cargarUno(userId, largo(datos, "ownedId", 0L));

        if(pokemon == null) return Respuesta.mal("NO_ES_TUYO", "Ese Pokemon no es tuyo");
        if(pokemon.objetoId() == null) return Respuesta.mal("SIN_OBJETO", "No lleva ningun objeto");

        Mochila mochila = ServicioEntrenador.cargarMochila(userId);

        mochila.anadir(pokemon.objetoId(), Bolsillo.OBJETOS, 1);
        pokemon.ponerObjetoId(null);

        ServicioEntrenador.guardar(pokemon);
        ServicioEntrenador.escribirMochila(userId, mochila);

        return Respuesta.bien(resumen(pokemon));
    }

    // --- Pokedex ---

    private static Respuesta resumenDex(int userId) throws Exception
    {
        Map<Integer, Dex.EntradaDex> entradas = ServicioEntrenador.cargarDex(userId);
        List<Map<String, Object>> salida = new ArrayList<>();

        for(Dex.EntradaDex entrada : entradas.values())
        {
            Map<String, Object> fila = new LinkedHashMap<>();

            fila.put("especieId", entrada.especieId());
            fila.put("visto", entrada.visto());
            fila.put("capturado", entrada.capturado());
            fila.put("shiny", entrada.shinyCapturado());

            salida.add(fila);
        }

        Map<String, Object> cuerpo = new LinkedHashMap<>();

        cuerpo.put("vistos", Dex.vistos(entradas.values()));
        cuerpo.put("capturados", Dex.capturados(entradas.values()));
        cuerpo.put("entradas", salida);

        return Respuesta.bien(cuerpo);
    }

    private static Respuesta entradaDex(int userId, int especieId) throws Exception
    {
        EspecieCatalogo especie = ServicioPokedex.especie(especieId);

        if(especie == null) return Respuesta.mal("NO_EXISTE", "Esa especie no existe");

        Dex.EntradaDex entrada = ServicioEntrenador.cargarDex(userId).get(especieId);
        boolean visto = entrada != null && entrada.visto();

        Map<String, Object> cuerpo = new LinkedHashMap<>();

        cuerpo.put("especieId", especieId);
        cuerpo.put("visto", visto);
        cuerpo.put("capturado", entrada != null && entrada.capturado());
        cuerpo.put("shiny", entrada != null && entrada.shinyCapturado());

        // De lo que no se ha visto no se cuenta nada: el pokedex se gana.
        if(visto)
        {
            cuerpo.put("nombre", especie.nombreEs());
            cuerpo.put("tipo1", especie.tipo1());
            cuerpo.put("tipo2", especie.tipo2());
        }

        return Respuesta.bien(cuerpo);
    }

    // --- Utilidades ---

    private static Map<String, Object> resumen(PokemonPoseido pokemon)
    {
        EspecieCatalogo especie = ServicioPokedex.especie(pokemon.especieId());
        Map<String, Object> fila = new LinkedHashMap<>();

        fila.put("ownedId", pokemon.id());
        fila.put("especieId", pokemon.especieId());
        fila.put("formaId", pokemon.formaId());
        fila.put("nombre", pokemon.nombreMostrado(especie));
        fila.put("mote", pokemon.mote());
        fila.put("nivel", pokemon.nivel());
        fila.put("experiencia", pokemon.experiencia());
        fila.put("genero", pokemon.genero());
        fila.put("shiny", pokemon.shiny());
        fila.put("psActual", pokemon.psActual());
        fila.put("psMax", especie == null ? pokemon.psActual() : pokemon.psMax(especie));
        fila.put("estado", pokemon.estado());
        fila.put("huevo", pokemon.huevo());
        fila.put("favorito", pokemon.favorito());
        fila.put("ubicacion", pokemon.ubicacion());
        fila.put("caja", pokemon.caja());
        fila.put("hueco", pokemon.hueco());

        return fila;
    }

    private static PokemonPoseido buscar(List<PokemonPoseido> todos, long ownedId)
    {
        for(PokemonPoseido pokemon : todos)
        {
            if(pokemon.id() == ownedId) return pokemon;
        }

        return null;
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

    private static long largo(JsonObject datos, String campo, long porDefecto)
    {
        if(datos == null || !datos.has(campo) || datos.get(campo).isJsonNull()) return porDefecto;

        try
        {
            return datos.get(campo).getAsLong();
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

    private static boolean booleano(JsonObject datos, String campo, boolean porDefecto)
    {
        if(datos == null || !datos.has(campo) || datos.get(campo).isJsonNull()) return porDefecto;

        try
        {
            return datos.get(campo).getAsBoolean();
        }
        catch(Exception error)
        {
            return porDefecto;
        }
    }
}
