package com.retro.avatarreactions;

import com.eu.habbo.Emulator;

import java.sql.Connection;
import java.sql.Statement;

public final class BaseDatosReacciones
{
    private BaseDatosReacciones()
    {
    }

    public static void inicializar() throws Exception
    {
        String catalogo =
                "CREATE TABLE IF NOT EXISTS biribiri_reactions (" +
                "id INT NOT NULL," +
                "code VARCHAR(64) NOT NULL," +
                "glyph VARCHAR(32) NOT NULL," +
                "name VARCHAR(80) NOT NULL," +
                "source VARCHAR(64) NOT NULL DEFAULT 'base'," +
                "default_owned TINYINT(1) NOT NULL DEFAULT 0," +
                "enabled TINYINT(1) NOT NULL DEFAULT 1," +
                "sort_order INT NOT NULL DEFAULT 0," +
                "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
                "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," +
                "PRIMARY KEY (id)," +
                "UNIQUE KEY uq_biribiri_reaction_code (code)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

        String propiedad =
                "CREATE TABLE IF NOT EXISTS biribiri_user_reactions (" +
                "user_id INT NOT NULL," +
                "reaction_id INT NOT NULL," +
                "source VARCHAR(64) NOT NULL DEFAULT 'unknown'," +
                "obtained_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
                "PRIMARY KEY (user_id, reaction_id)," +
                "KEY idx_biribiri_user_reactions_reaction (reaction_id)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

        String slots =
                "CREATE TABLE IF NOT EXISTS biribiri_user_reaction_slots (" +
                "user_id INT NOT NULL," +
                "slot_index TINYINT UNSIGNED NOT NULL," +
                "reaction_id INT NOT NULL," +
                "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," +
                "PRIMARY KEY (user_id, slot_index)," +
                "UNIQUE KEY uq_biribiri_user_reaction_slot_reaction (user_id, reaction_id)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

        String ajustes =
                "CREATE TABLE IF NOT EXISTS biribiri_user_reaction_settings (" +
                "user_id INT NOT NULL," +
                "display_mode TINYINT UNSIGNED NOT NULL DEFAULT 0," +
                "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," +
                "PRIMARY KEY (user_id)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

        String semillas =
                "INSERT INTO biribiri_reactions " +
                "(id, code, glyph, name, source, default_owned, enabled, sort_order) VALUES " +
                "(1,'heart','❤️','Corazón','base',1,1,1)," +
                "(2,'laugh','😂','Risa','base',1,1,2)," +
                "(3,'fire','🔥','Fuego','base',1,1,3)," +
                "(4,'skull','💀','Calavera','base',1,1,4)," +
                "(5,'sparkle','✨','Brillo','base',1,1,5)," +
                "(6,'exclamation','❗','Impacto','base',1,1,6)," +
                "(7,'cry','😭','Llorar','base',1,1,7)," +
                "(8,'angry','😡','Enfado','base',1,1,8)," +
                "(9,'question','❓','Interrogación','base',1,1,9)," +
                "(10,'clap','👏','Aplausos','base',1,1,10)," +
                "(11,'surprised','😮','Sorpresa','base',1,1,11)," +
                "(12,'thumbs_up','👍','Aprobación','base',1,1,12) " +
                "ON DUPLICATE KEY UPDATE " +
                "code=VALUES(code), glyph=VALUES(glyph), name=VALUES(name), " +
                "source=VALUES(source), default_owned=VALUES(default_owned), " +
                "enabled=VALUES(enabled), sort_order=VALUES(sort_order)";

        try(Connection conexion = Emulator.getDatabase().getDataSource().getConnection();
            Statement sentencia = conexion.createStatement())
        {
            sentencia.executeUpdate(catalogo);
            sentencia.executeUpdate(propiedad);
            sentencia.executeUpdate(slots);
            sentencia.executeUpdate(ajustes);
            sentencia.executeUpdate(semillas);
        }
    }
}
