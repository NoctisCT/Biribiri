import {
    ArcadeCloseEvent,
    ArcadeGameStartComposer,
    ArcadeGameStartedEvent,
    ArcadeLeaderboardEvent,
    ArcadeScoreSubmitComposer,
    SnakeOpenEvent
} from '@nitrots/nitro-renderer';
import { FC, useEffect, useRef, useState } from 'react';
import { NitroCardContentView, NitroCardHeaderView, NitroCardView } from '../../common';
import { SendMessageComposer } from '../../api';
import { useMessageEvent } from '../../hooks/events';
import { ArcadeLeaderboardView } from '../arcade/ArcadeLeaderboardView';
import './SnakeView.scss';

type GamePhase = 'ready' | 'playing' | 'paused' | 'gameover';
type Direction = 'left' | 'right' | 'up' | 'down';
type ServerResultState = 'idle' | 'accepted' | 'rejected';

interface Point { x: number; y: number; }
interface LeaderboardEntry { rank: number; username: string; score: number; level: number; }

interface GameModel
{
    phase: GamePhase;
    snake: Point[];
    direction: Direction;
    queuedDirection: Direction;
    food: Point;
    score: number;
    level: number;
    foods: number;
    tickAccum: number;
    elapsed: number;
    feedback: string;
    feedbackTime: number;
}

const GAME_KEY = 'snake';
const IDENTITY_PATCH_MARKER = 'BIRIBIRI_SNAKE_IDENTITY_PATCH_V3';
const UI_MARKER = 'BIRIBIRI_SNAKE_V3_PHOSPHOR_IDENTITY|BIRIBIRI_SNAKE_TARGETED_FINAL_V1|BIRIBIRI_SNAKE_VISIBLE_FIX_V2';
const COLS = 32;
const ROWS = 22;
const CELL = 20;
const BOARD_W = COLS * CELL;
const BOARD_H = ROWS * CELL;
const MAX_LEVEL = 100;

const DIR_VECTOR: Record<Direction, Point> = {
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 }
};

const OPPOSITE: Record<Direction, Direction> = {
    left: 'right', right: 'left', up: 'down', down: 'up'
};

const samePoint = (a: Point, b: Point): boolean => a.x === b.x && a.y === b.y;

const initialSnake = (): Point[] => [
    { x: 16, y: 11 },
    { x: 15, y: 11 },
    { x: 14, y: 11 }
];

const spawnFood = (snake: Point[]): Point =>
{
    const free: Point[] = [];

    for(let y = 1; y < ROWS - 1; y++)
    {
        for(let x = 1; x < COLS - 1; x++)
        {
            const point = { x, y };

            if(!snake.some(segment => samePoint(segment, point)))
                free.push(point);
        }
    }

    return free[Math.floor(Math.random() * free.length)] || { x: 2, y: 2 };
};

const freshGame = (phase: GamePhase = 'ready'): GameModel =>
{
    const snake = initialSnake();

    return {
        phase,
        snake,
        direction: 'right',
        queuedDirection: 'right',
        food: spawnFood(snake),
        score: 0,
        level: 1,
        foods: 0,
        tickAccum: 0,
        elapsed: 0,
        feedback: '',
        feedbackTime: 0
    };
};

const stepMsForLevel = (level: number): number =>
    Math.max(62, 148 - ((Math.max(1, level) - 1) * 6));

const SnakeHudIcon: FC<{ active?: boolean }> = ({ active = true }) =>
(
    <div className={ `snake-hud-icon${ active ? ' is-on' : '' }` } aria-hidden="true">
        <span /><span /><span /><span /><span className="is-head" />
    </div>
);

export const SnakeView: FC<{}> = () =>
{
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const visibleRef = useRef(false);
    const gameRef = useRef<GameModel>(freshGame());
    const itemIdRef = useRef(0);
    const runTokenRef = useRef('');
    const submittedRunRef = useRef(false);
    const startPendingRef = useRef(false);
    const lastFrameRef = useRef(0);
    const soundEnabledRef = useRef(true);
    const audioRef = useRef<AudioContext | null>(null);

    const [ isVisible, setIsVisible ] = useState(false);
    const [ score, setScore ] = useState(0);
    const [ level, setLevel ] = useState(1);
    const [ foods, setFoods ] = useState(0);
    const [ length, setLength ] = useState(3);
    const [ phase, setPhase ] = useState<GamePhase>('ready');
    const [ soundEnabled, setSoundEnabled ] = useState(true);
    const [ startPending, setStartPending ] = useState(false);
    const [ leaderboard, setLeaderboard ] = useState<LeaderboardEntry[]>([]);
    const [ serverBest, setServerBest ] = useState(0);
    const [ personalRank, setPersonalRank ] = useState(0);
    const [ totalPlayers, setTotalPlayers ] = useState(0);
    const [ recordsOpen, setRecordsOpen ] = useState(false);
    const [ resultState, setResultState ] = useState<ServerResultState>('idle');
    const [ resultMessage, setResultMessage ] = useState('');
    const [ newServerRecord, setNewServerRecord ] = useState(false);
    const [ feedbackRevision, setFeedbackRevision ] = useState(0);
    const feedbackTimerRef = useRef<number | null>(null);

    const ensureAudio = (): AudioContext | null =>
    {
        if(!soundEnabledRef.current) return null;

        try
        {
            if(!audioRef.current)
            {
                const AudioContextClass =
                    window.AudioContext || (window as any).webkitAudioContext;

                if(!AudioContextClass) return null;
                audioRef.current = new AudioContextClass();
            }

            if(audioRef.current.state === 'suspended')
                void audioRef.current.resume();

            return audioRef.current;
        }
        catch
        {
            return null;
        }
    };

    const tone = (
        frequency: number,
        duration: number,
        type: OscillatorType = 'square',
        volume = 0.025,
        delay = 0,
        endFrequency?: number) =>
    {
        const context = ensureAudio();
        if(!context) return;

        const start = context.currentTime + delay;
        const oscillator = context.createOscillator();
        const gain = context.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(Math.max(1, frequency), start);

        if(endFrequency !== undefined)
        {
            oscillator.frequency.exponentialRampToValueAtTime(
                Math.max(1, endFrequency),
                start + duration
            );
        }

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(
            Math.max(0.0001, Math.min(0.1, volume)),
            start + 0.004
        );
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + duration + 0.02);
    };

    const playStart = () =>
    {
        tone(220, 0.06, 'square', 0.02);
        tone(330, 0.06, 'square', 0.024, 0.07);
        tone(494, 0.10, 'square', 0.028, 0.14);
    };

    const playFood = () => tone(520, 0.045, 'square', 0.025, 0, 760);

    const playLevel = () =>
    {
        tone(392, 0.06, 'square', 0.025);
        tone(523, 0.06, 'square', 0.027, 0.07);
        tone(784, 0.11, 'square', 0.03, 0.14);
    };

    const playGameOver = () =>
    {
        tone(260, 0.12, 'sawtooth', 0.028, 0, 130);
        tone(120, 0.20, 'square', 0.024, 0.10, 58);
    };

    const syncHud = () =>
    {
        const game = gameRef.current;
        setScore(game.score);
        setLevel(game.level);
        setFoods(game.foods);
        setLength(game.snake.length);
        setPhase(game.phase);
    };

    const cancelFeedbackTimer = () =>
    {
        if(feedbackTimerRef.current !== null)
        {
            window.clearTimeout(feedbackTimerRef.current);
            feedbackTimerRef.current = null;
        }
    };

    const scheduleFeedbackClear = (ms: number) =>
    {
        cancelFeedbackTimer();

        feedbackTimerRef.current = window.setTimeout(() =>
        {
            gameRef.current.feedback = '';
            gameRef.current.feedbackTime = 0;
            feedbackTimerRef.current = null;
            setFeedbackRevision(value => value + 1);
        }, ms);
    };

    const resetReadyGame = () =>
    {
        cancelFeedbackTimer();
        gameRef.current = freshGame('ready');
        runTokenRef.current = '';
        submittedRunRef.current = false;
        startPendingRef.current = false;
        lastFrameRef.current = 0;
        setStartPending(false);
        setResultState('idle');
        setResultMessage('');
        setNewServerRecord(false);
        syncHud();
    };

    const beginLocalRun = (token: string) =>
    {
        const game = freshGame('playing');
        game.feedback = 'NIVEL 1';
        game.feedbackTime = 1.0;

        gameRef.current = game;
        scheduleFeedbackClear(1000);
        runTokenRef.current = token;
        submittedRunRef.current = false;
        lastFrameRef.current = performance.now();

        setResultState('idle');
        setResultMessage('');
        setNewServerRecord(false);
        syncHud();
        playStart();

        window.setTimeout(() => canvasRef.current?.focus(), 0);
    };

    const requestStartGame = () =>
    {
        if(!visibleRef.current || itemIdRef.current <= 0 || startPendingRef.current)
            return;

        ensureAudio();
        startPendingRef.current = true;
        setStartPending(true);
        setResultState('idle');
        setResultMessage('');
        setNewServerRecord(false);

        SendMessageComposer(new ArcadeGameStartComposer(itemIdRef.current, GAME_KEY));
    };

    const submitRunResult = (finalScore: number, finalLevel: number) =>
    {
        if(submittedRunRef.current || !runTokenRef.current || itemIdRef.current <= 0)
            return;

        submittedRunRef.current = true;

        SendMessageComposer(
            new ArcadeScoreSubmitComposer(
                itemIdRef.current,
                GAME_KEY,
                runTokenRef.current,
                finalScore,
                finalLevel
            )
        );
    };

    const close = () =>
    {
        visibleRef.current = false;
        runTokenRef.current = '';
        submittedRunRef.current = false;
        startPendingRef.current = false;
        setStartPending(false);
        setRecordsOpen(false);
        setIsVisible(false);

        if(gameRef.current.phase === 'playing')
            gameRef.current.phase = 'paused';
    };

    const togglePause = () =>
    {
        const game = gameRef.current;

        if(game.phase === 'playing')
            game.phase = 'paused';
        else if(game.phase === 'paused')
        {
            game.phase = 'playing';
            lastFrameRef.current = performance.now();
        }
        else return;

        setPhase(game.phase);
    };

    const toggleSound = () =>
    {
        const next = !soundEnabledRef.current;
        soundEnabledRef.current = next;
        setSoundEnabled(next);

        if(next)
        {
            ensureAudio();
            tone(520, 0.06, 'square', 0.025);
        }
    };

    const openRecords = () =>
    {
        if(gameRef.current.phase === 'playing')
        {
            gameRef.current.phase = 'paused';
            setPhase('paused');
        }

        setRecordsOpen(true);
    };

    const closeRecords = () =>
    {
        setRecordsOpen(false);
        window.setTimeout(() => canvasRef.current?.focus(), 0);
    };

    useMessageEvent(SnakeOpenEvent, (event: SnakeOpenEvent) =>
    {
        const parser = event.getParser();

        itemIdRef.current = parser.itemId;
        resetReadyGame();
        setLeaderboard([]);
        setServerBest(0);
        setPersonalRank(0);
        setTotalPlayers(0);
        setRecordsOpen(false);

        visibleRef.current = true;
        setIsVisible(true);

        window.setTimeout(() => canvasRef.current?.focus(), 0);
    });

    useMessageEvent(ArcadeGameStartedEvent, (event: ArcadeGameStartedEvent) =>
    {
        const parser = event.getParser();

        if(
            !visibleRef.current ||
            parser.gameKey !== GAME_KEY ||
            parser.itemId !== itemIdRef.current
        ) return;

        startPendingRef.current = false;
        setStartPending(false);

        if(!parser.success)
        {
            setResultState('rejected');
            setResultMessage(parser.message || 'No se pudo iniciar la partida.');
            return;
        }

        beginLocalRun(parser.token);
    });

    useMessageEvent(ArcadeLeaderboardEvent, (event: ArcadeLeaderboardEvent) =>
    {
        const parser = event.getParser();
        if(parser.gameKey !== GAME_KEY) return;

        setLeaderboard(
            parser.entries.map(entry => ({
                rank: entry.rank,
                username: entry.username,
                score: entry.score,
                level: entry.level
            }))
        );
        setPersonalRank(parser.personalRank);
        setTotalPlayers(parser.totalPlayers);
        setServerBest(parser.personalBest);

        if(parser.context === 1)
        {
            setResultState('accepted');
            setResultMessage(parser.message || 'Puntuación registrada.');
            setNewServerRecord(parser.newRecord);
        }
        else if(parser.context === 2)
        {
            setResultState('rejected');
            setResultMessage(parser.message || 'La puntuación no pudo validarse.');
            setNewServerRecord(false);
        }
    });

    useMessageEvent(ArcadeCloseEvent, (event: ArcadeCloseEvent) =>
    {
        const parser = event.getParser();

        if(parser.gameKey !== GAME_KEY || parser.itemId !== itemIdRef.current)
            return;

        visibleRef.current = false;
        runTokenRef.current = '';
        submittedRunRef.current = false;
        startPendingRef.current = false;
        setStartPending(false);
        setRecordsOpen(false);
        setIsVisible(false);
    });

    useEffect(() =>
    {
        const down = (event: KeyboardEvent) =>
        {
            if(!visibleRef.current) return;

            const handled = [
                'ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp',
                'KeyA', 'KeyD', 'KeyS', 'KeyW',
                'Enter', 'KeyP', 'Escape'
            ].includes(event.code);

            if(handled) event.preventDefault();

            if(event.code === 'Enter')
            {
                if(gameRef.current.phase === 'ready' || gameRef.current.phase === 'gameover')
                    requestStartGame();
                return;
            }

            if(event.code === 'KeyP' || event.code === 'Escape')
            {
                togglePause();
                return;
            }

            if(gameRef.current.phase !== 'playing') return;

            let next: Direction | null = null;

            if(event.code === 'ArrowLeft' || event.code === 'KeyA') next = 'left';
            else if(event.code === 'ArrowRight' || event.code === 'KeyD') next = 'right';
            else if(event.code === 'ArrowUp' || event.code === 'KeyW') next = 'up';
            else if(event.code === 'ArrowDown' || event.code === 'KeyS') next = 'down';

            if(next && next !== OPPOSITE[gameRef.current.direction])
                gameRef.current.queuedDirection = next;
        };

        const blur = () =>
        {
            if(visibleRef.current && gameRef.current.phase === 'playing')
            {
                gameRef.current.phase = 'paused';
                setPhase('paused');
            }
        };

        window.addEventListener('keydown', down, { passive: false });
        window.addEventListener('blur', blur);

        return () =>
        {
            window.removeEventListener('keydown', down);
            window.removeEventListener('blur', blur);
        };
    }, []);

    useEffect(() =>
    {
        let frameId = 0;

        const finishGame = () =>
        {
            const game = gameRef.current;
            if(game.phase === 'gameover') return;

            game.phase = 'gameover';
            game.feedback = 'FIN DE LA PARTIDA';
            game.feedbackTime = 1.5;
            setPhase('gameover');
            syncHud();
            playGameOver();
            submitRunResult(game.score, game.level);
        };

        const stepGame = () =>
        {
            const game = gameRef.current;

            if(game.queuedDirection !== OPPOSITE[game.direction])
                game.direction = game.queuedDirection;

            const vector = DIR_VECTOR[game.direction];
            const head = game.snake[0];
            const newHead = { x: head.x + vector.x, y: head.y + vector.y };

            if(
                newHead.x < 0 || newHead.x >= COLS ||
                newHead.y < 0 || newHead.y >= ROWS
            )
            {
                finishGame();
                return;
            }

            const eats = samePoint(newHead, game.food);
            const bodyToCheck = eats ? game.snake : game.snake.slice(0, -1);

            if(bodyToCheck.some(segment => samePoint(segment, newHead)))
            {
                finishGame();
                return;
            }

            if(eats)
            {
                game.snake = [ newHead, ...game.snake ];
                game.foods += 1;
                game.score += 100;

                const nextLevel = Math.min(MAX_LEVEL, 1 + Math.floor(game.foods / 5));

                if(nextLevel > game.level)
                {
                    game.level = nextLevel;
                    game.feedback = `NIVEL ${ game.level }`;
                    game.feedbackTime = 0.95;
                    scheduleFeedbackClear(950);
                    playLevel();
                }
                else
                {
                    game.feedback = '+100';
                    game.feedbackTime = 0.38;
                    scheduleFeedbackClear(450);
                    playFood();
                }

                game.food = spawnFood(game.snake);
            }
            else
            {
                game.snake = [ newHead, ...game.snake.slice(0, -1) ];
            }

            syncHud();
        };

        const draw = () =>
        {
            const canvas = canvasRef.current;
            if(!canvas) return;

            const context = canvas.getContext('2d');
            if(!context) return;

            const game = gameRef.current;

            context.setTransform(2, 0, 0, 2, 0, 0);
            context.imageSmoothingEnabled = false;

            const gradient = context.createLinearGradient(0, 0, BOARD_W, BOARD_H);
            gradient.addColorStop(0, '#03140b');
            gradient.addColorStop(1, '#061a10');

            context.fillStyle = gradient;
            context.fillRect(0, 0, BOARD_W, BOARD_H);

            context.strokeStyle = 'rgba(88,255,139,0.075)';
            context.lineWidth = 1;

            for(let x = 0; x <= BOARD_W; x += CELL)
            {
                context.beginPath();
                context.moveTo(x + 0.5, 0);
                context.lineTo(x + 0.5, BOARD_H);
                context.stroke();
            }

            for(let y = 0; y <= BOARD_H; y += CELL)
            {
                context.beginPath();
                context.moveTo(0, y + 0.5);
                context.lineTo(BOARD_W, y + 0.5);
                context.stroke();
            }

            const pulse = 0.74 + (Math.sin(game.elapsed * 8) * 0.14);
            const fx = (game.food.x * CELL) + (CELL / 2);
            const fy = (game.food.y * CELL) + (CELL / 2);

            context.shadowBlur = 14;
            context.shadowColor = '#ff587d';
            context.fillStyle = '#ff587d';
            context.beginPath();
            context.arc(fx, fy, Math.max(4.6, 7.2 * pulse), 0, Math.PI * 2);
            context.fill();

            context.shadowBlur = 0;
            context.fillStyle = '#ffd0da';
            context.fillRect(fx - 1.5, fy - 8, 3, 4);

            for(let i = game.snake.length - 1; i >= 0; i--)
            {
                const segment = game.snake[i];
                const isHead = i === 0;
                const inset = isHead ? 2 : 3;
                const px = (segment.x * CELL) + inset;
                const py = (segment.y * CELL) + inset;
                const size = CELL - (inset * 2);

                context.shadowBlur = isHead ? 13 : 7;
                context.shadowColor = isHead ? '#a4ff7a' : '#38df6b';
                context.fillStyle =
                    isHead ? '#a4ff7a' : (i % 2 === 0 ? '#38df6b' : '#2dc65d');

                context.fillRect(px, py, size, size);

                context.fillStyle = 'rgba(255,255,255,0.18)';
                context.fillRect(px + 2, py + 2, size - 4, 2);

                if(isHead)
                {
                    const d = game.direction;
                    const eyes =
                        d === 'left' || d === 'right'
                            ? [
                                { x: d === 'right' ? 11 : 3, y: 4 },
                                { x: d === 'right' ? 11 : 3, y: 10 }
                            ]
                            : [
                                { x: 4, y: d === 'down' ? 11 : 3 },
                                { x: 10, y: d === 'down' ? 11 : 3 }
                            ];

                    context.fillStyle = '#07200f';

                    for(const eye of eyes)
                        context.fillRect(px + eye.x, py + eye.y, 3, 3);
                }
            }

            context.shadowBlur = 0;
        };

        const frame = (now: number) =>
        {
            const game = gameRef.current;
            const previous = lastFrameRef.current || now;
            const deltaMs = Math.min(80, Math.max(0, now - previous));

            lastFrameRef.current = now;

            if(game.phase === 'playing')
            {
                game.elapsed += deltaMs / 1000;
                game.tickAccum += deltaMs;

                if(game.feedbackTime > 0)
                    game.feedbackTime = Math.max(
                        0,
                        game.feedbackTime - (deltaMs / 1000)
                    );

                const stepMs = stepMsForLevel(game.level);

                while(game.tickAccum >= stepMs && game.phase === 'playing')
                {
                    game.tickAccum -= stepMs;
                    stepGame();
                }
            }

            draw();
            frameId = requestAnimationFrame(frame);
        };

        frameId = requestAnimationFrame(frame);
        return () => cancelAnimationFrame(frameId);
    }, []);

    void feedbackRevision;

    if(!isVisible) return null;

    const formattedScore =
        score.toString().padStart(5, '0');

    const formattedBest =
        serverBest.toString().padStart(5, '0');

    const statusLabel =
        phase === 'playing'
            ? 'JUGANDO'
            : phase === 'paused'
                ? 'PAUSA'
                : phase === 'gameover'
                    ? 'FIN'
                    : 'PREPARADO';

    const completedInLevel =
        level >= MAX_LEVEL
            ? 5
            : Math.max(
                0,
                foods - ((level - 1) * 5)
            );


    return (
        <>
            <NitroCardView
                uniqueKey="biribiri-snake"
                className="nitro-snake"
                data-engine={ `${ UI_MARKER }|${ IDENTITY_PATCH_MARKER }` }>
                <NitroCardHeaderView
                    headerText="Snake"
                    onCloseClick={ close } />

                <NitroCardContentView
                    gap={ 0 }
                    className="snake-content">
                    <div className="snake-cabinet">
                        <span
                            className="snake-cabinet-screw is-top-left"
                            aria-hidden="true" />
                        <span
                            className="snake-cabinet-screw is-top-right"
                            aria-hidden="true" />
                        <span
                            className="snake-cabinet-screw is-bottom-left"
                            aria-hidden="true" />
                        <span
                            className="snake-cabinet-screw is-bottom-right"
                            aria-hidden="true" />

                        <div className="snake-hud">
                            <div className="snake-hud-cell">
                                <span className="snake-hud-label">
                                    PUNTUACIÓN
                                </span>
                                <b className="snake-score-value">
                                    { formattedScore }
                                </b>
                            </div>

                            <div className="snake-hud-cell">
                                <span className="snake-hud-label">
                                    NIVEL
                                </span>
                                <b className="snake-level-value">
                                    { level.toString().padStart(2, '0') }
                                </b>
                            </div>

                            <div className="snake-hud-cell is-length">
                                <span className="snake-hud-label">
                                    LONGITUD
                                </span>
                                <b className="snake-length-value">
                                    { length.toString().padStart(2, '0') }
                                </b>
                            </div>

                            <div className="snake-hud-cell is-food">
                                <span className="snake-hud-label">
                                    COMIDA
                                </span>
                                <b className="snake-food-value">
                                    { foods.toString().padStart(2, '0') }
                                </b>
                            </div>

                            <div className={
                                    `snake-hud-cell is-status is-${ phase }`
                                }>
                                <SnakeHudIcon active />
                                <b>{ statusLabel }</b>
                            </div>
                        </div>

                        <div className="snake-stage">
                            <div className="snake-board-shell">
                                <div
                                    className="snake-crt-plate"
                                    aria-hidden="true">
                                    <span></span>
                                    <b>GRID-80</b>
                                </div>

                                <canvas
                                    ref={ canvasRef }
                                    className="snake-canvas"
                                    width={ BOARD_W * 2 }
                                    height={ BOARD_H * 2 }
                                    tabIndex={ 0 } />

                                <div
                                    className="snake-crt-scanlines"
                                    aria-hidden="true" />

                                { phase === 'ready' &&
                                    <div className="snake-overlay">
                                        <div className="snake-overlay-panel">
                                            <span className="snake-overlay-kicker">
                                                CAZA DE MANZANAS
                                            </span>
                                            <strong className="snake-overlay-title">
                                                SNAKE
                                            </strong>
                                            <span className="snake-overlay-copy">
                                                COME, CRECE Y NO CHOQUES
                                                CONTRA LOS BORDES NI CONTIGO
                                            </span>
                                            <button
                                                type="button"
                                                className="snake-primary-button"
                                                disabled={ startPending }
                                                onClick={ requestStartGame }>
                                                { startPending
                                                    ? 'PREPARANDO...'
                                                    : 'JUGAR' }
                                            </button>
                                            <small>
                                                ENTER TAMBIÉN INICIA
                                            </small>
                                        </div>
                                    </div> }

                                { phase === 'paused' &&
                                    <div className="snake-overlay is-pause">
                                        <div className="snake-overlay-panel">
                                            <span className="snake-overlay-kicker">
                                                PARTIDA DETENIDA
                                            </span>
                                            <strong className="snake-overlay-title">
                                                PAUSA
                                            </strong>
                                            <button
                                                type="button"
                                                className="snake-primary-button"
                                                onClick={ togglePause }>
                                                CONTINUAR
                                            </button>
                                        </div>
                                    </div> }

                                { phase === 'gameover' &&
                                    <div className="snake-overlay">
                                        <div className="snake-overlay-panel">
                                            <span className="snake-overlay-kicker">
                                                COLISIÓN
                                            </span>
                                            <strong className="snake-overlay-title">
                                                FIN DE LA PARTIDA
                                            </strong>

                                            <div className="snake-gameover-results">
                                                <span>
                                                    PUNTUACIÓN
                                                    <b>{ formattedScore }</b>
                                                </span>
                                                <span>
                                                    NIVEL
                                                    <b>{ level }</b>
                                                </span>
                                            </div>

                                            { newServerRecord &&
                                                <span className="snake-new-record">
                                                    ★ NUEVO RÉCORD PERSONAL
                                                </span> }

                                            { resultState !== 'idle' &&
                                                <span
                                                    className={
                                                        `snake-result-message ${
                                                            resultState === 'accepted'
                                                                ? 'is-success'
                                                                : 'is-error'
                                                        }`
                                                    }>
                                                    { resultMessage }
                                                </span> }

                                            <button
                                                type="button"
                                                className="snake-primary-button"
                                                disabled={ startPending }
                                                onClick={ requestStartGame }>
                                                { startPending
                                                    ? 'PREPARANDO...'
                                                    : 'JUGAR DE NUEVO' }
                                            </button>
                                        </div>
                                    </div> }

                                { gameRef.current.feedbackTime > 0 &&
                                    phase === 'playing' &&
                                    <div className="snake-feedback">
                                        { gameRef.current.feedback }
                                    </div> }
                            </div>

                            <div className="snake-side-panel">
                                <section>
                                    <span className="snake-side-title">
                                        OBJETIVO
                                    </span>
                                    <strong>
                                        COME Y CRECE
                                    </strong>
                                    <p>
                                        Cada comida suma 100 puntos.
                                        Evita las paredes y tu propio cuerpo.
                                    </p>
                                </section>

                                <section className="snake-growth-panel">
                                    <span className="snake-side-title">
                                        CRECIMIENTO
                                    </span>

                                    <div className="snake-growth-snake"
                                        aria-hidden="true">
                                        <span />
                                        <span />
                                        <span />
                                        <span />
                                        <span className="is-head" />
                                    </div>

                                    <div className="snake-progress-labels">
                                        <span>SIGUIENTE NIVEL</span>
                                        <b>{ completedInLevel }/5</b>
                                    </div>

                                    <div
                                        className="snake-food-led-row"
                                        aria-label={
                                            `${ completedInLevel } de 5 comidas`
                                        }>
                                        { Array.from(
                                            { length: 5 },
                                            (_, index) =>
                                                <span
                                                    key={ index }
                                                    className={
                                                        index < completedInLevel
                                                            ? 'is-on'
                                                            : ''
                                                    }>
                                                    <i />
                                                </span>
                                        ) }
                                    </div>

                                    <small>
                                        5 COMIDAS = +1 NIVEL
                                    </small>
                                </section>
                            </div>
                        </div>

                        <div className="snake-console">
                            <div className="snake-controls-panel">
                                <div className="snake-control-group">
                                    <span className="snake-keycap">
                                        ← ↑ ↓ →
                                    </span>
                                    <span className="snake-control-action">
                                        MOVER
                                    </span>
                                </div>

                                <div className="snake-console-divider" />

                                <div className="snake-control-group">
                                    <span className="snake-keycap">
                                        WASD
                                    </span>
                                    <span className="snake-control-action">
                                        MOVER
                                    </span>
                                </div>

                                <div className="snake-console-divider" />

                                <div className="snake-control-group">
                                    <span className="snake-keycap">
                                        P
                                    </span>
                                    <span className="snake-control-action">
                                        PAUSA
                                    </span>
                                </div>
                            </div>

                            <div className="snake-console-actions">
                                <button
                                    type="button"
                                    className={
                                        `snake-sound-button${
                                            soundEnabled
                                                ? ' is-on'
                                                : ''
                                        }`
                                    }
                                    onClick={ toggleSound }
                                    aria-pressed={ soundEnabled }>
                                    <span
                                        className="snake-sound-icon"
                                        aria-hidden="true">
                                        ♪
                                    </span>
                                    <span>
                                        SONIDO
                                        <b>
                                            { soundEnabled
                                                ? 'ON'
                                                : 'OFF' }
                                        </b>
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    className="snake-restart-button"
                                    disabled={ startPending }
                                    onClick={ requestStartGame }>
                                    <span
                                        className="snake-restart-shine"
                                        aria-hidden="true" />
                                    REINICIAR
                                </button>
                            </div>
                        </div>

                        <div className="snake-arcade-summary-bar">
                            <div className="snake-arcade-summary-brand">
                                <span>RANKING GLOBAL</span>
                                <strong>SNAKE</strong>
                            </div>

                            <div className="snake-arcade-summary-stats">
                                <span>
                                    TU RÉCORD
                                    <b>{ formattedBest }</b>
                                </span>

                                <span>
                                    TU PUESTO
                                    <b>
                                        { personalRank > 0
                                            ? `#${ personalRank }`
                                            : '—' }
                                    </b>
                                </span>

                                <span>
                                    JUGADORES
                                    <b>{ totalPlayers }</b>
                                </span>
                            </div>

                            <button
                                type="button"
                                className="snake-records-button"
                                onClick={ openRecords }>
                                <span className="snake-records-star">
                                    ★
                                </span>
                                RÉCORDS
                            </button>
                        </div>
                    </div>
                </NitroCardContentView>
            </NitroCardView>

            <ArcadeLeaderboardView
                visible={ recordsOpen }
                gameName="Snake"
                levelLabel="NIVEL"
                leaderboard={ leaderboard }
                personalBest={ serverBest }
                personalRank={ personalRank }
                totalPlayers={ totalPlayers }
                onClose={ closeRecords } />
        </>
    );
};
