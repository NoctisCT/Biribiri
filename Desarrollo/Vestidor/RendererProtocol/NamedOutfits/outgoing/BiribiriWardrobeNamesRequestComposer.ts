import { IMessageComposer } from '../../../../../api';

export class BiribiriWardrobeNamesRequestComposer implements IMessageComposer<ConstructorParameters<typeof BiribiriWardrobeNamesRequestComposer>>
{
    private _data: ConstructorParameters<typeof BiribiriWardrobeNamesRequestComposer>;

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
