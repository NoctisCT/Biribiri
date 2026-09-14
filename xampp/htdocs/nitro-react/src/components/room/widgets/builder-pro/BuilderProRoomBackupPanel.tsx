import { BuilderProRoomBackupStateComposer, BuilderProRoomBackupStateEvent, BuilderProRoomBackupSummary } from '@nitrots/nitro-renderer';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SendMessageComposer } from '../../../../api';
import { useMessageEvent, useRoom } from '../../../../hooks';

const OP_LIST = 0;
const OP_CREATE = 1;
const OP_UPDATE = 2;
const OP_RESTORE = 3;
const OP_DELETE = 4;
const OP_CHANGE_PIN = 5;

interface BuilderProRoomBackupPanelProps
{
    onStatus: (message: string) => void;
}

export const BuilderProRoomBackupPanel: FC<BuilderProRoomBackupPanelProps> = props =>
{
    const { onStatus } = props;
    const { roomSession = null } = useRoom();
    const roomId = roomSession?.roomId ?? 0;

    const [ backups, setBackups ] = useState<BuilderProRoomBackupSummary[]>([]);
    const [ selectedBackupId, setSelectedBackupId ] = useState<number | null>(null);
    const [ pin, setPin ] = useState('');
    const [ newPin, setNewPin ] = useState('');
    const [ pending, setPending ] = useState(false);

    const requestIdRef = useRef(0);
    const pendingRequestRef = useRef<number | null>(null);
    const timeoutRef = useRef<number | null>(null);

    const currentBackup = useMemo(
        () => backups.find(backup =>
            backup.activeRoomId === roomId &&
            backup.roomExists) ?? null,
        [ backups, roomId ]
    );

    const selectedBackup = useMemo(
        () => backups.find(backup =>
            backup.id === selectedBackupId) ?? null,
        [ backups, selectedBackupId ]
    );

    const send = useCallback((
        operation: number,
        backupId = 0,
        targetRoomId = 0,
        currentPin = '',
        nextPin = '') =>
    {
        if(pendingRequestRef.current !== null) return;

        requestIdRef.current++;

        if(requestIdRef.current > 2000000000)
        {
            requestIdRef.current = 1;
        }

        const requestId = requestIdRef.current;

        pendingRequestRef.current = requestId;
        setPending(true);

        SendMessageComposer(
            new BuilderProRoomBackupStateComposer(
                requestId,
                operation,
                backupId,
                targetRoomId,
                currentPin,
                nextPin
            )
        );

        if(timeoutRef.current !== null)
        {
            window.clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = window.setTimeout(() =>
        {
            timeoutRef.current = null;

            if(pendingRequestRef.current !== requestId) return;

            pendingRequestRef.current = null;
            setPending(false);
            onStatus('Sin respuesta al gestionar el backup.');
        }, 5000);
    }, [ onStatus ]);

    useMessageEvent<BuilderProRoomBackupStateEvent>(
        BuilderProRoomBackupStateEvent,
        event =>
        {
            const parser = event.getParser();

            if(!parser) return;
            if(parser.requestId !== pendingRequestRef.current) return;

            if(timeoutRef.current !== null)
            {
                window.clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }

            pendingRequestRef.current = null;
            setPending(false);

            const next = parser.backups;
            setBackups(next);

            setSelectedBackupId(current =>
            {
                if(current !== null && next.some(backup => backup.id === current))
                {
                    return current;
                }

                const currentRoomBackup =
                    next.find(backup =>
                        backup.activeRoomId === roomId &&
                        backup.roomExists);

                return currentRoomBackup?.id ?? next[0]?.id ?? null;
            });

            onStatus(
                parser.restoredRoomId > 0
                    ? `${ parser.message } Sala #${ parser.restoredRoomId }.`
                    : parser.message
            );

            if(parser.success)
            {
                setPin('');
                setNewPin('');
            }
        }
    );

    useEffect(() =>
    {
        send(OP_LIST);

        return () =>
        {
            if(timeoutRef.current !== null)
            {
                window.clearTimeout(timeoutRef.current);
            }
        };
    }, [ send ]);

    return (
        <details className="builder-pro-section" data-builder-pro-family="backup" open>
            <summary>Backup de sala</summary>

            <div className="builder-pro-section-body">
                <div className="builder-pro-hint">
                    Solo guarda y restaura tus furnis. Los furnis de otros jugadores nunca se tocan.
                </div>

                <select
                    className="builder-pro-group-select"
                    disabled={ pending || !backups.length }
                    value={ selectedBackupId ?? '' }
                    onChange={ event =>
                    {
                        const value = Number(event.target.value);

                        setSelectedBackupId(
                            Number.isSafeInteger(value) && value > 0
                                ? value
                                : null
                        );
                    } }>
                    { !backups.length &&
                        <option value="">Sin backups</option> }

                    { backups.map(backup =>
                        <option key={ backup.id } value={ backup.id }>
                            { `${ backup.roomName } · ${ backup.itemCount } furnis${ backup.roomExists ? '' : ' · sala eliminada' }` }
                        </option>
                    ) }
                </select>

                <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={ 12 }
                    placeholder="PIN actual"
                    disabled={ pending }
                    value={ pin }
                    onChange={ event =>
                        setPin(
                            event.target.value.replace(/\D/g, '').slice(0, 12)
                        )
                    } />

                <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={ 12 }
                    placeholder={
                        currentBackup
                            ? 'PIN nuevo'
                            : 'PIN nuevo (6-12 digitos)'
                    }
                    disabled={ pending }
                    value={ newPin }
                    onChange={ event =>
                        setNewPin(
                            event.target.value.replace(/\D/g, '').slice(0, 12)
                        )
                    } />

                <div className="builder-pro-grid-2">
                    { currentBackup
                        ? <button
                            type="button"
                            disabled={ pending || pin.length < 6 }
                            onClick={ () =>
                                send(
                                    OP_UPDATE,
                                    currentBackup.id,
                                    roomId,
                                    pin
                                )
                            }>
                            Actualizar backup
                        </button>
                        : <button
                            type="button"
                            disabled={
                                pending ||
                                roomId <= 0 ||
                                newPin.length < 6
                            }
                            onClick={ () =>
                                send(
                                    OP_CREATE,
                                    0,
                                    roomId,
                                    '',
                                    newPin
                                )
                            }>
                            Crear backup
                        </button> }

                    <button
                        type="button"
                        disabled={
                            pending ||
                            !selectedBackup ||
                            pin.length < 6
                        }
                        onClick={ () =>
                            selectedBackup &&
                            send(
                                OP_RESTORE,
                                selectedBackup.id,
                                0,
                                pin
                            )
                        }>
                        { selectedBackup?.roomExists
                            ? 'Restaurar'
                            : 'Recrear sala' }
                    </button>
                </div>

                <div className="builder-pro-grid-2">
                    <button
                        type="button"
                        disabled={
                            pending ||
                            !selectedBackup ||
                            pin.length < 6 ||
                            newPin.length < 6
                        }
                        onClick={ () =>
                            selectedBackup &&
                            send(
                                OP_CHANGE_PIN,
                                selectedBackup.id,
                                0,
                                pin,
                                newPin
                            )
                        }>
                        Cambiar PIN
                    </button>

                    <button
                        type="button"
                        disabled={
                            pending ||
                            !selectedBackup ||
                            pin.length < 6
                        }
                        onClick={ () =>
                            selectedBackup &&
                            send(
                                OP_DELETE,
                                selectedBackup.id,
                                0,
                                pin
                            )
                        }>
                        Eliminar backup
                    </button>
                </div>

                <button
                    type="button"
                    className="builder-pro-full"
                    disabled={ pending }
                    onClick={ () => send(OP_LIST) }>
                    Actualizar lista
                </button>

                <div className="builder-pro-hint">
                    { selectedBackup
                        ? `${ selectedBackup.updatedAt || 'Sin fecha' } · Sala original #${ selectedBackup.originalRoomId }`
                        : 'Un backup maximo por sala. Sobrescribir, restaurar o borrar requiere PIN.' }
                </div>

            </div>
        </details>
    );
};
