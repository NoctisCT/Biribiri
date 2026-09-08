import { IMessageComposer } from '../../../../../api';

export class GetReactionProfileComposer implements IMessageComposer<ConstructorParameters<typeof GetReactionProfileComposer>>
{
    private _data: ConstructorParameters<typeof GetReactionProfileComposer>;

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
