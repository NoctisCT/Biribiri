import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { BiribiriWardrobeNamesParser } from '../../parser';

export class BiribiriWardrobeNamesEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(
            callBack,
            BiribiriWardrobeNamesParser
        );
    }

    public getParser(): BiribiriWardrobeNamesParser
    {
        return this.parser as BiribiriWardrobeNamesParser;
    }
}
