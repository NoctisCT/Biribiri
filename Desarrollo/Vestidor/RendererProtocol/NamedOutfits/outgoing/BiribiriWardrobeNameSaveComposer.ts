import { IMessageComposer } from '../../../../../api';

export class BiribiriWardrobeNameSaveComposer implements IMessageComposer<ConstructorParameters<typeof BiribiriWardrobeNameSaveComposer>>
{
    private _data: ConstructorParameters<typeof BiribiriWardrobeNameSaveComposer>;

    constructor(slotId: number, name: string)
    {
        this._data = [
            slotId,
            name
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
