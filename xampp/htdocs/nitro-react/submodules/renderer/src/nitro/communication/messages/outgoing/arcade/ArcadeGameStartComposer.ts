import { IMessageComposer } from '../../../../../api';

export class ArcadeGameStartComposer implements IMessageComposer<ConstructorParameters<typeof ArcadeGameStartComposer>>
{
    private _data: ConstructorParameters<typeof ArcadeGameStartComposer>;

    constructor(
        itemId: number,
        gameKey: string)
    {
        this._data = [
            itemId,
            gameKey
        ];
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
