import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { BiribiriWardrobeClothingFavoritesParser } from '../../parser';

export class BiribiriWardrobeClothingFavoritesEvent extends MessageEvent implements IMessageEvent
{
    constructor(
        callBack: Function
    )
    {
        super(
            callBack,
            BiribiriWardrobeClothingFavoritesParser
        );
    }

    public getParser(): BiribiriWardrobeClothingFavoritesParser
    {
        return this.parser as BiribiriWardrobeClothingFavoritesParser;
    }
}
