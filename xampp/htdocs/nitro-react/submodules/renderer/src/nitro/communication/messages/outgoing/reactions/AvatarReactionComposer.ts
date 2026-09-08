import { IMessageComposer } from '../../../../../api';

export class AvatarReactionComposer implements IMessageComposer<ConstructorParameters<typeof AvatarReactionComposer>>
{
    private _data: ConstructorParameters<typeof AvatarReactionComposer>;

    constructor(reactionId: number)
    {
        this._data = [ reactionId ];
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
