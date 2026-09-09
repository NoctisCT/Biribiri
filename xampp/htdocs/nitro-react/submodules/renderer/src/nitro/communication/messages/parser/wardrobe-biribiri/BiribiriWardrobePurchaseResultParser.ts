import { IMessageDataWrapper, IMessageParser } from '../../../../../api';

export class BiribiriWardrobePurchaseResultParser implements IMessageParser
{
    private _status = 3;
    private _purchasedSlots = 0;
    private _price = 0;
    private _creditsRemaining = 0;
    private _nextPrice = 25;

    public flush(): boolean
    {
        this._status = 3;
        this._purchasedSlots = 0;
        this._price = 0;
        this._creditsRemaining = 0;
        this._nextPrice = 25;
        return true;
    }

    public parse(wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;
        this._status = wrapper.readInt();
        this._purchasedSlots = wrapper.readInt();
        this._price = wrapper.readInt();
        this._creditsRemaining = wrapper.readInt();
        this._nextPrice = wrapper.readInt();
        return true;
    }

    public get status(): number { return this._status; }
    public get purchasedSlots(): number { return this._purchasedSlots; }
    public get price(): number { return this._price; }
    public get creditsRemaining(): number { return this._creditsRemaining; }
    public get nextPrice(): number { return this._nextPrice; }
}
