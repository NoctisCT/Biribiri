import { IMessageComposer } from '../../../../../api';

export class ArcadeScoreSubmitComposer implements IMessageComposer<ConstructorParameters<typeof ArcadeScoreSubmitComposer>>
{
    private _data: ConstructorParameters<typeof ArcadeScoreSubmitComposer>;

    constructor(
        itemId: number,
        gameKey: string,
        token: string,
        score: number,
        level: number)
    {
        this._data = [
            itemId,
            gameKey,
            token,
            score,
            level
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
