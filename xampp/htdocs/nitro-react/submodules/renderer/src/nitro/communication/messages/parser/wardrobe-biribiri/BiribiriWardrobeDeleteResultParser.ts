import { IMessageDataWrapper, IMessageParser } from '../../../../../api';

export class BiribiriWardrobeDeleteResultParser implements IMessageParser
{
    private _status = -1;
    private _slotId = -1;

    public flush(): boolean
    {
        this._status = -1;
        this._slotId = -1;

        return true;
    }

    public parse(wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;

        this._status = wrapper.readInt();
        this._slotId = wrapper.readInt();

        return true;
    }

    public get status(): number
    {
        return this._status;
    }

    public get slotId(): number
    {
        return this._slotId;
    }
}
