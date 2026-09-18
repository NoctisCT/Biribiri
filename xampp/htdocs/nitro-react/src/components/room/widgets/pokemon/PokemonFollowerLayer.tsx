import { Vector3d } from '@nitrots/nitro-renderer';
import { FC, useEffect, useRef, useState } from 'react';
import { GetRoomEngine } from '../../../../api';
import { addPokemonFollowerListener, getPokemonFollowers, PokemonFollower, requestFollowerSnapshot } from '../../../../api/pokemon/PokemonEngineAdapter';
import { frameAt, loadPokemonAnim, pmdRow, PokemonAnim } from '../../../../api/pokemon/PokemonSprites';
import { useRoom } from '../../../../hooks';
import './PokemonFollowerLayer.scss';

/**
 * Dibuja el Pokemon que sigue a cada jugador de la sala.
 *
 * Va en una capa de HTML encima del lienzo de la sala, no dentro del motor de
 * render de Nitro. Es deliberado: asi se ve ya, sin tocar el pipeline de
 * entidades, que es trabajo de la fase 2. Lo que se pierde con esto es el
 * recorte por profundidad: el Pokemon se dibuja siempre por delante del furni
 * aunque este detras de el.
 *
 * El servidor manda baldosas, no pixeles. Aqui se interpola de la baldosa
 * anterior a la nueva durante lo que dura un paso de Habbo, porque si no el
 * Pokemon aparece a saltos en vez de caminar.
 *
 * La posicion se recalcula en cada fotograma a partir de la geometria de la
 * sala, asi que arrastrar o acercar la camara lo arrastra con ella sin escuchar
 * ningun evento.
 */

/**
 * Un paso de Habbo dura un ciclo de sala, medio segundo. Es lo que tarda el
 * avatar en pasar de una baldosa a la siguiente, y lo que debe tardar el
 * Pokemon en recorrer el mismo tramo.
 */
const MS_POR_BALDOSA = 500;

/**
 * Los sprites de PMD son de 32x40 y un avatar de Habbo mide cerca de 60 de alto,
 * asi que a tamano nativo el Pokemon se ve diminuto al lado de su entrenador.
 */
const ESCALA_POKEMON = 2;

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
    const elementos = useRef(new Map<number, HTMLDivElement>());
    const pintados = useRef(new Map<number, Pintado>());
    const movimientos = useRef(new Map<number, Movimiento>());
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

        for(const userId of Array.from(pintados.current.keys()))
        {
            if(!seguidores.some(seguidor => seguidor.userId === userId))
            {
                pintados.current.delete(userId);
                elementos.current.delete(userId);
                movimientos.current.delete(userId);
            }
        }
    }, [ seguidores ]);

    useEffect(() =>
    {
        if(!roomSession) return;

        let vivo = true;
        let identificador = 0;

        const pintar = () =>
        {
            if(!vivo) return;

            const roomId = roomSession.roomId;
            const geometria = GetRoomEngine().getRoomInstanceGeometry(roomId, 1);
            const lienzo = GetRoomEngine().getRoomInstanceRenderingCanvas(roomId, 1);

            if(geometria && lienzo)
            {
                const escalaSala = lienzo.scale;
                const escala = escalaSala * ESCALA_POKEMON;
                const ahora = performance.now();

                const aPantalla = (x: number, y: number, z: number) =>
                {
                    // El centro de la baldosa, no su esquina: si no, el sprite se ve
                    // desplazado media casilla y parece que flota.
                    const punto = geometria.getScreenPoint(new Vector3d(x + 0.5, y + 0.5, z));

                    if(!punto) return null;

                    return {
                        x: (punto.x * escalaSala) + (lienzo.width / 2) + lienzo.screenOffsetX,
                        y: (punto.y * escalaSala) + (lienzo.height / 2) + lienzo.screenOffsetY
                    };
                };

                for(const seguidor of seguidores)
                {
                    const elemento = elementos.current.get(seguidor.userId);
                    const pintado = pintados.current.get(seguidor.userId);
                    const movimiento = movimientos.current.get(seguidor.userId);

                    if(!elemento) continue;

                    if(!pintado || !movimiento)
                    {
                        elemento.style.display = 'none';
                        continue;
                    }

                    const avance = Math.min(1, (ahora - movimiento.empiezaMs) / MS_POR_BALDOSA);
                    const andando = avance < 1;

                    const anim = (andando && pintado.andar) ? pintado.andar : pintado.anim;

                    if(!anim)
                    {
                        elemento.style.display = 'none';
                        continue;
                    }

                    const desde = aPantalla(movimiento.desdeX, movimiento.desdeY, movimiento.desdeZ);
                    const hasta = aPantalla(movimiento.hastaX, movimiento.hastaY, movimiento.hastaZ);

                    if(!desde || !hasta)
                    {
                        elemento.style.display = 'none';
                        continue;
                    }

                    const x = desde.x + ((hasta.x - desde.x) * avance);
                    const y = desde.y + ((hasta.y - desde.y) * avance);

                    const ancho = anim.frameWidth * escala;
                    const alto = anim.frameHeight * escala;

                    // El ancla es donde pisa el dibujo dentro del fotograma, no el
                    // borde de la caja: los fotogramas de PMD llevan mucho hueco
                    // transparente y anclarlos por la caja deja al Pokemon flotando.
                    const izquierda = Math.round(x - (anim.anclaX * escala));
                    const arriba = Math.round(y - (anim.anclaY * escala));

                    // Los estados puntuales no dan vueltas: se quedan en el ultimo
                    // fotograma hasta que el servidor mande otro estado.
                    const bucle = andando || !esPuntual(seguidor.state);
                    const desdeMs = andando ? movimiento.empiezaMs : pintado.desdeMs;
                    const fotograma = frameAt(anim, ahora - desdeMs, bucle);
                    const fila = pmdRow(movimiento.direccion, anim.rows);

                    elemento.style.display = 'block';
                    elemento.style.width = `${ ancho }px`;
                    elemento.style.height = `${ alto }px`;
                    elemento.style.transform = `translate3d(${ izquierda }px, ${ arriba }px, 0)`;
                    elemento.style.backgroundImage = `url(${ anim.url })`;
                    elemento.style.backgroundSize =
                        `${ anim.frames * ancho }px ${ anim.rows * alto }px`;
                    elemento.style.backgroundPosition =
                        `${ -fotograma * ancho }px ${ -fila * alto }px`;
                }
            }

            identificador = requestAnimationFrame(pintar);
        };

        identificador = requestAnimationFrame(pintar);

        return () =>
        {
            vivo = false;
            cancelAnimationFrame(identificador);
        };
    }, [ roomSession, seguidores ]);

    if(!roomSession) return null;

    return (
        <div className="pokemon-follower-layer">
            { seguidores.map(seguidor => (
                <div
                    key={ seguidor.userId }
                    className="pokemon-follower"
                    title={ seguidor.name }
                    ref={ elemento =>
                    {
                        if(elemento) elementos.current.set(seguidor.userId, elemento);
                        else elementos.current.delete(seguidor.userId);
                    } } />
            )) }
        </div>
    );
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
