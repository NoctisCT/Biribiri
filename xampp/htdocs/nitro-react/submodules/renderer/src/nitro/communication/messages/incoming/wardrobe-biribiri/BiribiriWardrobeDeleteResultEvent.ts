import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { BiribiriWardrobeDeleteResultParser } from '../../parser';

export class BiribiriWardrobeDeleteResultEvent extends MessageEvent implements IMessageEvent
{
    constructor(
        callBack: Function
    )
    {
        super(
            callBack,
            BiribiriWardrobeDeleteResultParser
        );
    }

    public getParser(): BiribiriWardrobeDeleteResultParser
    {
        return this.parser as BiribiriWardrobeDeleteResultParser;
    }
}
