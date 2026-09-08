import { IMessageComposer } from '../../../../../api';

export class PartyChatComposer implements IMessageComposer<ConstructorParameters<typeof PartyChatComposer>>
{
    private _data: ConstructorParameters<typeof PartyChatComposer>;
    constructor(partyId: number, message: string) { this._data = [ partyId, message ]; }
    public getMessageArray() { return this._data; }
    public dispose(): void { return; }
}
