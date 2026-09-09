import { IMessageComposer } from '../../../../../api';

export class AirHockeyLeaveComposer implements IMessageComposer<ConstructorParameters<typeof AirHockeyLeaveComposer>>
{
    private _data: ConstructorParameters<typeof AirHockeyLeaveComposer>;

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
