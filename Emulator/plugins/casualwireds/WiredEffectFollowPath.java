package com.eu.habbo.casualwireds;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.items.Item;
import com.eu.habbo.habbohotel.users.HabboItem;
import com.eu.habbo.habbohotel.items.interactions.InteractionWiredEffect;
import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.rooms.RoomUnit;
import com.eu.habbo.habbohotel.rooms.RoomTile;
import com.eu.habbo.habbohotel.wired.WiredEffectType;
import com.eu.habbo.habbohotel.items.interactions.wired.WiredSettings;
import com.eu.habbo.messages.ServerMessage;
import com.eu.habbo.habbohotel.gameclients.GameClient;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

public class WiredEffectFollowPath extends InteractionWiredEffect {

    private boolean isMoving = false;

    public WiredEffectFollowPath(ResultSet set, Item baseItem) throws SQLException {
        super(set, baseItem);
    }

    public WiredEffectFollowPath(int id, int userId, Item item, String extradata, int limitedStack, int limitedSells) {
        super(id, userId, item, extradata, limitedStack, limitedSells);
    }

    @Override
    public boolean execute(RoomUnit roomUnit, Room room, Object[] stuff) {
        if (room == null || this.isMoving)
            return false;

        List<Integer> pathIds = new ArrayList<>();
        String extraData = this.getExtradata();

        if (extraData != null && !extraData.isEmpty()) {
            String[] parts = extraData.split(",");
            for (String part : parts) {
                try {
                    pathIds.add(Integer.parseInt(part.trim()));
                } catch (NumberFormatException ignored) {
                }
            }
        }

        if (pathIds.size() < 2)
            return false;

        int targetItemId = pathIds.get(0);
        HabboItem targetItem = room.getHabboItem(targetItemId);
        if (targetItem == null)
            return false;

        List<HabboItem> pathTiles = new ArrayList<>();
        for (int i = 1; i < pathIds.size(); i++) {
            HabboItem tile = room.getHabboItem(pathIds.get(i));
            if (tile != null) {
                pathTiles.add(tile);
            }
        }

        if (pathTiles.isEmpty())
            return false;

        this.isMoving = true;
        long delayBetweenSteps = 400L;

        final HabboItem finalTargetItem = targetItem;

        for (int i = 0; i < pathTiles.size(); i++) {
            final int stepIndex = i;
            final boolean isLastStep = (i == pathTiles.size() - 1);
            final HabboItem nextTile = pathTiles.get(i);

            Emulator.getThreading().run(() -> {
                if (room.getHabboItem(finalTargetItem.getId()) != null) {
                    if (room.getLayout() != null) {
                        RoomTile targetTile = room.getLayout().getTile(nextTile.getX(), nextTile.getY());
                        if (targetTile != null) {
                            room.slideFurniTo(finalTargetItem, targetTile, finalTargetItem.getRotation());
                        }
                    }
                }

                if (isLastStep) {
                    this.isMoving = false;
                }
            }, i * delayBetweenSteps);
        }

        return true;
    }

    @Override
    public String getWiredData() {
        return this.getExtradata();
    }

    @Override
    public void loadWiredData(ResultSet set, Room room) throws SQLException {
        this.setExtradata(set.getString("wired_data"));
    }

    @Override
    public void onPickUp() {
        this.setExtradata("");
        this.isMoving = false;
    }

    @Override
    public WiredEffectType getType() {
        return WiredEffectType.SHOW_MESSAGE;
    }

    @Override
    public void serializeWiredData(ServerMessage packet, Room room) {
        // CHIVATO DE CONSOLA: Si ves esto al hacer doble clic, el problema es 100% del
        // cliente
        System.out.println(
                "[CasualWireds] >> Doble clic detectado. Enviando interfaz tipo 7 (Move/Rotate) al cliente para el Wired ID: "
                        + this.getId());

        packet.appendBoolean(false);
        packet.appendInt(20);

        List<Integer> pathIds = new ArrayList<>();
        String extraData = this.getExtradata();
        if (extraData != null && !extraData.isEmpty()) {
            String[] parts = extraData.split(",");
            for (String part : parts) {
                try {
                    pathIds.add(Integer.parseInt(part.trim()));
                } catch (NumberFormatException ignored) {
                }
            }
        }

        packet.appendInt(pathIds.size());
        for (int id : pathIds) {
            packet.appendInt(id);
        }

        packet.appendInt(this.getBaseItem().getSpriteId());
        packet.appendInt(this.getId());
        packet.appendString(this.getExtradata());
        packet.appendInt(0);
        packet.appendInt(7); // Cambiado de 89 a 7 (Interfaz nativa de Mover/Rotar de Habbo)
        packet.appendInt(this.getDelay());
        packet.appendInt(0);
    }

    @Override
    public boolean saveData(WiredSettings settings, GameClient gameClient) {
        if (settings == null)
            return false;

        this.setDelay(settings.getDelay());

        int[] ids = settings.getFurniIds();
        StringBuilder sb = new StringBuilder();
        if (ids != null) {
            for (int i = 0; i < ids.length; i++) {
                sb.append(ids[i]);
                if (i < ids.length - 1) {
                    sb.append(",");
                }
            }
        }
        this.setExtradata(sb.toString());

        return true;
    }

    @Override
    public boolean requiresTriggeringUser() {
        return true;
    }
}