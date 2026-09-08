import { IMessageComposer } from '../../../../../api';

export class DuelChoiceComposer implements IMessageComposer<ConstructorParameters<typeof DuelChoiceComposer>>
{
    private _data: ConstructorParameters<typeof DuelChoiceComposer>;

    constructor(duelId: number, choice: number)
    {
        this._data = [ duelId, choice ];
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
