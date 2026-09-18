<?php

namespace App\Http\Controllers\Housekeeping;

use App\Http\Controllers\Controller;
use App\Models\ClothingSubmission;
use RuntimeException;

class ClothingPreviewAssetController extends Controller
{
    public function figureData(
        ClothingSubmission $submission
    ) {
        return $this->servePreviewFile(
            $submission,
            'gamedata/FigureData.json',
            'application/json; charset=UTF-8'
        );
    }

    public function figureMap(
        ClothingSubmission $submission
    ) {
        return $this->servePreviewFile(
            $submission,
            'gamedata/FigureMap.json',
            'application/json; charset=UTF-8'
        );
    }

    public function figureAsset(
        ClothingSubmission $submission,
        string $library
    ) {
        $this->authorizePreview();

        if (
            preg_match(
                '/^[A-Za-z0-9_]+$/',
                $library
            ) !== 1
        ) {
            abort(404);
        }

        $avatarRoot =
            $this->avatarRoot(
                $submission
            );

        $preview =
            $avatarRoot .
            DIRECTORY_SEPARATOR .
            'figure' .
            DIRECTORY_SEPARATOR .
            $library .
            '.nitro';

        if (is_file($preview)) {
            return response()->file(
                $preview,
                [
                    'Content-Type' =>
                        'application/octet-stream',
                    'Cache-Control' =>
                        'private, no-store, max-age=0',
                ]
            );
        }

        /*
         * El renderer del avatar también necesita las libraries
         * normales del personaje. Esas se leen del asset vivo,
         * pero nunca se escribe sobre él desde la preview.
         */
        $live =
            public_path(
                'nitro-assets/bundled/figure/' .
                $library .
                '.nitro'
            );

        if (! is_file($live)) {
            abort(404);
        }

        return response()->file(
            $live,
            [
                'Content-Type' =>
                    'application/octet-stream',
                'Cache-Control' =>
                    'private, no-store, max-age=0',
            ]
        );
    }

    private function servePreviewFile(
        ClothingSubmission $submission,
        string $relative,
        string $contentType
    ) {
        $this->authorizePreview();

        $path =
            $this->avatarRoot(
                $submission
            ) .
            DIRECTORY_SEPARATOR .
            str_replace(
                '/',
                DIRECTORY_SEPARATOR,
                $relative
            );

        if (! is_file($path)) {
            abort(404);
        }

        return response()->file(
            $path,
            [
                'Content-Type' =>
                    $contentType,
                'Cache-Control' =>
                    'private, no-store, max-age=0',
            ]
        );
    }

    private function avatarRoot(
        ClothingSubmission $submission
    ): string {
        $preview =
            $submission->preview_manifest;

        $relative =
            is_array($preview) &&
            is_array(
                $preview['avatar'] ?? null
            )
                ? trim(
                    str_replace(
                        '\\',
                        '/',
                        (string) (
                            $preview['avatar'][
                                'root_relative'
                            ] ?? ''
                        )
                    )
                )
                : '';

        if (
            $relative === '' ||
            ! str_starts_with(
                $relative,
                'clothing_importer/previews/' .
                $submission->id .
                '/'
            ) ||
            str_contains(
                $relative,
                '../'
            )
        ) {
            throw new RuntimeException(
                'La solicitud no tiene avatar preview válido.'
            );
        }

        $root =
            realpath(
                storage_path(
                    'app/' .
                    ltrim(
                        $relative,
                        '/'
                    )
                )
            );

        if (
            $root === false ||
            ! is_dir($root)
        ) {
            throw new RuntimeException(
                'No existe el avatar preview de la solicitud.'
            );
        }

        return $root;
    }

    private function authorizePreview(): void
    {
        abort_unless(
            auth()->check() &&
            hasHousekeepingPermission(
                'manage_clothing_submissions'
            ),
            403
        );
    }
}
