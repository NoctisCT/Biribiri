import { IMessageDataWrapper, IMessageParser } from '../../../../../api';

export class BiribiriWardrobeClothingFavoritesParser implements IMessageParser
{
    private _favorites: Set<string> =
        new Set<string>();

    public flush(): boolean
    {
        this._favorites =
            new Set<string>();

        return true;
    }

    public parse(
        wrapper: IMessageDataWrapper
    ): boolean
    {
        if(!wrapper) return false;

        const count =
            Math.max(
                0,
                wrapper.readInt()
            );

        const favorites =
            new Set<string>();

        for(
            let i = 0;
            i < count;
            i++
        )
        {
            const figureType =
                wrapper
                    .readString()
                    .trim()
                    .toLowerCase();

            const wireFigureSetId =
                wrapper.readInt();

            // Los figure-set IDs son uint32 en Nitro.
            // EvaWire los transporta como int32 signed.
            const figureSetId =
                (wireFigureSetId >>> 0);

            if(
                figureType &&
                figureSetId !== 0 &&
                figureSetId !== 0xFFFFFFFF
            )
            {
                favorites.add(
                    `${ figureType }:${ figureSetId }`
                );
            }
        }

        this._favorites =
            favorites;

        return true;
    }

    public get favorites(): Set<string>
    {
        return this._favorites;
    }
}
