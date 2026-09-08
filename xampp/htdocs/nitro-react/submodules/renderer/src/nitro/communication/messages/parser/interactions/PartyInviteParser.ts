import { IMessageDataWrapper, IMessageParser } from '../../../../../api';

export class PartyInviteParser implements IMessageParser
{
    private _inviteId = 0;
    private _inviterUserId = 0;
    private _inviterName = '';
    private _inviterObjectId = -1;
    public flush(): boolean { this._inviteId = 0; this._inviterUserId = 0; this._inviterName = ''; this._inviterObjectId = -1; return true; }
    public parse(wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;
        this._inviteId = wrapper.readInt();
        this._inviterUserId = wrapper.readInt();
        this._inviterName = wrapper.readString();
        this._inviterObjectId = wrapper.readInt();
        return true;
    }
    public get inviteId(): number { return this._inviteId; }
    public get inviterUserId(): number { return this._inviterUserId; }
    public get inviterName(): string { return this._inviterName; }
    public get inviterObjectId(): number { return this._inviterObjectId; }
}
