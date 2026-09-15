import { IMessageComposer } from '../../../../../api';

export class BiribiriWardrobeClothingFavoritesRequestComposer implements IMessageComposer<ConstructorParameters<typeof BiribiriWardrobeClothingFavoritesRequestComposer>>
{
    private _data: ConstructorParameters<typeof BiribiriWardrobeClothingFavoritesRequestComposer>;

    constructor()
    {
        this._data = [];
    }

    public getMessageArray()
    {
        return this._data;
    }

    public dispose(): void
    {
        return;
    }
}
