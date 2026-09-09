import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { AirHockeyRoundParser } from '../../parser';

export class AirHockeyRoundEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(callBack, AirHockeyRoundParser);
    }

    public getParser(): AirHockeyRoundParser
    {
        return this.parser as AirHockeyRoundParser;
    }
}
