import { IMessageComposer } from '../../../../../api';

export class SaveReactionDisplayModeComposer implements IMessageComposer<ConstructorParameters<typeof SaveReactionDisplayModeComposer>>
{
    private _data: ConstructorParameters<typeof SaveReactionDisplayModeComposer>;

    constructor(mode: number)
    {
        this._data = [ mode ];
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
