import { IMessageComposer } from '../../../../../api';

export class BiribiriWardrobeClothingFavoriteSetComposer implements IMessageComposer<ConstructorParameters<typeof BiribiriWardrobeClothingFavoriteSetComposer>>
{
    private _data: ConstructorParameters<typeof BiribiriWardrobeClothingFavoriteSetComposer>;

    constructor(
        figureType: string,
        figureSetId: number,
        favorite: boolean
    )
    {
        this._data = [
            figureType,
            figureSetId,
            favorite
        ];
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
