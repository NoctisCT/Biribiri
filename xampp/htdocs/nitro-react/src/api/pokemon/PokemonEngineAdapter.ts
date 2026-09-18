import { PokemonCommandComposer, PokemonResultEvent } from '@nitrots/nitro-renderer';
import { GetCommunication } from '../nitro/GetCommunication';
import { SendMessageComposer } from '../nitro/SendMessageComposer';

export const ACTION_SALUDO = 1;

export interface PokemonResult
{
    action: number;
    success: boolean;
    payload: Record<string, unknown> | null;
}

export type PokemonResultListener = (result: PokemonResult) => void;

const listeners = new Set<PokemonResultListener>();

let installed = false;

export function sendPokemonCommand(action: number, ...args: Array<string | number | boolean>): void
{
    SendMessageComposer(new PokemonCommandComposer(action, ...args));
}

export function addPokemonResultListener(listener: PokemonResultListener): () => void
{
    listeners.add(listener);

    return () => { listeners.delete(listener); };
}

function onServerResult(event: PokemonResultEvent): void
{
    const parser = event.getParser();

    if(!parser) return;

    const result: PokemonResult = {
        action: parser.action,
        success: parser.success,
        payload: parser.payload
    };

    for(const listener of listeners) listener(result);
}

export function InstallPokemonEngineAdapter(): boolean
{
    if(installed) return true;

    const communication = GetCommunication();

    if(!communication) return false;

    communication.registerMessageEvent(new PokemonResultEvent(onServerResult));

    (globalThis as any).PokemonEngine = {
        saludo: () => sendPokemonCommand(ACTION_SALUDO),
        enviar: (action: number, ...args: Array<string | number | boolean>) =>
            sendPokemonCommand(action, ...args),
        onResult: (listener: PokemonResultListener) => addPokemonResultListener(listener)
    };

    addPokemonResultListener(result =>
    {
        console.log('[PokemonEngine] resultado', result);
    });

    installed = true;

    return true;
}
