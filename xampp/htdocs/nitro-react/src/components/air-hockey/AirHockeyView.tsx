import { useEffect } from 'react';
import { AirHockeyCloseEvent, AirHockeyErrorEvent, AirHockeyOpenEvent, AirHockeyRoundEvent, AirHockeyStateEvent } from '@nitrots/nitro-renderer';
import { FC, PointerEvent as ReactPointerEvent, useRef, useState } from 'react';
import { LeaveAirHockey, MoveAirHockey, ReadyAirHockey } from '../../api';
import { NitroCardContentView, NitroCardHeaderView, NitroCardView } from '../../common';
import { useMessageEvent } from '../../hooks/events';
import './AirHockeyView.scss';

interface HockeyState
{
    playing: boolean;
    scoreLeft: number;
    scoreRight: number;
    puckX: number;
    puckY: number;
    puckVX: number;
    puckVY: number;
    leftX: number;
    leftY: number;
    rightX: number;
    rightY: number;
    playerLeft: number;
    playerRight: number;
    leftReady: boolean;
    rightReady: boolean;
}

const EMPTY_STATE: HockeyState = {
    playing: false,
    scoreLeft: 0,
    scoreRight: 0,
    puckX: 5000,
    puckY: 3000,
    puckVX: 0,
    puckVY: 0,
    leftX: 1800,
    leftY: 3000,
    rightX: 8200,
    rightY: 3000,
    playerLeft: 0,
    playerRight: 0,
    leftReady: false,
    rightReady: false
};

export const AirHockeyView: FC<{}> = () =>
{
    const [ isVisible, setIsVisible ] = useState(false);
    const [ errorOnly, setErrorOnly ] = useState(false);
    const [ itemId, setItemId ] = useState(0);
    const [ side, setSide ] = useState(0);
    const [ fieldWidth, setFieldWidth ] = useState(10000);
    const [ fieldHeight, setFieldHeight ] = useState(6000);
    const [ winScore, setWinScore ] = useState(7);
    const [ state, setState ] = useState<HockeyState>(EMPTY_STATE);
    // AIR_HOCKEY_V9_PUCK_PREDICTION
    const [ visualPuck, setVisualPuck ] = useState({ x: 5000, y: 3000 });
    const [ localMallet, setLocalMallet ] = useState<{ x: number; y: number } | null>(null);
    const [ status, setStatus ] = useState('Esperando rival...');

    const boardRef = useRef<HTMLDivElement>(null);
    const itemIdRef = useRef(0);
    const sideRef = useRef(0);
    const fieldWidthRef = useRef(10000);
    const fieldHeightRef = useRef(6000);
    const pointerDownRef = useRef(false);
    const lastMoveSentAtRef = useRef(0);
    const lastLocalPredictionAtRef = useRef(0);

    // AIR_HOCKEY_INPUT_V62_TRAILING_FLUSH
    const pendingServerMoveRef =
        useRef<{ x: number; y: number } | null>(null);

    const pendingServerMoveTimerRef =
        useRef<number | null>(null);

    // AIR_HOCKEY_INPUT_V6_GLOBAL_POINTER
    const localMalletRef = useRef<{ x: number; y: number } | null>(null);
    const playingRef = useRef(false);

    playingRef.current = state.playing;

    const applyLocalMallet = (value: { x: number; y: number } | null) =>
    {
        localMalletRef.current = value;
        setLocalMallet(value);
    };

    /*
     * V9: Arcturus sigue siendo autoritativo.
     * Este estado solo decide qué se dibuja entre snapshots.
     */
    const visualPuckRef =
        useRef({ x: 5000, y: 3000 });

    const visualPuckVelocityRef =
        useRef({ x: 0, y: 0 });

    const lastServerPuckRef =
        useRef({
            x: 5000,
            y: 3000,
            at: 0
        });

    const lastVisualFrameAtRef =
        useRef(0);

    const localImpactHoldUntilRef =
        useRef(0);

    const lastLocalMalletSampleRef =
        useRef({
            x: 0,
            y: 0,
            at: 0
        });

    const setVisualPuckV9 = (
        x: number,
        y: number) =>
    {
        visualPuckRef.current = { x, y };
        setVisualPuck({ x, y });
    };

    const clampVectorV9 = (
        x: number,
        y: number,
        maxLength: number) =>
    {
        const length = Math.hypot(x, y);

        if(
            length <= maxLength ||
            length < 0.000001
        )
        {
            return { x, y };
        }

        const scale =
            maxLength / length;

        return {
            x: x * scale,
            y: y * scale
        };
    };

    const clampPuckSpeedV9 = () =>
    {
        const velocity =
            visualPuckVelocityRef.current;

        const speed =
            Math.hypot(
                velocity.x,
                velocity.y
            );

        const maxSpeed = 22000;

        if(speed <= maxSpeed || speed < 0.000001)
            return;

        const scale =
            maxSpeed / speed;

        velocity.x *= scale;
        velocity.y *= scale;
    };

    const syncAuthoritativePuckV9 = (
        next: HockeyState) =>
    {
        const now = performance.now();

        const previous =
            lastServerPuckRef.current;

        const elapsedMs =
            previous.at > 0
                ? now - previous.at
                : 0;

        const dx =
            next.puckX - previous.x;

        const dy =
            next.puckY - previous.y;

        const teleport =
            Math.hypot(dx, dy) > 1400;

        if(
            !next.playing ||
            previous.at <= 0 ||
            teleport
        )
        {
            visualPuckVelocityRef.current =
                { x: 0, y: 0 };

            setVisualPuckV9(
                next.puckX,
                next.puckY
            );
        }
        else if(elapsedMs >= 2 && elapsedMs <= 100)
        {
            const seconds =
                elapsedMs / 1000;

            const measured =
                clampVectorV9(
                    dx / seconds,
                    dy / seconds,
                    22000
                );

            const currentVelocity =
                visualPuckVelocityRef.current;

            visualPuckVelocityRef.current =
            {
                x:
                    (currentVelocity.x * 0.25) +
                    (measured.x * 0.75),

                y:
                    (currentVelocity.y * 0.25) +
                    (measured.y * 0.75)
            };

            /*
             * Durante unos milisegundos después de un golpe local,
             * ignorar snapshots que todavía representan el pre-impacto.
             */
            if(now >= localImpactHoldUntilRef.current)
            {
                const visual =
                    visualPuckRef.current;

                const errorX =
                    next.puckX - visual.x;

                const errorY =
                    next.puckY - visual.y;

                const error =
                    Math.hypot(errorX, errorY);

                if(error > 900)
                {
                    setVisualPuckV9(
                        next.puckX,
                        next.puckY
                    );
                }
                else
                {
                    setVisualPuckV9(
                        visual.x +
                            (errorX * 0.28),

                        visual.y +
                            (errorY * 0.28)
                    );
                }
            }
        }

        lastServerPuckRef.current =
        {
            x: next.puckX,
            y: next.puckY,
            at: now
        };
    };

    const predictLocalMalletHitV9 = (
        from: { x: number; y: number },
        to: { x: number; y: number }) =>
    {
        if(!playingRef.current) return;

        const puck =
            visualPuckRef.current;

        const now =
            performance.now();

        const previousSample =
            lastLocalMalletSampleRef.current;

        let elapsed =
            previousSample.at > 0
                ? (now - previousSample.at) / 1000
                : 1 / 120;

        elapsed =
            Math.max(
                1 / 240,
                Math.min(
                    1 / 30,
                    elapsed
                )
            );

        const rawVelocity =
            clampVectorV9(
                (to.x - from.x) / elapsed,
                (to.y - from.y) / elapsed,
                18500
            );

        lastLocalMalletSampleRef.current =
        {
            x: to.x,
            y: to.y,
            at: now
        };

        const moveX =
            to.x - from.x;

        const moveY =
            to.y - from.y;

        const startX =
            from.x - puck.x;

        const startY =
            from.y - puck.y;

        const solidRadius =
            380 + 180 + 1.5;

        const a =
            (moveX * moveX) +
            (moveY * moveY);

        let contactT: number | null = null;

        const startDistanceSq =
            (startX * startX) +
            (startY * startY);

        if(
            startDistanceSq <=
            solidRadius * solidRadius
        )
        {
            contactT = 0;
        }
        else if(a > 0.000001)
        {
            const b =
                2 *
                (
                    (startX * moveX) +
                    (startY * moveY)
                );

            const c =
                startDistanceSq -
                (solidRadius * solidRadius);

            const discriminant =
                (b * b) -
                (4 * a * c);

            if(discriminant >= 0)
            {
                const root =
                    Math.sqrt(discriminant);

                const first =
                    (-b - root) /
                    (2 * a);

                if(first >= 0 && first <= 1)
                    contactT = first;
            }
        }

        if(contactT === null) return;

        const malletX =
            from.x +
            (moveX * contactT);

        const malletY =
            from.y +
            (moveY * contactT);

        let nx =
            puck.x - malletX;

        let ny =
            puck.y - malletY;

        let normalLength =
            Math.hypot(nx, ny);

        if(normalLength < 0.00001)
        {
            nx =
                rawVelocity.x !== 0
                    ? Math.sign(rawVelocity.x)
                    : (sideRef.current < 0 ? 1 : -1);

            ny = 0;
            normalLength = 1;
        }

        nx /= normalLength;
        ny /= normalLength;

        const correctedX =
            malletX +
            (nx * solidRadius);

        const correctedY =
            malletY +
            (ny * solidRadius);

        setVisualPuckV9(
            correctedX,
            correctedY
        );

        const velocity =
            visualPuckVelocityRef.current;

        const effectiveMX =
            rawVelocity.x * 0.68;

        const effectiveMY =
            rawVelocity.y * 0.68;

        const puckNormal =
            (velocity.x * nx) +
            (velocity.y * ny);

        const malletNormal =
            (effectiveMX * nx) +
            (effectiveMY * ny);

        const relativeNormal =
            puckNormal -
            malletNormal;

        if(relativeNormal < 0)
        {
            const targetNormal =
                malletNormal +
                (
                    0.72 *
                    (
                        malletNormal -
                        puckNormal
                    )
                );

            const delta =
                targetNormal -
                puckNormal;

            velocity.x +=
                delta * nx;

            velocity.y +=
                delta * ny;

            clampPuckSpeedV9();
        }

        localImpactHoldUntilRef.current =
            now + 55;
    };

    const closeLocal = () =>
    {
        pointerDownRef.current = false;
        lastLocalPredictionAtRef.current = 0;

        pendingServerMoveRef.current = null;

        if(
            pendingServerMoveTimerRef.current !==
            null
        )
        {
            window.clearTimeout(
                pendingServerMoveTimerRef.current
            );

            pendingServerMoveTimerRef.current =
                null;
        }
        itemIdRef.current = 0;
        sideRef.current = 0;
        setIsVisible(false);
        setErrorOnly(false);
        setItemId(0);
        setSide(0);
        applyLocalMallet(null);
        setState(EMPTY_STATE);
    };

    const leave = () =>
    {
        const currentItemId = itemIdRef.current;
        if(currentItemId > 0 && !errorOnly) LeaveAirHockey(currentItemId);
        closeLocal();
    };

    useMessageEvent(AirHockeyOpenEvent, (event: AirHockeyOpenEvent) =>
    {
        const parser = event.getParser();
        console.log('[AH-CLIENT-TRACE] VIEW_OPEN_6003', { itemId: parser.itemId, side: parser.side, fieldWidth: parser.fieldWidth, fieldHeight: parser.fieldHeight, winScore: parser.winScore, playerLeft: parser.playerLeft, playerRight: parser.playerRight });

        itemIdRef.current = parser.itemId;
        sideRef.current = parser.side;
        fieldWidthRef.current = parser.fieldWidth;
        fieldHeightRef.current = parser.fieldHeight;

        setItemId(parser.itemId);
        setSide(parser.side);
        setFieldWidth(parser.fieldWidth);
        setFieldHeight(parser.fieldHeight);
        setWinScore(parser.winScore);
        setState(previous => ({
            ...previous,
            playerLeft: parser.playerLeft,
            playerRight: parser.playerRight
        }));
        applyLocalMallet(null);
        setStatus(parser.playerLeft > 0 && parser.playerRight > 0 ? 'Pulsa LISTO para comenzar.' : 'Esperando rival...');
        setErrorOnly(false);
        setIsVisible(true);
    });

    useMessageEvent(AirHockeyStateEvent, (event: AirHockeyStateEvent) =>
    {
        const parser = event.getParser();
        if(parser.itemId !== itemIdRef.current) return;

        const next: HockeyState = {
            playing: parser.playing,
            scoreLeft: parser.scoreLeft,
            scoreRight: parser.scoreRight,
            puckX: parser.puckX,
            puckY: parser.puckY,
            puckVX: parser.puckVX,
            puckVY: parser.puckVY,
            leftX: parser.leftX,
            leftY: parser.leftY,
            rightX: parser.rightX,
            rightY: parser.rightY,
            playerLeft: parser.playerLeft,
            playerRight: parser.playerRight,
            leftReady: parser.leftReady,
            rightReady: parser.rightReady
        };

        setState(next);

        syncAuthoritativePuckV9(next);

        /*
         * AIR_HOCKEY_INPUT_V61_NO_LOCAL_SNAP
         *
         * Durante una partida el STATE del servidor NUNCA pisa la posición
         * visual de nuestro propio mazo. El ratón es la fuente visual local.
         *
         * El servidor sigue siendo autoritativo para puck/colisiones y para
         * la posición que recibe el rival.
         *
         * Solo inicializamos/reconciliamos desde servidor cuando no estamos
         * jugando o todavía no existe una posición local.
         */
        if(!next.playing || !localMalletRef.current)
        {
            applyLocalMallet(sideRef.current < 0
                ? { x: next.leftX, y: next.leftY }
                : { x: next.rightX, y: next.rightY });
        }

        if(!next.playerLeft || !next.playerRight) setStatus('Esperando rival...');
        else if(!next.playing && !(sideRef.current < 0 ? next.leftReady : next.rightReady)) setStatus('Pulsa LISTO para comenzar.');
    });

    useMessageEvent(AirHockeyRoundEvent, (event: AirHockeyRoundEvent) =>
    {
        const parser = event.getParser();
        if(parser.itemId !== itemIdRef.current) return;

        setState(previous => ({ ...previous, scoreLeft: parser.scoreLeft, scoreRight: parser.scoreRight }));

        switch(parser.event)
        {
            case 'start':
                setStatus('¡Partida!');
                break;
            case 'goal':
                setStatus(parser.side === sideRef.current ? '¡Gol!' : 'Gol del rival.');
                break;
            case 'finished':
                setStatus(parser.side === sideRef.current ? '¡Has ganado!' : 'Ha ganado el rival.');
                break;
            case 'opponent_left':
                setStatus('El rival ha abandonado la mesa.');
                break;
            case 'ready':
                setStatus('Esperando a que ambos estén listos...');
                break;
        }
    });

    useMessageEvent(AirHockeyCloseEvent, (event: AirHockeyCloseEvent) =>
    {
        const parser = event.getParser();
        if(parser.itemId !== itemIdRef.current) return;
        closeLocal();
    });

    useMessageEvent(AirHockeyErrorEvent, (event: AirHockeyErrorEvent) =>
    {
        const parser = event.getParser();

        if(itemIdRef.current > 0 && parser.itemId !== itemIdRef.current) return;

        if(itemIdRef.current <= 0)
        {
            itemIdRef.current = parser.itemId;
            setItemId(parser.itemId);
            setErrorOnly(true);
            setIsVisible(true);
        }

        setStatus(parser.reason || 'No se pudo usar esta mesa.');
    });

    const ready = () =>
    {
        if(itemId <= 0 || state.playing) return;
        ReadyAirHockey(itemId);
        setStatus('Listo. Esperando al rival...');
    };

    const flushPendingServerMove = () =>
    {
        pendingServerMoveTimerRef.current = null;

        const pending =
            pendingServerMoveRef.current;

        if(
            !pending ||
            !playingRef.current ||
            itemIdRef.current <= 0
        )
        {
            pendingServerMoveRef.current = null;
            return;
        }

        pendingServerMoveRef.current = null;
        lastMoveSentAtRef.current =
            performance.now();

        MoveAirHockey(
            itemIdRef.current,
            pending.x,
            pending.y
        );
    };

    const queueServerMove = (
        x: number,
        y: number) =>
    {
        /*
         * Siempre guardar el target MÁS NUEVO.
         * Nunca se descarta el último evento del ratón.
         */
        pendingServerMoveRef.current =
            { x, y };

        if(
            pendingServerMoveTimerRef.current !==
            null
        )
        {
            return;
        }

        const now = performance.now();
        const elapsed =
            now - lastMoveSentAtRef.current;

        if(elapsed >= 8)
        {
            flushPendingServerMove();
            return;
        }

        const wait =
            Math.max(0, 8 - elapsed);

        /*
         * Trailing edge:
         * aunque no llegue otro pointermove,
         * este timer enviará el último target.
         */
        pendingServerMoveTimerRef.current =
            window.setTimeout(
                flushPendingServerMove,
                wait
            );
    };

    const moveFromClientPoint = (
        clientX: number,
        clientY: number,
        pointerType: string = 'mouse') =>
    {
        if(
            !playingRef.current ||
            itemIdRef.current <= 0 ||
            !boardRef.current
        ) return;

        if(pointerType !== 'mouse' && !pointerDownRef.current) return;

        const rect =
            boardRef.current.getBoundingClientRect();

        if(rect.width <= 0 || rect.height <= 0) return;

        const width = fieldWidthRef.current;
        const height = fieldHeightRef.current;
        const radius = 380;

        let x =
            ((clientX - rect.left) / rect.width) *
            width;

        let y =
            ((clientY - rect.top) / rect.height) *
            height;

        y = Math.max(
            radius,
            Math.min(height - radius, y)
        );

        if(sideRef.current < 0)
        {
            x = Math.max(
                radius,
                Math.min(
                    (width / 2) - radius,
                    x
                )
            );
        }
        else
        {
            x = Math.max(
                (width / 2) + radius,
                Math.min(
                    width - radius,
                    x
                )
            );
        }

        /*
         * V7 standalone core:
         * el mazo propio se dibuja exactamente en el target del ratón.
         * No existe una segunda física visual en Nitro.
         */
        const previousLocalMallet =
            localMalletRef.current ||
            (
                sideRef.current < 0
                    ? {
                        x: state.leftX,
                        y: state.leftY
                    }
                    : {
                        x: state.rightX,
                        y: state.rightY
                    }
            );

        predictLocalMalletHitV9(
            previousLocalMallet,
            { x, y }
        );

        applyLocalMallet({ x, y });
        lastLocalPredictionAtRef.current =
            performance.now();

        /*
         * V6.2:
         * servidor recibe el target real del cursor.
         * Se limita a ~60 Hz pero el ÚLTIMO target nunca se pierde.
         */
        queueServerMove(
            x,
            y
        );
    };

    const moveFromPointer = (
        event: ReactPointerEvent<HTMLDivElement>) =>
    {
        /*
         * El ratón se procesa por el listener global.
         * Este handler queda para touch/pen mientras están pulsados.
         */
        if(event.pointerType === 'mouse') return;

        event.preventDefault();
        event.stopPropagation();

        moveFromClientPoint(
            event.clientX,
            event.clientY,
            event.pointerType
        );
    };

    const pointerDown = (
        event: ReactPointerEvent<HTMLDivElement>) =>
    {
        if(!playingRef.current) return;

        event.preventDefault();
        event.stopPropagation();

        /*
         * Mouse ya no cambia de modo al hacer clic.
         * Click y no-click usan exactamente el mismo tracking global.
         */
        if(event.pointerType === 'mouse') return;

        pointerDownRef.current = true;

        moveFromClientPoint(
            event.clientX,
            event.clientY,
            event.pointerType
        );
    };

    const pointerUp = (
        event: ReactPointerEvent<HTMLDivElement>) =>
    {
        if(event.pointerType === 'mouse') return;

        event.preventDefault();
        event.stopPropagation();

        pointerDownRef.current = false;
    };

    useEffect(() =>
    {
        const onGlobalPointerMove = (
            event: globalThis.PointerEvent) =>
        {
            if(
                !playingRef.current ||
                event.pointerType !== 'mouse'
            ) return;

            /*
             * Si el puntero está físicamente sobre el canvas de la sala,
             * cortar el evento ANTES de RoomView.canvas.onmousemove.
             * El minijuego tiene el foco mientras se está jugando.
             */
            if(event.target instanceof HTMLCanvasElement)
            {
                if(event.cancelable)
                    event.preventDefault();

                event.stopPropagation();
            }

            moveFromClientPoint(
                event.clientX,
                event.clientY,
                'mouse'
            );
        };

        window.addEventListener(
            'pointermove',
            onGlobalPointerMove,
            true
        );

        return () =>
        {
            window.removeEventListener(
                'pointermove',
                onGlobalPointerMove,
                true
            );
        };
    }, []);

    useEffect(() =>
    {
        let frameId = 0;

        const frame = (now: number) =>
        {
            const last =
                lastVisualFrameAtRef.current;

            lastVisualFrameAtRef.current = now;

            if(
                playingRef.current &&
                last > 0
            )
            {
                const dt =
                    Math.max(
                        0,
                        Math.min(
                            1 / 30,
                            (now - last) / 1000
                        )
                    );

                if(dt > 0)
                {
                    const puck =
                        visualPuckRef.current;

                    const velocity =
                        visualPuckVelocityRef.current;

                    let x =
                        puck.x +
                        (velocity.x * dt);

                    let y =
                        puck.y +
                        (velocity.y * dt);

                    const radius = 180;

                    if(y < radius)
                    {
                        y = radius;

                        if(velocity.y < 0)
                            velocity.y =
                                -velocity.y * 0.90;
                    }

                    if(
                        y >
                        fieldHeightRef.current -
                            radius
                    )
                    {
                        y =
                            fieldHeightRef.current -
                            radius;

                        if(velocity.y > 0)
                            velocity.y =
                                -velocity.y * 0.90;
                    }

                    const goalTop =
                        (fieldHeightRef.current / 2) -
                        1040;

                    const goalBottom =
                        (fieldHeightRef.current / 2) +
                        1040;

                    const inGoalMouth =
                        y > goalTop + radius &&
                        y < goalBottom - radius;

                    if(!inGoalMouth)
                    {
                        if(x < radius)
                        {
                            x = radius;

                            if(velocity.x < 0)
                                velocity.x =
                                    -velocity.x * 0.90;
                        }

                        if(
                            x >
                            fieldWidthRef.current -
                                radius
                        )
                        {
                            x =
                                fieldWidthRef.current -
                                radius;

                            if(velocity.x > 0)
                                velocity.x =
                                    -velocity.x * 0.90;
                        }
                    }

                    const damping =
                        Math.exp(-0.34 * dt);

                    velocity.x *= damping;
                    velocity.y *= damping;

                    clampPuckSpeedV9();

                    setVisualPuckV9(x, y);
                }
            }
            else
            {
                lastVisualFrameAtRef.current = now;
            }

            frameId =
                window.requestAnimationFrame(frame);
        };

        frameId =
            window.requestAnimationFrame(frame);

        return () =>
        {
            window.cancelAnimationFrame(frameId);
            lastVisualFrameAtRef.current = 0;
        };
    }, []);

    if(!isVisible) return null;

    const ownReady = side < 0 ? state.leftReady : state.rightReady;
    const bothPlayers = state.playerLeft > 0 && state.playerRight > 0;
    const ownMallet = localMallet || (side < 0
        ? { x: state.leftX, y: state.leftY }
        : { x: state.rightX, y: state.rightY });

    const leftMallet = side < 0 ? ownMallet : { x: state.leftX, y: state.leftY };
    const rightMallet = side > 0 ? ownMallet : { x: state.rightX, y: state.rightY };

    const pos = (x: number, y: number) => ({
        left: `${ (x / fieldWidth) * 100 }%`,
        top: `${ (y / fieldHeight) * 100 }%`
    });

    return (
        <NitroCardView
            uniqueKey="holo-air-hockey"
            className="nitro-air-hockey"
            theme="primary-slim"
            style={ { width: '680px' } }>
            <NitroCardHeaderView
                headerText={ errorOnly ? 'Air Hockey' : `Air Hockey · primero a ${ winScore }` }
                onCloseClick={ leave } />
            <NitroCardContentView gap={ 0 } className="air-hockey-content">
                { errorOnly
                    ? <div className="air-hockey-error">{ status }</div>
                    : <>
                        <div className="air-hockey-scorebar">
                            <div className={ `air-hockey-player is-left${ side < 0 ? ' is-you' : '' }` }>
                                <span>{ state.playerLeft > 0 ? `Jugador ${ state.playerLeft }` : 'Esperando...' }</span>
                                <strong>{ state.scoreLeft }</strong>
                                <small>{ state.leftReady ? 'LISTO' : 'NO LISTO' }</small>
                            </div>
                            <div className="air-hockey-status">{ status }</div>
                            <div className={ `air-hockey-player is-right${ side > 0 ? ' is-you' : '' }` }>
                                <span>{ state.playerRight > 0 ? `Jugador ${ state.playerRight }` : 'Esperando...' }</span>
                                <strong>{ state.scoreRight }</strong>
                                <small>{ state.rightReady ? 'LISTO' : 'NO LISTO' }</small>
                            </div>
                        </div>

                        <div
                            ref={ boardRef }
                            className={ `air-hockey-board${ state.playing ? ' is-playing' : '' }` }
                            data-air-hockey-engine="v9-puck-prediction"
                            onPointerDown={ pointerDown }
                            onPointerMove={ moveFromPointer }
                            onPointerUp={ pointerUp }
                            onPointerCancel={ pointerUp }>
                            <div className="air-hockey-half is-left" />
                            <div className="air-hockey-half is-right" />
                            <div className="air-hockey-center-line" />
                            <div className="air-hockey-center-circle" />
                            <div className="air-hockey-goal is-left" />
                            <div className="air-hockey-goal is-right" />

                            <div className="air-hockey-mallet is-left" style={ pos(leftMallet.x, leftMallet.y) } />
                            <div className="air-hockey-mallet is-right" style={ pos(rightMallet.x, rightMallet.y) } />
                            <div className="air-hockey-puck" style={ pos(visualPuck.x, visualPuck.y) } />
                        </div>

                        <div className="air-hockey-controls">
                            <span className="air-hockey-side-label">Tu lado: { side < 0 ? 'izquierdo' : 'derecho' }</span>
                            <button
                                type="button"
                                className="air-hockey-ready-button"
                                disabled={ state.playing || ownReady || !bothPlayers }
                                onClick={ ready }>
                                { state.playing ? 'EN PARTIDA' : ownReady ? 'LISTO' : bothPlayers ? 'LISTO' : 'ESPERANDO RIVAL' }
                            </button>
                        </div>
                    </> }
            </NitroCardContentView>
        </NitroCardView>
    );
};
