import { IMessageComposer } from '../../../../../api';

export class DuelChallengeComposer implements IMessageComposer<ConstructorParameters<typeof DuelChallengeComposer>>
{
    private _data: ConstructorParameters<typeof DuelChallengeComposer>;

    constructor(targetUserId: number)
    {
        this._data = [ targetUserId ];
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
