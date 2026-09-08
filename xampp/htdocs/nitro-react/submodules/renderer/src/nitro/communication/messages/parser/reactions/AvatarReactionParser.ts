import { IMessageDataWrapper, IMessageParser } from '../../../../../api';

export class AvatarReactionParser implements IMessageParser
{
    private _objectId = -1;
    private _reactionId = 0;
    private _glyph = '';

    public flush(): boolean
    {
        this._objectId = -1;
        this._reactionId = 0;
        this._glyph = '';
        return true;
    }

    public parse(wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;

        this._objectId = wrapper.readInt();
        this._reactionId = wrapper.readInt();
        this._glyph = wrapper.readString();

        return true;
    }

    public get objectId(): number { return this._objectId; }
    public get reactionId(): number { return this._reactionId; }
    public get glyph(): string { return this._glyph; }
}
