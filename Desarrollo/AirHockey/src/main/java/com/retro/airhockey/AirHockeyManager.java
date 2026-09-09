package com.retro.airhockey;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.gameclients.GameClient;
import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.habbohotel.users.HabboItem;
import com.eu.habbo.messages.ServerMessage;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public final class AirHockeyManager
{
    private static final int FIELD_W = 10000;
    private static final int FIELD_H = 6000;

    private static final int MALLET_RADIUS = 380;
    private static final int PUCK_RADIUS = 180;
    private static final int GOAL_HALF_HEIGHT = 1040;

    private static final String PHYSICS_ENGINE = "AIR_HOCKEY_GAME_V8_FIXED240_CORE";
    private static final long TICK_MS = 4L;
    private static final long STATE_BROADCAST_MS = 8L;

    private static final double FIXED_PHYSICS_DT = 1.0 / 240.0;
    private static final double CENTER_GAP = 50.0;
    private static final int WIN_SCORE = 7;

    /*
     * AIR_HOCKEY_PHYSICS_V3_TARGET_DRIVEN
     *
     * El input del cliente es un TARGET. El mazo tiene posición, velocidad,
     * aceleración y velocidad máxima propias. Nunca se teletransporta.
     *
     * 16 ms de tick + 4 substeps = física interna ~250 Hz.
     * A la velocidad máxima un mazo avanza ~48 unidades por substep,
     * muy por debajo de PUCK_RADIUS (360), por lo que no puede atravesarlo.
     */
    /*
     * AIR_HOCKEY_GAME_V8_FIXED240_CORE
     *
     * El target se alcanza en un único tick (~16 ms): el mazo se siente
     * unido al ratón. La detección usa CCD barrida sobre TODO el segmento
     * recorrido, así que un salto del cursor no puede atravesar el puck.
     *
     * La energía NO usa la velocidad bruta ilimitada del salto. Se mide
     * delta/dt, se limita y solo cuenta su componente NORMAL al impacto.
     */
    private static final double MAX_PUCK_SPEED = 22000.0;
    private static final double PUCK_DRAG_PER_SECOND = 0.34;

    private static final double MALLET_IMPACT_SPEED_CAP = 18500.0;
    private static final double MALLET_SURFACE_TRANSFER = 0.68;
    private static final double MALLET_COLLISION_RESTITUTION = 0.72;
    private static final double COLLISION_EPSILON = 1.5;

    /*
     * El paso físico se decide dinámicamente por DISTANCIA.
     * 60 unidades es muchísimo menor que PUCK_RADIUS (360)
     * y que MALLET_RADIUS + PUCK_RADIUS (1010).
     */
    private static final double SOLID_COLLISION_MAX_STEP = 40.0;
    private static final int SOLID_COLLISION_MAX_SUBSTEPS = 160;

    /*
     * Partidas aisladas por itemId.
     * Dos mesas iguales en la misma sala = dos estados independientes.
     */
    private final ConcurrentHashMap<Integer, Match> matches =
            new ConcurrentHashMap<>();

    /*
     * Un usuario solo puede estar en una mesa a la vez.
     * userId -> itemId
     */
    private final ConcurrentHashMap<Integer, Integer> userMatch =
            new ConcurrentHashMap<>();

    private volatile boolean running = false;

    public void start()
    {
        if(this.running) return;
        this.running = true;
        this.scheduleTick();
    }

    public void stop()
    {
        this.running = false;

        for(Match match : this.matches.values())
        {
            synchronized(match)
            {
                this.closeMatch(match, "La mesa se ha detenido.");
            }
        }

        this.matches.clear();
        this.userMatch.clear();
    }

    private void scheduleTick()
    {
        if(!this.running) return;

        Emulator.getThreading().run(
                () ->
                {
                    try
                    {
                        this.tick();
                    }
                    catch(Throwable error)
                    {
                        System.out.println(
                                "[AirHockey] ERROR tick: " +
                                error.getClass().getSimpleName() +
                                ": " +
                                error.getMessage()
                        );
                        error.printStackTrace();
                    }

                    this.scheduleTick();
                },
                TICK_MS
        );
    }

    public void requestJoin(
            GameClient client,
            Room room,
            InteractionAirHockey clicked)
    {
        if(client == null ||
                client.getHabbo() == null ||
                room == null ||
                clicked == null)
        {
            return;
        }

        HabboItem current = room.getHabboItem(clicked.getId());

        if(!(current instanceof InteractionAirHockey))
        {
            return;
        }

        Habbo habbo = client.getHabbo();
        int userId = habbo.getHabboInfo().getId();

        Integer previousItem = this.userMatch.get(userId);

        if(previousItem != null && previousItem != clicked.getId())
        {
            this.leaveByUser(userId, "Has cambiado de mesa.");
        }

        Match match = this.matches.computeIfAbsent(
                clicked.getId(),
                ignored -> new Match(
                        room.getId(),
                        clicked.getId()
                )
        );

        synchronized(match)
        {
            if(match.roomId != room.getId())
            {
                this.sendError(client, clicked.getId(), "La mesa no pertenece a esta sala.");
                return;
            }

            int side = match.sideOf(userId);

            if(side == 0)
            {
                if(match.playerLeft == 0)
                {
                    match.playerLeft = userId;
                    match.leftX = 1800;
                    match.leftY = FIELD_H / 2;
                    match.leftTargetX = 1800;
                    match.leftTargetY = FIELD_H / 2;
                    match.leftPosX = 1800.0;
                    match.leftPosY = FIELD_H / 2.0;
                    match.leftVelX = 0.0;
                    match.leftVelY = 0.0;
                    match.leftLastInputAt = System.currentTimeMillis();
                    side = -1;
                }
                else if(match.playerRight == 0)
                {
                    match.playerRight = userId;
                    match.rightX = FIELD_W - 1800;
                    match.rightY = FIELD_H / 2;
                    match.rightTargetX = FIELD_W - 1800;
                    match.rightTargetY = FIELD_H / 2;
                    match.rightPosX = FIELD_W - 1800.0;
                    match.rightPosY = FIELD_H / 2.0;
                    match.rightVelX = 0.0;
                    match.rightVelY = 0.0;
                    match.rightLastInputAt = System.currentTimeMillis();
                    side = 1;
                }
                else
                {
                    this.sendError(client, clicked.getId(), "Esta mesa ya tiene dos jugadores.");
                    return;
                }
            }

            this.userMatch.put(userId, clicked.getId());

            this.sendOpen(client, match, side);
            this.broadcastState(match, true);

            if(match.playerLeft != 0 && match.playerRight != 0)
            {
                this.broadcastRound(match, "ready", 0);
            }
        }
    }

    public void ready(GameClient client, int itemId)
    {
        if(client == null || client.getHabbo() == null) return;

        int userId = client.getHabbo().getHabboInfo().getId();
        Match match = this.matches.get(itemId);

        if(match == null)
        {
            this.sendError(client, itemId, "La partida ya no existe.");
            return;
        }

        synchronized(match)
        {
            int side = match.sideOf(userId);

            if(side == 0)
            {
                this.sendError(client, itemId, "No perteneces a esta mesa.");
                return;
            }

            if(side < 0) match.leftReady = true;
            else match.rightReady = true;

            if(match.playerLeft != 0 &&
                    match.playerRight != 0 &&
                    match.leftReady &&
                    match.rightReady)
            {
                this.resetPuck(match, 0);
                match.playing = true;
                match.roundPausedUntil = System.currentTimeMillis() + 900L;
                this.broadcastRound(match, "start", 0);
            }
            else
            {
                this.broadcastRound(match, "ready", side);
            }
        }
    }

    public void move(
            GameClient client,
            int itemId,
            int x,
            int y)
    {
        if(client == null || client.getHabbo() == null) return;

        int userId = client.getHabbo().getHabboInfo().getId();
        Match match = this.matches.get(itemId);

        if(match == null) return;

        synchronized(match)
        {
            int side = match.sideOf(userId);

            if(side == 0) return;

            long now = System.currentTimeMillis();

            x = clamp(x, MALLET_RADIUS, FIELD_W - MALLET_RADIUS);
            y = clamp(y, MALLET_RADIUS, FIELD_H - MALLET_RADIUS);

            /*
             * V3: el paquete de movimiento solo cambia el OBJETIVO.
             * La posición física real se integra en updatePhysics().
             */
            if(side < 0)
            {
                x = clamp(
                        x,
                        MALLET_RADIUS,
                        (FIELD_W / 2) - MALLET_RADIUS
                );

                match.leftTargetX = x;
                match.leftTargetY = y;
                match.leftLastInputAt = now;
            }
            else
            {
                x = clamp(
                        x,
                        (FIELD_W / 2) + MALLET_RADIUS,
                        FIELD_W - MALLET_RADIUS
                );

                match.rightTargetX = x;
                match.rightTargetY = y;
                match.rightLastInputAt = now;
            }
        }
    }

    public void leave(GameClient client, int itemId)
    {
        if(client == null || client.getHabbo() == null) return;

        int userId = client.getHabbo().getHabboInfo().getId();

        Integer current = this.userMatch.get(userId);

        if(current == null || current != itemId) return;

        this.leaveByUser(userId, "Has abandonado la mesa.");
    }

    private void leaveByUser(int userId, String reason)
    {
        Integer itemId = this.userMatch.remove(userId);

        if(itemId == null) return;

        Match match = this.matches.get(itemId);

        if(match == null) return;

        synchronized(match)
        {
            int side = match.sideOf(userId);

            if(side < 0)
            {
                match.playerLeft = 0;
                match.leftReady = false;
            }
            else if(side > 0)
            {
                match.playerRight = 0;
                match.rightReady = false;
            }

            match.playing = false;
            match.scoreLeft = 0;
            match.scoreRight = 0;
            this.resetPuck(match, 0);

            Habbo leaving = resolveHabbo(userId);

            if(leaving != null && leaving.getClient() != null)
            {
                this.sendClose(leaving.getClient(), itemId, reason);
            }

            this.broadcastRound(match, "opponent_left", side);

            if(match.playerLeft == 0 && match.playerRight == 0)
            {
                this.matches.remove(itemId, match);
            }
            else
            {
                this.broadcastState(match, true);
            }
        }
    }

    private void tick()
    {
        long now = System.currentTimeMillis();
        double dt = TICK_MS / 1000.0;

        for(Map.Entry<Integer, Match> entry : this.matches.entrySet())
        {
            Match match = entry.getValue();

            synchronized(match)
            {
                if(!this.validatePlayers(match))
                {
                    if(match.playerLeft == 0 && match.playerRight == 0)
                    {
                        this.matches.remove(entry.getKey(), match);
                    }

                    continue;
                }

                if(!match.playing)
                {
                    this.syncMalletSimulation(match);
                    if(now - match.lastBroadcastAt >= 250L)
                    {
                        this.broadcastState(match, false);
                    }

                    continue;
                }

                if(now < match.roundPausedUntil)
                {
                    this.syncMalletSimulation(match);
                    if(now - match.lastBroadcastAt >= 100L)
                    {
                        this.broadcastState(match, false);
                    }

                    continue;
                }

                this.updatePhysics(match, dt);

                if(now - match.lastBroadcastAt >= STATE_BROADCAST_MS)
                {
                    this.broadcastState(match, false);
                }
            }
        }
    }

    private boolean validatePlayers(Match match)
    {
        int departedSide = 0;

        if(match.playerLeft != 0 && !this.validPlayer(match, match.playerLeft))
        {
            int departedUser = match.playerLeft;
            Habbo habbo = resolveHabbo(departedUser);

            if(habbo != null && habbo.getClient() != null)
            {
                this.sendClose(habbo.getClient(), match.itemId, "Has salido de la sala.");
            }

            this.userMatch.remove(departedUser, match.itemId);
            match.playerLeft = 0;
            match.leftReady = false;
            match.playing = false;
            departedSide = -1;
        }

        if(match.playerRight != 0 && !this.validPlayer(match, match.playerRight))
        {
            int departedUser = match.playerRight;
            Habbo habbo = resolveHabbo(departedUser);

            if(habbo != null && habbo.getClient() != null)
            {
                this.sendClose(habbo.getClient(), match.itemId, "Has salido de la sala.");
            }

            this.userMatch.remove(departedUser, match.itemId);
            match.playerRight = 0;
            match.rightReady = false;
            match.playing = false;
            departedSide = 1;
        }

        if(departedSide != 0)
        {
            match.scoreLeft = 0;
            match.scoreRight = 0;
            this.resetPuck(match, 0);
            this.broadcastRound(match, "opponent_left", departedSide);
            this.broadcastState(match, true);
        }

        return match.playerLeft != 0 || match.playerRight != 0;
    }

    private boolean validPlayer(Match match, int userId)
    {
        Habbo habbo = resolveHabbo(userId);

        if(habbo == null ||
                habbo.getClient() == null ||
                habbo.getHabboInfo() == null)
        {
            return false;
        }

        Room room = habbo.getHabboInfo().getCurrentRoom();

        if(room == null || room.getId() != match.roomId)
        {
            return false;
        }

        HabboItem item = room.getHabboItem(match.itemId);

        return item instanceof InteractionAirHockey;
    }

    private void syncMalletSimulation(Match match)
    {
        match.simLeftX = match.leftX;
        match.simLeftY = match.leftY;
        match.simRightX = match.rightX;
        match.simRightY = match.rightY;
    }

    private void updatePhysics(Match match, double dt)
    {
        /*
         * AIR HOCKEY V8:
         * Habbo/networking alimenta un acumulador, pero la física
         * SIEMPRE avanza a 1/240 s como el standalone V2.
         */
        if(dt <= 0.0) return;

        if(!match.playing)
        {
            match.physicsAccumulator = 0.0;
            return;
        }

        if(match.roundPausedUntil > System.currentTimeMillis())
        {
            match.physicsAccumulator = 0.0;
            return;
        }

        match.physicsAccumulator += Math.min(dt, 0.050);

        int fixedSteps = 0;
        final int maxFixedStepsPerTick = 16;

        while(match.physicsAccumulator + 0.000000001 >= FIXED_PHYSICS_DT &&
                fixedSteps < maxFixedStepsPerTick &&
                match.playing &&
                match.roundPausedUntil <= System.currentTimeMillis())
        {
            this.stepStandalonePhysicsV8(
                    match,
                    FIXED_PHYSICS_DT
            );

            match.physicsAccumulator -= FIXED_PHYSICS_DT;

            if(match.physicsAccumulator < 0.0)
            {
                match.physicsAccumulator = 0.0;
            }

            fixedSteps++;
        }

        if(fixedSteps >= maxFixedStepsPerTick &&
                match.physicsAccumulator > (FIXED_PHYSICS_DT * 4.0))
        {
            match.physicsAccumulator = FIXED_PHYSICS_DT * 4.0;
        }
    }

    /*
     * Port de AirHockeyStandaloneV2/physics.js -> step().
     * Escala espacial x10: 1000x600 -> 10000x6000.
     */
    private void stepStandalonePhysicsV8(
            Match match,
            double dt)
    {
        double leftStartX = match.leftPosX;
        double leftStartY = match.leftPosY;
        double rightStartX = match.rightPosX;
        double rightStartY = match.rightPosY;

        double leftEndX = Math.max(
                MALLET_RADIUS,
                Math.min(
                        (FIELD_W / 2.0) - MALLET_RADIUS - CENTER_GAP,
                        match.leftTargetX
                )
        );

        double leftEndY = Math.max(
                MALLET_RADIUS,
                Math.min(
                        FIELD_H - MALLET_RADIUS,
                        match.leftTargetY
                )
        );

        double rightEndX = Math.max(
                (FIELD_W / 2.0) + MALLET_RADIUS + CENTER_GAP,
                Math.min(
                        FIELD_W - MALLET_RADIUS,
                        match.rightTargetX
                )
        );

        double rightEndY = Math.max(
                MALLET_RADIUS,
                Math.min(
                        FIELD_H - MALLET_RADIUS,
                        match.rightTargetY
                )
        );

        double leftDX = leftEndX - leftStartX;
        double leftDY = leftEndY - leftStartY;
        double rightDX = rightEndX - rightStartX;
        double rightDY = rightEndY - rightStartY;

        double leftVX = leftDX / dt;
        double leftVY = leftDY / dt;
        double rightVX = rightDX / dt;
        double rightVY = rightDY / dt;

        double leftSpeed = Math.hypot(leftVX, leftVY);

        if(leftSpeed > MALLET_IMPACT_SPEED_CAP)
        {
            double scale = MALLET_IMPACT_SPEED_CAP / leftSpeed;
            leftVX *= scale;
            leftVY *= scale;
        }

        double rightSpeed = Math.hypot(rightVX, rightVY);

        if(rightSpeed > MALLET_IMPACT_SPEED_CAP)
        {
            double scale = MALLET_IMPACT_SPEED_CAP / rightSpeed;
            rightVX *= scale;
            rightVY *= scale;
        }

        match.leftVelX = leftVX;
        match.leftVelY = leftVY;
        match.rightVelX = rightVX;
        match.rightVelY = rightVY;

        double puckTravel =
                Math.hypot(match.puckVX, match.puckVY) * dt;

        double leftTravel =
                Math.hypot(leftDX, leftDY);

        double rightTravel =
                Math.hypot(rightDX, rightDY);

        double maxTravel =
                Math.max(
                        puckTravel,
                        Math.max(leftTravel, rightTravel)
                );

        int microSteps =
                (int)Math.ceil(
                        maxTravel / SOLID_COLLISION_MAX_STEP
                );

        microSteps =
                Math.max(
                        1,
                        Math.min(
                                SOLID_COLLISION_MAX_SUBSTEPS,
                                microSteps
                        )
                );

        double microDt = dt / microSteps;

        for(int i = 1; i <= microSteps; i++)
        {
            double t = i / (double)microSteps;

            double leftX =
                    leftStartX + (leftDX * t);

            double leftY =
                    leftStartY + (leftDY * t);

            double rightX =
                    rightStartX + (rightDX * t);

            double rightY =
                    rightStartY + (rightDY * t);

            match.puckX += match.puckVX * microDt;
            match.puckY += match.puckVY * microDt;

            this.collideStandaloneMalletV8(
                    match,
                    leftX,
                    leftY,
                    leftVX,
                    leftVY
            );

            this.collideStandaloneMalletV8(
                    match,
                    rightX,
                    rightY,
                    rightVX,
                    rightVY
            );

            /*
             * Scoring/reset de Habbo se conserva.
             * Las paredes ya funcionaban correctamente.
             */
            this.collideWallsAndGoals(match);

            if(!match.playing ||
                    match.roundPausedUntil > System.currentTimeMillis())
            {
                match.physicsAccumulator = 0.0;
                break;
            }

            double damping =
                    Math.exp(-PUCK_DRAG_PER_SECOND * microDt);

            match.puckVX *= damping;
            match.puckVY *= damping;

            double puckSpeed =
                    Math.hypot(match.puckVX, match.puckVY);

            if(puckSpeed > MAX_PUCK_SPEED)
            {
                double scale =
                        MAX_PUCK_SPEED / puckSpeed;

                match.puckVX *= scale;
                match.puckVY *= scale;
            }
        }

        match.leftPosX = leftEndX;
        match.leftPosY = leftEndY;
        match.rightPosX = rightEndX;
        match.rightPosY = rightEndY;

        match.leftX = (int)Math.round(leftEndX);
        match.leftY = (int)Math.round(leftEndY);
        match.rightX = (int)Math.round(rightEndX);
        match.rightY = (int)Math.round(rightEndY);
    }




    /*
     * Port de AirHockeyStandaloneV2/physics.js
     * -> _resolveSolidMallet().
     */
    private boolean collideStandaloneMalletV8(
            Match match,
            double malletX,
            double malletY,
            double malletVX,
            double malletVY)
    {
        double dx = match.puckX - malletX;
        double dy = match.puckY - malletY;

        double solidRadius =
                MALLET_RADIUS + PUCK_RADIUS;

        double distanceSq =
                (dx * dx) + (dy * dy);

        if(distanceSq >= solidRadius * solidRadius)
        {
            return false;
        }

        double nx;
        double ny;

        double distance =
                Math.sqrt(
                        Math.max(
                                distanceSq,
                                0.000000000001
                        )
                );

        if(distance < 0.00001)
        {
            double relativeVX =
                    match.puckVX - malletVX;

            double relativeVY =
                    match.puckVY - malletVY;

            double relativeLength =
                    Math.hypot(relativeVX, relativeVY);

            if(relativeLength > 0.00001)
            {
                nx = relativeVX / relativeLength;
                ny = relativeVY / relativeLength;
            }
            else
            {
                nx =
                        malletX < (FIELD_W / 2.0)
                                ? 1.0
                                : -1.0;

                ny = 0.0;
            }
        }
        else
        {
            nx = dx / distance;
            ny = dy / distance;
        }

        /*
         * HARD CONSTRAINT:
         * el puck no permanece dentro de MALLET_R + PUCK_R.
         */
        match.puckX =
                malletX +
                (nx * (solidRadius + COLLISION_EPSILON));

        match.puckY =
                malletY +
                (ny * (solidRadius + COLLISION_EPSILON));

        double clampedVX = malletVX;
        double clampedVY = malletVY;

        double malletSpeed =
                Math.hypot(clampedVX, clampedVY);

        if(malletSpeed > MALLET_IMPACT_SPEED_CAP)
        {
            double scale =
                    MALLET_IMPACT_SPEED_CAP / malletSpeed;

            clampedVX *= scale;
            clampedVY *= scale;
        }

        double effectiveMX =
                clampedVX * MALLET_SURFACE_TRANSFER;

        double effectiveMY =
                clampedVY * MALLET_SURFACE_TRANSFER;

        double puckNormal =
                (match.puckVX * nx) +
                (match.puckVY * ny);

        double malletNormal =
                (effectiveMX * nx) +
                (effectiveMY * ny);

        double relativeNormal =
                puckNormal - malletNormal;

        if(relativeNormal < 0.0)
        {
            double targetNormal =
                    malletNormal +
                    (
                        MALLET_COLLISION_RESTITUTION *
                        (malletNormal - puckNormal)
                    );

            double delta =
                    targetNormal - puckNormal;

            match.puckVX += delta * nx;
            match.puckVY += delta * ny;
        }

        return true;
    }

    private void collideWallsAndGoals(Match match)
    {
        if(match.puckY - PUCK_RADIUS < 0)
        {
            match.puckY = PUCK_RADIUS;
            match.puckVY = Math.abs(match.puckVY);
        }
        else if(match.puckY + PUCK_RADIUS > FIELD_H)
        {
            match.puckY = FIELD_H - PUCK_RADIUS;
            match.puckVY = -Math.abs(match.puckVY);
        }

        boolean inGoalMouth =
                Math.abs(match.puckY - (FIELD_H / 2.0)) <= GOAL_HALF_HEIGHT;

        if(match.puckX - PUCK_RADIUS <= 0)
        {
            if(inGoalMouth)
            {
                this.goal(match, 1);
                return;
            }

            match.puckX = PUCK_RADIUS;
            match.puckVX = Math.abs(match.puckVX);
        }
        else if(match.puckX + PUCK_RADIUS >= FIELD_W)
        {
            if(inGoalMouth)
            {
                this.goal(match, -1);
                return;
            }

            match.puckX = FIELD_W - PUCK_RADIUS;
            match.puckVX = -Math.abs(match.puckVX);
        }
    }

    private void goal(Match match, int scoringSide)
    {
        if(scoringSide < 0) match.scoreLeft++;
        else match.scoreRight++;

        int winner = 0;

        if(match.scoreLeft >= WIN_SCORE) winner = -1;
        else if(match.scoreRight >= WIN_SCORE) winner = 1;

        this.broadcastRound(match, "goal", scoringSide);

        if(winner != 0)
        {
            match.playing = false;
            match.leftReady = false;
            match.rightReady = false;
            this.resetPuck(match, 0);
            this.broadcastRound(match, "finished", winner);
            return;
        }

        this.resetPuck(match, -scoringSide);
        match.roundPausedUntil = System.currentTimeMillis() + 1000L;
    }

    private void resetPuck(Match match, int serveDirection)
    {
        match.puckX = FIELD_W / 2.0;
        match.puckY = FIELD_H / 2.0;

        if(serveDirection == 0)
        {
            match.puckVX = 0;
            match.puckVY = 0;
        }
        else
        {
            match.puckVX = serveDirection * 900.0;
            match.puckVY = 0;
        }
    }

    private void sendOpen(GameClient client, Match match, int side)
    {
        ServerMessage packet = new ServerMessage(AirHockeyPlugin.PACKET_OPEN);

        packet.appendInt(match.itemId);
        packet.appendInt(side);
        packet.appendInt(FIELD_W);
        packet.appendInt(FIELD_H);
        packet.appendInt(WIN_SCORE);
        packet.appendInt(match.playerLeft);
        packet.appendInt(match.playerRight);

        client.sendResponse(packet);
        System.out.println(
                "[AirHockey][TRACE] OPEN_SENT itemId=" + match.itemId +
                " side=" + side
        );
    }

    private void broadcastState(Match match, boolean force)
    {
        long now = System.currentTimeMillis();

        if(!force && now - match.lastBroadcastAt < STATE_BROADCAST_MS)
        {
            return;
        }

        match.lastBroadcastAt = now;

        Habbo left = resolveHabbo(match.playerLeft);

        if(left != null && left.getClient() != null)
        {
            this.sendState(left.getClient(), match);
        }

        Habbo right = resolveHabbo(match.playerRight);

        if(right != null && right.getClient() != null)
        {
            this.sendState(right.getClient(), match);
        }
    }

    private void sendState(GameClient client, Match match)
    {
        ServerMessage packet = new ServerMessage(AirHockeyPlugin.PACKET_STATE);

        packet.appendInt(match.itemId);
        packet.appendInt(match.playing ? 1 : 0);
        packet.appendInt(match.scoreLeft);
        packet.appendInt(match.scoreRight);
        packet.appendInt((int)Math.round(match.puckX));
        packet.appendInt((int)Math.round(match.puckY));
        packet.appendInt((int)Math.round(match.puckVX));
        packet.appendInt((int)Math.round(match.puckVY));
        packet.appendInt(match.leftX);
        packet.appendInt(match.leftY);
        packet.appendInt(match.rightX);
        packet.appendInt(match.rightY);
        packet.appendInt(match.playerLeft);
        packet.appendInt(match.playerRight);
        packet.appendInt(match.leftReady ? 1 : 0);
        packet.appendInt(match.rightReady ? 1 : 0);

        client.sendResponse(packet);
    }

    private void broadcastRound(Match match, String event, int side)
    {
        Habbo left = resolveHabbo(match.playerLeft);

        if(left != null && left.getClient() != null)
        {
            this.sendRound(left.getClient(), match, event, side);
        }

        Habbo right = resolveHabbo(match.playerRight);

        if(right != null && right.getClient() != null)
        {
            this.sendRound(right.getClient(), match, event, side);
        }
    }

    private void sendRound(
            GameClient client,
            Match match,
            String event,
            int side)
    {
        ServerMessage packet = new ServerMessage(AirHockeyPlugin.PACKET_ROUND);

        packet.appendInt(match.itemId);
        packet.appendString(event == null ? "" : event);
        packet.appendInt(side);
        packet.appendInt(match.scoreLeft);
        packet.appendInt(match.scoreRight);

        client.sendResponse(packet);
    }

    private void sendClose(GameClient client, int itemId, String reason)
    {
        ServerMessage packet = new ServerMessage(AirHockeyPlugin.PACKET_CLOSE);

        packet.appendInt(itemId);
        packet.appendString(reason == null ? "" : reason);

        client.sendResponse(packet);
    }

    private void sendError(GameClient client, int itemId, String reason)
    {
        ServerMessage packet = new ServerMessage(AirHockeyPlugin.PACKET_ERROR);

        packet.appendInt(itemId);
        packet.appendString(reason == null ? "" : reason);

        client.sendResponse(packet);
    }

    private void closeMatch(Match match, String reason)
    {
        if(match.playerLeft != 0)
        {
            Habbo left = resolveHabbo(match.playerLeft);

            if(left != null && left.getClient() != null)
            {
                this.sendClose(left.getClient(), match.itemId, reason);
            }

            this.userMatch.remove(match.playerLeft, match.itemId);
        }

        if(match.playerRight != 0)
        {
            Habbo right = resolveHabbo(match.playerRight);

            if(right != null && right.getClient() != null)
            {
                this.sendClose(right.getClient(), match.itemId, reason);
            }

            this.userMatch.remove(match.playerRight, match.itemId);
        }
    }

    private static Habbo resolveHabbo(int userId)
    {
        if(userId <= 0) return null;

        return Emulator.getGameEnvironment()
                .getHabboManager()
                .getHabbo(userId);
    }

    private static int clamp(int value, int min, int max)
    {
        return Math.max(min, Math.min(max, value));
    }

    private static double clampDouble(
            double value,
            double min,
            double max)
    {
        return Math.max(min, Math.min(max, value));
    }


    private static final class Match
    {
        final int roomId;
        final int itemId;

        int playerLeft = 0;
        int playerRight = 0;

        boolean leftReady = false;
        boolean rightReady = false;
        boolean playing = false;

        int scoreLeft = 0;
        int scoreRight = 0;

        int leftX = 1800;
        int leftY = FIELD_H / 2;
        int rightX = FIELD_W - 1800;
        int rightY = FIELD_H / 2;

        /*
         * V3: target del ratón separado de la posición física real.
         * leftX/rightX siguen siendo los enteros enviados por STATE.
         */
        int leftTargetX = 1800;
        int leftTargetY = FIELD_H / 2;
        int rightTargetX = FIELD_W - 1800;
        int rightTargetY = FIELD_H / 2;

        double leftPosX = 1800.0;
        double leftPosY = FIELD_H / 2.0;
        double rightPosX = FIELD_W - 1800.0;
        double rightPosY = FIELD_H / 2.0;

        double leftVelX = 0.0;
        double leftVelY = 0.0;
        double rightVelX = 0.0;
        double rightVelY = 0.0;

        /*
         * Última posición consumida por la simulación. leftX/rightX son
         * los targets autoritativos más recientes enviados por el cliente.
         */
        double simLeftX = 1800.0;
        double simLeftY = FIELD_H / 2.0;
        double simRightX = FIELD_W - 1800.0;
        double simRightY = FIELD_H / 2.0;

        long leftLastInputAt = 0L;
        long rightLastInputAt = 0L;
        long roundPausedUntil = 0L;
        long lastBroadcastAt = 0L;

        /* V8 fixed-step accumulator (seconds). */
        double physicsAccumulator = 0.0;

        double puckX = FIELD_W / 2.0;
        double puckY = FIELD_H / 2.0;
        double puckVX = 0.0;
        double puckVY = 0.0;

        Match(int roomId, int itemId)
        {
            this.roomId = roomId;
            this.itemId = itemId;
        }

        int sideOf(int userId)
        {
            if(userId <= 0) return 0;
            if(this.playerLeft == userId) return -1;
            if(this.playerRight == userId) return 1;
            return 0;
        }
    }
}
