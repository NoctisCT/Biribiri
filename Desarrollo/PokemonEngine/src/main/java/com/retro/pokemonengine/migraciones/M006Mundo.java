package com.retro.pokemonengine.migraciones;

import java.sql.Connection;
import java.sql.Statement;

/**
 * El mundo: encuentros, obstaculos, centros y tiendas.
 *
 * Las zonas y el gating de salas ya existen desde la migracion 4. Aqui se les
 * cuelga lo que hace que Kanto exista de verdad.
 *
 * La siembra de zonas de Kanto es idempotente por codigo, y **no** da de alta
 * ninguna sala: eso lo decide un administrador metiendo una fila en
 * pokemon_zone_rooms, que es la tabla que manda.
 */
public final class M006Mundo implements Migracion
{
    @Override
    public int version()
    {
        return 6;
    }

    @Override
    public String nombre()
    {
        return "mundo";
    }

    @Override
    public void aplicar(Connection conexion) throws Exception
    {
        try(Statement s = conexion.createStatement())
        {
            // El peso es relativo a las filas de la misma zona, metodo y franja:
            // asi se puede anadir una especie sin recalcular las demas.
            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_zone_encounters (" +
                "id INT NOT NULL AUTO_INCREMENT," +
                "zone_id INT NOT NULL," +
                "species_id INT NOT NULL," +
                "form_id INT NOT NULL DEFAULT 0," +
                "nivel_min TINYINT UNSIGNED NOT NULL DEFAULT 2," +
                "nivel_max TINYINT UNSIGNED NOT NULL DEFAULT 5," +
                "peso SMALLINT UNSIGNED NOT NULL DEFAULT 10," +
                "metodo VARCHAR(16) NOT NULL DEFAULT 'HIERBA'," +
                "franja VARCHAR(8) NULL," +
                "temporada_id INT NULL," +
                "PRIMARY KEY (id)," +
                "KEY idx_pokemon_zone_encounters_zona (zone_id, metodo)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            // Los obstaculos son de zona, no de jugador: el estado por jugador
            // llega con las MO en el hito 8. `es_global` es lo que convierte un
            // obstaculo en un puzle de sala, que se abre para todos a la vez.
            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_zone_obstacles (" +
                "id INT NOT NULL AUTO_INCREMENT," +
                "zone_id INT NOT NULL," +
                "room_id INT NOT NULL," +
                "x SMALLINT NOT NULL," +
                "y SMALLINT NOT NULL," +
                "tipo VARCHAR(16) NOT NULL DEFAULT 'CORTE'," +
                "mo_requerida VARCHAR(16) NULL," +
                "es_global TINYINT(1) NOT NULL DEFAULT 0," +
                "PRIMARY KEY (id)," +
                "UNIQUE KEY uq_pokemon_zone_obstacles_baldosa (room_id, x, y)," +
                "KEY idx_pokemon_zone_obstacles_zona (zone_id)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_shops (" +
                "id INT NOT NULL AUTO_INCREMENT," +
                "codigo VARCHAR(40) NOT NULL," +
                "nombre_es VARCHAR(60) NOT NULL," +
                "tipo VARCHAR(16) NOT NULL DEFAULT 'tienda'," +
                "zone_id INT NULL," +
                "room_id INT NULL," +
                "insignias_requeridas INT UNSIGNED NOT NULL DEFAULT 0," +
                "activa TINYINT(1) NOT NULL DEFAULT 1," +
                "PRIMARY KEY (id)," +
                "UNIQUE KEY uq_pokemon_shops_codigo (codigo)," +
                "KEY idx_pokemon_shops_zona (zone_id)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            // precio NULL = el de pokemon_items. existencias -1 = sin limite.
            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_shop_stock (" +
                "id INT NOT NULL AUTO_INCREMENT," +
                "shop_id INT NOT NULL," +
                "item_id INT NOT NULL," +
                "precio INT NULL," +
                "insignias_requeridas INT UNSIGNED NOT NULL DEFAULT 0," +
                "existencias INT NOT NULL DEFAULT -1," +
                "orden SMALLINT UNSIGNED NOT NULL DEFAULT 0," +
                "PRIMARY KEY (id)," +
                "UNIQUE KEY uq_pokemon_shop_stock (shop_id, item_id)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            sembrarKanto(s);
        }
    }

    /**
     * Las tres primeras zonas de Kanto y lo que cuelga de ellas.
     *
     * Todo va por codigo y con INSERT IGNORE o NOT EXISTS: volver a aplicar la
     * migracion no duplica nada, y editar una fila a mano no se pisa.
     */
    private void sembrarKanto(Statement s) throws Exception
    {
        // Los codigos van sin region porque la region ya esta en region_id, y
        // porque 'ruta-1' ya existia dado de alta a mano con la sala 203 colgando
        // de el: cambiarlo aqui habria dejado esa sala apuntando a una zona vacia.
        s.executeUpdate(
            "INSERT IGNORE INTO pokemon_zones (region_id, codigo, nombre_es, tipo) VALUES" +
            " (1, 'pueblo-paleta', 'Pueblo Paleta', 'pueblo')," +
            " (1, 'ruta-1', 'Ruta 1', 'ruta')," +
            " (1, 'ciudad-verde', 'Ciudad Verde', 'ciudad')");

        encuentro(s, "ruta-1", 16, 2, 5, 55);
        encuentro(s, "ruta-1", 19, 2, 4, 45);

        tienda(s, "ciudad-verde-centro", "Centro Pokemon de Ciudad Verde", "centro");
        tienda(s, "ciudad-verde-tienda", "Tienda de Ciudad Verde", "tienda");

        int orden = 0;

        for(int itemId : new int[] { 4, 3, 17, 26, 18, 19, 20, 21, 22, 79, 78 })
        {
            stock(s, "ciudad-verde-tienda", itemId, orden++);
        }
    }

    private void encuentro(Statement s, String zona, int especieId, int nivelMin, int nivelMax, int peso)
            throws Exception
    {
        s.executeUpdate(
            "INSERT INTO pokemon_zone_encounters (zone_id, species_id, nivel_min, nivel_max, peso, metodo)" +
            " SELECT z.id, " + especieId + ", " + nivelMin + ", " + nivelMax + ", " + peso + ", 'HIERBA'" +
            " FROM pokemon_zones z WHERE z.codigo = '" + zona + "'" +
            " AND NOT EXISTS (SELECT 1 FROM pokemon_zone_encounters e" +
            " WHERE e.zone_id = z.id AND e.species_id = " + especieId + " AND e.metodo = 'HIERBA')");
    }

    private void tienda(Statement s, String codigo, String nombre, String tipo) throws Exception
    {
        String zona = codigo.startsWith("ciudad-verde") ? "ciudad-verde" : null;

        s.executeUpdate(
            "INSERT IGNORE INTO pokemon_shops (codigo, nombre_es, tipo, zone_id)" +
            " SELECT '" + codigo + "', '" + nombre + "', '" + tipo + "', " +
            (zona == null ? "NULL" : "(SELECT id FROM pokemon_zones WHERE codigo = '" + zona + "')"));
    }

    private void stock(Statement s, String tienda, int itemId, int orden) throws Exception
    {
        s.executeUpdate(
            "INSERT IGNORE INTO pokemon_shop_stock (shop_id, item_id, orden)" +
            " SELECT t.id, " + itemId + ", " + orden +
            " FROM pokemon_shops t WHERE t.codigo = '" + tienda + "'");
    }
}
