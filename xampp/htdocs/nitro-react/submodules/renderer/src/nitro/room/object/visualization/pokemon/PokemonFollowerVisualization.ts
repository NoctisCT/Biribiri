import { Resource, Texture } from '@pixi/core';
import { IObjectVisualizationData, IRoomGeometry, RoomObjectSpriteType } from '../../../../../api';
import { RoomObjectSpriteVisualization } from '../../../../../room';

/**
 * El Pokemon que sigue al jugador, dibujado como un objeto de sala de verdad.
 *
 * No tiene logica propia de dibujo: el cliente decide que fotograma toca, lo
 * recorta de la hoja de PMD a la escala que toque y deja la textura y su ancla
 * en el modelo del objeto. Aqui solo se copian al sprite.
 *
 * Existir como objeto de sala es todo el objetivo: asi el lienzo lo mete en su
 * lista ordenada por profundidad y el Pokemon pasa por detras del furni y de los
 * avatares que tiene delante, en vez de pintarse encima de todo.
 */
export class PokemonFollowerVisualization extends RoomObjectSpriteVisualization
{
    public static TEXTURA = 'pokemon_textura';
    public static ANCLA_X = 'pokemon_ancla_x';
    public static ANCLA_Y = 'pokemon_ancla_y';
    public static PROFUNDIDAD = 'pokemon_profundidad';

    private _ultimaTextura: Texture<Resource> = null;

    /**
     * La base devuelve false, que el gestor de salas entiende como "esta
     * visualizacion no vale" y tira el objeto entero. Aqui no hay nada que
     * inicializar, asi que basta con decir que si.
     */
    public initialize(data: IObjectVisualizationData): boolean
    {
        return true;
    }

    public update(geometry: IRoomGeometry, time: number, update: boolean, skipUpdate: boolean): void
    {
        const object = this.object;

        if(!object || !geometry) return;

        if(!this.getSprite(0)) this.createSprites(1);

        const sprite = this.getSprite(0);

        if(!sprite) return;

        const textura = object.model.getValue<Texture<Resource>>(PokemonFollowerVisualization.TEXTURA);

        if(!textura)
        {
            sprite.visible = false;
            return;
        }

        const anclaX = object.model.getValue<number>(PokemonFollowerVisualization.ANCLA_X) || 0;
        const anclaY = object.model.getValue<number>(PokemonFollowerVisualization.ANCLA_Y) || 0;
        const profundidad = object.model.getValue<number>(PokemonFollowerVisualization.PROFUNDIDAD) || 0;

        if(textura !== this._ultimaTextura)
        {
            sprite.texture = textura;
            this._ultimaTextura = textura;

            // El lienzo solo reconstruye su cache de sprites cuando este contador
            // cambia, asi que sin esto el cambio de fotograma no se veria.
            this.updateSpriteCounter = this.updateSpriteCounter + 1;
        }

        sprite.visible = true;
        sprite.spriteType = RoomObjectSpriteType.DEFAULT;
        // El lienzo usa este valor como tinte y arranca en 0, que en PIXI pinta
        // el sprite entero de negro.
        sprite.color = 0xFFFFFF;
        sprite.alpha = 255;
        sprite.name = 'pokemon_follower';
        sprite.clickHandling = true;
        sprite.offsetX = -anclaX;
        sprite.offsetY = -anclaY;
        sprite.relativeDepth = profundidad;
    }

    public dispose(): void
    {
        this._ultimaTextura = null;

        super.dispose();
    }
}
