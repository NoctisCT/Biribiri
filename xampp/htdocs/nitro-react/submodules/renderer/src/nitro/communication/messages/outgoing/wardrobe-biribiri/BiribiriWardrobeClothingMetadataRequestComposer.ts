import { IMessageComposer } from '../../../../../api';

export class BiribiriWardrobeClothingMetadataRequestComposer implements IMessageComposer<ConstructorParameters<typeof BiribiriWardrobeClothingMetadataRequestComposer>>
{
    private _data: ConstructorParameters<typeof BiribiriWardrobeClothingMetadataRequestComposer>;

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
