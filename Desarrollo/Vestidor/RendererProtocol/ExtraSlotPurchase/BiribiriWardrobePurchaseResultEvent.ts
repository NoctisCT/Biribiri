import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { BiribiriWardrobePurchaseResultParser } from '../../parser';

export class BiribiriWardrobePurchaseResultEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(callBack, BiribiriWardrobePurchaseResultParser);
    }

    public getParser(): BiribiriWardrobePurchaseResultParser
    {
        return this.parser as BiribiriWardrobePurchaseResultParser;
    }
}
