import { AirHockeyReadyComposer } from '@nitrots/nitro-renderer';
import { SendMessageComposer } from '..';

export function ReadyAirHockey(itemId: number): void
{
    if(itemId <= 0) return;
    SendMessageComposer(new AirHockeyReadyComposer(itemId));
}
