import { IMessageDataWrapper, IMessageParser } from '../../../../../api';

export class DuelStateParser implements IMessageParser
{
    private _duelId = 0;
    private _state = 0;
    private _opponentName = '';
    private _opponentObjectId = -1;
    private _ownObjectId = -1;

    public flush(): boolean
    {
        this._duelId = 0;
        this._state = 0;
        this._opponentName = '';
        this._opponentObjectId = -1;
        this._ownObjectId = -1;
        return true;
    }

    public parse(wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;

        this._duelId = wrapper.readInt();
        this._state = wrapper.readInt();
        this._opponentName = wrapper.readString();
        this._opponentObjectId = wrapper.readInt();
        this._ownObjectId = wrapper.readInt();

        return true;
    }

    public get duelId(): number { return this._duelId; }
    public get state(): number { return this._state; }
    public get opponentName(): string { return this._opponentName; }
    public get opponentObjectId(): number { return this._opponentObjectId; }
    public get ownObjectId(): number { return this._ownObjectId; }
}
