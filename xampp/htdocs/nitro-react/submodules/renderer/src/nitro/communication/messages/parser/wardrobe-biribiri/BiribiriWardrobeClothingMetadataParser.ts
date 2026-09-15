import { IMessageDataWrapper, IMessageParser } from '../../../../../api';

export interface BiribiriWardrobeClothingMetadataEntry
{
    figureType: string;
    figureSetId: number;
    name: string;
    tags: string[];
}

export class BiribiriWardrobeClothingMetadataParser
implements IMessageParser
{
    private _metadata:
        Map<string, BiribiriWardrobeClothingMetadataEntry> =
            new Map<string, BiribiriWardrobeClothingMetadataEntry>();

    public flush(): boolean
    {
        this._metadata =
            new Map<string, BiribiriWardrobeClothingMetadataEntry>();

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

        this._metadata =
            new Map<string, BiribiriWardrobeClothingMetadataEntry>();

        for(let i = 0; i < count; i++)
        {
            const figureType =
                (wrapper.readString() || '')
                    .toLowerCase();

            const wireFigureSetId =
                wrapper.readInt();

            // int32 del protocolo -> uint32 real de FigureData
            const figureSetId =
                (wireFigureSetId >>> 0);

            const name =
                wrapper.readString() || '';

            const tagCount =
                Math.max(
                    0,
                    wrapper.readInt()
                );

            const tags: string[] = [];

            for(let j = 0; j < tagCount; j++)
            {
                const tag =
                    wrapper.readString();

                if(tag)
                {
                    tags.push(tag);
                }
            }

            if(
                !figureType ||
                figureSetId === 0 ||
                figureSetId === 0xFFFFFFFF
            )
            {
                continue;
            }

            this._metadata.set(
                `${ figureType }:${ figureSetId }`,
                {
                    figureType,
                    figureSetId,
                    name,
                    tags
                }
            );
        }

        return true;
    }

    public get metadata():
        Map<string, BiribiriWardrobeClothingMetadataEntry>
    {
        return this._metadata;
    }
}
