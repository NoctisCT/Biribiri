<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (
            ! Schema::hasTable(
                'clothing_part_id_reservations'
            )
        ) {
            throw new \RuntimeException(
                'Falta clothing_part_id_reservations de P11.6.'
            );
        }

        if (
            Schema::hasColumn(
                'clothing_part_id_reservations',
                'source_part_id'
            )
        ) {
            throw new \RuntimeException(
                'source_part_id ya existe: P11.8 no se aplica dos veces.'
            );
        }

        Schema::table(
            'clothing_part_id_reservations',
            function (Blueprint $table): void {
                /*
                 * part_id queda como ID FINAL BIRIBIRI.
                 * source_part_id conserva el ID técnico que traía el RAR.
                 */
                $table->unsignedBigInteger(
                    'source_part_id'
                )
                    ->nullable()
                    ->after('part_id');

                $table->unique(
                    [
                        'claimed_submission_id',
                        'source_part_id',
                    ],
                    'clothing_part_submission_source_uq'
                );
            }
        );
    }

    public function down(): void
    {
        if (
            ! Schema::hasTable(
                'clothing_part_id_reservations'
            ) ||
            ! Schema::hasColumn(
                'clothing_part_id_reservations',
                'source_part_id'
            )
        ) {
            return;
        }

        Schema::table(
            'clothing_part_id_reservations',
            function (Blueprint $table): void {
                $table->dropUnique(
                    'clothing_part_submission_source_uq'
                );

                $table->dropColumn(
                    'source_part_id'
                );
            }
        );
    }
};
