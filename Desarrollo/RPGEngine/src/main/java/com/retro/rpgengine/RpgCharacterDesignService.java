package com.retro.rpgengine;

import com.eu.habbo.Emulator;
import com.retro.rpgengine.RpgCharacterService.CharacterData;
import com.retro.rpgengine.RpgSheetTemplateService.SheetField;
import com.retro.rpgengine.RpgSheetTemplateService.SheetSection;
import com.retro.rpgengine.RpgSheetTemplateService.SheetTemplate;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class RpgCharacterDesignService
{
    private static final Set<Integer> WIDTHS =
            new HashSet<Integer>(
                    java.util.Arrays.asList(3, 4, 6, 8, 9, 12)
            );

    private static final Set<String> ALIGNMENTS =
            new HashSet<String>(
                    java.util.Arrays.asList("left", "center", "right")
            );

    private RpgCharacterDesignService()
    {
    }

    public static final class BlockData
    {
        public String blockType;
        public int sourceId;
        public int sortOrder;
        public int widthSpan;
        public String alignment;
        public int imageWidthPct;
        public int imageMaxHeight;
        public boolean labelVisible;
    }

    public static final class DesignData
    {
        public int characterId;
        public int rpgId;
        public int userId;

        public String backgroundColor = "#1f1f26";
        public String backgroundImageUrl = "";
        public String primaryColor = "#6f5bd3";
        public String secondaryColor = "#292633";
        public String textColor = "#f5f5f5";
        public String panelColor = "#17171d";
        public int panelOpacity = 90;
        public String bannerImageUrl = "";
        public int bannerHeight = 180;
        public int contentWidth = 760;
        public int borderRadius = 8;
        public String advancedJson = "";

        public List<BlockData> blocks = new ArrayList<BlockData>();
    }

    private static Connection connection() throws Exception
    {
        return Emulator.getDatabase().getDataSource().getConnection();
    }

    private static CharacterData requireCharacter(
            int viewerUserId,
            int rpgId,
            int targetUserId) throws Exception
    {
        CharacterData character =
                RpgCharacterService.getCharacterForViewer(
                        viewerUserId,
                        rpgId,
                        targetUserId
                );

        if(character == null)
            throw new ServicioRpgEngine.RpgEngineException(
                    "character-not-found"
            );

        return character;
    }

    private static String cleanUrl(String value)
            throws ServicioRpgEngine.RpgEngineException
    {
        String clean = value == null ? "" : value.trim();

        if(clean.length() > 1000)
            throw new ServicioRpgEngine.RpgEngineException(
                    "sheet-design-url-too-long"
            );

        if(clean.length() > 0 &&
           !clean.startsWith("http://") &&
           !clean.startsWith("https://"))
            throw new ServicioRpgEngine.RpgEngineException(
                    "sheet-design-invalid-url"
            );

        return clean;
    }

    private static String cleanColor(String value)
            throws ServicioRpgEngine.RpgEngineException
    {
        String clean = value == null ? "" : value.trim();

        if(!clean.matches("^#[0-9a-fA-F]{6}$"))
            throw new ServicioRpgEngine.RpgEngineException(
                    "sheet-design-invalid-color"
            );

        return clean.toUpperCase();
    }

    private static String key(String type, int sourceId)
    {
        return type + ":" + sourceId;
    }

    private static LinkedHashMap<String, BlockData> defaultBlocks(
            SheetTemplate template)
    {
        LinkedHashMap<String, BlockData> result =
                new LinkedHashMap<String, BlockData>();

        int order = 1;

        if(template == null || template.sections == null)
            return result;

        for(SheetSection section : template.sections)
        {
            BlockData sectionBlock = new BlockData();
            sectionBlock.blockType = "section";
            sectionBlock.sourceId = section.id;
            sectionBlock.sortOrder = order++;
            sectionBlock.widthSpan = 12;
            sectionBlock.alignment = "left";
            sectionBlock.imageWidthPct = 100;
            sectionBlock.imageMaxHeight = 300;
            sectionBlock.labelVisible = true;

            result.put(
                    key(sectionBlock.blockType, sectionBlock.sourceId),
                    sectionBlock
            );

            if(section.fields == null) continue;

            for(SheetField field : section.fields)
            {
                BlockData fieldBlock = new BlockData();
                fieldBlock.blockType = "field";
                fieldBlock.sourceId = field.id;
                fieldBlock.sortOrder = order++;
                fieldBlock.widthSpan =
                        "image".equals(field.fieldType) ? 6 : 12;
                fieldBlock.alignment =
                        "image".equals(field.fieldType)
                                ? "center"
                                : "left";
                fieldBlock.imageWidthPct = 100;
                fieldBlock.imageMaxHeight = 300;
                fieldBlock.labelVisible =
                        !"image".equals(field.fieldType);

                result.put(
                        key(fieldBlock.blockType, fieldBlock.sourceId),
                        fieldBlock
                );
            }
        }

        return result;
    }

    private static BlockData copyBlock(BlockData source)
    {
        BlockData block = new BlockData();
        block.blockType = source.blockType;
        block.sourceId = source.sourceId;
        block.sortOrder = source.sortOrder;
        block.widthSpan = source.widthSpan;
        block.alignment = source.alignment;
        block.imageWidthPct = source.imageWidthPct;
        block.imageMaxHeight = source.imageMaxHeight;
        block.labelVisible = source.labelVisible;
        return block;
    }

    public static DesignData getDesign(
            int viewerUserId,
            int rpgId,
            int targetUserId) throws Exception
    {
        CharacterData character =
                requireCharacter(viewerUserId, rpgId, targetUserId);

        SheetTemplate template = RpgCharacterService.getTemplate(rpgId);
        LinkedHashMap<String, BlockData> defaults =
                defaultBlocks(template);

        DesignData design = new DesignData();
        design.characterId = character.id;
        design.rpgId = rpgId;
        design.userId = targetUserId;

        try(Connection connection = connection())
        {
            try(PreparedStatement statement = connection.prepareStatement(
                    "SELECT background_color,background_image_url," +
                    "primary_color,secondary_color,text_color,panel_color," +
                    "panel_opacity,banner_image_url,banner_height," +
                    "content_width,border_radius,advanced_json " +
                    "FROM rpg_engine_character_sheet_designs " +
                    "WHERE character_id=? LIMIT 1"))
            {
                statement.setInt(1, character.id);

                try(ResultSet result = statement.executeQuery())
                {
                    if(result.next())
                    {
                        design.backgroundColor =
                                result.getString("background_color");
                        design.backgroundImageUrl =
                                result.getString("background_image_url");
                        design.primaryColor =
                                result.getString("primary_color");
                        design.secondaryColor =
                                result.getString("secondary_color");
                        design.textColor =
                                result.getString("text_color");
                        design.panelColor =
                                result.getString("panel_color");
                        design.panelOpacity =
                                result.getInt("panel_opacity");
                        design.bannerImageUrl =
                                result.getString("banner_image_url");
                        design.bannerHeight =
                                result.getInt("banner_height");
                        design.contentWidth =
                                result.getInt("content_width");
                        design.borderRadius =
                                result.getInt("border_radius");

                        design.advancedJson =
                                result.getString("advanced_json");
                    }
                }
            }

            Map<String, BlockData> stored =
                    new HashMap<String, BlockData>();

            try(PreparedStatement statement = connection.prepareStatement(
                    "SELECT block_type,source_id,sort_order,width_span," +
                    "alignment,image_width_pct,image_max_height,label_visible " +
                    "FROM rpg_engine_character_sheet_blocks " +
                    "WHERE character_id=? ORDER BY sort_order ASC"))
            {
                statement.setInt(1, character.id);

                try(ResultSet result = statement.executeQuery())
                {
                    while(result.next())
                    {
                        BlockData block = new BlockData();
                        block.blockType =
                                result.getString("block_type");
                        block.sourceId =
                                result.getInt("source_id");
                        block.sortOrder =
                                result.getInt("sort_order");
                        block.widthSpan =
                                result.getInt("width_span");
                        block.alignment =
                                result.getString("alignment");
                        block.imageWidthPct =
                                result.getInt("image_width_pct");
                        block.imageMaxHeight =
                                result.getInt("image_max_height");
                        block.labelVisible =
                                result.getBoolean("label_visible");

                        String key = key(
                                block.blockType,
                                block.sourceId
                        );

                        if(defaults.containsKey(key))
                            stored.put(key, block);
                    }
                }
            }

            List<BlockData> reconciled =
                    new ArrayList<BlockData>();

            for(BlockData block : stored.values())
                reconciled.add(copyBlock(block));

            Collections.sort(
                    reconciled,
                    new Comparator<BlockData>()
                    {
                        @Override
                        public int compare(BlockData a, BlockData b)
                        {
                            return Integer.compare(
                                    a.sortOrder,
                                    b.sortOrder
                            );
                        }
                    }
            );

            Set<String> used = new HashSet<String>();

            for(BlockData block : reconciled)
                used.add(key(block.blockType, block.sourceId));

            for(Map.Entry<String, BlockData> entry : defaults.entrySet())
            {
                if(!used.contains(entry.getKey()))
                    reconciled.add(copyBlock(entry.getValue()));
            }

            for(int i = 0; i < reconciled.size(); i++)
                reconciled.get(i).sortOrder = i + 1;

            design.blocks = reconciled;
        }

        if(design.backgroundImageUrl == null)
            design.backgroundImageUrl = "";

        if(design.bannerImageUrl == null)
            design.bannerImageUrl = "";

        if(design.advancedJson == null)
            design.advancedJson = "";

        return design;
    }

    public static DesignData saveOwnDesign(
            int actorUserId,
            int rpgId,
            DesignData submitted) throws Exception
    {
        CharacterData character =
                RpgCharacterService.getMyCharacter(
                        actorUserId,
                        rpgId
                );

        if(character == null)
            throw new ServicioRpgEngine.RpgEngineException(
                    "character-not-found"
            );

        if(submitted == null)
            throw new ServicioRpgEngine.RpgEngineException(
                    "invalid-sheet-design"
            );

        SheetTemplate template =
                RpgCharacterService.getTemplate(rpgId);

        LinkedHashMap<String, BlockData> expected =
                defaultBlocks(template);

        submitted.backgroundColor =
                cleanColor(submitted.backgroundColor);
        submitted.backgroundImageUrl =
                cleanUrl(submitted.backgroundImageUrl);
        submitted.primaryColor =
                cleanColor(submitted.primaryColor);
        submitted.secondaryColor =
                cleanColor(submitted.secondaryColor);
        submitted.textColor =
                cleanColor(submitted.textColor);
        submitted.panelColor =
                cleanColor(submitted.panelColor);
        submitted.bannerImageUrl =
                cleanUrl(submitted.bannerImageUrl);

        if(submitted.panelOpacity < 20 ||
           submitted.panelOpacity > 100)
            throw new ServicioRpgEngine.RpgEngineException(
                    "sheet-design-invalid-opacity"
            );

        if(submitted.bannerHeight < 80 ||
           submitted.bannerHeight > 450)
            throw new ServicioRpgEngine.RpgEngineException(
                    "sheet-design-invalid-banner-height"
            );

        if(submitted.contentWidth < 520 ||
           submitted.contentWidth > 1100)
            throw new ServicioRpgEngine.RpgEngineException(
                    "sheet-design-invalid-width"
            );

        if(submitted.borderRadius < 0 ||
           submitted.borderRadius > 24)
            throw new ServicioRpgEngine.RpgEngineException(
                    "sheet-design-invalid-radius"
            );

        if(submitted.advancedJson == null)
            submitted.advancedJson = "";

        if(submitted.advancedJson.length() > 100000)
            throw new ServicioRpgEngine.RpgEngineException(
                    "sheet-design-advanced-too-large"
            );

        if(submitted.blocks == null ||
           submitted.blocks.size() != expected.size())
            throw new ServicioRpgEngine.RpgEngineException(
                    "sheet-design-missing-blocks"
            );

        Set<String> seen = new HashSet<String>();

        for(int i = 0; i < submitted.blocks.size(); i++)
        {
            BlockData block = submitted.blocks.get(i);

            if(block == null)
                throw new ServicioRpgEngine.RpgEngineException(
                        "invalid-sheet-design-block"
                );

            String blockKey = key(
                    block.blockType,
                    block.sourceId
            );

            if(!expected.containsKey(blockKey) ||
               !seen.add(blockKey))
                throw new ServicioRpgEngine.RpgEngineException(
                        "invalid-sheet-design-block"
                );

            block.sortOrder = i + 1;

            if("section".equals(block.blockType))
            {
                block.widthSpan = 12;
                block.alignment = "left";
                block.imageWidthPct = 100;
                block.imageMaxHeight = 300;
            }
            else
            {
                if(!WIDTHS.contains(block.widthSpan))
                    throw new ServicioRpgEngine.RpgEngineException(
                            "sheet-design-invalid-block-width"
                    );

                if(!ALIGNMENTS.contains(block.alignment))
                    throw new ServicioRpgEngine.RpgEngineException(
                            "sheet-design-invalid-alignment"
                    );

                if(block.imageWidthPct < 20 ||
                   block.imageWidthPct > 100)
                    throw new ServicioRpgEngine.RpgEngineException(
                            "sheet-design-invalid-image-width"
                    );

                if(block.imageMaxHeight < 100 ||
                   block.imageMaxHeight > 700)
                    throw new ServicioRpgEngine.RpgEngineException(
                            "sheet-design-invalid-image-height"
                    );
            }
        }

        try(Connection connection = connection())
        {
            connection.setAutoCommit(false);

            try
            {
                try(PreparedStatement statement = connection.prepareStatement(
                        "INSERT INTO rpg_engine_character_sheet_designs " +
                        "(character_id,background_color,background_image_url," +
                        "primary_color,secondary_color,text_color,panel_color," +
                        "panel_opacity,banner_image_url,banner_height," +
                        "content_width,border_radius,advanced_json) " +
                        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) " +
                        "ON DUPLICATE KEY UPDATE " +
                        "background_color=VALUES(background_color)," +
                        "background_image_url=VALUES(background_image_url)," +
                        "primary_color=VALUES(primary_color)," +
                        "secondary_color=VALUES(secondary_color)," +
                        "text_color=VALUES(text_color)," +
                        "panel_color=VALUES(panel_color)," +
                        "panel_opacity=VALUES(panel_opacity)," +
                        "banner_image_url=VALUES(banner_image_url)," +
                        "banner_height=VALUES(banner_height)," +
                        "content_width=VALUES(content_width)," +
                        "border_radius=VALUES(border_radius)," +
                        "advanced_json=VALUES(advanced_json)"))
                {
                    statement.setInt(1, character.id);
                    statement.setString(2, submitted.backgroundColor);
                    statement.setString(3, submitted.backgroundImageUrl);
                    statement.setString(4, submitted.primaryColor);
                    statement.setString(5, submitted.secondaryColor);
                    statement.setString(6, submitted.textColor);
                    statement.setString(7, submitted.panelColor);
                    statement.setInt(8, submitted.panelOpacity);
                    statement.setString(9, submitted.bannerImageUrl);
                    statement.setInt(10, submitted.bannerHeight);
                    statement.setInt(11, submitted.contentWidth);
                    statement.setInt(12, submitted.borderRadius);
                    statement.setString(13, submitted.advancedJson);
                    statement.executeUpdate();
                }

                try(PreparedStatement delete = connection.prepareStatement(
                        "DELETE FROM rpg_engine_character_sheet_blocks " +
                        "WHERE character_id=?"))
                {
                    delete.setInt(1, character.id);
                    delete.executeUpdate();
                }

                try(PreparedStatement insert = connection.prepareStatement(
                        "INSERT INTO rpg_engine_character_sheet_blocks " +
                        "(character_id,block_type,source_id,sort_order," +
                        "width_span,alignment,image_width_pct," +
                        "image_max_height,label_visible) " +
                        "VALUES (?,?,?,?,?,?,?,?,?)"))
                {
                    for(BlockData block : submitted.blocks)
                    {
                        insert.setInt(1, character.id);
                        insert.setString(2, block.blockType);
                        insert.setInt(3, block.sourceId);
                        insert.setInt(4, block.sortOrder);
                        insert.setInt(5, block.widthSpan);
                        insert.setString(6, block.alignment);
                        insert.setInt(7, block.imageWidthPct);
                        insert.setInt(8, block.imageMaxHeight);
                        insert.setBoolean(9, block.labelVisible);
                        insert.addBatch();
                    }

                    insert.executeBatch();
                }

                connection.commit();
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

        return getDesign(
                actorUserId,
                rpgId,
                actorUserId
        );
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

    public static String toJson(DesignData design)
    {
        StringBuilder json = new StringBuilder();

        json.append("{\"design\":{");
        json.append("\"characterId\":").append(design.characterId).append(',');
        json.append("\"rpgId\":").append(design.rpgId).append(',');
        json.append("\"userId\":").append(design.userId).append(',');
        json.append("\"backgroundColor\":")
                .append(jsonString(design.backgroundColor)).append(',');
        json.append("\"backgroundImageUrl\":")
                .append(jsonString(design.backgroundImageUrl)).append(',');
        json.append("\"primaryColor\":")
                .append(jsonString(design.primaryColor)).append(',');
        json.append("\"secondaryColor\":")
                .append(jsonString(design.secondaryColor)).append(',');
        json.append("\"textColor\":")
                .append(jsonString(design.textColor)).append(',');
        json.append("\"panelColor\":")
                .append(jsonString(design.panelColor)).append(',');
        json.append("\"panelOpacity\":")
                .append(design.panelOpacity).append(',');
        json.append("\"bannerImageUrl\":")
                .append(jsonString(design.bannerImageUrl)).append(',');
        json.append("\"bannerHeight\":")
                .append(design.bannerHeight).append(',');
        json.append("\"contentWidth\":")
                .append(design.contentWidth).append(',');
        json.append("\"borderRadius\":")
                .append(design.borderRadius).append(',');
        json.append("\"advancedJson\":")
                .append(jsonString(design.advancedJson)).append(',');
        json.append("\"blocks\":[");

        boolean first = true;

        for(BlockData block : design.blocks)
        {
            if(!first) json.append(',');
            first = false;

            json.append('{');
            json.append("\"blockType\":")
                    .append(jsonString(block.blockType)).append(',');
            json.append("\"sourceId\":").append(block.sourceId).append(',');
            json.append("\"sortOrder\":").append(block.sortOrder).append(',');
            json.append("\"widthSpan\":").append(block.widthSpan).append(',');
            json.append("\"alignment\":")
                    .append(jsonString(block.alignment)).append(',');
            json.append("\"imageWidthPct\":")
                    .append(block.imageWidthPct).append(',');
            json.append("\"imageMaxHeight\":")
                    .append(block.imageMaxHeight).append(',');
            json.append("\"labelVisible\":")
                    .append(block.labelVisible ? "true" : "false");
            json.append('}');
        }

        json.append("]}}");
        return json.toString();
    }
}