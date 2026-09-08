import { IMessageDataWrapper, IMessageParser } from '../../../../../api';

export interface ReactionProfileDefinition
{
    id: number;
    code: string;
    glyph: string;
    name: string;
    source: string;
}

export class ReactionProfileParser implements IMessageParser
{
    private _displayMode = 0;
    private _quickSlots: number[] = [];
    private _owned: ReactionProfileDefinition[] = [];

    public flush(): boolean
    {
        this._displayMode = 0;
        this._quickSlots = [];
        this._owned = [];
        return true;
    }

    public parse(wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;

        this._displayMode = wrapper.readInt();

        const slotCount = wrapper.readInt();

        this._quickSlots = [];

        for(let i = 0; i < slotCount; i++)
        {
            this._quickSlots.push(wrapper.readInt());
        }

        const ownedCount = wrapper.readInt();

        this._owned = [];

        for(let i = 0; i < ownedCount; i++)
        {
            this._owned.push({
                id: wrapper.readInt(),
                code: wrapper.readString(),
                glyph: wrapper.readString(),
                name: wrapper.readString(),
                source: wrapper.readString()
            });
        }

        return true;
    }

    public get displayMode(): number { return this._displayMode; }
    public get quickSlots(): number[] { return this._quickSlots; }
    public get owned(): ReactionProfileDefinition[] { return this._owned; }
}
