import { IMessageComposer } from '../../../../../api';

export class PartyInviteResponseComposer implements IMessageComposer<ConstructorParameters<typeof PartyInviteResponseComposer>>
{
    private _data: ConstructorParameters<typeof PartyInviteResponseComposer>;
    constructor(inviteId: number, accepted: number) { this._data = [ inviteId, accepted ]; }
    public getMessageArray() { return this._data; }
    public dispose(): void { return; }
}
