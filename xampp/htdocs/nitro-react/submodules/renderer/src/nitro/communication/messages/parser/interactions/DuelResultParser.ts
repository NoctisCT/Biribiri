import { IMessageDataWrapper, IMessageParser } from '../../../../../api';

export class DuelResultParser implements IMessageParser
{
    private _duelId = 0;
    private _challengerObjectId = -1;
    private _targetObjectId = -1;
    private _challengerChoice = -1;
    private _targetChoice = -1;
    private _winnerObjectId = -1;

    public flush(): boolean
    {
        this._duelId = 0;
        this._challengerObjectId = -1;
        this._targetObjectId = -1;
        this._challengerChoice = -1;
        this._targetChoice = -1;
        this._winnerObjectId = -1;
        return true;
    }

    public parse(wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;

        this._duelId = wrapper.readInt();
        this._challengerObjectId = wrapper.readInt();
        this._targetObjectId = wrapper.readInt();
        this._challengerChoice = wrapper.readInt();
        this._targetChoice = wrapper.readInt();
        this._winnerObjectId = wrapper.readInt();

        return true;
    }

    public get duelId(): number { return this._duelId; }
    public get challengerObjectId(): number { return this._challengerObjectId; }
    public get targetObjectId(): number { return this._targetObjectId; }
    public get challengerChoice(): number { return this._challengerChoice; }
    public get targetChoice(): number { return this._targetChoice; }
    public get winnerObjectId(): number { return this._winnerObjectId; }
}
