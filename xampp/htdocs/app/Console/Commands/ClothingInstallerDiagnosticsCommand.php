<?php

namespace App\Console\Commands;

use App\Services\Clothing\ClothingNitroConverterService;
use App\Services\Clothing\ClothingStaffCatalogService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ClothingInstallerDiagnosticsCommand extends Command
{
    protected $signature =
        'clothing:installer-diagnostics';

    protected $description =
        'Comprueba prerequisites del installer de ropa sin modificar nada.';

    public function handle(
        ClothingNitroConverterService $converter
    ): int {
        $failures = 0;

        $this->info(
            'Clothing Installer Diagnostics'
        );

        foreach ([
            'nitro-assets/gamedata/FigureMap.json',
            'nitro-assets/gamedata/FigureData.json',
            'nitro-assets/gamedata/FurnitureData.json',
            'nitro-assets/gamedata/ProductData.json',
        ] as $relative) {
            $path = public_path($relative);

            if (is_file($path)) {
                $this->line(
                    '[OK] ' .
                    $relative
                );
            } else {
                $this->error(
                    '[FAIL] ' .
                    $relative
                );

                $failures++;
            }
        }

        try {
            $converter->assertAvailable();

            $this->line(
                '[OK] nitro-converter: ' .
                $converter->converterRoot()
            );
        } catch (\Throwable $exception) {
            $this->warn(
                '[WARN] nitro-converter: ' .
                $exception->getMessage()
            );
        }

        if (
            Schema::hasTable(
                'items_base'
            )
        ) {
            $template = DB::table(
                'items_base'
            )
                ->where(
                    'id',
                    (int) config(
                        'clothing_marketplace.installer.redeemable_template_base_item_id',
                        2000000002
                    )
                )
                ->first();

            if (
                $template !== null &&
                (string)
                $template
                    ->interaction_type ===
                    'clothing'
            ) {
                $this->line(
                    '[OK] template DB: Amigo Conejo'
                );
            } else {
                $this->error(
                    '[FAIL] template DB Amigo Conejo'
                );

                $failures++;
            }
        }

        foreach ([
            'biribiri_clothing_metadata',
            'biribiri_clothing_tags',
        ] as $table) {
            if (Schema::hasTable($table)) {
                $this->line(
                    '[OK] ' .
                    $table
                );
            } else {
                $this->warn(
                    '[WARN] ' .
                    $table .
                    ' no existe todavía'
                );
            }
        }

        if (
            Schema::hasTable(
                'catalog_pages'
            )
        ) {
            $parent = DB::table(
                'catalog_pages'
            )
                ->where(
                    'id',
                    71244580
                )
                ->first();

            if (
                $parent !== null &&
                (string)
                $parent
                    ->caption_save ===
                    'biribiri_custom'
            ) {
                $this->line(
                    '[OK] STAFF > Biribiri #71244580'
                );
            } else {
                $this->error(
                    '[FAIL] STAFF > Biribiri #71244580'
                );

                $failures++;
            }

            $ready = true;

            foreach ([
                ClothingStaffCatalogService::ROOT_PAGE,
                ClothingStaffCatalogService::WEEKLY_PAGE,
                ClothingStaffCatalogService::CLUB_PAGE,
                ClothingStaffCatalogService::EVENTS_PAGE,
                ClothingStaffCatalogService::PASS_PAGE,
                ClothingStaffCatalogService::OTHER_PAGE,
            ] as $pageId) {
                if (
                    ! DB::table(
                        'catalog_pages'
                    )
                        ->where(
                            'id',
                            $pageId
                        )
                        ->exists()
                ) {
                    $ready = false;
                }
            }

            if ($ready) {
                $this->line(
                    '[OK] STAFF > Biribiri > Ropa'
                );
            } else {
                $this->line(
                    '[PENDING] páginas Ropa se crearán al ejecutar migraciones.'
                );
            }
        }

        if ($failures > 0) {
            $this->error(
                'Diagnostics: FAIL (' .
                $failures .
                ')'
            );

            return self::FAILURE;
        }

        $this->info(
            'Diagnostics: OK'
        );

        return self::SUCCESS;
    }
}