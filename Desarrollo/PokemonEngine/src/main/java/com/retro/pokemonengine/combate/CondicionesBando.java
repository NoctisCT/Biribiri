package com.retro.pokemonengine.combate;

import java.util.ArrayList;
import java.util.List;

/**
 * Las doce condiciones de bando que el importador encontro en los datos.
 *
 * Se agrupan en tres familias: pantallas que reducen dano, protecciones que
 * bloquean estados o movimientos, y trampas que castigan al Pokemon que entra
 * al campo.
 */
public final class CondicionesBando
{
    // Pantallas
    public static final String REFLEJO = "reflect";
    public static final String PANTALLA_LUZ = "lightscreen";
    public static final String VELO_AURORA = "auroraveil";

    // Protecciones
    public static final String NEBLINA = "mist";
    public static final String VELO_SAGRADO = "safeguard";
    public static final String ANTICIPO = "quickguard";
    public static final String VASTA_GUARDIA = "wideguard";
    public static final String VIENTO_AFIN = "tailwind";

    // Trampas de entrada
    public static final String PUAS = "spikes";
    public static final String TRAMPA_ROCAS = "stealthrock";
    public static final String PUAS_TOXICAS = "toxicspikes";
    public static final String RED_VISCOSA = "stickyweb";

    public static final int TURNOS_PANTALLA = 5;
    public static final int TURNOS_VIENTO_AFIN = 4;
    public static final int TURNOS_PROTECCION_TURNO = 1;

    public static final int CAPAS_MAX_PUAS = 3;
    public static final int CAPAS_MAX_PUAS_TOXICAS = 2;

    private CondicionesBando()
    {
    }

    /**
     * Cuanto reduce el dano la pantalla del bando defensor.
     *
     * Velo Aurora cubre las dos clases de dano; Reflejo solo el fisico y
     * Pantalla Luz solo el especial. Un critico las atraviesa.
     */
    public static double modificadorPantalla(Bando defensor, boolean fisico, boolean critico)
    {
        if(critico) return 1.0;

        if(defensor.tieneCondicion(VELO_AURORA)) return 0.5;
        if(fisico && defensor.tieneCondicion(REFLEJO)) return 0.5;
        if(!fisico && defensor.tieneCondicion(PANTALLA_LUZ)) return 0.5;

        return 1.0;
    }

    /** Velo Sagrado protege al bando de los estados alterados que vengan de fuera. */
    public static boolean protegeDeEstados(Bando defensor)
    {
        return defensor.tieneCondicion(VELO_SAGRADO);
    }

    /** Neblina impide que el rival baje las caracteristicas del bando. */
    public static boolean protegeDeBajadas(Bando defensor)
    {
        return defensor.tieneCondicion(NEBLINA);
    }

    /** Viento Afin duplica la Velocidad del bando. */
    public static int velocidadConViento(Bando bando, int velocidad)
    {
        return bando.tieneCondicion(VIENTO_AFIN) ? velocidad * 2 : velocidad;
    }

    /**
     * Anticipo bloquea los movimientos con prioridad y Vasta Guardia los que
     * golpean a varios objetivos.
     */
    public static String bloqueaMovimiento(Bando defensor, MovimientoCatalogo movimiento)
    {
        if(defensor.tieneCondicion(ANTICIPO) && movimiento.prioridad() > 0) return "quickguard";

        if(defensor.tieneCondicion(VASTA_GUARDIA) && esDeVariosObjetivos(movimiento)) return "wideguard";

        return null;
    }

    private static boolean esDeVariosObjetivos(MovimientoCatalogo movimiento)
    {
        String objetivo = movimiento.objetivo();

        return "all-opponents".equals(objetivo)
                || "all-other-pokemon".equals(objetivo)
                || "all-pokemon".equals(objetivo);
    }

    /** Anade una capa de trampa y dice si de verdad cupo otra. */
    public static boolean anadirCapa(Bando objetivo, String trampa)
    {
        int maximo = switch(trampa)
        {
            case PUAS -> CAPAS_MAX_PUAS;
            case PUAS_TOXICAS -> CAPAS_MAX_PUAS_TOXICAS;
            default -> 1;
        };

        int actuales = objetivo.tieneCondicion(trampa) ? objetivo.condiciones().get(trampa) : 0;

        if(actuales >= maximo) return false;

        objetivo.condiciones().put(trampa, actuales + 1);

        return true;
    }

    /**
     * Lo que le pasa a un Pokemon al entrar al campo por las trampas del bando.
     *
     * Trampa Rocas afecta a todos y escala con la efectividad de Roca; el resto
     * solo castiga a quien pisa el suelo.
     */
    public static List<Evento> alEntrar(PokemonCombate entrante, Bando suBando, CatalogoCombate catalogo)
    {
        List<Evento> eventos = new ArrayList<>();

        if(suBando.tieneCondicion(TRAMPA_ROCAS))
        {
            double efectividad = catalogo.tipos().multiplicador(
                    Tipos.ROCA, entrante.tipo1(), entrante.tipo2());

            int dano = (int) Math.floor(entrante.psMax() / 8.0 * efectividad);

            if(dano > 0)
            {
                int aplicado = entrante.recibirDano(dano);

                eventos.add(new Evento("dano_trampa")
                        .con("pokemon", entrante.nombre())
                        .con("trampa", "stealthrock")
                        .con("dano", aplicado));
            }
        }

        if(!Campo.pisaSuelo(entrante)) return eventos;

        if(suBando.tieneCondicion(PUAS))
        {
            int capas = suBando.condiciones().get(PUAS);
            int divisor = switch(capas)
            {
                case 1 -> 8;
                case 2 -> 6;
                default -> 4;
            };

            int aplicado = entrante.recibirDano(Math.max(1, entrante.psMax() / divisor));

            eventos.add(new Evento("dano_trampa")
                    .con("pokemon", entrante.nombre())
                    .con("trampa", "spikes")
                    .con("capas", capas)
                    .con("dano", aplicado));
        }

        if(suBando.tieneCondicion(PUAS_TOXICAS) && !Tipos.es(entrante, Tipos.VENENO))
        {
            int capas = suBando.condiciones().get(PUAS_TOXICAS);
            String estado = capas >= 2 ? PokemonCombate.VENENO_GRAVE : PokemonCombate.VENENO;

            if(entrante.aplicarEstado(estado, 0))
            {
                eventos.add(new Evento("estado_aplicado")
                        .con("pokemon", entrante.nombre())
                        .con("estado", estado)
                        .con("por", "toxicspikes"));
            }
        }

        if(suBando.tieneCondicion(RED_VISCOSA))
        {
            int movido = entrante.cambiarEtapa(PokemonCombate.ETAPA_VELOCIDAD, -1);

            eventos.add(new Evento("stat_cambiado")
                    .con("pokemon", entrante.nombre())
                    .con("stat", "VELOCIDAD")
                    .con("etapas", movido)
                    .con("por", "stickyweb"));
        }

        return eventos;
    }

    /** Los Pokemon de tipo Veneno limpian las Puas Toxicas al entrar. */
    public static boolean absorbePuasToxicas(PokemonCombate entrante, Bando suBando)
    {
        if(!Tipos.es(entrante, Tipos.VENENO)) return false;
        if(!Campo.pisaSuelo(entrante)) return false;
        if(!suBando.tieneCondicion(PUAS_TOXICAS)) return false;

        suBando.quitarCondicion(PUAS_TOXICAS);

        return true;
    }
}
