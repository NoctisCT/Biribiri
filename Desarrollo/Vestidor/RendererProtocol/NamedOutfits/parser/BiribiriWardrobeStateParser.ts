import { IMessageDataWrapper, IMessageParser } from '../../../../../api';

export class BiribiriWardrobeStateParser implements IMessageParser
{
    private _baseSlots = 10;
    private _hcSlots = 10;
    private _hcActive = false;
    private _purchasedSlots = 0;
    private _displaySlots = 20;

    public flush(): boolean
    {
        this._baseSlots = 10;
        this._hcSlots = 10;
        this._hcActive = false;
        this._purchasedSlots = 0;
        this._displaySlots = 20;
        return true;
    }

    public parse(wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;

        this._baseSlots = wrapper.readInt();
        this._hcSlots = wrapper.readInt();
        this._hcActive = wrapper.readBoolean();
        this._purchasedSlots = wrapper.readInt();
        this._displaySlots = wrapper.readInt();
        return true;
    }

    public get baseSlots(): number { return this._baseSlots; }
    public get hcSlots(): number { return this._hcSlots; }
    public get hcActive(): boolean { return this._hcActive; }
    public get purchasedSlots(): number { return this._purchasedSlots; }
    public get displaySlots(): number { return this._displaySlots; }
}
