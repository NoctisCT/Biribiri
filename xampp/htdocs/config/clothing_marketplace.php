<?php

return [
    /*
     * Europe/Madrid:
     * cambio semanal = domingo 00:00.
     */
    'timezone' => 'Europe/Madrid',

    'weekly_store' => [
        'rollover_day' => 'sunday',
        'rollover_time' => '00:00',

        /*
         * Las limitadas pasan a "Ropa de semanas anteriores"
         * y siguen a la venta hasta agotar stock.
         */
        'limited_keep_until_sold' => true,

        /*
         * Las ilimitadas desaparecen al siguiente cambio semanal.
         */
        'unlimited_retire_on_rollover' => true,

        /*
         * La web vende varias unidades si el usuario quiere.
         */
        'default_purchase_limit_per_user' => null,

        'currency' => 'credits',
    ],

    'economy' => [
        'creator_share_percent' => 50,
        'burn_percent' => 50,
    ],

    /*
     * MUY IMPORTANTE:
     * una compra web entrega el furni canjeable tradeable.
     * NO desbloquea la ropa directamente.
     */
    'delivery' => [
        'weekly_store' => 'redeemable_furni',
        'public_furni_tradeable' => true,

        /*
         * El diseñador recibe una variante de furni distinta
         * para poder hacerla no tradeable sin afectar al furni público.
         */
        'designer_reward_nontradeable' => true,
    ],

    'biri_club' => [
        /*
         * Se resolverá en la fase Biri Club:
         * una renovación mensual válida genera un entitlement
         * de colección, no simplemente el cambio de calendario.
         */
        'collection_entitlements' => true,
    ],

    'staff_catalog' => [
        'root' => 'STAFF > BiriBiri > Ropa',
        'parent_page_id' => 71244580,
        'root_page_id' => 71244582,
        'weekly_page_id' => 71244583,
        'club_page_id' => 71244584,
        'events_page_id' => 71244585,
        'pass_page_id' => 71244586,
        'other_page_id' => 71244587,
    ],

    /*
     * Installer P6.
     *
     * El converter vive FUERA del repo y no se instala desde Laravel.
     * El POC de Chimuelo ya utilizó este aislamiento.
     */
    'installer' => [
        'converter_root' => env(
            'CLOTHING_NITRO_CONVERTER_PATH',
            '%LOCALAPPDATA%\\BiribiriTools\\nitro-converter'
        ),

        'node_binary' => env(
            'CLOTHING_NODE_BINARY',
            ''
        ),

        /*
         * DB: Amigo Conejo es nuestra referencia real probada
         * de interaction_type=clothing.
         */
        'redeemable_template_class' =>
            'tv_hobba_26_AmigoConejo',

        'redeemable_template_base_item_id' =>
            2000000002,

        /*
         * Renderer: usamos el clothing oficial que sirvió para
         * corregir Amigo Conejo. El SWF del diseñador aporta sus
         * propios píxeles; solo heredamos el contrato de clothing.
         */
        'redeemable_nitro_comparator_class' =>
            'clothing_r21_trainoutfit',

        'redeemable_furnituredata_template_class' =>
            'clothing_r21_trainoutfit',

        'id_ranges' => [
            /*
             * IDs de FigureData gestionados SOLO por Biribiri.
             * El diseñador puede dejar DEFINE_ID o cualquier ID
             * de su builder: nunca se reutiliza como destino.
             */
            'figure_set_start' => 1900000000,
            'figure_set_max' => 1999999999,

            /*
             * Part IDs finales gestionados SOLO por Biribiri.
             * Los IDs del RAR/SWF son source_part_id y se remapean
             * automáticamente durante staging/conversión.
             */
            'figure_part_start' => 1800000000,
            'figure_part_max' => 1899999999,

            'items_base_start' => 2001000000,
            'catalog_items_start' => 2001000000,
            'max' => 2147000000,
        ],
    ],
];