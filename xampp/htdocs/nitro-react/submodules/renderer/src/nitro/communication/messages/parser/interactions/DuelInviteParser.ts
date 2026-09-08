import { IMessageDataWrapper, IMessageParser } from '../../../../../api';

export class DuelInviteParser implements IMessageParser
{
    private _duelId = 0;
    private _challengerUserId = 0;
    private _challengerName = '';
    private _challengerObjectId = -1;

    public flush(): boolean
    {
        this._duelId = 0;
        this._challengerUserId = 0;
        this._challengerName = '';
        this._challengerObjectId = -1;
        return true;
    }

    public parse(wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;

        this._duelId = wrapper.readInt();
        this._challengerUserId = wrapper.readInt();
        this._challengerName = wrapper.readString();
        this._challengerObjectId = wrapper.readInt();

        return true;
    }

    public get duelId(): number { return this._duelId; }
    public get challengerUserId(): number { return this._challengerUserId; }
    public get challengerName(): string { return this._challengerName; }
    public get challengerObjectId(): number { return this._challengerObjectId; }
}
