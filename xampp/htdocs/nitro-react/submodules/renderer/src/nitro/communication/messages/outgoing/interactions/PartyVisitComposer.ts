import { IMessageComposer } from '../../../../../api';

export class PartyVisitComposer implements IMessageComposer<ConstructorParameters<typeof PartyVisitComposer>>
{
    private _data: ConstructorParameters<typeof PartyVisitComposer>;
    constructor(targetUserId: number) { this._data = [ targetUserId ]; }
    public getMessageArray() { return this._data; }
    public dispose(): void { return; }
}
