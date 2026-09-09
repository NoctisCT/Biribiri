import { IMessageComposer } from '../../../../../api';

export class BiribiriWardrobePurchaseRequestComposer implements IMessageComposer<ConstructorParameters<typeof BiribiriWardrobePurchaseRequestComposer>>
{
    private _data: ConstructorParameters<typeof BiribiriWardrobePurchaseRequestComposer>;

    constructor()
    {
        this._data = [];
    }

    public getMessageArray()
    {
        return this._data;
    }

    public dispose(): void
    {
        return;
    }
}
