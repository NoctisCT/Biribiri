import { IMessageDataWrapper, IMessageParser } from '../../../../../api';

export class DuelPublicParser implements IMessageParser
{
    private _duelId = 0;
    private _active = false;
    private _challengerObjectId = -1;
    private _targetObjectId = -1;

    public flush(): boolean
    {
        this._duelId = 0;
        this._active = false;
        this._challengerObjectId = -1;
        this._targetObjectId = -1;
        return true;
    }

    public parse(wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;

        this._duelId = wrapper.readInt();
        this._active = wrapper.readInt() === 1;
        this._challengerObjectId = wrapper.readInt();
        this._targetObjectId = wrapper.readInt();

        return true;
    }

    public get duelId(): number { return this._duelId; }
    public get active(): boolean { return this._active; }
    public get challengerObjectId(): number { return this._challengerObjectId; }
    public get targetObjectId(): number { return this._targetObjectId; }
}
