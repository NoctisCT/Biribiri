import { IMessageDataWrapper, IMessageParser } from '../../../../../api';

export class BiribiriWardrobeNamesParser implements IMessageParser
{
    private _names: Map<number, string> =
        new Map<number, string>();

    public flush(): boolean
    {
        this._names =
            new Map<number, string>();

        return true;
    }

    public parse(wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;

        const count =
            Math.max(
                0,
                wrapper.readInt()
            );

        this._names =
            new Map<number, string>();

        for(let i = 0; i < count; i++)
        {
            const slotId =
                wrapper.readInt();

            const name =
                wrapper.readString();

            if(slotId > 0 && name)
            {
                this._names.set(
                    slotId,
                    name
                );
            }
        }

        return true;
    }

    public get names(): Map<number, string>
    {
        return this._names;
    }
}
