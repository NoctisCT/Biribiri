import { IMessageComposer } from '../../../../../api';

export class SaveReactionSlotsComposer implements IMessageComposer<number[]>
{
    private _data: number[];

    constructor(...reactionIds: number[])
    {
        this._data = [ reactionIds.length, ...reactionIds ];
    }

    public getMessageArray(): number[]
    {
        return this._data;
    }

    public dispose(): void
    {
        return;
    }
}
