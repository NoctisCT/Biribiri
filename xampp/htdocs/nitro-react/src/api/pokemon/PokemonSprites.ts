/**
 * Carga de sprites de PMDCollab/SpriteCollab.
 *
 * Cada especie es una carpeta con un AnimData.xml y una hoja `<Anim>-Anim.png`
 * por animacion. La hoja tiene una columna por fotograma y una fila por
 * direccion, pero **no todas traen las ocho filas**: `Sleep` y `Sit` de Pikachu
 * son de una sola, asi que la fila se recorta a las que de verdad existan.
 *
 * Las duraciones del XML van en fotogramas de 60 por segundo, que es a lo que
 * corren los juegos de los que salen estos sprites.
 */

export const PMD_FPS = 60;

export interface PokemonAnim
{
    name: string;
    frameWidth: number;
    frameHeight: number;
    durations: number[];
    frames: number;
    rows: number;
    url: string;
    shadowUrl: string;
    totalMs: number;
    /** Centro horizontal del dibujo dentro del fotograma, en pixeles del sprite. */
    anclaX: number;
    /** Donde pisa el dibujo dentro del fotograma, en pixeles del sprite. */
    anclaY: number;
}

export interface PokemonSpriteSet
{
    speciesId: number;
    anims: Map<string, PokemonAnim>;
}

interface AnimMeta
{
    frameWidth: number;
    frameHeight: number;
    durations: number[];
}

const sets = new Map<number, Promise<PokemonSpriteSet>>();
const metaBySpecies = new Map<number, Map<string, AnimMeta>>();
const loading = new Map<string, Promise<PokemonAnim | null>>();

/**
 * La base con la que se sirve el cliente: `/pokemon-dist/` en el cliente de
 * pruebas y `/dist/` en produccion.
 *
 * El casting va sobre `import.meta` entero y no lleva `?.` detras a proposito:
 * Vite sustituye el texto literal `import.meta.env` al compilar, y un
 * `import.meta?.env` no le casa, asi que la base se quedaria en `/` y los
 * sprites darian 404.
 */
const ENTORNO = (import.meta as unknown as { env?: Record<string, string> }).env;
const BASE_CLIENTE: string = (ENTORNO && ENTORNO.BASE_URL) || '/';

export function pokemonSpriteBase(speciesId: number): string
{
    const folder = String(speciesId).padStart(4, '0');

    return `${ BASE_CLIENTE }pokemon/sprite/${ folder }`;
}

function parseAnimData(xml: string): Map<string, AnimMeta>
{
    const metas = new Map<string, AnimMeta>();
    const document = new DOMParser().parseFromString(xml, 'text/xml');

    for(const node of Array.from(document.getElementsByTagName('Anim')))
    {
        const name = node.getElementsByTagName('Name')[0]?.textContent;

        if(!name) continue;

        const width = Number(node.getElementsByTagName('FrameWidth')[0]?.textContent ?? 0);
        const height = Number(node.getElementsByTagName('FrameHeight')[0]?.textContent ?? 0);

        // Una entrada sin medidas es un alias (CopyOf) y no se puede dibujar sola.
        if(!width || !height) continue;

        const durations = Array.from(node.getElementsByTagName('Duration'))
            .map(duration => Number(duration.textContent ?? 1))
            .filter(duration => duration > 0);

        metas.set(name, { frameWidth: width, frameHeight: height, durations });
    }

    return metas;
}

export function loadPokemonSpriteSet(speciesId: number): Promise<PokemonSpriteSet>
{
    const cached = sets.get(speciesId);

    if(cached) return cached;

    const promise = fetch(`${ pokemonSpriteBase(speciesId) }/AnimData.xml`)
        .then(response =>
        {
            if(!response.ok) throw new Error(`AnimData.xml ${ response.status }`);

            return response.text();
        })
        .then(xml =>
        {
            metaBySpecies.set(speciesId, parseAnimData(xml));

            return { speciesId, anims: new Map<string, PokemonAnim>() } as PokemonSpriteSet;
        })
        .catch(error =>
        {
            console.warn('[PokemonEngine] no se ha podido cargar el sprite', speciesId, error);

            metaBySpecies.set(speciesId, new Map());

            return { speciesId, anims: new Map<string, PokemonAnim>() } as PokemonSpriteSet;
        });

    sets.set(speciesId, promise);

    return promise;
}

function cargarImagen(url: string): Promise<HTMLImageElement | null>
{
    return new Promise(resolve =>
    {
        const image = new Image();

        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = url;
    });
}

/**
 * Donde esta de verdad el dibujo dentro del fotograma.
 *
 * Los fotogramas de PMD son cajas grandes con el bicho en medio y mucho hueco
 * transparente alrededor: el de Pikachu parado mide 30x56 y el dibujo ocupa
 * bastante menos. Si se ancla la caja a la baldosa, el Pokemon sale flotando por
 * encima del suelo, y al escalarlo el hueco se agranda igual que el dibujo.
 *
 * Asi que se lee la hoja una vez y se busca, en coordenadas de fotograma, el pixel
 * mas bajo y el centro horizontal de lo que no es transparente. Eso es lo que se
 * clava en la baldosa.
 */
function medirAnclas(
    image: HTMLImageElement, frameWidth: number, frameHeight: number): { x: number, y: number }
{
    const porDefecto = { x: frameWidth / 2, y: frameHeight };

    try
    {
        const lienzo = document.createElement('canvas');

        lienzo.width = image.naturalWidth;
        lienzo.height = image.naturalHeight;

        const contexto = lienzo.getContext('2d', { willReadFrequently: true });

        if(!contexto) return porDefecto;

        contexto.drawImage(image, 0, 0);

        const datos = contexto.getImageData(0, 0, lienzo.width, lienzo.height).data;

        let minX = frameWidth;
        let maxX = -1;
        let maxY = -1;

        for(let y = 0; y < lienzo.height; y++)
        {
            const localY = y % frameHeight;

            for(let x = 0; x < lienzo.width; x++)
            {
                if(datos[((y * lienzo.width) + x) * 4 + 3] < 8) continue;

                const localX = x % frameWidth;

                if(localX < minX) minX = localX;
                if(localX > maxX) maxX = localX;
                if(localY > maxY) maxY = localY;
            }
        }

        if(maxX < 0 || maxY < 0) return porDefecto;

        return { x: (minX + maxX + 1) / 2, y: maxY + 1 };
    }
    catch(error)
    {
        return porDefecto;
    }
}

/**
 * Devuelve la animacion lista para dibujar, cargando la hoja la primera vez.
 * Si la especie no trae esa animacion, devuelve null y quien llama prueba el
 * respaldo que ya venia del servidor.
 */
export async function loadPokemonAnim(speciesId: number, name: string): Promise<PokemonAnim | null>
{
    const set = await loadPokemonSpriteSet(speciesId);
    const existing = set.anims.get(name);

    if(existing) return existing;

    const clave = `${ speciesId }:${ name }`;
    const enCurso = loading.get(clave);

    if(enCurso) return enCurso;

    const promise = (async () =>
    {
        const meta = metaBySpecies.get(speciesId)?.get(name);

        if(!meta) return null;

        const url = `${ pokemonSpriteBase(speciesId) }/${ name }-Anim.png`;
        const image = await cargarImagen(url);

        if(!image) return null;

        const frames = Math.max(1, Math.floor(image.naturalWidth / meta.frameWidth));
        const rows = Math.max(1, Math.floor(image.naturalHeight / meta.frameHeight));
        const anclas = medirAnclas(image, meta.frameWidth, meta.frameHeight);

        const durations = meta.durations.length ? meta.durations : [ 8 ];
        const totalMs = durations.reduce((total, duration) => total + duration, 0) * 1000 / PMD_FPS;

        const anim: PokemonAnim = {
            name,
            frameWidth: meta.frameWidth,
            frameHeight: meta.frameHeight,
            durations,
            frames,
            rows,
            url,
            shadowUrl: `${ pokemonSpriteBase(speciesId) }/${ name }-Shadow.png`,
            totalMs,
            anclaX: anclas.x,
            anclaY: anclas.y
        };

        set.anims.set(name, anim);

        return anim;
    })();

    loading.set(clave, promise);

    return promise;
}

/**
 * La fila de la hoja segun hacia donde mira el Pokemon.
 *
 * Las filas de PMD van en orden de pantalla: 0 abajo, 1 abajo-derecha, 2 derecha,
 * 3 arriba-derecha, 4 arriba, 5 arriba-izquierda, 6 izquierda, 7 abajo-izquierda.
 *
 * Las direcciones de Habbo tambien son de pantalla, pero en una sala isometrica:
 * la 2 (+x) apunta abajo-derecha y la 4 (+y) abajo-izquierda. Encajando las dos
 * ruedas sale que la 3 de Habbo es el "abajo" de PMD, y de ahi la resta.
 *
 * Si la hoja trae menos filas (Sleep y Sit de Pikachu son de una sola), todas las
 * direcciones usan la que haya.
 */
export function pmdRow(habboDirection: number, rows: number): number
{
    if(rows <= 1) return 0;

    const row = (11 - (((habboDirection % 8) + 8) % 8)) % 8;

    return Math.min(row, rows - 1);
}

/** El fotograma que toca segun el tiempo transcurrido, respetando cada duracion. */
export function frameAt(anim: PokemonAnim, elapsedMs: number, loop: boolean): number
{
    if(anim.frames <= 1) return 0;

    const total = anim.totalMs;

    if(total <= 0) return 0;

    const time = loop ? elapsedMs % total : Math.min(elapsedMs, total - 1);

    let acumulado = 0;

    for(let i = 0; i < anim.durations.length; i++)
    {
        acumulado += anim.durations[i] * 1000 / PMD_FPS;

        if(time < acumulado) return Math.min(i, anim.frames - 1);
    }

    return Math.min(anim.durations.length - 1, anim.frames - 1);
}
