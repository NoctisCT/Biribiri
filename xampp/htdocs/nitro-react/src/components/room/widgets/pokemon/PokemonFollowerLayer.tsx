import { RoomObjectVisualizationType, Vector3d } from '@nitrots/nitro-renderer';
import { FC, useEffect, useRef, useState } from 'react';
import { GetRoomEngine } from '../../../../api';
import { addPokemonFollowerListener, getPokemonFollowers, PokemonFollower, requestFollowerSnapshot } from '../../../../api/pokemon/PokemonEngineAdapter';
import { frameAt, loadPokemonAnim, pmdRow, PokemonAnim, recorteDeFotograma } from '../../../../api/pokemon/PokemonSprites';
import { useRoom } from '../../../../hooks';

/**
 * El Pokemon que sigue a cada jugador, como objeto de sala de verdad.
 *
 * No dibuja nada por su cuenta: crea un objeto del tipo `pokemon_follower` en el
 * motor de Nitro y en cada fotograma le deja la posicion y la textura que toca.
 * Dibujar es cosa de `PokemonFollowerVisualization`, en el renderer.
 *
 * Esto es lo que le da profundidad. Antes era una capa de HTML encima del lienzo
 * y el Pokemon se pintaba siempre por delante del furni y de los avatares; ahora
 * entra en la misma lista ordenada que todo lo demas y se tapa como es debido.
 *
 * El servidor manda baldosas, no pixeles, asi que la posicion se interpola de la
 * baldosa anterior a la nueva durante lo que dura un paso de Habbo. Como el motor
 * acepta coordenadas con decimales, basta con moverlo en el espacio de la sala y
 * la camara hace el resto.
 */

/** Un paso de Habbo dura un ciclo de sala. */
const MS_POR_BALDOSA = 500;

/**
 * Los sprites de PMD son de 32x40 y un avatar de Habbo mide cerca de 60 de alto,
 * asi que a tamano nativo el Pokemon se ve diminuto al lado de su entrenador.
 */
const ESCALA_POKEMON = 2;

/**
 * Los identificadores de objeto de los usuarios de una sala son indices bajos.
 * Los seguidores se van bien lejos para no chocar con ninguno.
 */
const ID_BASE = 900000;

interface Pintado
{
    anim: PokemonAnim | null;
    andar: PokemonAnim | null;
    estado: string;
    desdeMs: number;
    peticion: number;
}

interface Movimiento
{
    desdeX: number;
    desdeY: number;
    desdeZ: number;
    hastaX: number;
    hastaY: number;
    hastaZ: number;
    empiezaMs: number;
    direccion: number;
}

export const PokemonFollowerLayer: FC<{}> = () =>
{
    const { roomSession = null } = useRoom();
    const [ seguidores, setSeguidores ] = useState<PokemonFollower[]>([]);
    const pintados = useRef(new Map<number, Pintado>());
    const movimientos = useRef(new Map<number, Movimiento>());
    const creados = useRef(new Set<number>());
    const peticiones = useRef(0);

    useEffect(() =>
    {
        const actualizar = (todos: Map<number, PokemonFollower>) =>
            setSeguidores(Array.from(todos.values()));

        const quitar = addPokemonFollowerListener(actualizar);

        actualizar(getPokemonFollowers());

        return quitar;
    }, []);

    // Al entrar en una sala se pide la foto: el cliente puede haberse recargado.
    useEffect(() =>
    {
        if(!roomSession) return;

        requestFollowerSnapshot();
    }, [ roomSession ]);

    // Un paso nuevo arranca la interpolacion desde donde estaba.
    useEffect(() =>
    {
        const ahora = performance.now();

        for(const seguidor of seguidores)
        {
            const anterior = movimientos.current.get(seguidor.userId);

            if(anterior
                && anterior.hastaX === seguidor.x
                && anterior.hastaY === seguidor.y
                && anterior.hastaZ === seguidor.z)
            {
                anterior.direccion = seguidor.direction;
                continue;
            }

            const lejos = !anterior
                || Math.max(
                    Math.abs(seguidor.x - anterior.hastaX),
                    Math.abs(seguidor.y - anterior.hastaY)) > 1;

            // Si aparece o lo teletransportan, no camina: sale ya en su sitio.
            movimientos.current.set(seguidor.userId, {
                desdeX: lejos ? seguidor.x : anterior.hastaX,
                desdeY: lejos ? seguidor.y : anterior.hastaY,
                desdeZ: lejos ? seguidor.z : anterior.hastaZ,
                hastaX: seguidor.x,
                hastaY: seguidor.y,
                hastaZ: seguidor.z,
                empiezaMs: lejos ? ahora - MS_POR_BALDOSA : ahora,
                direccion: seguidor.direction
            });
        }
    }, [ seguidores ]);

    // Carga de la hoja que toca cada vez que un seguidor cambia de estado.
    useEffect(() =>
    {
        for(const seguidor of seguidores)
        {
            const pintado = pintados.current.get(seguidor.userId);

            if(pintado && pintado.estado === seguidor.state) continue;

            const peticion = ++peticiones.current;

            pintados.current.set(seguidor.userId, {
                anim: pintado?.anim ?? null,
                andar: pintado?.andar ?? null,
                estado: seguidor.state,
                desdeMs: performance.now(),
                peticion
            });

            const nombres = [ seguidor.animation, seguidor.fallback, 'Idle', 'Walk' ]
                .filter((nombre, indice, todos) => nombre && todos.indexOf(nombre) === indice);

            (async () =>
            {
                // Andar se precarga siempre: se usa en cuanto el jugador da un paso,
                // sin esperar a que el servidor diga que esta caminando.
                const andar = await loadPokemonAnim(seguidor.speciesId, 'Walk');
                const actualAndar = pintados.current.get(seguidor.userId);

                if(actualAndar) actualAndar.andar = andar;

                for(const nombre of nombres)
                {
                    const anim = await loadPokemonAnim(seguidor.speciesId, nombre);

                    if(!anim) continue;

                    const actual = pintados.current.get(seguidor.userId);

                    // Ha llegado tarde: el seguidor ya esta haciendo otra cosa.
                    if(!actual || actual.peticion !== peticion) return;

                    actual.anim = anim;

                    return;
                }
            })();
        }
    }, [ seguidores ]);

    useEffect(() =>
    {
        if(!roomSession) return;

        const roomId = roomSession.roomId;
        let vivo = true;
        let identificador = 0;

        const quitarObjeto = (userId: number) =>
        {
            GetRoomEngine().removeRoomObjectUser(roomId, ID_BASE + userId);
            creados.current.delete(userId);
        };

        const pintar = () =>
        {
            if(!vivo) return;

            const ahora = performance.now();

            // Los que ya no estan se retiran de la sala.
            for(const userId of Array.from(creados.current))
            {
                if(!seguidores.some(seguidor => seguidor.userId === userId)) quitarObjeto(userId);
            }

            for(const seguidor of seguidores)
            {
                const pintado = pintados.current.get(seguidor.userId);
                const movimiento = movimientos.current.get(seguidor.userId);

                if(!pintado || !movimiento) continue;

                const avance = Math.min(1, (ahora - movimiento.empiezaMs) / MS_POR_BALDOSA);
                const andando = avance < 1;
                const anim = (andando && pintado.andar) ? pintado.andar : pintado.anim;

                if(!anim) continue;

                const objectId = ID_BASE + seguidor.userId;

                if(!creados.current.has(seguidor.userId))
                {
                    const creado = GetRoomEngine().createRoomObjectUser(
                        roomId, objectId, RoomObjectVisualizationType.POKEMON_FOLLOWER);

                    if(!creado) continue;

                    creados.current.add(seguidor.userId);
                }

                const objeto = GetRoomEngine().getRoomObjectUser(roomId, objectId);

                if(!objeto)
                {
                    creados.current.delete(seguidor.userId);
                    continue;
                }

                // El motor acepta baldosas con decimales, asi que el paso se
                // interpola en coordenadas de sala y no en pixeles de pantalla.
                const x = movimiento.desdeX + ((movimiento.hastaX - movimiento.desdeX) * avance);
                const y = movimiento.desdeY + ((movimiento.hastaY - movimiento.desdeY) * avance);
                const z = movimiento.desdeZ + ((movimiento.hastaZ - movimiento.desdeZ) * avance);

                objeto.setLocation(new Vector3d(x, y, z));

                const bucle = andando || !esPuntual(seguidor.state);
                const desdeMs = andando ? movimiento.empiezaMs : pintado.desdeMs;
                const fotograma = frameAt(anim, ahora - desdeMs, bucle);
                const fila = pmdRow(movimiento.direccion, anim.rows);
                const textura = recorteDeFotograma(anim, fila, fotograma, ESCALA_POKEMON);

                if(!textura) continue;

                objeto.model.setValue('pokemon_textura', textura);
                objeto.model.setValue('pokemon_ancla_x', anim.anclaX * ESCALA_POKEMON);
                objeto.model.setValue('pokemon_ancla_y', anim.anclaY * ESCALA_POKEMON);
                objeto.model.setValue('pokemon_usuario', seguidor.userId);
            }

            identificador = requestAnimationFrame(pintar);
        };

        identificador = requestAnimationFrame(pintar);

        return () =>
        {
            vivo = false;
            cancelAnimationFrame(identificador);

            for(const userId of Array.from(creados.current)) quitarObjeto(userId);
        };
    }, [ roomSession, seguidores ]);

    return null;
}

/** Los estados que se quedan quietos al acabar en vez de repetirse. */
function esPuntual(estado: string): boolean
{
    return estado !== 'parado'
        && estado !== 'caminando'
        && estado !== 'durmiendo'
        && estado !== 'sentado'
        && estado !== 'tumbado'
        && estado !== 'bailando'
        && estado !== 'debilitado';
}
