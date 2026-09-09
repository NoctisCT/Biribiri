package com.biribiri.wardrobe;

import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.messages.incoming.MessageHandler;

public final class WardrobePurchaseRequest extends MessageHandler
{
    @Override
    public void handle() throws Exception
    {
        if(
            this.client == null ||
            this.client.getHabbo() == null
        ) return;

        BiribiriWardrobePlugin plugin =
            BiribiriWardrobePlugin.getInstance();

        if(plugin == null) return;

        Habbo habbo =
            this.client.getHabbo();

        System.out.println(
            "[BiribiriWardrobe][BUY] request user=" +
            habbo.getHabboInfo().getUsername() +
            " credits=" +
            habbo.getHabboInfo().getCredits()
        );

        WardrobeManager.PurchaseResult result =
            plugin.getManager()
                .purchaseNextSlot(
                    habbo
                );

        System.out.println(
            "[BiribiriWardrobe][BUY] result user=" +
            habbo.getHabboInfo().getUsername() +
            " status=" +
            result.getStatus() +
            " purchased=" +
            result.getPurchasedSlots() +
            " price=" +
            result.getPrice() +
            " credits=" +
            result.getCreditsRemaining()
        );

        this.client.sendResponse(
            new WardrobePurchaseResultComposer(
                result
            )
        );

        // 6201 ya es el canal estable del Vestidor desde V1.
        // Una compra correcta se confirma por el purchased_slots real.
        plugin.getManager()
            .sendState(
                this.client
            );

        if(result.isSuccess())
        {
            return;
        }

        if(
            result.getStatus() ==
            WardrobeManager.PURCHASE_NOT_ENOUGH_CREDITS
        )
        {
            habbo.alert(
                "No tienes suficientes creditos. Necesitas " +
                result.getPrice() +
                " creditos."
            );

            return;
        }

        if(
            result.getStatus() ==
            WardrobeManager.PURCHASE_MAX_REACHED
        )
        {
            habbo.alert(
                "Has alcanzado el maximo de 80 espacios EXTRA."
            );

            return;
        }

        habbo.alert(
            "No se pudo completar la compra. No se han descontado creditos."
        );
    }

    @Override
    public int getRatelimit()
    {
        return 750;
    }
}
