package com.retro.pokemonengine.seguidor;

import com.retro.pokemonengine.seguidor.MaquinaAnimacion.EntradaAvatar;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MaquinaAnimacionTest
{
    /** Un avatar quieto y sin nada especial, sobre el que cada prueba cambia una cosa. */
    private static final class Avatar
    {
        boolean enCombate;
        boolean debilitado;
        boolean tumbado;
        boolean sentado;
        boolean idle;
        boolean bailando;
        boolean caminando;
        String gesto;
        long gestoHasta;
        String interaccion;
        long interaccionHasta;
        long ahora = 1_000L;

        EntradaAvatar foto()
        {
            return new EntradaAvatar(
                    this.enCombate, this.debilitado, this.tumbado, this.sentado, this.idle,
                    this.bailando, this.caminando, this.gesto, this.gestoHasta,
                    this.interaccion, this.interaccionHasta, this.ahora);
        }
    }

    @Test
    void andarDaCaminandoYQuietoDaParado()
    {
        MaquinaAnimacion maquina = new MaquinaAnimacion();
        Avatar avatar = new Avatar();

        avatar.caminando = true;
        assertEquals(CatalogoAnimaciones.CAMINANDO, maquina.resolver(avatar.foto()).codigo());

        avatar.caminando = false;
        assertEquals(CatalogoAnimaciones.PARADO, maquina.resolver(avatar.foto()).codigo());
    }

    @Test
    void elIdleDelAvatarDuermeAlSeguidorYAlSalirSeDespereza()
    {
        MaquinaAnimacion maquina = new MaquinaAnimacion();
        Avatar avatar = new Avatar();

        avatar.idle = true;
        assertEquals(CatalogoAnimaciones.DURMIENDO, maquina.resolver(avatar.foto()).codigo());

        avatar.idle = false;
        assertEquals(CatalogoAnimaciones.DESPERTANDO, maquina.resolver(avatar.foto()).codigo());

        // Sigue desperezandose mientras dura la animacion.
        avatar.ahora += 400L;
        assertEquals(CatalogoAnimaciones.DESPERTANDO, maquina.resolver(avatar.foto()).codigo());

        avatar.ahora += 5_000L;
        assertEquals(CatalogoAnimaciones.PARADO, maquina.resolver(avatar.foto()).codigo());
    }

    @Test
    void tumbadoGanaASentadoYSentadoADormir()
    {
        MaquinaAnimacion maquina = new MaquinaAnimacion();
        Avatar avatar = new Avatar();

        avatar.tumbado = true;
        avatar.sentado = true;
        avatar.idle = true;

        assertEquals(CatalogoAnimaciones.TUMBADO, maquina.resolver(avatar.foto()).codigo());

        avatar.tumbado = false;
        assertEquals(CatalogoAnimaciones.SENTADO, maquina.resolver(avatar.foto()).codigo());

        avatar.sentado = false;
        assertEquals(CatalogoAnimaciones.DURMIENDO, maquina.resolver(avatar.foto()).codigo());
    }

    @Test
    void bailarGanaAParadoPeroPierdeContraSentado()
    {
        MaquinaAnimacion maquina = new MaquinaAnimacion();
        Avatar avatar = new Avatar();

        avatar.bailando = true;
        assertEquals(CatalogoAnimaciones.BAILANDO, maquina.resolver(avatar.foto()).codigo());

        avatar.sentado = true;
        assertEquals(CatalogoAnimaciones.SENTADO, maquina.resolver(avatar.foto()).codigo());
    }

    @Test
    void bailarGanaACaminar()
    {
        MaquinaAnimacion maquina = new MaquinaAnimacion();
        Avatar avatar = new Avatar();

        avatar.bailando = true;
        avatar.caminando = true;

        assertEquals(CatalogoAnimaciones.BAILANDO, maquina.resolver(avatar.foto()).codigo());
    }

    @Test
    void unGestoPuntualDuraLoSuyoYVuelveAParado()
    {
        MaquinaAnimacion maquina = new MaquinaAnimacion();
        Avatar avatar = new Avatar();

        avatar.gesto = CatalogoAnimaciones.SALUDANDO;
        avatar.gestoHasta = avatar.ahora + 1_600L;

        assertEquals(CatalogoAnimaciones.SALUDANDO, maquina.resolver(avatar.foto()).codigo());

        avatar.ahora += 2_000L;

        assertEquals(CatalogoAnimaciones.PARADO, maquina.resolver(avatar.foto()).codigo());
    }

    @Test
    void laInteraccionPedidaGanaAlGestoAutomatico()
    {
        MaquinaAnimacion maquina = new MaquinaAnimacion();
        Avatar avatar = new Avatar();

        avatar.gesto = CatalogoAnimaciones.SALUDANDO;
        avatar.gestoHasta = avatar.ahora + 1_600L;
        avatar.interaccion = "comer";
        avatar.interaccionHasta = avatar.ahora + 2_000L;
        avatar.bailando = true;
        avatar.sentado = true;

        assertEquals("comer", maquina.resolver(avatar.foto()).codigo(),
                "Lo que el jugador pide a mano manda mientras dure");
    }

    @Test
    void elCombateGanaATodo()
    {
        MaquinaAnimacion maquina = new MaquinaAnimacion();
        Avatar avatar = new Avatar();

        avatar.enCombate = true;
        avatar.bailando = true;
        avatar.caminando = true;

        assertEquals(CatalogoAnimaciones.PARADO, maquina.resolver(avatar.foto()).codigo());

        avatar.debilitado = true;

        assertEquals(CatalogoAnimaciones.DEBILITADO, maquina.resolver(avatar.foto()).codigo());
    }

    @Test
    void unaInteraccionDesconocidaNoRompeNada()
    {
        MaquinaAnimacion maquina = new MaquinaAnimacion();
        Avatar avatar = new Avatar();

        avatar.interaccion = "no-existe";
        avatar.interaccionHasta = avatar.ahora + 5_000L;

        assertEquals(CatalogoAnimaciones.PARADO, maquina.resolver(avatar.foto()).codigo());
    }

    // --- El catalogo ---

    @Test
    void todoEstadoTieneAnimacionYRespaldo()
    {
        for(EstadoSeguidor estado : CatalogoAnimaciones.todos())
        {
            assertFalse(estado.animacion().isBlank(), "Sin animacion: " + estado.codigo());
            assertFalse(estado.respaldo().isBlank(), "Sin respaldo: " + estado.codigo());
            assertFalse(estado.codigo().isBlank());
            assertFalse(estado.nombreEs().isBlank());
        }
    }

    @Test
    void losCodigosYLosOrdenesNoSeRepiten()
    {
        Set<String> codigos = new HashSet<>();
        Set<Integer> ordenes = new HashSet<>();

        for(EstadoSeguidor estado : CatalogoAnimaciones.todos())
        {
            assertTrue(codigos.add(estado.codigo()), "Codigo repetido: " + estado.codigo());
            assertTrue(ordenes.add(estado.orden()), "Orden repetido: " + estado.orden());
        }
    }

    @Test
    void ningunEstadoInteractivoPisaUnVinculoDeHabbo()
    {
        for(EstadoSeguidor estado : CatalogoAnimaciones.interactivos())
        {
            assertEquals(null, estado.vinculo(),
                    "Un interactivo no puede estar vinculado: " + estado.codigo());
            assertTrue(estado.duracionMs() > 0,
                    "Un interactivo tiene que caducar: " + estado.codigo());
        }
    }

    @Test
    void cadaVinculoDeHabboApuntaAUnSoloEstado()
    {
        Set<String> vinculos = new HashSet<>();

        for(EstadoSeguidor estado : CatalogoAnimaciones.todos())
        {
            if(estado.vinculo() == null) continue;

            assertTrue(vinculos.add(estado.vinculo()), "Vinculo repetido: " + estado.vinculo());
        }

        assertNotNull(CatalogoAnimaciones.porVinculo(CatalogoAnimaciones.V_SALUDAR));
        assertEquals(CatalogoAnimaciones.SALUDANDO,
                CatalogoAnimaciones.porVinculo(CatalogoAnimaciones.V_SALUDAR).codigo());
    }

    @Test
    void hayInteraccionesSuficientesParaElMenu()
    {
        assertTrue(CatalogoAnimaciones.interactivos().size() >= 20,
                "El menu de interaccion se queda corto");
        assertNotNull(CatalogoAnimaciones.parado());
    }
}
