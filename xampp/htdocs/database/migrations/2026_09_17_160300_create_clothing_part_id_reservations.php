<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(
            'clothing_part_id_reservations',
            function (Blueprint $table): void {
                $table->id();

                /*
                 * UNIQUE es la garantía dura de concurrencia:
                 * dos diseñadores no pueden reservar el mismo ID
                 * aunque pulsen el botón al mismo tiempo.
                 */
                $table->unsignedBigInteger('part_id')->unique();

                $table->uuid('reservation_group')->index();
                $table->unsignedInteger('account_id')->index();
                $table->integer('creator_user_id')->nullable()->index();

                $table->unsignedBigInteger(
                    'claimed_submission_id'
                )->nullable()->index();

                $table->string(
                    'source',
                    32
                )->default('designer');

                $table->string(
                    'status',
                    20
                )->default('reserved')->index();

                $table->timestamps();

                $table->index([
                    'account_id',
                    'status',
                ]);
            }
        );
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'clothing_part_id_reservations'
        );
    }
};
