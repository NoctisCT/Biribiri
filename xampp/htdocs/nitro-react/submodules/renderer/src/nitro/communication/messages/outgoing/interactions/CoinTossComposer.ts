import { IMessageComposer } from '../../../../../api';

export class CoinTossComposer implements IMessageComposer<ConstructorParameters<typeof CoinTossComposer>>
{
    private _data: ConstructorParameters<typeof CoinTossComposer>;

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
