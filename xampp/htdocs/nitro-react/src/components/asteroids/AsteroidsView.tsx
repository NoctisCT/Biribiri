import {
    ArcadeCloseEvent,
    ArcadeGameStartComposer,
    ArcadeGameStartedEvent,
    ArcadeLeaderboardEvent,
    ArcadeScoreSubmitComposer,
    AsteroidsOpenEvent
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
import './AsteroidsView.scss';

type Phase = 'ready' | 'playing' | 'paused' | 'gameover';
type Size = 1 | 2 | 3;

interface LeaderboardEntry
{
    rank: number;
    username: string;
    score: number;
    level: number;
}

interface Ship
{
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
}

interface Rock
{
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    size: Size;
    angle: number;
    spin: number;
    points: number[];
}

interface Shot
{
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
}

interface Spark
{
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
}

interface GameModel
{
    phase: Phase;
    score: number;
    level: number;
    lives: number;
    ship: Ship;
    rocks: Rock[];
    shots: Shot[];
    sparks: Spark[];
    fireCooldown: number;
    invulnerable: number;
    respawnDelay: number;
    waveBanner: number;
    nextId: number;
}

const WIDTH = 640;
const HEIGHT = 480;
const MAX_LIVES = 3;
const GAME_KEY = 'asteroids';
const UI_MARKER = 'BIRIBIRI_ASTEROIDS_V2_VECTOR_IDENTITY';

const wrap = (value: number, max: number): number =>
{
    if(value < 0) return value + max;
    if(value >= max) return value - max;
    return value;
};

const distanceSq = (
    ax: number,
    ay: number,
    bx: number,
    by: number): number =>
{
    const dx = ax - bx;
    const dy = ay - by;
    return (dx * dx) + (dy * dy);
};

const makeShip = (): Ship => ({
    x: WIDTH / 2,
    y: HEIGHT / 2,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2
});

const rockRadius = (size: Size): number =>
    size === 3 ? 34 : size === 2 ? 22 : 13;

const rockScore = (size: Size): number =>
    size === 3 ? 20 : size === 2 ? 50 : 100;

const makeRock = (
    id: number,
    size: Size,
    level: number,
    x?: number,
    y?: number): Rock =>
{
    const radius = rockRadius(size);

    let rx = x ?? Math.random() * WIDTH;
    let ry = y ?? Math.random() * HEIGHT;

    if(x === undefined || y === undefined)
    {
        let attempts = 0;

        while(
            distanceSq(rx, ry, WIDTH / 2, HEIGHT / 2) < 170 * 170 &&
            attempts < 20)
        {
            rx = Math.random() * WIDTH;
            ry = Math.random() * HEIGHT;
            attempts++;
        }
    }

    const speedBase =
        34 +
        ((3 - size) * 24) +
        Math.min(52, level * 3);

    const direction = Math.random() * Math.PI * 2;
    const speed = speedBase * (.72 + Math.random() * .58);

    const vertices = 9;
    const points = Array.from(
        { length: vertices },
        () => .72 + Math.random() * .34
    );

    return {
        id,
        x: rx,
        y: ry,
        vx: Math.cos(direction) * speed,
        vy: Math.sin(direction) * speed,
        radius,
        size,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - .5) * (1.0 + (3 - size) * .5),
        points
    };
};

const makeWave = (
    level: number,
    startId = 1): { rocks: Rock[]; nextId: number } =>
{
    const count = Math.min(8, 4 + Math.floor((level - 1) / 2));
    const rocks: Rock[] = [];
    let nextId = startId;

    for(let i = 0; i < count; i++)
    {
        rocks.push(makeRock(nextId++, 3, level));
    }

    return { rocks, nextId };
};

const makeGame = (
    phase: Phase = 'ready',
    score = 0,
    level = 1,
    lives = MAX_LIVES): GameModel =>
{
    const wave = makeWave(level);

    return {
        phase,
        score,
        level,
        lives,
        ship: makeShip(),
        rocks: wave.rocks,
        shots: [],
        sparks: [],
        fireCooldown: 0,
        invulnerable: 1.8,
        respawnDelay: 0,
        waveBanner: phase === 'playing' ? 1.15 : 0,
        nextId: wave.nextId
    };
};

const MiniShip: FC<{ active: boolean }> = ({ active }) =>
{
    return (
        <svg
            className={
                `asteroids-life-ship${ active ? ' is-active' : '' }`
            }
            viewBox="0 0 18 18"
            aria-hidden="true">
            <path d="M9 1 L16 16 L9 12 L2 16 Z" />
        </svg>
    );
};

const StatusRock: FC<{}> = () =>
{
    return (
        <svg
            className="asteroids-status-rock"
            viewBox="0 0 20 20"
            aria-hidden="true">
            <path d="M5 1 L14 2 L19 8 L16 16 L9 19 L2 14 L1 7 Z" />
            <path className="rock-cut" d="M6 5 L10 4 L12 8 L8 10 Z" />
        </svg>
    );
};

export const AsteroidsView: FC<{}> = () =>
{
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const visibleRef = useRef(false);
    const keysRef = useRef<Set<string>>(new Set());
    const lastFrameRef = useRef(0);
    const gameRef = useRef<GameModel>(makeGame());
    const itemIdRef = useRef(0);
    const recordRef = useRef(0);
    const serverBestRef = useRef(0);
    const runTokenRef = useRef('');
    const submittedRunRef = useRef(false);
    const startPendingRef = useRef(false);
    const soundEnabledRef = useRef(true);
    const audioRef = useRef<AudioContext | null>(null);

    const [ isVisible, setIsVisible ] = useState(false);
    const [ itemId, setItemId ] = useState(0);
    const [ score, setScore ] = useState(0);
    const [ record, setRecord ] = useState(0);
    const [ serverBest, setServerBest ] = useState(0);
    const [ lives, setLives ] = useState(MAX_LIVES);
    const [ level, setLevel ] = useState(1);
    const [ phase, setPhase ] = useState<Phase>('ready');
    const [ rocksLeft, setRocksLeft ] = useState(0);
    const [ soundEnabled, setSoundEnabled ] = useState(true);
    const [ startPending, setStartPending ] = useState(false);
    const [ leaderboard, setLeaderboard ] = useState<LeaderboardEntry[]>([]);
    const [ personalRank, setPersonalRank ] = useState(0);
    const [ totalPlayers, setTotalPlayers ] = useState(0);
    const [ resultState, setResultState ] =
        useState<'idle' | 'accepted' | 'rejected'>('idle');
    const [ resultMessage, setResultMessage ] = useState('');
    const [ newServerRecord, setNewServerRecord ] = useState(false);
    const [ recordsOpen, setRecordsOpen ] = useState(false);

    const ensureAudio = (): AudioContext | null =>
    {
        if(!soundEnabledRef.current) return null;

        try
        {
            if(!audioRef.current)
            {
                const AudioContextClass =
                    window.AudioContext ||
                    (window as any).webkitAudioContext;

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
        volume = .02,
        endFrequency?: number) =>
    {
        const context = ensureAudio();
        if(!context) return;

        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const start = context.currentTime;

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, start);

        if(endFrequency !== undefined)
        {
            oscillator.frequency.exponentialRampToValueAtTime(
                Math.max(1, endFrequency),
                start + duration
            );
        }

        gain.gain.setValueAtTime(.0001, start);
        gain.gain.exponentialRampToValueAtTime(
            Math.min(.09, volume * 2.5),
            start + .008
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

    const playShoot = () =>
        tone(660, .055, 'square', .012, 290);

    const playRock = (size: Size) =>
        tone(
            size === 3 ? 115 : size === 2 ? 155 : 210,
            .08,
            'sawtooth',
            .018,
            52
        );

    const playThrust = () =>
        tone(78, .04, 'sawtooth', .006, 58);

    const playCrash = () =>
    {
        tone(150, .18, 'sawtooth', .035, 42);
    };

    const playWave = () =>
    {
        tone(330, .08, 'square', .018, 430);
    };

    const playGameOver = () =>
    {
        tone(240, .16, 'square', .025, 120);
    };

    const updateRecord = (nextScore: number) =>
    {
        const candidate =
            Math.max(serverBestRef.current, nextScore);

        if(candidate === recordRef.current) return;

        recordRef.current = candidate;
        setRecord(candidate);
    };

    const syncHud = () =>
    {
        const game = gameRef.current;

        setScore(game.score);
        setLives(game.lives);
        setLevel(game.level);
        setPhase(game.phase);
        setRocksLeft(game.rocks.length);
        updateRecord(game.score);
    };

    const newReadyGame = () =>
    {
        gameRef.current = makeGame('ready');
        runTokenRef.current = '';
        submittedRunRef.current = false;
        startPendingRef.current = false;
        keysRef.current.clear();
        lastFrameRef.current = 0;
        setStartPending(false);
        setResultState('idle');
        setResultMessage('');
        setNewServerRecord(false);
        syncHud();
    };

    const beginLocalRun = (token: string) =>
    {
        if(!token) return;

        runTokenRef.current = token;
        submittedRunRef.current = false;
        startPendingRef.current = false;
        gameRef.current = makeGame('playing');
        keysRef.current.clear();
        lastFrameRef.current = 0;

        setStartPending(false);
        setResultState('idle');
        setResultMessage('');
        setNewServerRecord(false);
        syncHud();
        playWave();

        window.setTimeout(
            () => canvasRef.current?.focus(),
            0
        );
    };

    const requestStartGame = () =>
    {
        if(
            !visibleRef.current ||
            startPendingRef.current ||
            itemIdRef.current <= 0)
        {
            return;
        }

        ensureAudio();
        startPendingRef.current = true;
        setStartPending(true);
        setResultState('idle');
        setResultMessage('');
        setNewServerRecord(false);

        try
        {
            SendMessageComposer(
                new ArcadeGameStartComposer(
                    itemIdRef.current,
                    GAME_KEY
                )
            );
        }
        catch
        {
            startPendingRef.current = false;
            setStartPending(false);
            setResultState('rejected');
            setResultMessage('No se pudo iniciar la partida.');
        }
    };

    const restartGame = () => requestStartGame();

    const submitRunResult = (
        finalScore: number,
        finalLevel: number) =>
    {
        const token = runTokenRef.current;

        if(
            !token ||
            submittedRunRef.current ||
            itemIdRef.current <= 0)
        {
            return;
        }

        submittedRunRef.current = true;

        try
        {
            SendMessageComposer(
                new ArcadeScoreSubmitComposer(
                    itemIdRef.current,
                    GAME_KEY,
                    token,
                    finalScore,
                    finalLevel
                )
            );
        }
        catch
        {
            submittedRunRef.current = false;
            setResultState('rejected');
            setResultMessage('No se pudo enviar la puntuación.');
        }
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
        else
            return;

        setPhase(game.phase);
    };

    const close = () =>
    {
        visibleRef.current = false;
        keysRef.current.clear();
        runTokenRef.current = '';
        submittedRunRef.current = false;
        startPendingRef.current = false;
        setStartPending(false);
        setRecordsOpen(false);
        setIsVisible(false);

        if(gameRef.current.phase === 'playing')
            gameRef.current.phase = 'paused';
    };

    const toggleSound = () =>
    {
        const next = !soundEnabledRef.current;

        soundEnabledRef.current = next;
        setSoundEnabled(next);

        if(next)
        {
            ensureAudio();
            tone(520, .06, 'square', .018);
        }
    };

    const openRecords = () =>
    {
        if(gameRef.current.phase === 'playing')
        {
            gameRef.current.phase = 'paused';
            setPhase('paused');
            keysRef.current.clear();
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

    useEffect(() =>
    {
        return () =>
        {
            const context = audioRef.current;

            if(context)
            {
                void context.close().catch(() => undefined);
                audioRef.current = null;
            }
        };
    }, []);

    useMessageEvent(
        AsteroidsOpenEvent,
        (event: AsteroidsOpenEvent) =>
    {
        const parser = event.getParser();

        itemIdRef.current = parser.itemId;
        setItemId(parser.itemId);
        setLeaderboard([]);
        setPersonalRank(0);
        setTotalPlayers(0);
        serverBestRef.current = 0;
        recordRef.current = 0;
        setServerBest(0);
        setRecord(0);
        setRecordsOpen(false);
        newReadyGame();

        visibleRef.current = true;
        setIsVisible(true);

        window.setTimeout(
            () => canvasRef.current?.focus(),
            0
        );
    });

    useMessageEvent(
        ArcadeGameStartedEvent,
        (event: ArcadeGameStartedEvent) =>
    {
        const parser = event.getParser();

        if(
            !visibleRef.current ||
            parser.gameKey !== GAME_KEY ||
            parser.itemId !== itemIdRef.current)
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

        beginLocalRun(parser.token);
    });

    useMessageEvent(
        ArcadeLeaderboardEvent,
        (event: ArcadeLeaderboardEvent) =>
    {
        const parser = event.getParser();

        if(parser.gameKey !== GAME_KEY) return;

        const entries: LeaderboardEntry[] =
            parser.entries.map(entry => ({
                rank: entry.rank,
                username: entry.username,
                score: entry.score,
                level: entry.level
            }));

        setLeaderboard(entries);
        setPersonalRank(parser.personalRank);
        setTotalPlayers(parser.totalPlayers);
        setServerBest(parser.personalBest);

        serverBestRef.current = parser.personalBest;

        const visibleRecord =
            Math.max(
                parser.personalBest,
                gameRef.current.score
            );

        recordRef.current = visibleRecord;
        setRecord(visibleRecord);

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
    });

    useMessageEvent(
        ArcadeCloseEvent,
        (event: ArcadeCloseEvent) =>
    {
        const parser = event.getParser();

        if(
            parser.gameKey !== GAME_KEY ||
            parser.itemId !== itemIdRef.current)
        {
            return;
        }

        visibleRef.current = false;
        keysRef.current.clear();
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

            if([
                'ArrowLeft',
                'ArrowRight',
                'ArrowUp',
                'KeyA',
                'KeyD',
                'KeyW',
                'Space',
                'Enter',
                'KeyP',
                'Escape'
            ].includes(event.code))
            {
                event.preventDefault();
            }

            if(event.code === 'Enter')
            {
                const current = gameRef.current.phase;

                if(current === 'ready' || current === 'gameover')
                {
                    requestStartGame();
                    return;
                }
            }

            if(event.code === 'KeyP' || event.code === 'Escape')
            {
                togglePause();
                return;
            }

            keysRef.current.add(event.code);
        };

        const up = (event: KeyboardEvent) =>
            keysRef.current.delete(event.code);

        const blur = () =>
        {
            if(
                visibleRef.current &&
                gameRef.current.phase === 'playing')
            {
                gameRef.current.phase = 'paused';
                setPhase('paused');
                keysRef.current.clear();
            }
        };

        window.addEventListener(
            'keydown',
            down,
            { passive: false }
        );
        window.addEventListener('keyup', up);
        window.addEventListener('blur', blur);

        return () =>
        {
            window.removeEventListener('keydown', down);
            window.removeEventListener('keyup', up);
            window.removeEventListener('blur', blur);
        };
    }, []);

    useEffect(() =>
    {
        let frameId = 0;
        let thrustSoundTimer = 0;

        const spawnSparks = (
            x: number,
            y: number,
            count: number,
            speed: number) =>
        {
            const game = gameRef.current;

            for(let i = 0; i < count; i++)
            {
                const angle = Math.random() * Math.PI * 2;
                const amount = speed * (.35 + Math.random() * .8);
                const life = .22 + Math.random() * .35;

                game.sparks.push({
                    x,
                    y,
                    vx: Math.cos(angle) * amount,
                    vy: Math.sin(angle) * amount,
                    life,
                    maxLife: life
                });
            }
        };

        const finishGame = () =>
        {
            const game = gameRef.current;

            if(game.phase === 'gameover') return;

            game.phase = 'gameover';
            game.shots = [];
            setPhase('gameover');
            updateRecord(game.score);
            playGameOver();
            submitRunResult(game.score, game.level);
        };

        const award = (points: number) =>
        {
            const game = gameRef.current;

            game.score += points;
            setScore(game.score);
            updateRecord(game.score);
        };

        const splitRock = (rock: Rock) =>
        {
            const game = gameRef.current;

            award(rockScore(rock.size));
            playRock(rock.size);
            spawnSparks(
                rock.x,
                rock.y,
                rock.size === 3 ? 12 : 8,
                rock.size === 3 ? 125 : 150
            );

            if(rock.size > 1)
            {
                const childSize =
                    (rock.size - 1) as Size;

                for(let i = 0; i < 2; i++)
                {
                    const child = makeRock(
                        game.nextId++,
                        childSize,
                        game.level,
                        rock.x,
                        rock.y
                    );

                    const angle =
                        Math.atan2(rock.vy, rock.vx) +
                        (i === 0 ? -.75 : .75);

                    const speed =
                        Math.hypot(
                            child.vx,
                            child.vy
                        );

                    child.vx = Math.cos(angle) * speed;
                    child.vy = Math.sin(angle) * speed;
                    game.rocks.push(child);
                }
            }
        };

        const respawnShip = () =>
        {
            const game = gameRef.current;
            game.ship = makeShip();
            game.invulnerable = 1.8;
            game.respawnDelay = 0;
        };

        const update = (dt: number) =>
        {
            const game = gameRef.current;

            game.sparks.forEach(spark =>
            {
                spark.x += spark.vx * dt;
                spark.y += spark.vy * dt;
                spark.vx *= Math.pow(.25, dt);
                spark.vy *= Math.pow(.25, dt);
                spark.life -= dt;
            });

            game.sparks =
                game.sparks.filter(spark => spark.life > 0);

            game.waveBanner = Math.max(0, game.waveBanner - dt);

            if(game.phase !== 'playing') return;

            if(game.respawnDelay > 0)
            {
                game.respawnDelay -= dt;

                if(game.respawnDelay <= 0)
                    respawnShip();
            }

            game.invulnerable = Math.max(0, game.invulnerable - dt);
            game.fireCooldown = Math.max(0, game.fireCooldown - dt);

            const keys = keysRef.current;
            const ship = game.ship;

            let rotation = 0;

            if(keys.has('ArrowLeft') || keys.has('KeyA'))
                rotation -= 1;

            if(keys.has('ArrowRight') || keys.has('KeyD'))
                rotation += 1;

            ship.angle += rotation * 3.55 * dt;

            const thrust =
                keys.has('ArrowUp') ||
                keys.has('KeyW');

            if(thrust && game.respawnDelay <= 0)
            {
                const accel = 225;

                ship.vx += Math.cos(ship.angle) * accel * dt;
                ship.vy += Math.sin(ship.angle) * accel * dt;

                const speed = Math.hypot(ship.vx, ship.vy);
                const maxSpeed = 255;

                if(speed > maxSpeed)
                {
                    ship.vx *= maxSpeed / speed;
                    ship.vy *= maxSpeed / speed;
                }

                thrustSoundTimer -= dt;

                if(thrustSoundTimer <= 0)
                {
                    thrustSoundTimer = .13;
                    playThrust();
                }
            }

            const drag = Math.pow(.88, dt);
            ship.vx *= drag;
            ship.vy *= drag;

            ship.x = wrap(ship.x + ship.vx * dt, WIDTH);
            ship.y = wrap(ship.y + ship.vy * dt, HEIGHT);

            if(
                keys.has('Space') &&
                game.fireCooldown <= 0 &&
                game.respawnDelay <= 0 &&
                game.shots.length < 5)
            {
                const noseX =
                    ship.x + Math.cos(ship.angle) * 16;

                const noseY =
                    ship.y + Math.sin(ship.angle) * 16;

                game.shots.push({
                    x: noseX,
                    y: noseY,
                    vx:
                        Math.cos(ship.angle) * 430 +
                        ship.vx * .28,
                    vy:
                        Math.sin(ship.angle) * 430 +
                        ship.vy * .28,
                    life: 1.18
                });

                game.fireCooldown = .18;
                playShoot();
            }

            for(const shot of game.shots)
            {
                shot.x = wrap(shot.x + shot.vx * dt, WIDTH);
                shot.y = wrap(shot.y + shot.vy * dt, HEIGHT);
                shot.life -= dt;
            }

            game.shots =
                game.shots.filter(shot => shot.life > 0);

            for(const rock of game.rocks)
            {
                rock.x = wrap(rock.x + rock.vx * dt, WIDTH);
                rock.y = wrap(rock.y + rock.vy * dt, HEIGHT);
                rock.angle += rock.spin * dt;
            }

            const hitShots = new Set<Shot>();
            const hitRocks = new Set<Rock>();

            for(const shot of game.shots)
            {
                for(const rock of game.rocks)
                {
                    if(hitRocks.has(rock)) continue;

                    if(
                        distanceSq(
                            shot.x,
                            shot.y,
                            rock.x,
                            rock.y
                        ) <=
                        (rock.radius + 3) *
                        (rock.radius + 3))
                    {
                        hitShots.add(shot);
                        hitRocks.add(rock);
                        break;
                    }
                }
            }

            if(hitShots.size)
            {
                game.shots =
                    game.shots.filter(
                        shot => !hitShots.has(shot)
                    );
            }

            if(hitRocks.size)
            {
                game.rocks =
                    game.rocks.filter(
                        rock => !hitRocks.has(rock)
                    );

                for(const rock of hitRocks)
                    splitRock(rock);

                setRocksLeft(game.rocks.length);
            }

            if(
                game.invulnerable <= 0 &&
                game.respawnDelay <= 0)
            {
                for(const rock of game.rocks)
                {
                    const limit = rock.radius + 10;

                    if(
                        distanceSq(
                            ship.x,
                            ship.y,
                            rock.x,
                            rock.y
                        ) <=
                        limit * limit)
                    {
                        game.lives -= 1;
                        setLives(game.lives);

                        spawnSparks(
                            ship.x,
                            ship.y,
                            22,
                            210
                        );

                        playCrash();

                        if(game.lives <= 0)
                        {
                            finishGame();
                            return;
                        }

                        game.respawnDelay = .85;
                        game.invulnerable = 999;
                        break;
                    }
                }
            }

            if(game.rocks.length === 0)
            {
                const nextLevel = game.level + 1;
                const nextScore = game.score + 250;
                const wave = makeWave(
                    nextLevel,
                    game.nextId
                );

                game.level = nextLevel;
                game.score = nextScore;
                game.rocks = wave.rocks;
                game.nextId = wave.nextId;
                game.shots = [];
                game.waveBanner = 1.2;
                game.invulnerable = Math.max(game.invulnerable, 1.2);

                setLevel(nextLevel);
                setScore(nextScore);
                setRocksLeft(game.rocks.length);
                updateRecord(nextScore);
                playWave();
            }
        };

        const drawRock = (
            ctx: CanvasRenderingContext2D,
            rock: Rock) =>
        {
            ctx.save();
            ctx.translate(rock.x, rock.y);
            ctx.rotate(rock.angle);

            const path = new Path2D();

            for(let i = 0; i < rock.points.length; i++)
            {
                const angle =
                    (i / rock.points.length) *
                    Math.PI *
                    2;

                const radius =
                    rock.radius *
                    rock.points[i];

                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;

                if(i === 0)
                    path.moveTo(x, y);
                else
                    path.lineTo(x, y);
            }

            path.closePath();

            ctx.shadowBlur = 10;
            ctx.shadowColor = 'rgba(71, 211, 231, .18)';
            ctx.strokeStyle = '#153a46';
            ctx.lineWidth = rock.size === 3 ? 5 : 4;
            ctx.stroke(path);

            ctx.shadowBlur = 0;
            ctx.strokeStyle =
                rock.size === 3
                    ? '#bdeff5'
                    : rock.size === 2
                        ? '#7fd7e4'
                        : '#54b7c8';

            ctx.lineWidth = rock.size === 3 ? 2 : 1.6;
            ctx.stroke(path);

            const craterScale =
                rock.size === 3
                    ? 1
                    : rock.size === 2
                        ? .72
                        : .48;

            ctx.strokeStyle = '#2c6977';
            ctx.lineWidth = 1;

            ctx.beginPath();
            ctx.arc(
                -rock.radius * .18,
                -rock.radius * .10,
                rock.radius * .19 * craterScale,
                .15,
                Math.PI * 1.75
            );
            ctx.stroke();

            if(rock.size >= 2)
            {
                ctx.beginPath();
                ctx.arc(
                    rock.radius * .26,
                    rock.radius * .18,
                    rock.radius * .12,
                    Math.PI * .2,
                    Math.PI * 1.55
                );
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(-rock.radius * .48, rock.radius * .18);
                ctx.lineTo(-rock.radius * .22, rock.radius * .05);
                ctx.lineTo(-rock.radius * .08, rock.radius * .28);
                ctx.stroke();
            }

            ctx.restore();
        };

        const drawShip = (
            ctx: CanvasRenderingContext2D,
            ship: Ship,
            thrust: boolean,
            visible: boolean) =>
        {
            if(!visible) return;

            ctx.save();
            ctx.translate(ship.x, ship.y);
            ctx.rotate(ship.angle);

            ctx.shadowBlur = 9;
            ctx.shadowColor = 'rgba(98, 225, 239, .28)';
            ctx.strokeStyle = '#eafcff';
            ctx.lineWidth = 2.2;

            ctx.beginPath();
            ctx.moveTo(18, 0);
            ctx.lineTo(-12, -11);
            ctx.lineTo(-7, 0);
            ctx.lineTo(-12, 11);
            ctx.closePath();
            ctx.stroke();

            ctx.shadowBlur = 0;
            ctx.strokeStyle = '#54c8da';
            ctx.lineWidth = 1;

            ctx.beginPath();
            ctx.moveTo(9, 0);
            ctx.lineTo(-5, -5);
            ctx.lineTo(-2, 0);
            ctx.lineTo(-5, 5);
            ctx.closePath();
            ctx.stroke();

            if(thrust)
            {
                const flame =
                    18 +
                    Math.random() * 9;

                ctx.shadowBlur = 8;
                ctx.shadowColor = 'rgba(255, 166, 58, .55)';
                ctx.strokeStyle = '#ffb44c';
                ctx.lineWidth = 2;

                ctx.beginPath();
                ctx.moveTo(-9, -5);
                ctx.lineTo(-flame, 0);
                ctx.lineTo(-9, 5);
                ctx.stroke();

                ctx.shadowBlur = 0;
                ctx.strokeStyle = '#fff1a8';
                ctx.lineWidth = 1;

                ctx.beginPath();
                ctx.moveTo(-10, -2);
                ctx.lineTo(-(flame - 5), 0);
                ctx.lineTo(-10, 2);
                ctx.stroke();
            }

            ctx.restore();
        };

        const draw = () =>
        {
            const canvas = canvasRef.current;
            if(!canvas) return;

            const ctx = canvas.getContext('2d');
            if(!ctx) return;

            const game = gameRef.current;

            const background =
                ctx.createRadialGradient(
                    WIDTH * .52,
                    HEIGHT * .46,
                    20,
                    WIDTH * .52,
                    HEIGHT * .46,
                    HEIGHT * .8
                );

            background.addColorStop(0, '#08161b');
            background.addColorStop(.58, '#03090d');
            background.addColorStop(1, '#010407');

            ctx.fillStyle = background;
            ctx.fillRect(0, 0, WIDTH, HEIGHT);

            for(let i = 0; i < 132; i++)
            {
                const x = (i * 89 + 13) % WIDTH;
                const y = (i * 53 + 31) % HEIGHT;
                const bright = i % 17 === 0;
                const medium = i % 7 === 0;

                ctx.fillStyle =
                    bright
                        ? '#bceef1'
                        : medium
                            ? '#3d8090'
                            : '#17343d';

                ctx.globalAlpha =
                    bright
                        ? .92
                        : medium
                            ? .48
                            : .34;

                ctx.fillRect(
                    x,
                    y,
                    bright ? 2 : 1,
                    bright ? 2 : 1
                );
            }

            ctx.globalAlpha = 1;

            ctx.strokeStyle = 'rgba(72, 199, 216, .12)';
            ctx.lineWidth = 1;

            for(let x = 64; x < WIDTH; x += 64)
            {
                ctx.beginPath();
                ctx.moveTo(x + .5, 0);
                ctx.lineTo(x + .5, HEIGHT);
                ctx.stroke();
            }

            for(let y = 64; y < HEIGHT; y += 64)
            {
                ctx.beginPath();
                ctx.moveTo(0, y + .5);
                ctx.lineTo(WIDTH, y + .5);
                ctx.stroke();
            }

            ctx.strokeStyle = '#214a56';
            ctx.strokeRect(.5, .5, WIDTH - 1, HEIGHT - 1);

            ctx.strokeStyle = '#4bc4d5';
            ctx.lineWidth = 1.5;

            const corner = 24;

            ctx.beginPath();
            ctx.moveTo(13, 37);
            ctx.lineTo(13, 13);
            ctx.lineTo(37, 13);

            ctx.moveTo(WIDTH - 37, 13);
            ctx.lineTo(WIDTH - 13, 13);
            ctx.lineTo(WIDTH - 13, 37);

            ctx.moveTo(13, HEIGHT - 37);
            ctx.lineTo(13, HEIGHT - 13);
            ctx.lineTo(37, HEIGHT - 13);

            ctx.moveTo(WIDTH - 37, HEIGHT - 13);
            ctx.lineTo(WIDTH - 13, HEIGHT - 13);
            ctx.lineTo(WIDTH - 13, HEIGHT - 37);
            ctx.stroke();

            ctx.fillStyle = '#58c9d9';
            ctx.font = '700 9px monospace';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText('CINTURÓN DE ASTEROIDES', 22, 20);

            ctx.textAlign = 'right';
            ctx.fillText(
                `ROCAS ${ game.rocks.length }`,
                WIDTH - 22,
                20
            );

            for(const rock of game.rocks)
                drawRock(ctx, rock);

            ctx.fillStyle = '#dffaff';

            for(const shot of game.shots)
            {
                ctx.beginPath();
                ctx.arc(shot.x, shot.y, 2.1, 0, Math.PI * 2);
                ctx.fill();
            }

            for(const spark of game.sparks)
            {
                const alpha =
                    Math.max(0, spark.life / spark.maxLife);

                ctx.globalAlpha = alpha;
                ctx.fillStyle = '#ffcf70';
                ctx.fillRect(
                    Math.round(spark.x),
                    Math.round(spark.y),
                    2,
                    2
                );
            }

            ctx.globalAlpha = 1;

            const thrust =
                keysRef.current.has('ArrowUp') ||
                keysRef.current.has('KeyW');

            const shipVisible =
                game.respawnDelay <= 0 &&
                (
                    game.invulnerable <= 0 ||
                    Math.floor(game.invulnerable * 11) % 2 === 0
                );

            drawShip(
                ctx,
                game.ship,
                thrust,
                shipVisible
            );

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            if(game.waveBanner > 0)
            {
                ctx.fillStyle = 'rgba(2, 7, 14, .75)';
                ctx.fillRect(
                    WIDTH / 2 - 90,
                    HEIGHT / 2 - 34,
                    180,
                    68
                );

                ctx.strokeStyle = '#72d9ff';
                ctx.lineWidth = 2;
                ctx.strokeRect(
                    WIDTH / 2 - 90,
                    HEIGHT / 2 - 34,
                    180,
                    68
                );

                ctx.font = 'bold 20px monospace';
                ctx.fillStyle = '#ffffff';
                ctx.fillText(
                    `NIVEL ${ game.level }`,
                    WIDTH / 2,
                    HEIGHT / 2
                );
            }
        };

        const frame = (now: number) =>
        {
            if(visibleRef.current)
            {
                const last = lastFrameRef.current;
                lastFrameRef.current = now;

                if(last > 0)
                {
                    const dt = Math.min(
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

            frameId = window.requestAnimationFrame(frame);
        };

        frameId = window.requestAnimationFrame(frame);

        return () =>
        {
            window.cancelAnimationFrame(frameId);
        };
    }, []);

    if(!isVisible) return null;

    const phaseLabel =
        startPending
            ? 'CONECTANDO'
            : phase === 'playing'
                ? 'JUGANDO'
                : phase === 'paused'
                    ? 'PAUSA'
                    : phase === 'gameover'
                        ? 'FIN'
                        : 'PREPARADO';

    const formattedScore =
        score.toString().padStart(5, '0');

    const formattedRecord =
        record.toString().padStart(5, '0');

    return (
        <>
        <NitroCardView
            uniqueKey="asteroids"
            className="nitro-space-invaders nitro-asteroids"
            theme="primary-slim"
            style={ { width: '780px' } }>
            <NitroCardHeaderView
                headerText="Asteroids"
                onCloseClick={ close } />

            <NitroCardContentView
                gap={ 0 }
                className="space-invaders-content">
                <div
                    className="space-invaders-shell"
                    data-engine={ UI_MARKER }
                    data-item-id={ itemId }>
                    <span className="space-cabinet-screw is-top-left" />
                    <span className="space-cabinet-screw is-top-right" />
                    <span className="space-cabinet-screw is-bottom-left" />
                    <span className="space-cabinet-screw is-bottom-right" />

                    <div className="space-invaders-hud">
                        <div className="space-hud-cell is-score">
                            <span className="space-hud-label">
                                PUNTUACIÓN
                            </span>
                            <strong className="space-score-value">
                                { formattedScore }
                            </strong>
                        </div>

                        <div className="space-hud-cell is-level">
                            <span className="space-hud-label">
                                NIVEL
                            </span>
                            <strong className="space-level-value">
                                { level.toString().padStart(2, '0') }
                            </strong>
                        </div>

                        <div className="space-hud-cell is-lives">
                            <span className="space-hud-label">
                                VIDAS
                            </span>
                            <div className="asteroids-life-row">
                                { Array.from(
                                    { length: MAX_LIVES },
                                    (_, index) =>
                                        <MiniShip
                                            key={ index }
                                            active={ index < lives } />
                                ) }
                            </div>
                        </div>

                        <div
                            className={
                                `space-hud-cell is-status is-${ phase }`
                            }>
                            <StatusRock />
                            <strong>{ phaseLabel }</strong>
                        </div>
                    </div>

                    <div className="space-invaders-stage">
                        <canvas
                            ref={ canvasRef }
                            className="space-invaders-canvas"
                            width={ WIDTH }
                            height={ HEIGHT }
                            tabIndex={ 0 }
                            aria-label="Asteroids" />

                        { phase === 'ready' &&
                            <div className="space-game-overlay">
                                <div className="space-overlay-panel">
                                    <span className="space-overlay-kicker">
                                        CINTURÓN DE ASTEROIDES
                                    </span>
                                    <strong className="space-overlay-title">
                                        ASTEROIDS
                                    </strong>
                                    <span className="space-overlay-copy">
                                        Destruye las rocas, esquiva sus fragmentos
                                        y sobrevive a cada nueva oleada.
                                    </span>
                                    <button
                                        type="button"
                                        className="space-primary-button"
                                        disabled={ startPending }
                                        onClick={ requestStartGame }>
                                        { startPending
                                            ? 'CONECTANDO...'
                                            : 'JUGAR' }
                                    </button>

                                    { resultState === 'rejected' &&
                                        resultMessage &&
                                        <span className="space-start-error">
                                            { resultMessage }
                                        </span> }

                                    <span className="space-overlay-hint">
                                        ENTER también inicia la partida
                                    </span>
                                </div>
                            </div> }

                        { phase === 'paused' &&
                            <div className="space-game-overlay is-pause">
                                <div className="space-overlay-panel is-compact">
                                    <span className="space-overlay-kicker">
                                        PARTIDA DETENIDA
                                    </span>
                                    <strong className="space-overlay-title">
                                        PAUSA
                                    </strong>
                                    <button
                                        type="button"
                                        className="space-primary-button"
                                        onClick={ togglePause }>
                                        CONTINUAR
                                    </button>
                                </div>
                            </div> }

                        { phase === 'gameover' &&
                            <div className="space-game-overlay is-gameover">
                                <div className="space-overlay-panel">
                                    <span className="space-overlay-kicker">
                                        NAVE DESTRUIDA
                                    </span>
                                    <strong className="space-overlay-title">
                                        FIN DE LA PARTIDA
                                    </strong>

                                    <div className="space-gameover-results">
                                        <span>
                                            PUNTUACIÓN
                                            <b>{ formattedScore }</b>
                                        </span>
                                        <span>
                                            NIVEL
                                            <b>{ level }</b>
                                        </span>
                                        <span>
                                            RÉCORD
                                            <b>{ formattedRecord }</b>
                                        </span>
                                    </div>

                                    <div
                                        className={
                                            `space-score-submit-status is-${ resultState }`
                                        }>
                                        { resultState === 'accepted'
                                            ? newServerRecord
                                                ? 'NUEVO RÉCORD GLOBAL'
                                                : resultMessage
                                            : resultState === 'rejected'
                                                ? resultMessage
                                                : 'Guardando puntuación...' }
                                    </div>

                                    <button
                                        type="button"
                                        className="space-primary-button"
                                        disabled={ startPending }
                                        onClick={ requestStartGame }>
                                        { startPending
                                            ? 'CONECTANDO...'
                                            : 'JUGAR DE NUEVO' }
                                    </button>
                                </div>
                            </div> }
                    </div>

                    <div className="space-invaders-console">
                        <div className="space-controls-panel">
                            <div className="space-control-group">
                                <span className="space-keycap">←</span>
                                <span className="space-keycap">→</span>
                                <span className="space-control-separator">/</span>
                                <span className="space-keycap is-letter">A</span>
                                <span className="space-keycap is-letter">D</span>
                                <span className="space-control-action">
                                    GIRAR
                                </span>
                            </div>

                            <span className="space-console-divider" />

                            <div className="space-control-group">
                                <span className="space-keycap">↑</span>
                                <span className="space-control-separator">/</span>
                                <span className="space-keycap is-letter">W</span>
                                <span className="space-control-action">
                                    IMPULSO
                                </span>
                            </div>

                            <span className="space-console-divider" />

                            <div className="space-control-group">
                                <span className="space-keycap is-space">
                                    ESPACIO
                                </span>
                                <span className="space-control-action">
                                    DISPARAR
                                </span>
                            </div>

                            <span className="space-console-divider" />

                            <div className="space-control-group">
                                <span className="space-keycap is-letter">P</span>
                                <span className="space-control-action">
                                    PAUSA
                                </span>
                            </div>
                        </div>

                        <div className="space-console-actions">
                            <button
                                type="button"
                                className={
                                    `space-sound-button${
                                        soundEnabled ? ' is-on' : ''
                                    }`
                                }
                                onClick={ toggleSound }
                                aria-pressed={ soundEnabled }>
                                <span className="space-sound-icon">♪</span>
                                <span>
                                    SONIDO
                                    <b>{ soundEnabled ? 'ON' : 'OFF' }</b>
                                </span>
                            </button>

                            <button
                                type="button"
                                className="space-restart-button"
                                onClick={ restartGame }>
                                <span className="space-restart-shine" />
                                <span>REINICIAR</span>
                            </button>
                        </div>
                    </div>

                    <div className="space-arcade-summary-bar">
                        <div className="space-arcade-summary-brand">
                            <span>RANKING GLOBAL</span>
                            <strong>ASTEROIDS</strong>
                        </div>

                        <div className="space-arcade-summary-stats">
                            <span>
                                TU RÉCORD
                                <b>
                                    { serverBest
                                        .toString()
                                        .padStart(5, '0') }
                                </b>
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
                            className="space-records-button"
                            onClick={ openRecords }>
                            <span className="space-records-star">★</span>
                            <span>RÉCORDS</span>
                        </button>
                    </div>
                </div>
            </NitroCardContentView>
        </NitroCardView>

        <ArcadeLeaderboardView
            visible={ recordsOpen }
            gameName="Asteroids"
            leaderboard={ leaderboard }
            personalBest={ serverBest }
            personalRank={ personalRank }
            totalPlayers={ totalPlayers }
            onClose={ closeRecords } />
        </>
    );
};
