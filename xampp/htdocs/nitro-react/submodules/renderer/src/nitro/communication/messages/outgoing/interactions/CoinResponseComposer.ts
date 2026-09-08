import { IMessageComposer } from '../../../../../api';

export class CoinResponseComposer implements IMessageComposer<ConstructorParameters<typeof CoinResponseComposer>>
{
    private _data: ConstructorParameters<typeof CoinResponseComposer>;

    constructor(challengeId: number, accepted: number)
    {
        this._data = [ challengeId, accepted ];
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
