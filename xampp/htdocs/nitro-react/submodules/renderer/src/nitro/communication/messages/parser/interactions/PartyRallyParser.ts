import { IMessageDataWrapper, IMessageParser } from '../../../../../api';

export class PartyRallyParser implements IMessageParser
{
    private _leaderUserId=0; private _leaderName=''; private _roomName=''; private _canVisit=false;
    public flush(): boolean { this._leaderUserId=0; this._leaderName=''; this._roomName=''; this._canVisit=false; return true; }
    public parse(wrapper: IMessageDataWrapper): boolean { if(!wrapper) return false; this._leaderUserId=wrapper.readInt(); this._leaderName=wrapper.readString(); this._roomName=wrapper.readString(); this._canVisit=wrapper.readInt()===1; return true; }
    public get leaderUserId(): number { return this._leaderUserId; }
    public get leaderName(): string { return this._leaderName; }
    public get roomName(): string { return this._roomName; }
    public get canVisit(): boolean { return this._canVisit; }
}
