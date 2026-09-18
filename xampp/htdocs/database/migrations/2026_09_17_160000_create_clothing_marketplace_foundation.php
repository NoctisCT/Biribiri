<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('clothing_submissions', function (Blueprint $table) {
            $table->id();

            $table->unsignedInteger('account_id')->nullable();
            $table->integer('creator_user_id')->nullable();

            $table->string('source_mode', 20)->default('designer');
            $table->string('source_path')->nullable();
            $table->string('original_filename')->nullable();

            $table->string('clothing_name', 80);
            $table->string('tag', 64)->nullable();
            $table->string('designer_comment', 500)->nullable();

            $table->string('requested_category', 8)->nullable();
            $table->string('final_category', 8)->nullable();

            $table->string('intended_acquisition_method', 32)
                ->default('weekly_store');

            /*
             * single = una prenda.
             * set    = varias prendas desbloqueadas por UN furni.
             */
            $table->string('package_kind', 16)
                ->default('single');
            $table->unsignedSmallInteger('piece_count')
                ->default(1);
            $table->json('piece_manifest')->nullable();

            $table->string('status', 24)->default('pending');
            $table->string('technical_status', 24)
                ->default('not_checked');

            $table->json('technical_report')->nullable();
            $table->json('preview_manifest')->nullable();

            /*
             * clothing_code = código lógico de categories.txt.
             * clothing_library_codes = nombres técnicos exactos de
             * FigureMap/SWF. Se preservan; no se renombran a ciegas.
             */
            $table->string('clothing_code', 128)->nullable();
            $table->json('clothing_library_codes')->nullable();
            $table->string('redeemable_furni_code', 128)->nullable();

            /*
             * Huella del paquete técnico para detectar reenvíos
             * y dobles importaciones sin depender del nombre humano.
             */
            $table->string('source_fingerprint', 64)->nullable();

            $table->unsignedInteger('clothing_catalog_id')->nullable();
            $table->unsignedInteger('redeemable_base_item_id')->nullable();

            /*
             * La copia gratuita del diseñador debe ser NO tradeable.
             * En Arcturus la tradeabilidad vive normalmente en items_base,
             * no en la instancia, por eso reservamos una base distinta.
             */
            $table->unsignedInteger('designer_reward_base_item_id')
                ->nullable();

            $table->integer('moderator_user_id')->nullable();
            $table->string('moderation_reason', 500)->nullable();

            $table->timestamp('approved_at')->nullable();
            $table->timestamp('rejected_at')->nullable();

            $table->timestamps();

            $table->index(['status', 'created_at']);
            $table->index(['creator_user_id', 'status']);
            $table->index(['account_id', 'status']);
            $table->index(['technical_status', 'status']);
            $table->index('intended_acquisition_method');
            $table->index('source_fingerprint');
        });

        Schema::create('clothing_products', function (Blueprint $table) {
            $table->id();

            $table->unsignedBigInteger('clothing_submission_id')
                ->nullable();

            $table->integer('creator_user_id')->nullable();

            /*
             * weekly_store  = tienda semanal WEB
             * biri_club     = colección mensual Biri Club
             * battle_pass   = futuro
             * online_time   = futuro
             * event         = futuro
             * staff         = distribución interna
             */
            $table->string('acquisition_method', 32);

            $table->string('name', 80);
            $table->string('tag', 64)->nullable();
            $table->string('category', 8)->nullable();

            /*
             * Un producto puede representar una sola prenda o un SET.
             * En ambos casos la compra entrega un único tipo de furni
             * canjeable; para un set, catalog_clothing agrupará todos
             * los setId desbloqueables.
             */
            $table->string('package_kind', 16)
                ->default('single');
            $table->unsignedSmallInteger('piece_count')
                ->default(1);
            $table->json('piece_manifest')->nullable();

            /*
             * La tienda semanal es WEB. El catálogo público del juego
             * no es la fuente de venta.
             */
            $table->boolean('web_visible')->default(false);
            $table->string('web_section', 32)->nullable();

            /*
             * draft      = preparada
             * scheduled  = programada
             * active     = visible/comprable ahora
             * previous   = semana anterior, sigue hasta agotar
             * sold_out   = agotada
             * retired    = retirada
             */
            $table->string('status', 24)->default('draft');

            $table->string('currency_type', 24)->default('credits');
            $table->unsignedInteger('points_type')->nullable();
            $table->unsignedInteger('unit_price')->default(0);

            /*
             * limited: mantiene stock y, tras el domingo, pasa a
             * "Ropa de semanas anteriores" hasta agotarse.
             * unlimited: se retira al siguiente cambio semanal.
             */
            $table->string('stock_mode', 16)->default('limited');
            $table->unsignedInteger('stock_total')->nullable();
            $table->unsignedInteger('sold_count')->default(0);

            /*
             * El usuario puede comprar varias unidades.
             * NULL = sin límite por usuario.
             */
            $table->unsignedInteger('purchase_limit_per_user')->nullable();

            $table->timestamp('starts_at')->nullable();
            $table->timestamp('weekly_window_ends_at')->nullable();
            $table->timestamp('retires_at')->nullable();

            $table->boolean('keep_after_window_until_sold')
                ->default(true);

            /*
             * Economía: 50% diseñador, 50% quema.
             */
            $table->unsignedTinyInteger('creator_share_percent')
                ->default(50);
            $table->unsignedTinyInteger('burn_percent')
                ->default(50);

            /*
             * La compra WEB entrega un FURNI CANJEABLE TRADEABLE.
             * Ese furni es el activo económico que el usuario puede
             * guardar, intercambiar o revender antes de canjear.
             */
            $table->unsignedInteger('redeemable_base_item_id')->nullable();
            $table->boolean('public_furni_tradeable')->default(true);

            /*
             * Copia especial del diseñador: misma ropa, pero base de
             * furni distinta y NO tradeable.
             */
            $table->unsignedInteger('designer_reward_base_item_id')
                ->nullable();
            $table->boolean('designer_reward_nontradeable')
                ->default(true);
            $table->timestamp('designer_reward_due_at')->nullable();
            $table->timestamp('designer_reward_delivered_at')->nullable();

            /*
             * La ropa aprobada también se publica en:
             * STAFF > BiriBiri > Ropa > <sección>
             */
            $table->string('staff_catalog_section', 64)->nullable();

            $table->timestamps();

            $table->foreign('clothing_submission_id')
                ->references('id')
                ->on('clothing_submissions')
                ->nullOnDelete();

            $table->index([
                'acquisition_method',
                'status',
                'web_visible',
            ]);

            $table->index([
                'status',
                'starts_at',
                'weekly_window_ends_at',
            ]);

            $table->index(['creator_user_id', 'status']);
        });

        Schema::create('clothing_sales', function (Blueprint $table) {
            $table->id();

            $table->string('purchase_id', 64)->unique();

            $table->unsignedBigInteger('clothing_product_id');
            $table->integer('buyer_user_id');

            $table->unsignedInteger('quantity')->default(1);

            $table->string('currency_type', 24)->default('credits');
            $table->unsignedInteger('points_type')->nullable();

            $table->unsignedBigInteger('gross_amount');
            $table->unsignedBigInteger('creator_amount')->default(0);
            $table->unsignedBigInteger('burn_amount')->default(0);

            /*
             * pending -> charging -> charged -> delivering
             * -> delivered
             * -> delivered_pending_payout
             * -> manual_review
             * -> refunded
             */
            $table->string('status', 32)->default('pending');

            /*
             * La entrega son instancias del furni canjeable, NO la ropa
             * directamente. Conserva la economía y la reventa.
             */
            $table->json('delivered_item_ids')->nullable();

            $table->string('charge_transaction_id', 96)
                ->nullable()
                ->unique();

            $table->string('payout_transaction_id', 96)
                ->nullable()
                ->unique();

            $table->string('refund_transaction_id', 96)
                ->nullable()
                ->unique();

            $table->text('manual_review_reason')->nullable();

            $table->timestamp('charged_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('payout_at')->nullable();
            $table->timestamp('refunded_at')->nullable();

            $table->timestamps();

            $table->foreign('clothing_product_id')
                ->references('id')
                ->on('clothing_products');

            $table->index([
                'clothing_product_id',
                'status',
                'created_at',
            ]);

            $table->index([
                'buyer_user_id',
                'created_at',
            ]);
        });

        /*
         * Rewards opcionales ligados a la COMPRA WEB.
         * Ejemplo: una placa promocional.
         *
         * NO forman parte del furni y NO se transfieren si el furni
         * se vende después a otro usuario.
         */
        Schema::create('clothing_product_rewards', function (Blueprint $table) {
            $table->id();

            $table->unsignedBigInteger('clothing_product_id');

            $table->string('reward_type', 24);
            $table->string('reward_key', 128);
            $table->string('grant_timing', 24)
                ->default('purchase');

            /*
             * Las placas se dan una vez por usuario por defecto,
             * aunque compre varias unidades del mismo producto.
             */
            $table->boolean('once_per_user')
                ->default(true);

            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->foreign('clothing_product_id')
                ->references('id')
                ->on('clothing_products')
                ->cascadeOnDelete();

            $table->unique([
                'clothing_product_id',
                'reward_type',
                'reward_key',
                'grant_timing',
            ], 'clothing_product_reward_unique');
        });

        /*
         * Ledger idempotente de rewards de compra.
         */
        Schema::create('clothing_sale_rewards', function (Blueprint $table) {
            $table->id();

            $table->unsignedBigInteger('clothing_sale_id');
            $table->unsignedBigInteger('clothing_product_reward_id');
            $table->integer('user_id');

            $table->string('status', 24)
                ->default('pending');

            $table->string('delivery_transaction_id', 96)
                ->nullable()
                ->unique();

            $table->text('error_message')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamps();

            $table->foreign('clothing_sale_id')
                ->references('id')
                ->on('clothing_sales')
                ->cascadeOnDelete();

            $table->foreign('clothing_product_reward_id')
                ->references('id')
                ->on('clothing_product_rewards')
                ->cascadeOnDelete();

            $table->unique([
                'clothing_sale_id',
                'clothing_product_reward_id',
            ], 'clothing_sale_reward_unique');

            $table->index([
                'user_id',
                'status',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('clothing_sale_rewards');
        Schema::dropIfExists('clothing_product_rewards');
        Schema::dropIfExists('clothing_sales');
        Schema::dropIfExists('clothing_products');
        Schema::dropIfExists('clothing_submissions');
    }
};