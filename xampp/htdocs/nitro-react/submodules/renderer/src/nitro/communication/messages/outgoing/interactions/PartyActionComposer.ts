import { IMessageComposer } from '../../../../../api';

export class PartyActionComposer implements IMessageComposer<ConstructorParameters<typeof PartyActionComposer>>
{
    private _data: ConstructorParameters<typeof PartyActionComposer>;
    constructor(action: number, targetUserId: number = 0) { this._data = [ action, targetUserId ]; }
    public getMessageArray() { return this._data; }
    public dispose(): void { return; }
}
