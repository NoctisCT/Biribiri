import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { PartyRallyParser } from '../../parser/interactions';
export class PartyRallyEvent extends MessageEvent implements IMessageEvent { constructor(callBack: Function) { super(callBack, PartyRallyParser); } public getParser(): PartyRallyParser { return this.parser as PartyRallyParser; } }
