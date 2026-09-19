package com.retro.pokemonengine;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.users.Habbo;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Cuanto tiempo lleva jugado un entrenador.
 *
 * Se cuenta **tiempo en salas Pokemon**, no tiempo de hotel: contar el hotel
 * entero premiaria a quien deja el navegador abierto en la plaza sin tocar el
 * juego. Arcturus no guarda ningun acumulado propio, asi que esto hay que
 * llevarlo aqui de todas formas.
 *
 * Es un dato de vitrina: se ensena en la ficha del entrenador y no decide nada.
 * Un contador de tiempo se farmea dejando el avatar quieto, asi que cualquier
 * cosa que dependiera de el seria regalarla.
 */
public final class ServicioTiempoJugado
{
    /**
     * Tope de un solo tramo. Una conexion que se cae sin avisar no puede
     * regalar ocho horas cuando el emulador cierre la sesion mucho despues.
     */
    public static final int TOPE_TRAMO_SEGUNDOS = 4 * 60 * 60;

    private static final Map<Integer, Long> DESDE = new ConcurrentHashMap<>();

    private ServicioTiempoJugado()
    {
    }

    public static void alEntrar(Habbo habbo, Room room)
    {
        if(habbo == null || room == null) return;

        int userId = habbo.getHabboInfo().getId();

        // Cambiar de sala cierra el tramo anterior antes de abrir el nuevo.
        cerrar(userId);

        if(ServicioZonas.esSalaPokemon(room.getId()))
        {
            DESDE.put(userId, System.currentTimeMillis());
        }
    }

    public static void alSalir(Habbo habbo)
    {
        if(habbo == null || habbo.getHabboInfo() == null) return;

        cerrar(habbo.getHabboInfo().getId());
    }

    /** Cierra el tramo abierto y lo suma. Sin tramo abierto no hace nada. */
    public static void cerrar(int userId)
    {
        Long desde = DESDE.remove(userId);

        if(desde == null) return;

        long segundos = (System.currentTimeMillis() - desde) / 1000L;

        if(segundos <= 0) return;

        int tramo = (int) Math.min(segundos, TOPE_TRAMO_SEGUNDOS);

        try
        {
            sumar(userId, tramo);
        }
        catch(Exception error)
        {
            System.out.println("[PokemonEngine] No se pudo sumar el tiempo jugado de "
                    + userId + ": " + error.getMessage());
        }
    }

    private static void sumar(int userId, int segundos) throws Exception
    {
        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            PreparedStatement p = c.prepareStatement(
                    "UPDATE pokemon_trainers SET jugado_segundos = jugado_segundos + ?" +
                    " WHERE user_id = ?"))
        {
            p.setInt(1, segundos);
            p.setInt(2, userId);
            p.executeUpdate();
        }
    }
}
