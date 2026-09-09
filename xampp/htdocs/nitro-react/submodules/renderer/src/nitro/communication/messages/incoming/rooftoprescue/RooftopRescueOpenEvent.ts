import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { RooftopRescueOpenParser } from '../../parser';

export class RooftopRescueOpenEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(
            callBack,
            RooftopRescueOpenParser
        );
    }

    public getParser(): RooftopRescueOpenParser
    {
        return this.parser as RooftopRescueOpenParser;
    }
}
