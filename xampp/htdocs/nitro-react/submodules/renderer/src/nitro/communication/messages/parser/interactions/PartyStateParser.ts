import { IMessageDataWrapper, IMessageParser } from '../../../../../api';

export interface PartyMemberParserData { userId: number; username: string; figure: string; roomId: number; roomName: string; canVisit: boolean; sameRoom: boolean; }
export class PartyStateParser implements IMessageParser
{
    private _active = false; private _partyId = 0; private _threadKey = 0; private _leaderUserId = 0; private _selfUserId = 0; private _members: PartyMemberParserData[] = [];
    public flush(): boolean { this._active=false; this._partyId=0; this._threadKey=0; this._leaderUserId=0; this._selfUserId=0; this._members=[]; return true; }
    public parse(wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;
        this._active = wrapper.readInt() === 1;
        if(!this._active) return true;
        this._partyId = wrapper.readInt(); this._threadKey = wrapper.readInt(); this._leaderUserId = wrapper.readInt(); this._selfUserId = wrapper.readInt();
        const total = wrapper.readInt();
        for(let i=0;i<total;i++) this._members.push({ userId: wrapper.readInt(), username: wrapper.readString(), figure: wrapper.readString(), roomId: wrapper.readInt(), roomName: wrapper.readString(), canVisit: wrapper.readInt()===1, sameRoom: wrapper.readInt()===1 });
        return true;
    }
    public get active(): boolean { return this._active; }
    public get partyId(): number { return this._partyId; }
    public get threadKey(): number { return this._threadKey; }
    public get leaderUserId(): number { return this._leaderUserId; }
    public get selfUserId(): number { return this._selfUserId; }
    public get members(): PartyMemberParserData[] { return this._members; }
}
