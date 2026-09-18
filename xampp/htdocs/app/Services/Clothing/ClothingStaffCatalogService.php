<?php

namespace App\Services\Clothing;

use Illuminate\Support\Facades\DB;
use RuntimeException;

class ClothingStaffCatalogService
{
    public const ROOT_PAGE = 71244582;
    public const WEEKLY_PAGE = 71244583;
    public const CLUB_PAGE = 71244584;
    public const EVENTS_PAGE = 71244585;
    public const PASS_PAGE = 71244586;
    public const OTHER_PAGE = 71244587;

    private const EXPECTED = [
        self::ROOT_PAGE => [
            'parent_id' => 71244580,
            'caption_save' => 'biribiri_clothing',
            'caption' => 'Ropa',
        ],
        self::WEEKLY_PAGE => [
            'parent_id' => self::ROOT_PAGE,
            'caption_save' =>
                'biribiri_clothing_weekly',
            'caption' => 'Semanal',
        ],
        self::CLUB_PAGE => [
            'parent_id' => self::ROOT_PAGE,
            'caption_save' =>
                'biribiri_clothing_club',
            'caption' => 'Biri Club',
        ],
        self::EVENTS_PAGE => [
            'parent_id' => self::ROOT_PAGE,
            'caption_save' =>
                'biribiri_clothing_events',
            'caption' => 'Eventos',
        ],
        self::PASS_PAGE => [
            'parent_id' => self::ROOT_PAGE,
            'caption_save' =>
                'biribiri_clothing_pass',
            'caption' => 'Pase',
        ],
        self::OTHER_PAGE => [
            'parent_id' => self::ROOT_PAGE,
            'caption_save' =>
                'biribiri_clothing_other',
            'caption' => 'Otras',
        ],
    ];

    public function assertReady(): void
    {
        foreach (self::EXPECTED as $id => $expected) {
            $row = DB::table('catalog_pages')
                ->where('id', $id)
                ->first();

            if ($row === null) {
                throw new RuntimeException(
                    'Falta página STAFF de ropa #' .
                    $id .
                    '. Ejecuta las migraciones P1-P6.'
                );
            }

            if (
                (int) $row->parent_id !==
                    $expected['parent_id'] ||
                (string) $row->caption_save !==
                    $expected['caption_save']
            ) {
                throw new RuntimeException(
                    'Página STAFF de ropa inesperada #' .
                    $id .
                    '.'
                );
            }
        }
    }

    public function pageIdFor(
        string $acquisitionMethod
    ): int {
        return match ($acquisitionMethod) {
            'weekly_store' => self::WEEKLY_PAGE,
            'biri_club' => self::CLUB_PAGE,
            'event' => self::EVENTS_PAGE,
            'battle_pass' => self::PASS_PAGE,
            default => self::OTHER_PAGE,
        };
    }

    public function sectionFor(
        string $acquisitionMethod
    ): string {
        return match ($acquisitionMethod) {
            'weekly_store' => 'Semanal',
            'biri_club' => 'Biri Club',
            'event' => 'Eventos',
            'battle_pass' => 'Pase',
            default => 'Otras',
        };
    }
}