import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { ArkanoidOpenParser } from '../../parser';

export class ArkanoidOpenEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(
            callBack,
            ArkanoidOpenParser
        );
    }

    public getParser(): ArkanoidOpenParser
    {
        return this.parser as ArkanoidOpenParser;
    }
}
