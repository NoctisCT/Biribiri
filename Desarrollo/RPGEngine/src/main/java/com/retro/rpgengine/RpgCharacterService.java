package com.retro.rpgengine;

import com.eu.habbo.Emulator;
import com.retro.rpgengine.RpgSheetTemplateService.SheetField;
import com.retro.rpgengine.RpgSheetTemplateService.SheetSection;
import com.retro.rpgengine.RpgSheetTemplateService.SheetTemplate;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.LinkedHashMap;
import java.util.Map;

public final class RpgCharacterService
{
    private RpgCharacterService()
    {
    }

    public static final class CharacterData
    {
        public int id;
        public int rpgId;
        public int userId;
        public String username;
        public long createdAtEpoch;
        public long updatedAtEpoch;
        public Map<Integer, String> values = new LinkedHashMap<Integer, String>();
    }

    private static Connection connection() throws Exception
    {
        return Emulator.getDatabase().getDataSource().getConnection();
    }

    public static SheetTemplate getTemplate(int rpgId) throws Exception
    {
        if(rpgId <= 0)
            throw new ServicioRpgEngine.RpgEngineException("invalid-rpg");

        SheetTemplate template = new SheetTemplate();
        template.rpgId = rpgId;

        try(Connection connection = connection())
        {
            try(PreparedStatement project = connection.prepareStatement(
                    "SELECT id FROM rpg_engine_projects WHERE id=? AND enabled=1 LIMIT 1"))
            {
                project.setInt(1, rpgId);

                try(ResultSet result = project.executeQuery())
                {
                    if(!result.next())
                        throw new ServicioRpgEngine.RpgEngineException("rpg-not-found");
                }
            }

            try(PreparedStatement sections = connection.prepareStatement(
                    "SELECT id,rpg_id,title,sort_order " +
                    "FROM rpg_engine_sheet_sections " +
                    "WHERE rpg_id=? AND enabled=1 " +
                    "ORDER BY sort_order ASC,id ASC"))
            {
                sections.setInt(1, rpgId);

                try(ResultSet result = sections.executeQuery())
                {
                    while(result.next())
                    {
                        SheetSection section = new SheetSection();
                        section.id = result.getInt("id");
                        section.rpgId = result.getInt("rpg_id");
                        section.title = result.getString("title");
                        section.sortOrder = result.getInt("sort_order");

                        try(PreparedStatement fields = connection.prepareStatement(
                                "SELECT id,rpg_id,section_id,label,field_type,required," +
                                "visibility,control_mode,sort_order,options_text " +
                                "FROM rpg_engine_sheet_fields " +
                                "WHERE rpg_id=? AND section_id=? AND enabled=1 " +
                                "ORDER BY sort_order ASC,id ASC"))
                        {
                            fields.setInt(1, rpgId);
                            fields.setInt(2, section.id);

                            try(ResultSet fieldRows = fields.executeQuery())
                            {
                                while(fieldRows.next())
                                {
                                    SheetField field = new SheetField();
                                    field.id = fieldRows.getInt("id");
                                    field.rpgId = fieldRows.getInt("rpg_id");
                                    field.sectionId = fieldRows.getInt("section_id");
                                    field.label = fieldRows.getString("label");
                                    field.fieldType = fieldRows.getString("field_type");
                                    field.required = fieldRows.getBoolean("required");
                                    field.visibility = fieldRows.getString("visibility");
                                    field.controlMode = fieldRows.getString("control_mode");
                                    field.sortOrder = fieldRows.getInt("sort_order");
                                    field.optionsText = fieldRows.getString("options_text");

                                    if(field.optionsText == null)
                                        field.optionsText = "";

                                    section.fields.add(field);
                                }
                            }
                        }

                        template.sections.add(section);
                    }
                }
            }
        }

        return template;
    }

    private static boolean isProjectOwner(Connection connection, int rpgId, int userId)
            throws Exception
    {
        try(PreparedStatement statement = connection.prepareStatement(
                "SELECT 1 FROM rpg_engine_projects " +
                "WHERE id=? AND owner_user_id=? AND enabled=1 LIMIT 1"))
        {
            statement.setInt(1, rpgId);
            statement.setInt(2, userId);

            try(ResultSet result = statement.executeQuery())
            {
                return result.next();
            }
        }
    }

    private static boolean isRegisteredRoom(Connection connection, int rpgId, int roomId)
            throws Exception
    {
        if(roomId <= 0) return false;

        try(PreparedStatement statement = connection.prepareStatement(
                "SELECT 1 FROM rpg_engine_rooms " +
                "WHERE room_id=? AND rpg_id=? AND enabled=1 LIMIT 1"))
        {
            statement.setInt(1, roomId);
            statement.setInt(2, rpgId);

            try(ResultSet result = statement.executeQuery())
            {
                return result.next();
            }
        }
    }

    private static CharacterData loadCharacter(
            Connection connection,
            int rpgId,
            int userId) throws Exception
    {
        CharacterData character = null;

        try(PreparedStatement statement = connection.prepareStatement(
                "SELECT c.id, c.rpg_id, c.user_id, u.username, " +
                "UNIX_TIMESTAMP(c.created_at) AS created_epoch, " +
                "UNIX_TIMESTAMP(c.updated_at) AS updated_epoch " +
                "FROM rpg_engine_characters c " +
                "LEFT JOIN users u ON u.id=c.user_id " +
                "WHERE c.rpg_id=? AND c.user_id=? LIMIT 1"))
        {
            statement.setInt(1, rpgId);
            statement.setInt(2, userId);

            try(ResultSet result = statement.executeQuery())
            {
                if(result.next())
                {
                    character = new CharacterData();
                    character.id = result.getInt("id");
                    character.rpgId = result.getInt("rpg_id");
                    character.userId = result.getInt("user_id");
                    character.username = result.getString("username");
                    character.createdAtEpoch = result.getLong("created_epoch");
                    character.updatedAtEpoch = result.getLong("updated_epoch");
                }
            }
        }

        if(character == null) return null;
        if(character.username == null) character.username = "Usuario #" + character.userId;

        try(PreparedStatement values = connection.prepareStatement(
                "SELECT field_id, value_text " +
                "FROM rpg_engine_character_field_values " +
                "WHERE character_id=? ORDER BY field_id ASC"))
        {
            values.setInt(1, character.id);

            try(ResultSet result = values.executeQuery())
            {
                while(result.next())
                {
                    String value = result.getString("value_text");
                    character.values.put(
                            result.getInt("field_id"),
                            value == null ? "" : value
                    );
                }
            }
        }

        return character;
    }

    public static CharacterData getMyCharacter(int userId, int rpgId) throws Exception
    {
        getTemplate(rpgId);

        try(Connection connection = connection())
        {
            return loadCharacter(connection, rpgId, userId);
        }
    }

    private static Map<Integer, SheetField> fieldDefinitions(SheetTemplate template)
    {
        Map<Integer, SheetField> fields = new LinkedHashMap<Integer, SheetField>();

        if(template == null || template.sections == null) return fields;

        for(SheetSection section : template.sections)
        {
            if(section == null || section.fields == null) continue;

            for(SheetField field : section.fields)
            {
                if(field != null) fields.put(field.id, field);
            }
        }

        return fields;
    }

    private static String validateValue(SheetField field, String raw)
            throws ServicioRpgEngine.RpgEngineException
    {
        String value = raw == null ? "" : raw.trim();

        if(field == null)
            throw new ServicioRpgEngine.RpgEngineException("sheet-field-not-found");

        if(!"player".equals(field.controlMode))
            throw new ServicioRpgEngine.RpgEngineException("sheet-field-not-player-editable");

        if("staff".equals(field.visibility))
            throw new ServicioRpgEngine.RpgEngineException("sheet-field-not-visible-to-player");

        if(field.required && value.length() == 0)
            throw new ServicioRpgEngine.RpgEngineException("sheet-required-field-empty");

        if("text".equals(field.fieldType))
        {
            if(value.length() > 255)
                throw new ServicioRpgEngine.RpgEngineException("sheet-text-too-long");
        }
        else if("long_text".equals(field.fieldType))
        {
            if(value.length() > 10000)
                throw new ServicioRpgEngine.RpgEngineException("sheet-long-text-too-long");
        }
        else if("number".equals(field.fieldType))
        {
            if(value.length() > 0 &&
               !value.matches("^-?\\d+(\\.\\d+)?$"))
                throw new ServicioRpgEngine.RpgEngineException("sheet-invalid-number");

            if(value.length() > 64)
                throw new ServicioRpgEngine.RpgEngineException("sheet-number-too-long");
        }
        else if("image".equals(field.fieldType))
        {
            if(value.length() > 1000)
                throw new ServicioRpgEngine.RpgEngineException("sheet-image-too-long");
        }
        else if("date".equals(field.fieldType))
        {
            if(value.length() > 0 &&
               !value.matches("^\\d{4}-\\d{2}-\\d{2}$"))
                throw new ServicioRpgEngine.RpgEngineException("sheet-invalid-date");
        }
        else if("yes_no".equals(field.fieldType))
        {
            if(value.length() > 0 &&
               !"yes".equals(value) &&
               !"no".equals(value))
                throw new ServicioRpgEngine.RpgEngineException("sheet-invalid-yes-no");
        }
        else if("select".equals(field.fieldType))
        {
            if(value.length() > 0)
            {
                boolean valid = false;
                String options = field.optionsText == null ? "" : field.optionsText;

                for(String option : options.split("\\r?\\n"))
                {
                    if(value.equals(option.trim()))
                    {
                        valid = true;
                        break;
                    }
                }

                if(!valid)
                    throw new ServicioRpgEngine.RpgEngineException("sheet-invalid-option");
            }
        }
        else
        {
            throw new ServicioRpgEngine.RpgEngineException("invalid-sheet-field-type");
        }

        return value;
    }

    public static CharacterData saveMyCharacter(
            int userId,
            int rpgId,
            int currentRoomId,
            Map<Integer, String> submittedValues) throws Exception
    {
        SheetTemplate template = getTemplate(rpgId);
        Map<Integer, SheetField> definitions = fieldDefinitions(template);

        if(definitions.isEmpty())
            throw new ServicioRpgEngine.RpgEngineException("sheet-template-empty");

        Map<Integer, String> cleanValues = new LinkedHashMap<Integer, String>();

        if(submittedValues != null)
        {
            for(Map.Entry<Integer, String> entry : submittedValues.entrySet())
            {
                SheetField field = definitions.get(entry.getKey());

                if(field == null)
                    throw new ServicioRpgEngine.RpgEngineException("sheet-field-not-found");

                cleanValues.put(field.id, validateValue(field, entry.getValue()));
            }
        }

        for(SheetField field : definitions.values())
        {
            if(!"player".equals(field.controlMode)) continue;
            if("staff".equals(field.visibility)) continue;
            if(!field.required) continue;

            String value = cleanValues.get(field.id);

            if(value == null || value.trim().length() == 0)
                throw new ServicioRpgEngine.RpgEngineException("sheet-required-field-empty");
        }

        try(Connection connection = connection())
        {
            connection.setAutoCommit(false);

            try
            {
                CharacterData existing = loadCharacter(connection, rpgId, userId);

                if(existing == null)
                {
                    boolean allowed =
                            isProjectOwner(connection, rpgId, userId) ||
                            isRegisteredRoom(connection, rpgId, currentRoomId) ||
                            RpgMembershipService.isMember(rpgId, userId);

                    if(!allowed)
                        throw new ServicioRpgEngine.RpgEngineException(
                                "character-create-requires-rpg-room"
                        );

                    try(PreparedStatement insert = connection.prepareStatement(
                            "INSERT INTO rpg_engine_characters (rpg_id, user_id) VALUES (?, ?)",
                            Statement.RETURN_GENERATED_KEYS))
                    {
                        insert.setInt(1, rpgId);
                        insert.setInt(2, userId);
                        insert.executeUpdate();

                        try(ResultSet keys = insert.getGeneratedKeys())
                        {
                            if(!keys.next())
                                throw new IllegalStateException("character-id-not-generated");
                        }
                    }
                }

                CharacterData character = loadCharacter(connection, rpgId, userId);

                if(character == null)
                    throw new IllegalStateException("character-not-found-after-create");

                for(Map.Entry<Integer, String> entry : cleanValues.entrySet())
                {
                    try(PreparedStatement value = connection.prepareStatement(
                            "INSERT INTO rpg_engine_character_field_values " +
                            "(character_id, field_id, value_text) VALUES (?, ?, ?) " +
                            "ON DUPLICATE KEY UPDATE " +
                            "value_text=VALUES(value_text), updated_at=CURRENT_TIMESTAMP"))
                    {
                        value.setInt(1, character.id);
                        value.setInt(2, entry.getKey());
                        value.setString(3, entry.getValue());
                        value.executeUpdate();
                    }
                }

                try(PreparedStatement touch = connection.prepareStatement(
                        "UPDATE rpg_engine_characters SET updated_at=CURRENT_TIMESTAMP WHERE id=?"))
                {
                    touch.setInt(1, character.id);
                    touch.executeUpdate();
                }

                connection.commit();
                return loadCharacter(connection, rpgId, userId);
            }
            catch(Exception error)
            {
                connection.rollback();
                throw error;
            }
            finally
            {
                connection.setAutoCommit(true);
            }
        }
    }

    private static String jsonString(String value)
    {
        if(value == null) return "null";

        StringBuilder out = new StringBuilder();
        out.append('"');

        for(int i = 0; i < value.length(); i++)
        {
            char c = value.charAt(i);

            switch(c)
            {
                case '"': out.append("\\\""); break;
                case '\\': out.append("\\\\"); break;
                case '\b': out.append("\\b"); break;
                case '\f': out.append("\\f"); break;
                case '\n': out.append("\\n"); break;
                case '\r': out.append("\\r"); break;
                case '\t': out.append("\\t"); break;
                default:
                    if(c < 32)
                        out.append(String.format("\\u%04x", (int)c));
                    else
                        out.append(c);
                    break;
            }
        }

        out.append('"');
        return out.toString();
    }

    public static String toJson(CharacterData character)
    {
        if(character == null)
            return "{\"character\":null}";

        StringBuilder json = new StringBuilder();
        json.append("{\"character\":{");
        json.append("\"id\":").append(character.id).append(',');
        json.append("\"rpgId\":").append(character.rpgId).append(',');
        json.append("\"userId\":").append(character.userId).append(',');
        json.append("\"username\":").append(jsonString(character.username)).append(',');
        json.append("\"createdAtEpoch\":").append(character.createdAtEpoch).append(',');
        json.append("\"updatedAtEpoch\":").append(character.updatedAtEpoch).append(',');
        json.append("\"values\":[");

        boolean first = true;

        for(Map.Entry<Integer, String> entry : character.values.entrySet())
        {
            if(!first) json.append(',');
            first = false;

            json.append("{\"fieldId\":").append(entry.getKey());
            json.append(",\"value\":").append(jsonString(entry.getValue()));
            json.append('}');
        }

        json.append("]}}");
        return json.toString();
    }

    public static final class CharacterSummary
    {
        public int characterId;
        public int userId;
        public String username;
        public long updatedAtEpoch;
    }

    private static boolean isRpgMemberOrOwner(int userId, int rpgId) throws Exception
    {
        if(userId <= 0 || rpgId <= 0) return false;

        for(ServicioRpgEngine.Proyecto project : ServicioRpgEngine.listProjects(userId))
        {
            if(project != null && project.id == rpgId)
                return true;
        }

        return false;
    }

    private static boolean isRpgAdmin(int userId, int rpgId) throws Exception
    {
        if(userId <= 0 || rpgId <= 0) return false;

        for(ServicioRpgEngine.Proyecto project : ServicioRpgEngine.listProjects(userId))
        {
            if(project != null &&
               project.id == rpgId &&
               project.ownerUserId == userId)
                return true;
        }

        return false;
    }

    private static SheetField copyField(SheetField source)
    {
        SheetField field = new SheetField();
        field.id = source.id;
        field.rpgId = source.rpgId;
        field.sectionId = source.sectionId;
        field.label = source.label;
        field.fieldType = source.fieldType;
        field.required = source.required;
        field.visibility = source.visibility;
        field.controlMode = source.controlMode;
        field.sortOrder = source.sortOrder;
        field.optionsText = source.optionsText;
        return field;
    }

    private static boolean canSeeField(
            SheetField field,
            int viewerUserId,
            int targetUserId,
            boolean viewerMember,
            boolean viewerAdmin)
    {
        if(field == null) return false;

        String visibility = field.visibility == null
                ? "public"
                : field.visibility;

        if("public".equals(visibility))
            return true;

        if("members".equals(visibility))
            return viewerMember || viewerAdmin;

        if("owner".equals(visibility))
            return viewerUserId == targetUserId;

        if("staff".equals(visibility))
            return viewerAdmin;

        return false;
    }

    public static SheetTemplate getTemplateForViewer(
            int viewerUserId,
            int rpgId,
            int targetUserId) throws Exception
    {
        SheetTemplate original = getTemplate(rpgId);
        SheetTemplate filtered = new SheetTemplate();
        filtered.rpgId = rpgId;

        boolean viewerMember = isRpgMemberOrOwner(viewerUserId, rpgId);
        boolean viewerAdmin = isRpgAdmin(viewerUserId, rpgId);

        if(original == null || original.sections == null)
            return filtered;

        for(SheetSection sourceSection : original.sections)
        {
            if(sourceSection == null || sourceSection.fields == null)
                continue;

            SheetSection section = new SheetSection();
            section.id = sourceSection.id;
            section.rpgId = sourceSection.rpgId;
            section.title = sourceSection.title;
            section.sortOrder = sourceSection.sortOrder;

            for(SheetField sourceField : sourceSection.fields)
            {
                if(canSeeField(
                        sourceField,
                        viewerUserId,
                        targetUserId,
                        viewerMember,
                        viewerAdmin))
                    section.fields.add(copyField(sourceField));
            }

            if(!section.fields.isEmpty())
                filtered.sections.add(section);
        }

        return filtered;
    }

    public static java.util.List<CharacterSummary> listCharactersForRpg(
            int viewerUserId,
            int rpgId) throws Exception
    {
        getTemplate(rpgId);

        java.util.List<CharacterSummary> characters =
                new java.util.ArrayList<CharacterSummary>();

        try(Connection connection = connection();
            PreparedStatement statement = connection.prepareStatement(
                    "SELECT c.id AS character_id,c.user_id,u.username," +
                    "UNIX_TIMESTAMP(c.updated_at) AS updated_epoch " +
                    "FROM rpg_engine_characters c " +
                    "LEFT JOIN users u ON u.id=c.user_id " +
                    "WHERE c.rpg_id=? " +
                    "ORDER BY COALESCE(u.username,''),c.user_id"))
        {
            statement.setInt(1, rpgId);

            try(ResultSet result = statement.executeQuery())
            {
                while(result.next())
                {
                    int targetUserId = result.getInt("user_id");

                    // La lista representa jugadores actuales del RPG.
                    // La autoridad de pertenencia es la misma que usa "Mis RPGs"
                    // (A1), sin duplicar aquí la lógica de grupos/placas.
                    if(!isRpgMemberOrOwner(targetUserId, rpgId))
                        continue;

                    CharacterSummary summary = new CharacterSummary();
                    summary.characterId = result.getInt("character_id");
                    summary.userId = targetUserId;
                    summary.username = result.getString("username");
                    summary.updatedAtEpoch = result.getLong("updated_epoch");

                    if(summary.username == null || summary.username.trim().length() == 0)
                        summary.username = "Usuario #" + targetUserId;

                    characters.add(summary);
                }
            }
        }

        return characters;
    }

    public static CharacterData getCharacterForViewer(
            int viewerUserId,
            int rpgId,
            int targetUserId) throws Exception
    {
        getTemplate(rpgId);

        try(Connection connection = connection())
        {
            CharacterData character = loadCharacter(connection, rpgId, targetUserId);

            if(character == null) return null;

            SheetTemplate visibleTemplate =
                    getTemplateForViewer(viewerUserId, rpgId, targetUserId);

            java.util.HashSet<Integer> visibleFieldIds =
                    new java.util.HashSet<Integer>();

            for(SheetSection section : visibleTemplate.sections)
            {
                for(SheetField field : section.fields)
                    visibleFieldIds.add(field.id);
            }

            java.util.LinkedHashMap<Integer, String> visibleValues =
                    new java.util.LinkedHashMap<Integer, String>();

            for(Map.Entry<Integer, String> entry : character.values.entrySet())
            {
                if(visibleFieldIds.contains(entry.getKey()))
                    visibleValues.put(entry.getKey(), entry.getValue());
            }

            character.values = visibleValues;
            return character;
        }
    }

    private static String validateAdminValue(SheetField field, String raw)
            throws ServicioRpgEngine.RpgEngineException
    {
        if(field == null)
            throw new ServicioRpgEngine.RpgEngineException("sheet-field-not-found");

        if(!"staff".equals(field.controlMode))
            throw new ServicioRpgEngine.RpgEngineException(
                    "sheet-field-not-staff-editable"
            );

        String value = raw == null ? "" : raw.trim();

        if("text".equals(field.fieldType))
        {
            if(value.length() > 255)
                throw new ServicioRpgEngine.RpgEngineException("sheet-text-too-long");
        }
        else if("long_text".equals(field.fieldType))
        {
            if(value.length() > 10000)
                throw new ServicioRpgEngine.RpgEngineException("sheet-long-text-too-long");
        }
        else if("number".equals(field.fieldType))
        {
            if(value.length() > 0 &&
               !value.matches("^-?\\d+(\\.\\d+)?$"))
                throw new ServicioRpgEngine.RpgEngineException("sheet-invalid-number");

            if(value.length() > 64)
                throw new ServicioRpgEngine.RpgEngineException("sheet-number-too-long");
        }
        else if("image".equals(field.fieldType))
        {
            if(value.length() > 1000)
                throw new ServicioRpgEngine.RpgEngineException("sheet-image-too-long");
        }
        else if("date".equals(field.fieldType))
        {
            if(value.length() > 0 &&
               !value.matches("^\\d{4}-\\d{2}-\\d{2}$"))
                throw new ServicioRpgEngine.RpgEngineException("sheet-invalid-date");
        }
        else if("yes_no".equals(field.fieldType))
        {
            if(value.length() > 0 &&
               !"yes".equals(value) &&
               !"no".equals(value))
                throw new ServicioRpgEngine.RpgEngineException("sheet-invalid-yes-no");
        }
        else if("select".equals(field.fieldType))
        {
            if(value.length() > 0)
            {
                boolean valid = false;
                String options = field.optionsText == null ? "" : field.optionsText;

                for(String option : options.split("\\r?\\n"))
                {
                    if(value.equals(option.trim()))
                    {
                        valid = true;
                        break;
                    }
                }

                if(!valid)
                    throw new ServicioRpgEngine.RpgEngineException("sheet-invalid-option");
            }
        }
        else
        {
            throw new ServicioRpgEngine.RpgEngineException(
                    "invalid-sheet-field-type"
            );
        }

        return value;
    }

    public static CharacterData saveCharacterAsAdmin(
            int actorUserId,
            int rpgId,
            int targetUserId,
            Map<Integer, String> submittedValues) throws Exception
    {
        if(!isRpgAdmin(actorUserId, rpgId))
            throw new ServicioRpgEngine.RpgEngineException("rpg-admin-required");

        SheetTemplate template = getTemplate(rpgId);
        Map<Integer, SheetField> definitions = fieldDefinitions(template);

        try(Connection connection = connection())
        {
            connection.setAutoCommit(false);

            try
            {
                CharacterData character =
                        loadCharacter(connection, rpgId, targetUserId);

                if(character == null)
                    throw new ServicioRpgEngine.RpgEngineException(
                            "character-not-found"
                    );

                if(submittedValues != null)
                {
                    for(Map.Entry<Integer, String> entry : submittedValues.entrySet())
                    {
                        SheetField field = definitions.get(entry.getKey());

                        if(field == null)
                            throw new ServicioRpgEngine.RpgEngineException(
                                    "sheet-field-not-found"
                            );

                        String clean = validateAdminValue(
                                field,
                                entry.getValue()
                        );

                        try(PreparedStatement value = connection.prepareStatement(
                                "INSERT INTO rpg_engine_character_field_values " +
                                "(character_id,field_id,value_text) VALUES (?,?,?) " +
                                "ON DUPLICATE KEY UPDATE " +
                                "value_text=VALUES(value_text)," +
                                "updated_at=CURRENT_TIMESTAMP"))
                        {
                            value.setInt(1, character.id);
                            value.setInt(2, field.id);
                            value.setString(3, clean);
                            value.executeUpdate();
                        }
                    }
                }

                try(PreparedStatement touch = connection.prepareStatement(
                        "UPDATE rpg_engine_characters " +
                        "SET updated_at=CURRENT_TIMESTAMP WHERE id=?"))
                {
                    touch.setInt(1, character.id);
                    touch.executeUpdate();
                }

                connection.commit();
                return getCharacterForViewer(
                        actorUserId,
                        rpgId,
                        targetUserId
                );
            }
            catch(Exception error)
            {
                connection.rollback();
                throw error;
            }
            finally
            {
                connection.setAutoCommit(true);
            }
        }
    }

    public static String summariesToJson(
            java.util.List<CharacterSummary> characters)
    {
        StringBuilder json = new StringBuilder();
        json.append("{\"characters\":[");

        boolean first = true;

        if(characters != null)
        {
            for(CharacterSummary character : characters)
            {
                if(!first) json.append(',');
                first = false;

                json.append('{');
                json.append("\"characterId\":").append(character.characterId).append(',');
                json.append("\"userId\":").append(character.userId).append(',');
                json.append("\"username\":").append(jsonString(character.username)).append(',');
                json.append("\"updatedAtEpoch\":").append(character.updatedAtEpoch);
                json.append('}');
            }
        }

        json.append("]}");
        return json.toString();
    }
}