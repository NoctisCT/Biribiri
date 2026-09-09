import { IMessageComposer } from '../../../../../api';

export class BiribiriWardrobeStateRequestComposer implements IMessageComposer<ConstructorParameters<typeof BiribiriWardrobeStateRequestComposer>>
{
    private _data: ConstructorParameters<typeof BiribiriWardrobeStateRequestComposer>;

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
