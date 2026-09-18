import { PokemonCommandComposer, PokemonFollowerComposer, PokemonFollowerEvent, PokemonResultEvent } from '@nitrots/nitro-renderer';
import { GetCommunication } from '../nitro/GetCommunication';
import { SendMessageComposer } from '../nitro/SendMessageComposer';

// 1-19 sesion, zona y seguidor
export const ACTION_SALUDO = 1;
export const ACTION_CATALOGO = 2;
export const ACTION_ENTRENADOR_ESTADO = 3;
export const ACTION_SEGUIDOR_ELEGIR = 4;
export const ACTION_SEGUIDOR_ACTIVAR = 5;
export const ACTION_SEGUIDOR_ANIMACIONES = 6;

// 20-39 equipo y cajas
export const ACTION_EQUIPO_LISTAR = 20;
export const ACTION_CAJAS_LISTAR = 22;
export const ACTION_CAJA_VER = 23;
export const ACTION_POKEMON_MOVER = 24;
export const ACTION_POKEMON_DETALLE = 25;
export const ACTION_POKEMON_MOTE = 26;
export const ACTION_POKEMON_FAVORITO = 27;
export const ACTION_CAJA_RENOMBRAR = 28;
export const ACTION_POKEMON_DEPOSITAR = 29;
export const ACTION_POKEMON_RETIRAR = 30;

// 40-59 mochila y objetos
export const ACTION_MOCHILA_LISTAR = 40;
export const ACTION_MOCHILA_TIRAR = 41;
export const ACTION_OBJETO_DAR = 42;
export const ACTION_OBJETO_QUITAR = 43;

// 100-119 pokedex
export const ACTION_DEX_RESUMEN = 100;
export const ACTION_DEX_ENTRADA = 101;

// Acciones del paquete 6402
export const FOLLOWER_REQUEST_SNAPSHOT = 1;
export const FOLLOWER_INTERACT = 2;
export const FOLLOWER_OWN_GESTURE = 3;

// Tipos del paquete 6403
export const FOLLOWER_SNAPSHOT = 1;
export const FOLLOWER_STEP = 2;
export const FOLLOWER_ADDED = 3;
export const FOLLOWER_REMOVED = 4;
export const FOLLOWER_ANIMATION = 5;

export interface PokemonResult
{
    action: number;
    success: boolean;
    payload: Record<string, unknown> | null;
}

export interface PokemonFollower
{
    userId: number;
    ownedId: number;
    speciesId: number;
    formId: number;
    shiny: boolean;
    x: number;
    y: number;
    z: number;
    direction: number;
    state: string;
    animation: string;
    fallback: string;
    name: string;
}

export type PokemonResultListener = (result: PokemonResult) => void;
export type PokemonFollowerListener = (followers: Map<number, PokemonFollower>, type: number) => void;

const listeners = new Set<PokemonResultListener>();
const followerListeners = new Set<PokemonFollowerListener>();

/**
 * El estado del seguidor de cada usuario de la sala, por id de usuario.
 * Es la unica copia que tiene el cliente: la capa de render de la fase 2 leera
 * de aqui en vez de volver a hablar con el servidor.
 */
const followers = new Map<number, PokemonFollower>();

let installed = false;

export function sendPokemonCommand(action: number, data: Record<string, unknown> = {}): void
{
    SendMessageComposer(new PokemonCommandComposer(action, JSON.stringify(data ?? {})));
}

export function addPokemonResultListener(listener: PokemonResultListener): () => void
{
    listeners.add(listener);

    return () => { listeners.delete(listener); };
}

export function addPokemonFollowerListener(listener: PokemonFollowerListener): () => void
{
    followerListeners.add(listener);

    return () => { followerListeners.delete(listener); };
}

export function getPokemonFollowers(): Map<number, PokemonFollower>
{
    return followers;
}

export function requestFollowerSnapshot(): void
{
    SendMessageComposer(new PokemonFollowerComposer(FOLLOWER_REQUEST_SNAPSHOT));
}

export function interactWithFollower(userId: number, code: string): void
{
    SendMessageComposer(new PokemonFollowerComposer(FOLLOWER_INTERACT, userId, code));
}

export function sendOwnGesture(code: string): void
{
    SendMessageComposer(new PokemonFollowerComposer(FOLLOWER_OWN_GESTURE, code));
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

function onFollowerUpdate(event: PokemonFollowerEvent): void
{
    const parser = event.getParser();

    if(!parser) return;

    // La foto sustituye la sala entera; el resto son cambios sueltos.
    if(parser.type === FOLLOWER_SNAPSHOT) followers.clear();

    for(const entry of parser.entries)
    {
        if(parser.type === FOLLOWER_REMOVED)
        {
            followers.delete(entry.userId);
            continue;
        }

        followers.set(entry.userId, { ...entry });
    }

    for(const listener of followerListeners) listener(followers, parser.type);
}

export function InstallPokemonEngineAdapter(): boolean
{
    if(installed) return true;

    const communication = GetCommunication();

    if(!communication) return false;

    communication.registerMessageEvent(new PokemonResultEvent(onServerResult));
    communication.registerMessageEvent(new PokemonFollowerEvent(onFollowerUpdate));

    (globalThis as any).PokemonEngine = {
        saludo: () => sendPokemonCommand(ACTION_SALUDO),
        enviar: (action: number, data?: Record<string, unknown>) => sendPokemonCommand(action, data),
        onResult: (listener: PokemonResultListener) => addPokemonResultListener(listener),
        seguidores: () => Array.from(followers.values()),
        pedirFoto: () => requestFollowerSnapshot(),
        interactuar: (userId: number, code: string) => interactWithFollower(userId, code),
        gesto: (code: string) => sendOwnGesture(code),
        onSeguidor: (listener: PokemonFollowerListener) => addPokemonFollowerListener(listener)
    };

    addPokemonResultListener(result =>
    {
        console.log('[PokemonEngine] resultado', result);
    });

    addPokemonFollowerListener((all, type) =>
    {
        console.log('[PokemonEngine] seguidores', type, Array.from(all.values()));
    });

    installed = true;

    return true;
}
