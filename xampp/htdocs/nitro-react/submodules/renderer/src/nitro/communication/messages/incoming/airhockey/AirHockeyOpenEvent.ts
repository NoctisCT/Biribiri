import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { AirHockeyOpenParser } from '../../parser';

export class AirHockeyOpenEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(callBack, AirHockeyOpenParser);
    }

    public getParser(): AirHockeyOpenParser
    {
        return this.parser as AirHockeyOpenParser;
    }
}
