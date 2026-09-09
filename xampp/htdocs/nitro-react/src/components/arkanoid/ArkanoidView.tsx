import {
    ArcadeCloseEvent,
    ArcadeGameStartComposer,
    ArcadeGameStartedEvent,
    ArcadeLeaderboardEvent,
    ArcadeScoreSubmitComposer,
    ArkanoidOpenEvent
} from '@nitrots/nitro-renderer';
import { FC, useEffect, useRef, useState } from 'react';
import {
    NitroCardContentView,
    NitroCardHeaderView,
    NitroCardView
} from '../../common';
import { SendMessageComposer } from '../../api';
import { useMessageEvent } from '../../hooks/events';
import { ArcadeLeaderboardView } from '../arcade/ArcadeLeaderboardView';
import './ArkanoidView.scss';

type Phase = 'ready' | 'playing' | 'paused' | 'gameover';
type ResultState = 'idle' | 'accepted' | 'rejected';
type PowerType = 'wide' | 'slow' | 'multi';

interface Ball
{
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    r: number;
}

interface Brick
{
    id: number;
    x: number;
    y: number;
    w: number;
    h: number;
    hp: number;
    maxHp: number;
    alive: boolean;
}

interface PowerUp
{
    id: number;
    x: number;
    y: number;
    vy: number;
    type: PowerType;
}

interface Particle
{
    x: number;
    y: number;
    vx: number;
    vy: number;
    ttl: number;
    kind: number;
}

interface Popup
{
    id: number;
    text: string;
    x: number;
    y: number;
    ttl: number;
    accent: number;
}

interface Model
{
    phase: Phase;
    score: number;
    level: number;
    blocks: number;
    lives: number;
    combo: number;
    paddleX: number;
    paddleWidth: number;
    balls: Ball[];
    bricks: Brick[];
    powerUps: PowerUp[];
    particles: Particle[];
    popups: Popup[];
    nextBallId: number;
    nextPowerId: number;
    launchTimer: number;
    wideTimer: number;
    feedback: string;
    feedbackTime: number;
    levelFlash: number;
    hitFlash: number;
}

interface LeaderboardEntry
{
    rank: number;
    username: string;
    score: number;
    level: number;
}

const GAME_KEY = 'arkanoid';
const UI_MARKER = 'BIRIBIRI_ARKANOID_V1';

const W = 640;
const H = 420;
const PADDLE_Y = 366;
const BASE_PADDLE_WIDTH = 88;
const MAX_LIVES = 3;
const BRICK_COLS = 11;
const BRICK_ROWS = 7;
const BRICK_W = 44;
const BRICK_H = 14;
const BRICK_GAP_X = 6;
const BRICK_GAP_Y = 6;
const BRICK_START_X = 48;
const BRICK_START_Y = 70;

const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));

const rnd = (max: number) =>
    Math.floor(Math.random() * max);

const fmt = (value: number) =>
    value.toString().padStart(6, '0');

const speedForLevel = (level: number) =>
    235 + Math.min(155, Math.max(0, level - 1) * 14);

const makeBricks = (level: number): Brick[] =>
{
    const bricks: Brick[] = [];
    let id = 1;

    for(let row = 0; row < BRICK_ROWS; row++)
    {
        for(let col = 0; col < BRICK_COLS; col++)
        {
            let present = true;

            if(level % 4 === 2)
                present = ((row + col) % 3) !== 0;
            else if(level % 4 === 3)
            {
                const center = (BRICK_COLS - 1) / 2;
                present = Math.abs(col - center) <= Math.max(1, center - (row * .55));
            }
            else if(level % 4 === 0)
                present = row < 2 || col < 2 || col > BRICK_COLS - 3 || ((row + col) % 2 === 0);

            if(!present)
                continue;

            let hp = 1;

            if(level >= 3 && (row + col + level) % 7 === 0)
                hp = 2;

            if(level >= 7 && (row * 3 + col + level) % 13 === 0)
                hp = 3;

            bricks.push({
                id: id++,
                x: BRICK_START_X + (col * (BRICK_W + BRICK_GAP_X)),
                y: BRICK_START_Y + (row * (BRICK_H + BRICK_GAP_Y)),
                w: BRICK_W,
                h: BRICK_H,
                hp,
                maxHp: hp,
                alive: true
            });
        }
    }

    return bricks;
};

const freshGame = (phase: Phase = 'ready'): Model => ({
    phase,
    score: 0,
    level: 1,
    blocks: 0,
    lives: MAX_LIVES,
    combo: 0,
    paddleX: W / 2,
    paddleWidth: BASE_PADDLE_WIDTH,
    balls: [],
    bricks: makeBricks(1),
    powerUps: [],
    particles: [],
    popups: [],
    nextBallId: 1,
    nextPowerId: 1,
    launchTimer: .85,
    wideTimer: 0,
    feedback: '',
    feedbackTime: 0,
    levelFlash: 0,
    hitFlash: 0
});


const ArkanoidPixelHeart: FC<{ active: boolean }> = ({ active }) =>
{
    return (
        <svg
            className={ `arkanoid-life-heart${ active ? ' is-active' : '' }` }
            viewBox="0 0 18 16"
            shapeRendering="crispEdges"
            aria-hidden="true">
            <rect x="3" y="2" width="4" height="2" />
            <rect x="11" y="2" width="4" height="2" />
            <rect x="1" y="4" width="16" height="5" />
            <rect x="3" y="9" width="12" height="2" />
            <rect x="5" y="11" width="8" height="2" />
            <rect x="7" y="13" width="4" height="2" />
            <rect className="heart-shine" x="4" y="4" width="2" height="2" />
        </svg>
    );
};

const ArkanoidStatusIcon: FC<{}> = () =>
{
    return (
        <span
            className="arkanoid-status-icon"
            aria-hidden="true">
            <i className="ball" />
            <i className="trail" />
            <i className="paddle" />
        </span>
    );
};

export const ArkanoidView: FC<{}> = () =>
{
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const visibleRef = useRef(false);
    const gameRef = useRef<Model>(freshGame());
    const itemIdRef = useRef(0);
    const runTokenRef = useRef('');
    const submittedRef = useRef(false);
    const startPendingRef = useRef(false);
    const lastFrameRef = useRef(0);
    const heldLeftRef = useRef(false);
    const heldRightRef = useRef(false);
    const soundRef = useRef(true);
    const audioRef = useRef<AudioContext | null>(null);

    const [ isVisible, setIsVisible ] = useState(false);
    const [ score, setScore ] = useState(0);
    const [ level, setLevel ] = useState(1);
    const [ blocks, setBlocks ] = useState(0);
    const [ lives, setLives ] = useState(MAX_LIVES);
    const [ phase, setPhase ] = useState<Phase>('ready');
    const [ soundEnabled, setSoundEnabled ] = useState(true);
    const [ startPending, setStartPending ] = useState(false);

    const [ leaderboard, setLeaderboard ] =
        useState<LeaderboardEntry[]>([]);
    const [ serverBest, setServerBest ] = useState(0);
    const [ personalRank, setPersonalRank ] = useState(0);
    const [ totalPlayers, setTotalPlayers ] = useState(0);
    const [ recordsOpen, setRecordsOpen ] = useState(false);
    const [ resultState, setResultState ] =
        useState<ResultState>('idle');
    const [ resultMessage, setResultMessage ] = useState('');
    const [ newServerRecord, setNewServerRecord ] = useState(false);

    const ensureAudio = (): AudioContext | null =>
    {
        if(!soundRef.current) return null;

        try
        {
            if(!audioRef.current)
            {
                const Context =
                    window.AudioContext ||
                    (window as any).webkitAudioContext;

                if(!Context) return null;

                audioRef.current = new Context();
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
        volume = .024,
        delay = 0,
        endFrequency?: number) =>
    {
        const context = ensureAudio();

        if(!context)
            return;

        const start = context.currentTime + delay;
        const oscillator = context.createOscillator();
        const gain = context.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(
            Math.max(1, frequency),
            start
        );

        if(endFrequency !== undefined)
        {
            oscillator.frequency.exponentialRampToValueAtTime(
                Math.max(1, endFrequency),
                start + duration
            );
        }

        gain.gain.setValueAtTime(.0001, start);
        gain.gain.exponentialRampToValueAtTime(
            Math.max(.0001, volume),
            start + .004
        );
        gain.gain.exponentialRampToValueAtTime(
            .0001,
            start + duration
        );

        oscillator.connect(gain);
        gain.connect(context.destination);

        oscillator.start(start);
        oscillator.stop(start + duration + .02);
    };

    const playStart = () =>
    {
        tone(330, .05);
        tone(494, .05, 'square', .024, .06);
        tone(660, .10, 'square', .026, .12);
    };

    const playWall = () =>
        tone(250, .018, 'square', .010);

    const playPaddle = () =>
        tone(360, .028, 'square', .016);

    const playBrick = (hp: number) =>
        tone(
            hp > 1 ? 190 : 510,
            .035,
            'square',
            .018
        );

    const playPower = () =>
    {
        tone(520, .05, 'triangle', .022);
        tone(780, .08, 'square', .024, .05);
    };

    const playLife = () =>
        tone(155, .16, 'sawtooth', .028, 0, 74);

    const playLevel = () =>
    {
        tone(392, .05, 'square', .022);
        tone(587, .05, 'square', .024, .06);
        tone(784, .11, 'square', .027, .12);
    };

    const playGameOver = () =>
    {
        tone(220, .12, 'square', .026);
        tone(135, .20, 'sawtooth', .030, .10, 65);
    };

    const syncHud = () =>
    {
        const game = gameRef.current;

        setScore(game.score);
        setLevel(game.level);
        setBlocks(game.blocks);
        setLives(game.lives);
        setPhase(game.phase);
    };

    const addPopup = (
        text: string,
        x: number,
        y: number,
        accent = 0) =>
    {
        gameRef.current.popups.push({
            id: Date.now() + rnd(9999),
            text,
            x,
            y,
            ttl: .85,
            accent
        });
    };

    const addParticles = (
        x: number,
        y: number,
        count: number,
        kind: number) =>
    {
        const game = gameRef.current;

        for(let i = 0; i < count; i++)
        {
            game.particles.push({
                x,
                y,
                vx: -65 + (Math.random() * 130),
                vy: -55 + (Math.random() * 90),
                ttl: .25 + (Math.random() * .40),
                kind
            });
        }
    };

    const resetReady = () =>
    {
        gameRef.current = freshGame('ready');
        runTokenRef.current = '';
        submittedRef.current = false;
        startPendingRef.current = false;
        lastFrameRef.current = 0;
        heldLeftRef.current = false;
        heldRightRef.current = false;

        setStartPending(false);
        setResultState('idle');
        setResultMessage('');
        setNewServerRecord(false);

        syncHud();
    };

    const spawnBall = (
        x: number,
        direction = 1,
        angleBias = 0) =>
    {
        const game = gameRef.current;
        const speed = speedForLevel(game.level);
        const vx =
            (105 + (Math.random() * 55) + angleBias) *
            direction;

        const vy =
            -Math.sqrt(
                Math.max(
                    12000,
                    (speed * speed) - (vx * vx)
                )
            );

        game.balls.push({
            id: game.nextBallId++,
            x,
            y: PADDLE_Y - 12,
            vx,
            vy,
            r: 5
        });
    };

    const requestStart = () =>
    {
        if(
            !visibleRef.current ||
            itemIdRef.current <= 0 ||
            startPendingRef.current
        )
        {
            return;
        }

        ensureAudio();

        startPendingRef.current = true;
        setStartPending(true);
        setResultState('idle');
        setResultMessage('');
        setNewServerRecord(false);

        SendMessageComposer(
            new ArcadeGameStartComposer(
                itemIdRef.current,
                GAME_KEY
            )
        );
    };

    const beginRun = (token: string) =>
    {
        const game = freshGame('playing');

        game.feedback = 'PREPARANDO BOLA';
        game.feedbackTime = .85;

        gameRef.current = game;
        runTokenRef.current = token;
        submittedRef.current = false;
        lastFrameRef.current = performance.now();

        syncHud();
        playStart();

        window.setTimeout(
            () => canvasRef.current?.focus(),
            0
        );
    };

    const submitScore = (
        finalScore: number,
        finalLevel: number) =>
    {
        if(
            submittedRef.current ||
            !runTokenRef.current ||
            itemIdRef.current <= 0
        )
        {
            return;
        }

        submittedRef.current = true;

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
        submittedRef.current = false;
        startPendingRef.current = false;
        heldLeftRef.current = false;
        heldRightRef.current = false;

        setStartPending(false);
        setRecordsOpen(false);
        setIsVisible(false);

        if(gameRef.current.phase === 'playing')
            gameRef.current.phase = 'paused';
    };

    const togglePause = () =>
    {
        const game = gameRef.current;

        heldLeftRef.current = false;
        heldRightRef.current = false;

        if(game.phase === 'playing')
        {
            game.phase = 'paused';
        }
        else if(game.phase === 'paused')
        {
            game.phase = 'playing';
            lastFrameRef.current = performance.now();
        }
        else
        {
            return;
        }

        setPhase(game.phase);
    };

    const toggleSound = () =>
    {
        const next = !soundRef.current;

        soundRef.current = next;
        setSoundEnabled(next);

        if(next)
        {
            ensureAudio();
            tone(520, .05, 'square', .022);
        }
    };

    const openRecords = () =>
    {
        if(gameRef.current.phase === 'playing')
        {
            heldLeftRef.current = false;
            heldRightRef.current = false;
            gameRef.current.phase = 'paused';
            setPhase('paused');
        }

        setRecordsOpen(true);
    };

    const closeRecords = () =>
    {
        setRecordsOpen(false);

        window.setTimeout(
            () => canvasRef.current?.focus(),
            0
        );
    };

    const setMovement = (
        direction: -1 | 1,
        active: boolean) =>
    {
        if(direction < 0)
            heldLeftRef.current = active;
        else
            heldRightRef.current = active;
    };

    const activatePower = (type: PowerType) =>
    {
        const game = gameRef.current;

        if(type === 'wide')
        {
            game.paddleWidth = 132;
            game.wideTimer = 10;
            game.feedback = 'PALA ANCHA';
            addPopup('PALA ANCHA', game.paddleX, PADDLE_Y - 28, 1);
        }
        else if(type === 'slow')
        {
            for(const ball of game.balls)
            {
                ball.vx *= .78;
                ball.vy *= .78;
            }

            game.feedback = 'BOLA LENTA';
            addPopup('BOLA LENTA', game.paddleX, PADDLE_Y - 28, 2);
        }
        else
        {
            const source = game.balls[0];

            if(source && game.balls.length < 3)
            {
                const speed =
                    Math.sqrt(
                        (source.vx * source.vx) +
                        (source.vy * source.vy)
                    );

                const direction =
                    source.vx >= 0 ? 1 : -1;

                const vx1 = clamp(
                    Math.abs(source.vx) + 55,
                    115,
                    speed * .78
                );

                for(const sign of [ -1, 1 ])
                {
                    if(game.balls.length >= 3)
                        break;

                    game.balls.push({
                        id: game.nextBallId++,
                        x: source.x,
                        y: source.y,
                        vx: vx1 * direction * sign,
                        vy: -Math.abs(
                            Math.sqrt(
                                Math.max(
                                    12000,
                                    (speed * speed) - (vx1 * vx1)
                                )
                            )
                        ),
                        r: 5
                    });
                }
            }

            game.feedback = 'MULTIBOLA';
            addPopup('MULTIBOLA', game.paddleX, PADDLE_Y - 28, 3);
        }

        game.feedbackTime = .85;
        game.score += 150;
        playPower();
        syncHud();
    };

    useMessageEvent(
        ArkanoidOpenEvent,
        (event: ArkanoidOpenEvent) =>
        {
            const parser = event.getParser();

            itemIdRef.current = parser.itemId;
            resetReady();

            setLeaderboard([]);
            setServerBest(0);
            setPersonalRank(0);
            setTotalPlayers(0);
            setRecordsOpen(false);

            visibleRef.current = true;
            setIsVisible(true);

            window.setTimeout(
                () => canvasRef.current?.focus(),
                0
            );
        }
    );

    useMessageEvent(
        ArcadeGameStartedEvent,
        (event: ArcadeGameStartedEvent) =>
        {
            const parser = event.getParser();

            if(
                !visibleRef.current ||
                parser.gameKey !== GAME_KEY ||
                parser.itemId !== itemIdRef.current
            )
            {
                return;
            }

            startPendingRef.current = false;
            setStartPending(false);

            if(!parser.success)
            {
                setResultState('rejected');
                setResultMessage(
                    parser.message ||
                    'No se pudo iniciar la partida.'
                );
                return;
            }

            beginRun(parser.token);
        }
    );

    useMessageEvent(
        ArcadeLeaderboardEvent,
        (event: ArcadeLeaderboardEvent) =>
        {
            const parser = event.getParser();

            if(parser.gameKey !== GAME_KEY)
                return;

            setLeaderboard(
                parser.entries.map(
                    entry => ({
                        rank: entry.rank,
                        username: entry.username,
                        score: entry.score,
                        level: entry.level
                    })
                )
            );

            setPersonalRank(parser.personalRank);
            setTotalPlayers(parser.totalPlayers);
            setServerBest(parser.personalBest);

            if(parser.context === 1)
            {
                setResultState('accepted');
                setResultMessage(
                    parser.message ||
                    'Puntuación registrada.'
                );
                setNewServerRecord(parser.newRecord);
            }
            else if(parser.context === 2)
            {
                setResultState('rejected');
                setResultMessage(
                    parser.message ||
                    'La puntuación no pudo validarse.'
                );
                setNewServerRecord(false);
            }
        }
    );

    useMessageEvent(
        ArcadeCloseEvent,
        (event: ArcadeCloseEvent) =>
        {
            const parser = event.getParser();

            if(
                parser.gameKey !== GAME_KEY ||
                parser.itemId !== itemIdRef.current
            )
            {
                return;
            }

            visibleRef.current = false;
            runTokenRef.current = '';
            submittedRef.current = false;
            startPendingRef.current = false;
            heldLeftRef.current = false;
            heldRightRef.current = false;

            setStartPending(false);
            setRecordsOpen(false);
            setIsVisible(false);
        }
    );

    useEffect(
        () =>
        {
            const keyDown = (event: KeyboardEvent) =>
            {
                if(!visibleRef.current)
                    return;

                const handled = [
                    'ArrowLeft',
                    'ArrowRight',
                    'KeyA',
                    'KeyD',
                    'Enter',
                    'KeyP',
                    'Escape'
                ].includes(event.code);

                if(handled)
                    event.preventDefault();

                if(event.code === 'Enter')
                {
                    if(
                        gameRef.current.phase === 'ready' ||
                        gameRef.current.phase === 'gameover'
                    )
                    {
                        requestStart();
                    }

                    return;
                }

                if(
                    event.code === 'KeyP' ||
                    event.code === 'Escape'
                )
                {
                    togglePause();
                    return;
                }

                if(gameRef.current.phase !== 'playing')
                    return;

                if(
                    event.code === 'ArrowLeft' ||
                    event.code === 'KeyA'
                )
                {
                    setMovement(-1, true);
                }
                else if(
                    event.code === 'ArrowRight' ||
                    event.code === 'KeyD'
                )
                {
                    setMovement(1, true);
                }
            };

            const keyUp = (event: KeyboardEvent) =>
            {
                if(
                    event.code === 'ArrowLeft' ||
                    event.code === 'KeyA'
                )
                {
                    setMovement(-1, false);
                }
                else if(
                    event.code === 'ArrowRight' ||
                    event.code === 'KeyD'
                )
                {
                    setMovement(1, false);
                }
            };

            const blur = () =>
            {
                heldLeftRef.current = false;
                heldRightRef.current = false;

                if(
                    visibleRef.current &&
                    gameRef.current.phase === 'playing'
                )
                {
                    gameRef.current.phase = 'paused';
                    setPhase('paused');
                }
            };

            window.addEventListener(
                'keydown',
                keyDown,
                { passive: false }
            );

            window.addEventListener(
                'keyup',
                keyUp
            );

            window.addEventListener(
                'blur',
                blur
            );

            return () =>
            {
                window.removeEventListener(
                    'keydown',
                    keyDown
                );

                window.removeEventListener(
                    'keyup',
                    keyUp
                );

                window.removeEventListener(
                    'blur',
                    blur
                );
            };
        },
        []
    );

    useEffect(
        () =>
        {
            let frameId = 0;

            const finish = () =>
            {
                const game = gameRef.current;

                if(game.phase === 'gameover')
                    return;

                game.phase = 'gameover';
                game.feedback = 'PARTIDA TERMINADA';
                game.feedbackTime = 1.2;

                heldLeftRef.current = false;
                heldRightRef.current = false;

                setPhase('gameover');
                syncHud();
                playGameOver();

                submitScore(
                    game.score,
                    game.level
                );
            };

            const nextLevel = () =>
            {
                const game = gameRef.current;

                game.level += 1;
                game.bricks = makeBricks(game.level);
                game.balls = [];
                game.powerUps = [];
                game.paddleWidth = BASE_PADDLE_WIDTH;
                game.wideTimer = 0;
                game.launchTimer = 1.0;
                game.combo = 0;
                game.levelFlash = .9;
                game.feedback = `NIVEL ${ game.level }`;
                game.feedbackTime = 1.0;

                addPopup(
                    `NIVEL ${ game.level }`,
                    W / 2,
                    216,
                    1
                );

                playLevel();
                syncHud();
            };

            const update = (dt: number) =>
            {
                const game = gameRef.current;

                if(game.phase !== 'playing')
                    return;

                game.feedbackTime =
                    Math.max(
                        0,
                        game.feedbackTime - dt
                    );

                game.levelFlash =
                    Math.max(
                        0,
                        game.levelFlash - dt
                    );

                game.hitFlash =
                    Math.max(
                        0,
                        game.hitFlash - dt
                    );

                if(game.wideTimer > 0)
                {
                    game.wideTimer -= dt;

                    if(game.wideTimer <= 0)
                        game.paddleWidth = BASE_PADDLE_WIDTH;
                }

                const paddleSpeed =
                    365 +
                    Math.min(
                        80,
                        game.level * 4
                    );

                if(
                    heldLeftRef.current &&
                    !heldRightRef.current
                )
                {
                    game.paddleX -=
                        paddleSpeed * dt;
                }
                else if(
                    heldRightRef.current &&
                    !heldLeftRef.current
                )
                {
                    game.paddleX +=
                        paddleSpeed * dt;
                }

                game.paddleX = clamp(
                    game.paddleX,
                    28 + (game.paddleWidth / 2),
                    W - 28 - (game.paddleWidth / 2)
                );

                if(
                    game.balls.length === 0 &&
                    game.launchTimer > 0
                )
                {
                    game.launchTimer -= dt;

                    if(game.launchTimer <= 0)
                        spawnBall(game.paddleX, Math.random() > .5 ? 1 : -1);
                }

                const nextBalls: Ball[] = [];

                for(const ball of game.balls)
                {
                    const previousX = ball.x;
                    const previousY = ball.y;

                    ball.x += ball.vx * dt;
                    ball.y += ball.vy * dt;

                    if(ball.x - ball.r <= 24)
                    {
                        ball.x = 24 + ball.r;
                        ball.vx = Math.abs(ball.vx);
                        playWall();
                    }
                    else if(ball.x + ball.r >= W - 24)
                    {
                        ball.x = W - 24 - ball.r;
                        ball.vx = -Math.abs(ball.vx);
                        playWall();
                    }

                    if(ball.y - ball.r <= 28)
                    {
                        ball.y = 28 + ball.r;
                        ball.vy = Math.abs(ball.vy);
                        playWall();
                    }

                    if(
                        ball.vy > 0 &&
                        previousY + ball.r <= PADDLE_Y &&
                        ball.y + ball.r >= PADDLE_Y &&
                        Math.abs(ball.x - game.paddleX) <=
                            (game.paddleWidth / 2) + ball.r
                    )
                    {
                        const offset =
                            clamp(
                                (ball.x - game.paddleX) /
                                (game.paddleWidth / 2),
                                -1,
                                1
                            );

                        const speed = clamp(
                            Math.sqrt(
                                (ball.vx * ball.vx) +
                                (ball.vy * ball.vy)
                            ) * 1.012,
                            220,
                            420
                        );

                        ball.vx =
                            clamp(
                                offset * speed * .78,
                                -speed * .82,
                                speed * .82
                            );

                        const vertical =
                            Math.sqrt(
                                Math.max(
                                    9000,
                                    (speed * speed) -
                                    (ball.vx * ball.vx)
                                )
                            );

                        ball.vy = -Math.abs(vertical);
                        ball.y = PADDLE_Y - ball.r - 1;

                        playPaddle();
                    }

                    let brickHit = false;

                    for(const brick of game.bricks)
                    {
                        if(!brick.alive)
                            continue;

                        if(
                            ball.x + ball.r < brick.x ||
                            ball.x - ball.r > brick.x + brick.w ||
                            ball.y + ball.r < brick.y ||
                            ball.y - ball.r > brick.y + brick.h
                        )
                        {
                            continue;
                        }

                        const cameFromTop =
                            previousY + ball.r <= brick.y;

                        const cameFromBottom =
                            previousY - ball.r >= brick.y + brick.h;

                        if(cameFromTop || cameFromBottom)
                            ball.vy *= -1;
                        else
                            ball.vx *= -1;

                        brick.hp -= 1;
                        game.hitFlash = .10;
                        game.score += 18 * game.level;

                        if(brick.hp <= 0)
                        {
                            brick.alive = false;
                            game.blocks += 1;
                            game.combo += 1;

                            const reward =
                                75 +
                                (game.level * 12) +
                                Math.min(
                                    180,
                                    game.combo * 6
                                );

                            game.score += reward;

                            addParticles(
                                brick.x + (brick.w / 2),
                                brick.y + (brick.h / 2),
                                8,
                                brick.maxHp
                            );

                            if(Math.random() < .14)
                            {
                                const types: PowerType[] =
                                    [ 'wide', 'slow', 'multi' ];

                                game.powerUps.push({
                                    id: game.nextPowerId++,
                                    x: brick.x + (brick.w / 2),
                                    y: brick.y + (brick.h / 2),
                                    vy: 100 + (game.level * 2),
                                    type: types[rnd(types.length)]
                                });
                            }

                            if(game.combo >= 4)
                            {
                                addPopup(
                                    `RACHA x${ game.combo }`,
                                    brick.x + (brick.w / 2),
                                    brick.y,
                                    0
                                );
                            }
                        }

                        playBrick(brick.hp);
                        syncHud();
                        brickHit = true;
                        break;
                    }

                    if(brickHit)
                    {
                        const maxSpeed =
                            speedForLevel(game.level) + 75;

                        const current =
                            Math.sqrt(
                                (ball.vx * ball.vx) +
                                (ball.vy * ball.vy)
                            );

                        if(current > maxSpeed)
                        {
                            const scale =
                                maxSpeed / current;

                            ball.vx *= scale;
                            ball.vy *= scale;
                        }
                    }

                    if(ball.y - ball.r <= H + 12)
                        nextBalls.push(ball);
                }

                game.balls = nextBalls;

                if(
                    game.balls.length === 0 &&
                    game.launchTimer <= 0
                )
                {
                    game.lives -= 1;
                    game.combo = 0;
                    game.powerUps = [];
                    game.paddleWidth = BASE_PADDLE_WIDTH;
                    game.wideTimer = 0;

                    if(game.lives <= 0)
                    {
                        finish();
                        return;
                    }

                    game.launchTimer = 1.05;
                    game.feedback = `VIDA ${ game.lives }`;
                    game.feedbackTime = .9;

                    addPopup(
                        `VIDAS ${ game.lives }`,
                        game.paddleX,
                        PADDLE_Y - 30,
                        2
                    );

                    playLife();
                    syncHud();
                }

                const nextPowerUps: PowerUp[] = [];

                for(const power of game.powerUps)
                {
                    power.y += power.vy * dt;

                    if(
                        power.y >= PADDLE_Y - 6 &&
                        power.y <= PADDLE_Y + 14 &&
                        Math.abs(power.x - game.paddleX) <=
                            (game.paddleWidth / 2) + 12
                    )
                    {
                        activatePower(power.type);
                        continue;
                    }

                    if(power.y < H + 20)
                        nextPowerUps.push(power);
                }

                game.powerUps = nextPowerUps;

                for(const particle of game.particles)
                {
                    particle.ttl -= dt;
                    particle.x += particle.vx * dt;
                    particle.y += particle.vy * dt;
                    particle.vy += 85 * dt;
                }

                game.particles =
                    game.particles.filter(
                        particle => particle.ttl > 0
                    );

                for(const popup of game.popups)
                {
                    popup.ttl -= dt;
                    popup.y -= 22 * dt;
                }

                game.popups =
                    game.popups.filter(
                        popup => popup.ttl > 0
                    );

                if(
                    game.bricks.length > 0 &&
                    game.bricks.every(
                        brick => !brick.alive
                    )
                )
                {
                    nextLevel();
                }
            };

            const brickColor = (
                brick: Brick): [ string, string, string ] =>
            {
                if(brick.maxHp >= 3)
                    return [ '#fff1a3', '#cba646', '#756126' ];

                if(brick.maxHp === 2)
                    return [ '#d9f3ff', '#6bb9db', '#356780' ];

                const row =
                    Math.round(
                        (brick.y - BRICK_START_Y) /
                        (BRICK_H + BRICK_GAP_Y)
                    );

                const palette: [ string, string, string ][] = [
                    [ '#ff927f', '#d75858', '#7d2a32' ],
                    [ '#ffbd70', '#d9833f', '#824720' ],
                    [ '#ffe978', '#d6b43f', '#78631f' ],
                    [ '#92e17c', '#4ca861', '#27613f' ],
                    [ '#70dce9', '#3590ad', '#20536b' ],
                    [ '#78abff', '#466fc2', '#2b437e' ],
                    [ '#bc91f5', '#7754ae', '#493571' ]
                ];

                return palette[row % palette.length];
            };

            const drawPower = (
                context: CanvasRenderingContext2D,
                power: PowerUp) =>
            {
                const colors: Record<PowerType, string> = {
                    wide: '#ffe56f',
                    slow: '#67d5ff',
                    multi: '#ff956d'
                };

                const labels: Record<PowerType, string> = {
                    wide: 'W',
                    slow: 'S',
                    multi: 'M'
                };

                context.fillStyle = '#0c1728';
                context.fillRect(
                    Math.round(power.x - 9),
                    Math.round(power.y - 6),
                    18,
                    12
                );

                context.fillStyle = colors[power.type];
                context.fillRect(
                    Math.round(power.x - 7),
                    Math.round(power.y - 4),
                    14,
                    8
                );

                context.fillStyle = '#102034';
                context.font = 'bold 7px monospace';
                context.textAlign = 'center';
                context.textBaseline = 'middle';
                context.fillText(
                    labels[power.type],
                    Math.round(power.x),
                    Math.round(power.y)
                );
            };

            const draw = () =>
            {
                const canvas = canvasRef.current;

                if(!canvas)
                    return;

                const context =
                    canvas.getContext('2d');

                if(!context)
                    return;

                const game = gameRef.current;

                context.setTransform(
                    2,
                    0,
                    0,
                    2,
                    0,
                    0
                );

                context.imageSmoothingEnabled = false;

                const bg =
                    context.createLinearGradient(
                        0,
                        0,
                        0,
                        H
                    );

                bg.addColorStop(0, '#071c39');
                bg.addColorStop(.58, '#0a2e53');
                bg.addColorStop(1, '#061527');

                context.fillStyle = bg;
                context.fillRect(0, 0, W, H);

                // Cabinet-screen playfield.
                context.fillStyle = 'rgba(81,150,204,.045)';

                for(let x = 48; x < W - 40; x += 64)
                    context.fillRect(x, 40, 1, H - 76);

                context.fillStyle = '#102f4c';
                context.fillRect(22, 28, 8, H - 56);
                context.fillRect(W - 30, 28, 8, H - 56);

                context.fillStyle = '#255d86';
                context.fillRect(24, 31, 2, H - 62);
                context.fillRect(W - 26, 31, 2, H - 62);

                context.strokeStyle = '#3b6c90';
                context.lineWidth = 1;
                context.strokeRect(30.5, 28.5, W - 61, H - 57);

                context.fillStyle = '#08192a';
                context.fillRect(286, 38, 68, 16);
                context.strokeStyle = '#355f7d';
                context.strokeRect(286.5, 38.5, 67, 15);

                context.fillStyle = '#f4d862';
                context.font = 'bold 8px monospace';
                context.textAlign = 'center';
                context.textBaseline = 'middle';
                context.fillText(
                    `NIVEL ${ game.level.toString().padStart(2, '0') }`,
                    W / 2,
                    46
                );

                for(const brick of game.bricks)
                {
                    if(!brick.alive)
                        continue;

                    const [ top, middle, bottom ] =
                        brickColor(brick);

                    context.fillStyle = '#06101d';
                    context.fillRect(
                        brick.x - 1,
                        brick.y - 1,
                        brick.w + 2,
                        brick.h + 2
                    );

                    const gradient =
                        context.createLinearGradient(
                            brick.x,
                            brick.y,
                            brick.x,
                            brick.y + brick.h
                        );

                    gradient.addColorStop(0, top);
                    gradient.addColorStop(.48, middle);
                    gradient.addColorStop(1, bottom);

                    context.fillStyle = gradient;
                    context.fillRect(
                        brick.x,
                        brick.y,
                        brick.w,
                        brick.h
                    );

                    context.fillStyle = 'rgba(255,255,255,.28)';
                    context.fillRect(
                        brick.x + 2,
                        brick.y + 2,
                        brick.w - 4,
                        2
                    );

                    if(brick.hp > 1)
                    {
                        context.fillStyle = '#102239';
                        context.font = 'bold 7px monospace';
                        context.textAlign = 'center';
                        context.fillText(
                            brick.hp.toString(),
                            brick.x + (brick.w / 2),
                            brick.y + 10
                        );
                    }
                }

                for(const power of game.powerUps)
                    drawPower(context, power);

                for(const ball of game.balls)
                {
                    context.fillStyle = 'rgba(96,210,255,.18)';
                    context.fillRect(
                        Math.round(ball.x - 7),
                        Math.round(ball.y - 7),
                        14,
                        14
                    );

                    context.fillStyle = '#f5fbff';
                    context.fillRect(
                        Math.round(ball.x - 4),
                        Math.round(ball.y - 4),
                        8,
                        8
                    );

                    context.fillStyle = '#84dcff';
                    context.fillRect(
                        Math.round(ball.x - 3),
                        Math.round(ball.y - 3),
                        3,
                        3
                    );
                }

                // Paddle.
                const px =
                    Math.round(
                        game.paddleX -
                        (game.paddleWidth / 2)
                    );

                context.fillStyle = '#07101c';
                context.fillRect(
                    px - 2,
                    PADDLE_Y - 2,
                    game.paddleWidth + 4,
                    13
                );

                const paddleGradient =
                    context.createLinearGradient(
                        0,
                        PADDLE_Y,
                        0,
                        PADDLE_Y + 9
                    );

                paddleGradient.addColorStop(0, '#fff09a');
                paddleGradient.addColorStop(.52, '#e2b33e');
                paddleGradient.addColorStop(1, '#9d6924');

                context.fillStyle = paddleGradient;
                context.fillRect(
                    px,
                    PADDLE_Y,
                    game.paddleWidth,
                    9
                );

                context.fillStyle = '#64cfff';
                context.fillRect(
                    px + 6,
                    PADDLE_Y + 2,
                    12,
                    5
                );
                context.fillRect(
                    px + game.paddleWidth - 18,
                    PADDLE_Y + 2,
                    12,
                    5
                );

                if(
                    game.balls.length === 0 &&
                    game.launchTimer > 0
                )
                {
                    const pulse =
                        Math.floor(performance.now() / 170) % 2 === 0;

                    context.fillStyle =
                        pulse
                            ? '#f8fbff'
                            : '#7fd8ff';

                    context.fillRect(
                        Math.round(game.paddleX - 4),
                        PADDLE_Y - 14,
                        8,
                        8
                    );
                }

                for(const particle of game.particles)
                {
                    const colors = [
                        '#ffe56f',
                        '#62cfff',
                        '#ff9a70',
                        '#f8fbff'
                    ];

                    context.globalAlpha =
                        clamp(
                            particle.ttl / .65,
                            0,
                            1
                        );

                    context.fillStyle =
                        colors[
                            particle.kind %
                            colors.length
                        ];

                    context.fillRect(
                        Math.round(particle.x),
                        Math.round(particle.y),
                        2,
                        2
                    );
                }

                context.globalAlpha = 1;

                for(const popup of game.popups)
                {
                    const colors = [
                        '#ffe56f',
                        '#9eeeff',
                        '#ffad7f',
                        '#ffffff'
                    ];

                    context.globalAlpha =
                        clamp(
                            popup.ttl / .85,
                            0,
                            1
                        );

                    context.fillStyle =
                        colors[
                            popup.accent %
                            colors.length
                        ];

                    context.font = 'bold 9px monospace';
                    context.textAlign = 'center';
                    context.fillText(
                        popup.text,
                        popup.x,
                        popup.y
                    );
                }

                context.globalAlpha = 1;

                if(
                    game.feedbackTime > 0 &&
                    game.feedback
                )
                {
                    context.fillStyle = 'rgba(4,13,27,.91)';
                    context.fillRect(220, 392, 200, 18);

                    context.strokeStyle = '#356a92';
                    context.strokeRect(220.5, 392.5, 199, 17);

                    context.fillStyle = '#ffe36f';
                    context.font = 'bold 8px monospace';
                    context.textAlign = 'center';
                    context.fillText(
                        game.feedback,
                        W / 2,
                        404
                    );
                }

                if(game.levelFlash > 0)
                {
                    context.fillStyle =
                        `rgba(255,224,93,${
                            Math.min(.12, game.levelFlash * .16)
                        })`;

                    context.fillRect(0, 0, W, H);
                }

                if(game.hitFlash > 0)
                {
                    context.fillStyle =
                        `rgba(98,205,255,${
                            Math.min(.05, game.hitFlash * .4)
                        })`;

                    context.fillRect(0, 0, W, H);
                }

                context.fillStyle = 'rgba(255,255,255,.010)';

                for(let y = 0; y < H; y += 4)
                    context.fillRect(0, y, W, 1);
            };

            const frame = (now: number) =>
            {
                if(visibleRef.current)
                {
                    const last = lastFrameRef.current;
                    lastFrameRef.current = now;

                    if(
                        last > 0 &&
                        gameRef.current.phase === 'playing'
                    )
                    {
                        const dt =
                            Math.min(
                                .033,
                                Math.max(
                                    0,
                                    (now - last) / 1000
                                )
                            );

                        update(dt);
                    }

                    draw();
                }
                else
                {
                    lastFrameRef.current = now;
                }

                frameId =
                    window.requestAnimationFrame(frame);
            };

            frameId =
                window.requestAnimationFrame(frame);

            return () =>
                window.cancelAnimationFrame(frameId);
        },
        []
    );

    if(!isVisible)
        return null;

    const remaining =
        gameRef.current.bricks.filter(
            brick => brick.alive
        ).length;

    const phaseLabel =
        phase === 'playing'
            ? 'JUGANDO'
            : phase === 'paused'
                ? 'PAUSA'
                : phase === 'gameover'
                    ? 'FIN'
                    : 'PREPARADO';

    return (
        <>
            <NitroCardView
                uniqueKey="arkanoid"
                className="nitro-arkanoid"
                theme="primary-slim"
                style={ { width: '760px' } }>
                <NitroCardHeaderView
                    headerText="Arkanoid"
                    onCloseClick={ close } />

                <NitroCardContentView
                    gap={ 0 }
                    className="arkanoid-content">
                    <div
                        className="arkanoid-shell"
                        data-engine={ UI_MARKER }>
                        <span
                            className="arkanoid-cabinet-screw is-top-left"
                            aria-hidden="true" />
                        <span
                            className="arkanoid-cabinet-screw is-top-right"
                            aria-hidden="true" />
                        <span
                            className="arkanoid-cabinet-screw is-bottom-left"
                            aria-hidden="true" />
                        <span
                            className="arkanoid-cabinet-screw is-bottom-right"
                            aria-hidden="true" />

                        <div className="arkanoid-hud">
                            <div className="arkanoid-hud-cell is-score">
                                <span className="arkanoid-hud-label">
                                    PUNTUACIÓN
                                </span>
                                <strong className="arkanoid-score-value">
                                    { fmt(score) }
                                </strong>
                            </div>

                            <div className="arkanoid-hud-cell is-round">
                                <span className="arkanoid-hud-label">
                                    NIVEL
                                </span>
                                <strong className="arkanoid-level-value">
                                    { level.toString().padStart(2, '0') }
                                </strong>
                            </div>

                            <div className="arkanoid-hud-cell is-hits">
                                <span className="arkanoid-hud-label">
                                    BLOQUES
                                </span>
                                <strong className="arkanoid-blocks-value">
                                    { blocks }
                                </strong>
                            </div>

                            <div className="arkanoid-hud-cell is-lives">
                                <span className="arkanoid-hud-label">
                                    VIDAS
                                </span>
                                <div
                                    className="arkanoid-life-row"
                                    aria-label={ `${ lives } vidas` }>
                                    { Array.from(
                                        { length: MAX_LIVES },
                                        (_, index) =>
                                            <ArkanoidPixelHeart
                                                key={ index }
                                                active={ index < lives } />
                                    ) }
                                </div>
                            </div>

                            <div
                                className={
                                    `arkanoid-hud-cell is-status is-${ phase }`
                                }>
                                <ArkanoidStatusIcon />
                                <strong>{ phaseLabel }</strong>
                            </div>
                        </div>

                        <div className="arkanoid-stage">
                            <canvas
                                ref={ canvasRef }
                                className="arkanoid-canvas"
                                width={ W * 2 }
                                height={ H * 2 }
                                tabIndex={ 0 }
                                aria-label="Arkanoid" />

                            { phase === 'ready' &&
                                <div className="arkanoid-game-overlay">
                                    <div className="arkanoid-overlay-panel">
                                        <span className="arkanoid-overlay-kicker">
                                            ROMPEBLOQUES
                                        </span>

                                        <strong className="arkanoid-overlay-title">
                                            ARKANOID
                                        </strong>

                                        <span className="arkanoid-overlay-copy">
                                            Rompe todos los bloques y domina
                                            el rebote de la bola.
                                        </span>

                                        <button
                                            type="button"
                                            className="arkanoid-primary-button"
                                            disabled={ startPending }
                                            onClick={ requestStart }>
                                            { startPending
                                                ? 'PREPARANDO...'
                                                : 'JUGAR' }
                                        </button>

                                        <span className="arkanoid-overlay-hint">
                                            ENTER también inicia la partida
                                        </span>

                                        { resultState === 'rejected' &&
                                            <span className="arkanoid-result-message is-error">
                                                { resultMessage }
                                            </span> }
                                    </div>
                                </div> }

                            { phase === 'paused' &&
                                <div className="arkanoid-game-overlay is-pause">
                                    <div className="arkanoid-overlay-panel is-compact">
                                        <span className="arkanoid-overlay-kicker">
                                            PARTIDA DETENIDA
                                        </span>

                                        <strong className="arkanoid-overlay-title">
                                            PAUSA
                                        </strong>

                                        <button
                                            type="button"
                                            className="arkanoid-primary-button"
                                            onClick={ togglePause }>
                                            CONTINUAR
                                        </button>

                                        <span className="arkanoid-overlay-hint">
                                            P o ESC para continuar
                                        </span>
                                    </div>
                                </div> }

                            { phase === 'gameover' &&
                                <div className="arkanoid-game-overlay is-gameover">
                                    <div className="arkanoid-overlay-panel">
                                        <span className="arkanoid-overlay-kicker">
                                            SIN BOLAS
                                        </span>

                                        <strong className="arkanoid-overlay-title">
                                            FIN DE PARTIDA
                                        </strong>

                                        <div className="arkanoid-gameover-results">
                                            <span>
                                                PUNTUACIÓN
                                                <b>{ fmt(score) }</b>
                                            </span>

                                            <span>
                                                NIVEL
                                                <b>{ level }</b>
                                            </span>

                                            <span>
                                                BLOQUES
                                                <b>{ blocks }</b>
                                            </span>
                                        </div>

                                        { newServerRecord &&
                                            <div className="arkanoid-new-record">
                                                ★ NUEVO RÉCORD PERSONAL ★
                                            </div> }

                                        { resultState !== 'idle' &&
                                            <span
                                                className={
                                                    `arkanoid-result-message${
                                                        resultState === 'rejected'
                                                            ? ' is-error'
                                                            : ' is-success'
                                                    }`
                                                }>
                                                { resultMessage }
                                            </span> }

                                        <button
                                            type="button"
                                            className="arkanoid-primary-button"
                                            disabled={ startPending }
                                            onClick={ requestStart }>
                                            { startPending
                                                ? 'PREPARANDO...'
                                                : 'JUGAR DE NUEVO' }
                                        </button>
                                    </div>
                                </div> }
                        </div>

                        <div className="arkanoid-console">
                            <div className="arkanoid-controls-panel">
                                <div className="arkanoid-control-group">
                                    <span className="arkanoid-keycap">
                                        ←
                                    </span>

                                    <span className="arkanoid-keycap">
                                        →
                                    </span>

                                    <span className="arkanoid-control-action">
                                        MOVER PALA
                                    </span>
                                </div>

                                <span className="arkanoid-console-divider" />

                                <div className="arkanoid-control-group">
                                    <span className="arkanoid-keycap">
                                        P
                                    </span>

                                    <span className="arkanoid-control-action">
                                        PAUSA
                                    </span>
                                </div>
                            </div>

                            <div className="arkanoid-console-actions">
                                <button
                                    type="button"
                                    className={
                                        `arkanoid-sound-button${
                                            soundEnabled
                                                ? ' is-on'
                                                : ''
                                        }`
                                    }
                                    onClick={ toggleSound }
                                    aria-pressed={ soundEnabled }>
                                    <span
                                        className="arkanoid-sound-icon"
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
                                    className="arkanoid-restart-button"
                                    disabled={ startPending }
                                    onClick={ requestStart }>
                                    <span className="arkanoid-restart-shine" />
                                    <span>REINICIAR</span>
                                </button>
                            </div>
                        </div>

                        <div className="arkanoid-summary-bar">
                            <div className="arkanoid-summary-brand">
                                <span>RANKING GLOBAL</span>
                                <strong>ARKANOID</strong>
                            </div>

                            <div className="arkanoid-summary-stats">
                                <span>
                                    TU RÉCORD
                                    <b>{ fmt(serverBest) }</b>
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
                                className="arkanoid-records-button"
                                onClick={ openRecords }>
                                <span
                                    className="arkanoid-records-star"
                                    aria-hidden="true">
                                    ★
                                </span>

                                <span>RÉCORDS</span>
                            </button>
                        </div>
                    </div>
                </NitroCardContentView>
            </NitroCardView>

            <ArcadeLeaderboardView
                visible={ recordsOpen }
                gameName="Arkanoid"
                levelLabel="NIVEL"
                leaderboard={ leaderboard }
                personalBest={ serverBest }
                personalRank={ personalRank }
                totalPlayers={ totalPlayers }
                onClose={ closeRecords } />
        </>
    );
};

export default ArkanoidView;

// BIRIBIRI_ARKANOID_VISUAL_V2

// BIRIBIRI_ARKANOID_CANONICAL_CONTROLS_V1
