import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { ArcadeGameStartedParser } from '../../parser';

export class ArcadeGameStartedEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(
            callBack,
            ArcadeGameStartedParser
        );
    }

    public getParser(): ArcadeGameStartedParser
    {
        return this.parser as ArcadeGameStartedParser;
    }
}
