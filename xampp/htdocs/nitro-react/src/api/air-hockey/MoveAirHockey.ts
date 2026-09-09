import { AirHockeyMoveComposer } from '@nitrots/nitro-renderer';
import { SendMessageComposer } from '..';

export function MoveAirHockey(itemId: number, x: number, y: number): void
{
    if(itemId <= 0) return;
    SendMessageComposer(new AirHockeyMoveComposer(itemId, Math.round(x), Math.round(y)));
}
