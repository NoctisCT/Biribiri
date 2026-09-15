import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { BiribiriWardrobeClothingMetadataParser } from '../../parser';

export class BiribiriWardrobeClothingMetadataEvent extends MessageEvent implements IMessageEvent
{
    constructor(
        callBack: Function
    )
    {
        super(
            callBack,
            BiribiriWardrobeClothingMetadataParser
        );
    }

    public getParser(): BiribiriWardrobeClothingMetadataParser
    {
        return this.parser as BiribiriWardrobeClothingMetadataParser;
    }
}
