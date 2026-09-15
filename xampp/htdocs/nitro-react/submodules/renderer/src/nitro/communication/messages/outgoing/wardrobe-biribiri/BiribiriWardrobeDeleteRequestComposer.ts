import { IMessageComposer } from '../../../../../api';

export class BiribiriWardrobeDeleteRequestComposer implements IMessageComposer<ConstructorParameters<typeof BiribiriWardrobeDeleteRequestComposer>>
{
    private _data: ConstructorParameters<typeof BiribiriWardrobeDeleteRequestComposer>;

    constructor(slotId: number)
    {
        this._data = [slotId];
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
