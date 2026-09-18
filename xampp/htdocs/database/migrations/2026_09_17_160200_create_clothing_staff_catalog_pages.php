<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const PARENT_BIRIBIRI = 71244580;

    private const PAGES = [
        [
            'id' => 71244582,
            'parent_id' => self::PARENT_BIRIBIRI,
            'caption_save' => 'biribiri_clothing',
            'caption' => 'Ropa',
            'order_num' => 2,
        ],
        [
            'id' => 71244583,
            'parent_id' => 71244582,
            'caption_save' => 'biribiri_clothing_weekly',
            'caption' => 'Semanal',
            'order_num' => 1,
        ],
        [
            'id' => 71244584,
            'parent_id' => 71244582,
            'caption_save' => 'biribiri_clothing_club',
            'caption' => 'Biri Club',
            'order_num' => 2,
        ],
        [
            'id' => 71244585,
            'parent_id' => 71244582,
            'caption_save' => 'biribiri_clothing_events',
            'caption' => 'Eventos',
            'order_num' => 3,
        ],
        [
            'id' => 71244586,
            'parent_id' => 71244582,
            'caption_save' => 'biribiri_clothing_pass',
            'caption' => 'Pase',
            'order_num' => 4,
        ],
        [
            'id' => 71244587,
            'parent_id' => 71244582,
            'caption_save' => 'biribiri_clothing_other',
            'caption' => 'Otras',
            'order_num' => 5,
        ],
    ];

    public function up(): void
    {
        if (! Schema::hasTable('catalog_pages')) {
            throw new RuntimeException(
                'No existe catalog_pages.'
            );
        }

        $parent = DB::table('catalog_pages')
            ->where('id', self::PARENT_BIRIBIRI)
            ->first();

        if (
            $parent === null ||
            (int) $parent->parent_id !== 7 ||
            (string) $parent->caption_save !==
                'biribiri_custom'
        ) {
            throw new RuntimeException(
                'No coincide STAFF > Biribiri (71244580).'
            );
        }

        foreach (self::PAGES as $page) {
            $byId = DB::table('catalog_pages')
                ->where('id', $page['id'])
                ->first();

            if ($byId !== null) {
                if (
                    (int) $byId->parent_id ===
                        $page['parent_id'] &&
                    (string) $byId->caption_save ===
                        $page['caption_save']
                ) {
                    continue;
                }

                throw new RuntimeException(
                    'ID de catalog_pages ocupado: ' .
                    $page['id']
                );
            }

            $byKey = DB::table('catalog_pages')
                ->where(
                    'caption_save',
                    $page['caption_save']
                )
                ->first();

            if ($byKey !== null) {
                throw new RuntimeException(
                    'caption_save ya existe con otro ID: ' .
                    $page['caption_save']
                );
            }

            DB::table('catalog_pages')->insert([
                'id' => $page['id'],
                'parent_id' => $page['parent_id'],
                'caption_save' =>
                    $page['caption_save'],
                'caption' => $page['caption'],
                'page_layout' => 'default_3x3',
                'icon_color' => 1,
                'icon_image' => 42,
                'min_rank' => 7,
                'order_num' =>
                    $page['order_num'],
                'visible' => '1',
                'enabled' => '1',
                'club_only' => '0',
                'vip_only' => '0',
                'page_headline' => '',
                'page_teaser' => '',
                'page_special' => '',
                'page_text1' => null,
                'page_text2' => null,
                'page_text_details' => null,
                'page_text_teaser' => null,
                'room_id' => 0,
                'includes' => '',
            ]);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('catalog_pages')) {
            return;
        }

        foreach (
            array_reverse(self::PAGES)
            as $page
        ) {
            DB::table('catalog_pages')
                ->where('id', $page['id'])
                ->where(
                    'caption_save',
                    $page['caption_save']
                )
                ->delete();
        }
    }
};