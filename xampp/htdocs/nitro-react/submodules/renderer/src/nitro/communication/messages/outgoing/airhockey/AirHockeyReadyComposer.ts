import { IMessageComposer } from '../../../../../api';

export class AirHockeyReadyComposer implements IMessageComposer<ConstructorParameters<typeof AirHockeyReadyComposer>>
{
    private _data: ConstructorParameters<typeof AirHockeyReadyComposer>;

    constructor(itemId: number)
    {
        this._data = [ itemId ];
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
