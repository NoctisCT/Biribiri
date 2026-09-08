import { IMessageComposer } from '../../../../../api';

export class PartyInviteComposer implements IMessageComposer<ConstructorParameters<typeof PartyInviteComposer>>
{
    private _data: ConstructorParameters<typeof PartyInviteComposer>;
    constructor(targetUserId: number) { this._data = [ targetUserId ]; }
    public getMessageArray() { return this._data; }
    public dispose(): void { return; }
}
