import { IAssetData, IObjectVisualizationData } from '../../../../../api';
import { Disposable } from '../../../../../core';

/**
 * El seguidor no carga ningun `.nitro`: sus texturas las prepara el cliente a
 * partir de las hojas de sprites de PMD y se las pasa al objeto por el modelo.
 * Por eso aqui no hay nada que inicializar.
 */
export class PokemonFollowerVisualizationData extends Disposable implements IObjectVisualizationData
{
    public initialize(asset: IAssetData): boolean
    {
        return true;
    }

    public onDispose(): void
    {
        return;
    }

    public get layerCount(): number
    {
        return 1;
    }
}
