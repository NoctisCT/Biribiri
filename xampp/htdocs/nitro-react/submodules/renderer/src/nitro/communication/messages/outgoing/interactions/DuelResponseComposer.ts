import { IMessageComposer } from '../../../../../api';

export class DuelResponseComposer implements IMessageComposer<ConstructorParameters<typeof DuelResponseComposer>>
{
    private _data: ConstructorParameters<typeof DuelResponseComposer>;

    constructor(duelId: number, accepted: number)
    {
        this._data = [ duelId, accepted ];
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
