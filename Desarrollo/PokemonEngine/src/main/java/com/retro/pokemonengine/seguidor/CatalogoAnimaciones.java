package com.retro.pokemonengine.seguidor;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Los estados del seguidor, con su animacion PMD.
 *
 * Esta clase es la fuente unica: la migracion M004 siembra
 * `pokemon_follower_animations` leyendo de aqui, para que la tabla y el codigo no
 * se puedan separar. Si manana se cambia una animacion, se cambia en un sitio.
 *
 * Los nombres salen del AnimData.xml de PMDCollab/SpriteCollab, comprobados
 * contra sprite/0025.
 */
public final class CatalogoAnimaciones
{
    // Vinculos: nombres propios, no los del emulador, para que este paquete no
    // dependa de com.eu.habbo. El adaptador traduce.
    public static final String V_CAMINAR = "WALK";
    public static final String V_IDLE = "IDLE";
    public static final String V_DESPERTAR = "WAKE";
    public static final String V_SENTARSE = "SIT";
    public static final String V_TUMBARSE = "LAY";
    public static final String V_BAILAR = "DANCE";
    public static final String V_SALUDAR = "WAVE";
    public static final String V_REIR = "LAUGH";
    public static final String V_BESO = "BLOW_KISS";
    public static final String V_PULGAR = "THUMB_UP";
    public static final String V_SALTAR = "JUMP";
    public static final String V_HABLAR = "SPEAK";

    public static final String PARADO = "parado";
    public static final String CAMINANDO = "caminando";
    public static final String DURMIENDO = "durmiendo";
    public static final String DESPERTANDO = "despertando";
    public static final String SENTADO = "sentado";
    public static final String TUMBADO = "tumbado";
    public static final String BAILANDO = "bailando";
    public static final String SALUDANDO = "saludando";
    public static final String RIENDO = "riendo";
    public static final String CARINO = "carino";
    public static final String APROBANDO = "aprobando";
    public static final String SALTANDO = "saltando";
    public static final String HABLANDO = "hablando";
    public static final String DANADO = "danado";
    public static final String DEBILITADO = "debilitado";

    private static final List<EstadoSeguidor> TODOS = construir();
    private static final Map<String, EstadoSeguidor> POR_CODIGO = indexar(TODOS);

    private CatalogoAnimaciones()
    {
    }

    public static List<EstadoSeguidor> todos()
    {
        return TODOS;
    }

    public static EstadoSeguidor por(String codigo)
    {
        return POR_CODIGO.get(codigo);
    }

    public static EstadoSeguidor parado()
    {
        return POR_CODIGO.get(PARADO);
    }

    public static List<EstadoSeguidor> interactivos()
    {
        List<EstadoSeguidor> salida = new ArrayList<>();

        for(EstadoSeguidor estado : TODOS)
        {
            if(estado.interactivo()) salida.add(estado);
        }

        return salida;
    }

    public static EstadoSeguidor porVinculo(String vinculo)
    {
        if(vinculo == null) return null;

        for(EstadoSeguidor estado : TODOS)
        {
            if(vinculo.equals(estado.vinculo())) return estado;
        }

        return null;
    }

    private static Map<String, EstadoSeguidor> indexar(List<EstadoSeguidor> estados)
    {
        Map<String, EstadoSeguidor> mapa = new LinkedHashMap<>();

        for(EstadoSeguidor estado : estados) mapa.put(estado.codigo(), estado);

        return Collections.unmodifiableMap(mapa);
    }

    private static List<EstadoSeguidor> construir()
    {
        List<EstadoSeguidor> lista = new ArrayList<>();

        // Estados vinculados a lo que hace el avatar.
        lista.add(new EstadoSeguidor(PARADO, "Parado", "Idle", "Walk", null, false, 0, 1));
        lista.add(new EstadoSeguidor(CAMINANDO, "Caminando", "Walk", "Idle", V_CAMINAR, false, 0, 2));
        lista.add(new EstadoSeguidor(DURMIENDO, "Durmiendo", "Sleep", "EventSleep", V_IDLE, false, 0, 3));
        lista.add(new EstadoSeguidor(DESPERTANDO, "Despertando", "Wake", "Idle", V_DESPERTAR, false, 1200, 4));
        lista.add(new EstadoSeguidor(SENTADO, "Sentado", "Sit", "Idle", V_SENTARSE, false, 0, 5));
        lista.add(new EstadoSeguidor(TUMBADO, "Tumbado", "Laying", "Sleep", V_TUMBARSE, false, 0, 6));
        lista.add(new EstadoSeguidor(BAILANDO, "Bailando", "Hop", "Idle", V_BAILAR, false, 0, 7));
        lista.add(new EstadoSeguidor(SALUDANDO, "Saludando", "Nod", "Idle", V_SALUDAR, false, 1600, 8));
        lista.add(new EstadoSeguidor(RIENDO, "Riendo", "Pose", "Idle", V_REIR, false, 1600, 9));
        lista.add(new EstadoSeguidor(CARINO, "Carino", "DeepBreath", "Idle", V_BESO, false, 1600, 10));
        lista.add(new EstadoSeguidor(APROBANDO, "Aprobando", "Nod", "Idle", V_PULGAR, false, 1600, 11));
        lista.add(new EstadoSeguidor(SALTANDO, "Saltando", "Hop", "Idle", V_SALTAR, false, 1200, 12));
        lista.add(new EstadoSeguidor(HABLANDO, "Hablando", "Nod", "Idle", V_HABLAR, false, 1200, 13));

        // Estados de combate: los usara el hito 6, la animacion ya esta decidida.
        lista.add(new EstadoSeguidor(DANADO, "Danado", "Hurt", "Idle", null, false, 900, 14));
        lista.add(new EstadoSeguidor(DEBILITADO, "Debilitado", "Faint", "Hurt", null, false, 0, 15));

        // Sin vinculo en Habbo: se piden pulsando el seguidor.
        lista.add(new EstadoSeguidor("comer", "Comer", "Eat", "Idle", null, true, 2000, 20));
        lista.add(new EstadoSeguidor("cargar", "Cargar energia", "Charge", "Idle", null, true, 1800, 21));
        lista.add(new EstadoSeguidor("girar", "Girar", "Rotate", "Idle", null, true, 1500, 22));
        lista.add(new EstadoSeguidor("estirarse", "Estirarse", "Pull", "Idle", null, true, 1600, 23));
        lista.add(new EstadoSeguidor("mirar_arriba", "Mirar arriba", "LookUp", "Idle", null, true, 1500, 24));
        lista.add(new EstadoSeguidor("voltereta", "Voltereta", "Tumble", "Idle", null, true, 1500, 25));
        lista.add(new EstadoSeguidor("voltereta_atras", "Voltereta atras", "TumbleBack", "Tumble", null, true, 1500, 26));
        lista.add(new EstadoSeguidor("flotar", "Flotar", "Float", "Idle", null, true, 1800, 27));
        lista.add(new EstadoSeguidor("tropezar", "Tropezar", "Trip", "Idle", null, true, 1400, 28));
        lista.add(new EstadoSeguidor("encogerse", "Encogerse", "Cringe", "Idle", null, true, 1400, 29));
        lista.add(new EstadoSeguidor("perder_equilibrio", "Perder el equilibrio", "LostBalance", "Idle", null, true, 1500, 30));
        lista.add(new EstadoSeguidor("caer", "Caer al suelo", "HitGround", "Idle", null, true, 1500, 31));
        lista.add(new EstadoSeguidor("cabezazo", "Cabezazo", "Head", "Attack", null, true, 1200, 32));
        lista.add(new EstadoSeguidor("hundirse", "Hundirse", "Sink", "Idle", null, true, 1600, 33));
        lista.add(new EstadoSeguidor("saltar_adelante", "Saltar adelante", "LeapForth", "Hop", null, true, 1400, 34));
        lista.add(new EstadoSeguidor("quejarse", "Quejarse", "Pain", "Hurt", null, true, 1400, 35));
        lista.add(new EstadoSeguidor("golpe_rapido", "Golpe rapido", "QuickStrike", "Attack", null, true, 1000, 36));
        lista.add(new EstadoSeguidor("disparar", "Disparar", "Shoot", "Attack", null, true, 1200, 37));
        lista.add(new EstadoSeguidor("descarga", "Descarga", "Shock", "Attack", null, true, 1200, 38));
        lista.add(new EstadoSeguidor("balanceo", "Balanceo", "Swing", "Idle", null, true, 1400, 39));
        lista.add(new EstadoSeguidor("doble", "Golpe doble", "Double", "Attack", null, true, 1200, 40));
        lista.add(new EstadoSeguidor("atacar", "Atacar", "Attack", "Idle", null, true, 1200, 41));

        return Collections.unmodifiableList(lista);
    }
}
