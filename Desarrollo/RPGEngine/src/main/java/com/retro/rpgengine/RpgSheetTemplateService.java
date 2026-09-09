package com.retro.rpgengine;

import com.eu.habbo.Emulator;
import java.sql.*;
import java.util.*;

public final class RpgSheetTemplateService
{
    private static final Set<String> TYPES = new HashSet<String>(Arrays.asList(
        "text","long_text","number","image","date","select","yes_no"
    ));
    private static final Set<String> VIS = new HashSet<String>(Arrays.asList(
        "public","members","owner","staff"
    ));
    private static final Set<String> CONTROL = new HashSet<String>(Arrays.asList(
        "player","staff","engine"
    ));

    private RpgSheetTemplateService() {}

    public static final class SheetField {
        public int id,rpgId,sectionId,sortOrder;
        public String label,fieldType,visibility,controlMode,optionsText;
        public boolean required;
    }
    public static final class SheetSection {
        public int id,rpgId,sortOrder;
        public String title;
        public List<SheetField> fields = new ArrayList<SheetField>();
    }
    public static final class SheetTemplate {
        public int rpgId;
        public List<SheetSection> sections = new ArrayList<SheetSection>();
    }

    private static Connection db() throws Exception {
        return Emulator.getDatabase().getDataSource().getConnection();
    }

    private static String clean(String v,int min,int max,String code)
            throws ServicioRpgEngine.RpgEngineException {
        String s=v==null?"":v.trim();
        if(s.length()<min || s.length()>max) throw new ServicioRpgEngine.RpgEngineException(code);
        return s;
    }

    private static void owner(int actor,int rpgId) throws Exception {
        try(Connection c=db(); PreparedStatement s=c.prepareStatement(
            "SELECT owner_user_id FROM rpg_engine_projects WHERE id=? AND enabled=1 LIMIT 1")) {
            s.setInt(1,rpgId);
            try(ResultSet r=s.executeQuery()) {
                if(!r.next()) throw new ServicioRpgEngine.RpgEngineException("rpg-not-found");
                if(r.getInt("owner_user_id")!=actor) throw new ServicioRpgEngine.RpgEngineException("rpg-owner-required");
            }
        }
    }

    private static void sectionExists(Connection c,int rpgId,int sectionId) throws Exception {
        try(PreparedStatement s=c.prepareStatement(
            "SELECT id FROM rpg_engine_sheet_sections WHERE id=? AND rpg_id=? AND enabled=1 LIMIT 1")) {
            s.setInt(1,sectionId); s.setInt(2,rpgId);
            try(ResultSet r=s.executeQuery()) {
                if(!r.next()) throw new ServicioRpgEngine.RpgEngineException("sheet-section-not-found");
            }
        }
    }

    private static int nextOrder(Connection c,String table,String whereCol,int whereId) throws Exception {
        try(PreparedStatement s=c.prepareStatement(
            "SELECT COALESCE(MAX(sort_order),0)+1 n FROM "+table+" WHERE "+whereCol+"=? AND enabled=1")) {
            s.setInt(1,whereId);
            try(ResultSet r=s.executeQuery()) { r.next(); return Math.max(1,r.getInt("n")); }
        }
    }

    public static SheetTemplate getTemplate(int actor,int rpgId) throws Exception {
        owner(actor,rpgId);
        SheetTemplate t=new SheetTemplate(); t.rpgId=rpgId;
        try(Connection c=db(); PreparedStatement s=c.prepareStatement(
            "SELECT id,rpg_id,title,sort_order FROM rpg_engine_sheet_sections "+
            "WHERE rpg_id=? AND enabled=1 ORDER BY sort_order,id")) {
            s.setInt(1,rpgId);
            try(ResultSet r=s.executeQuery()) {
                while(r.next()) {
                    SheetSection sec=new SheetSection();
                    sec.id=r.getInt("id"); sec.rpgId=r.getInt("rpg_id");
                    sec.title=r.getString("title"); sec.sortOrder=r.getInt("sort_order");
                    sec.fields=fields(c,rpgId,sec.id);
                    t.sections.add(sec);
                }
            }
        }
        return t;
    }

    private static List<SheetField> fields(Connection c,int rpgId,int sectionId) throws Exception {
        List<SheetField> out=new ArrayList<SheetField>();
        try(PreparedStatement s=c.prepareStatement(
            "SELECT id,rpg_id,section_id,label,field_type,required,visibility,control_mode,sort_order,options_text "+
            "FROM rpg_engine_sheet_fields WHERE rpg_id=? AND section_id=? AND enabled=1 ORDER BY sort_order,id")) {
            s.setInt(1,rpgId); s.setInt(2,sectionId);
            try(ResultSet r=s.executeQuery()) {
                while(r.next()) {
                    SheetField f=new SheetField();
                    f.id=r.getInt("id"); f.rpgId=r.getInt("rpg_id"); f.sectionId=r.getInt("section_id");
                    f.label=r.getString("label"); f.fieldType=r.getString("field_type");
                    f.required=r.getBoolean("required"); f.visibility=r.getString("visibility");
                    f.controlMode=r.getString("control_mode"); f.sortOrder=r.getInt("sort_order");
                    f.optionsText=r.getString("options_text"); if(f.optionsText==null) f.optionsText="";
                    out.add(f);
                }
            }
        }
        return out;
    }

    public static SheetTemplate saveSection(int actor,int rpgId,int id,String rawTitle) throws Exception {
        owner(actor,rpgId);
        String title=clean(rawTitle,1,80,"invalid-sheet-section-title");
        try(Connection c=db()) {
            if(id<=0) {
                int order=nextOrder(c,"rpg_engine_sheet_sections","rpg_id",rpgId);
                try(PreparedStatement s=c.prepareStatement(
                    "INSERT INTO rpg_engine_sheet_sections(rpg_id,title,sort_order,enabled) VALUES(?,?,?,1)")) {
                    s.setInt(1,rpgId); s.setString(2,title); s.setInt(3,order); s.executeUpdate();
                }
            } else {
                try(PreparedStatement s=c.prepareStatement(
                    "UPDATE rpg_engine_sheet_sections SET title=? WHERE id=? AND rpg_id=? AND enabled=1")) {
                    s.setString(1,title); s.setInt(2,id); s.setInt(3,rpgId);
                    if(s.executeUpdate()!=1) throw new ServicioRpgEngine.RpgEngineException("sheet-section-not-found");
                }
            }
        }
        return getTemplate(actor,rpgId);
    }

    public static SheetTemplate deleteSection(int actor,int rpgId,int id) throws Exception {
        owner(actor,rpgId);
        try(Connection c=db()) {
            c.setAutoCommit(false);
            try {
                sectionExists(c,rpgId,id);
                try(PreparedStatement f=c.prepareStatement(
                    "UPDATE rpg_engine_sheet_fields SET enabled=0 WHERE rpg_id=? AND section_id=? AND enabled=1")) {
                    f.setInt(1,rpgId); f.setInt(2,id); f.executeUpdate();
                }
                try(PreparedStatement s=c.prepareStatement(
                    "UPDATE rpg_engine_sheet_sections SET enabled=0 WHERE id=? AND rpg_id=? AND enabled=1")) {
                    s.setInt(1,id); s.setInt(2,rpgId); s.executeUpdate();
                }
                c.commit();
            } catch(Exception e) { c.rollback(); throw e; }
            finally { c.setAutoCommit(true); }
        }
        return getTemplate(actor,rpgId);
    }

    private static void move(Connection c,String table,String scopeCol,int scopeId,int id,int dir) throws Exception {
        int current;
        try(PreparedStatement s=c.prepareStatement(
            "SELECT sort_order FROM "+table+" WHERE id=? AND "+scopeCol+"=? AND enabled=1 FOR UPDATE")) {
            s.setInt(1,id); s.setInt(2,scopeId);
            try(ResultSet r=s.executeQuery()) {
                if(!r.next()) throw new ServicioRpgEngine.RpgEngineException("sheet-item-not-found");
                current=r.getInt("sort_order");
            }
        }
        String cmp=dir<0?"<":">", ord=dir<0?"DESC":"ASC";
        int other=0,otherOrder=0;
        try(PreparedStatement s=c.prepareStatement(
            "SELECT id,sort_order FROM "+table+" WHERE "+scopeCol+"=? AND enabled=1 AND sort_order "+cmp+
            " ? ORDER BY sort_order "+ord+",id "+ord+" LIMIT 1 FOR UPDATE")) {
            s.setInt(1,scopeId); s.setInt(2,current);
            try(ResultSet r=s.executeQuery()) {
                if(r.next()) { other=r.getInt("id"); otherOrder=r.getInt("sort_order"); }
            }
        }
        if(other>0) {
            try(PreparedStatement a=c.prepareStatement("UPDATE "+table+" SET sort_order=? WHERE id=?");
                PreparedStatement b=c.prepareStatement("UPDATE "+table+" SET sort_order=? WHERE id=?")) {
                a.setInt(1,otherOrder); a.setInt(2,id); a.executeUpdate();
                b.setInt(1,current); b.setInt(2,other); b.executeUpdate();
            }
        }
    }

    public static SheetTemplate moveSection(int actor,int rpgId,int id,int dir) throws Exception {
        owner(actor,rpgId); if(dir!=-1 && dir!=1) throw new ServicioRpgEngine.RpgEngineException("invalid-sheet-move");
        try(Connection c=db()) {
            c.setAutoCommit(false);
            try { move(c,"rpg_engine_sheet_sections","rpg_id",rpgId,id,dir); c.commit(); }
            catch(Exception e) { c.rollback(); throw e; } finally { c.setAutoCommit(true); }
        }
        return getTemplate(actor,rpgId);
    }

    public static SheetTemplate saveField(int actor,int rpgId,int id,int sectionId,String rawLabel,
            String rawType,boolean required,String rawVis,String rawControl,String rawOptions) throws Exception {
        owner(actor,rpgId);
        String label=clean(rawLabel,1,80,"invalid-sheet-field-label");
        String type=rawType==null?"":rawType.trim().toLowerCase();
        String vis=rawVis==null?"":rawVis.trim().toLowerCase();
        String control=rawControl==null?"":rawControl.trim().toLowerCase();
        String options=rawOptions==null?"":rawOptions.trim();
        if(!TYPES.contains(type)) throw new ServicioRpgEngine.RpgEngineException("invalid-sheet-field-type");
        if(!VIS.contains(vis)) throw new ServicioRpgEngine.RpgEngineException("invalid-sheet-visibility");
        if(!CONTROL.contains(control)) throw new ServicioRpgEngine.RpgEngineException("invalid-sheet-control-mode");
        if(options.length()>1500) throw new ServicioRpgEngine.RpgEngineException("sheet-options-too-long");
        if(!"select".equals(type)) options="";

        try(Connection c=db()) {
            sectionExists(c,rpgId,sectionId);
            if(id<=0) {
                int order=nextOrder(c,"rpg_engine_sheet_fields","section_id",sectionId);
                try(PreparedStatement s=c.prepareStatement(
                    "INSERT INTO rpg_engine_sheet_fields(rpg_id,section_id,label,field_type,required,visibility,control_mode,sort_order,options_text,enabled) "+
                    "VALUES(?,?,?,?,?,?,?,?,?,1)")) {
                    s.setInt(1,rpgId); s.setInt(2,sectionId); s.setString(3,label); s.setString(4,type);
                    s.setBoolean(5,required); s.setString(6,vis); s.setString(7,control);
                    s.setInt(8,order); s.setString(9,options); s.executeUpdate();
                }
            } else {
                try(PreparedStatement s=c.prepareStatement(
                    "UPDATE rpg_engine_sheet_fields SET section_id=?,label=?,field_type=?,required=?,visibility=?,control_mode=?,options_text=? "+
                    "WHERE id=? AND rpg_id=? AND enabled=1")) {
                    s.setInt(1,sectionId); s.setString(2,label); s.setString(3,type); s.setBoolean(4,required);
                    s.setString(5,vis); s.setString(6,control); s.setString(7,options);
                    s.setInt(8,id); s.setInt(9,rpgId);
                    if(s.executeUpdate()!=1) throw new ServicioRpgEngine.RpgEngineException("sheet-field-not-found");
                }
            }
        }
        return getTemplate(actor,rpgId);
    }

    public static SheetTemplate deleteField(int actor,int rpgId,int id) throws Exception {
        owner(actor,rpgId);
        try(Connection c=db(); PreparedStatement s=c.prepareStatement(
            "UPDATE rpg_engine_sheet_fields SET enabled=0 WHERE id=? AND rpg_id=? AND enabled=1")) {
            s.setInt(1,id); s.setInt(2,rpgId);
            if(s.executeUpdate()!=1) throw new ServicioRpgEngine.RpgEngineException("sheet-field-not-found");
        }
        return getTemplate(actor,rpgId);
    }

    public static SheetTemplate moveField(int actor,int rpgId,int id,int dir) throws Exception {
        owner(actor,rpgId); if(dir!=-1 && dir!=1) throw new ServicioRpgEngine.RpgEngineException("invalid-sheet-move");
        try(Connection c=db()) {
            c.setAutoCommit(false);
            try {
                int sectionId;
                try(PreparedStatement s=c.prepareStatement(
                    "SELECT section_id FROM rpg_engine_sheet_fields WHERE id=? AND rpg_id=? AND enabled=1 FOR UPDATE")) {
                    s.setInt(1,id); s.setInt(2,rpgId);
                    try(ResultSet r=s.executeQuery()) {
                        if(!r.next()) throw new ServicioRpgEngine.RpgEngineException("sheet-field-not-found");
                        sectionId=r.getInt("section_id");
                    }
                }
                move(c,"rpg_engine_sheet_fields","section_id",sectionId,id,dir);
                c.commit();
            } catch(Exception e) { c.rollback(); throw e; } finally { c.setAutoCommit(true); }
        }
        return getTemplate(actor,rpgId);
    }
}