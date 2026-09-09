import { IMessageComposer } from '../../../../../api';

export class AirHockeyMoveComposer implements IMessageComposer<ConstructorParameters<typeof AirHockeyMoveComposer>>
{
    private _data: ConstructorParameters<typeof AirHockeyMoveComposer>;

    constructor(itemId: number, x: number, y: number)
    {
        this._data = [ itemId, x, y ];
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
