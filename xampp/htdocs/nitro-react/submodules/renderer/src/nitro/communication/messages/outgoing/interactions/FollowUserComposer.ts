import { IMessageComposer } from '../../../../../api';

export class FollowUserComposer implements IMessageComposer<ConstructorParameters<typeof FollowUserComposer>>
{
    private _data: ConstructorParameters<typeof FollowUserComposer>;

    constructor(targetUserId: number)
    {
        this._data = [ targetUserId ];
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
