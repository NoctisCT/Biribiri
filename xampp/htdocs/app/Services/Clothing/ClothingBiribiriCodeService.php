<?php

namespace App\Services\Clothing;

use App\Models\ClothingSubmission;
use Illuminate\Support\Str;
use RuntimeException;

class ClothingBiribiriCodeService
{
    public function redeemableCode(
        ClothingSubmission $submission
    ): string {
        return 'biri_' .
            $this->year($submission) .
            '_' .
            $this->submissionName($submission);
    }

    public function figureLibraryCode(
        ClothingSubmission $submission,
        string $sourceLibrary,
        string $sourceCode
    ): string {
        $sourceLibrary =
            trim($sourceLibrary);

        $sourceCode =
            trim($sourceCode);

        if (
            $sourceLibrary === '' ||
            $sourceCode === ''
        ) {
            throw new RuntimeException(
                'No se puede generar una library Biribiri sin library/code fuente.'
            );
        }

        if (
            ! str_ends_with(
                strtolower($sourceLibrary),
                strtolower($sourceCode)
            )
        ) {
            throw new RuntimeException(
                'La library fuente no termina en su código de categories.txt: ' .
                $sourceLibrary .
                ' / ' .
                $sourceCode
            );
        }

        $prefix =
            substr(
                $sourceLibrary,
                0,
                strlen($sourceLibrary) -
                    strlen($sourceCode)
            );

        $tail =
            $this->sourceTail(
                $sourceCode
            );

        if ($tail === '') {
            $tail =
                $this->submissionName(
                    $submission
                );
        }

        return $prefix .
            'biri' .
            $this->year($submission) .
            $tail;
    }

    private function year(
        ClothingSubmission $submission
    ): string {
        return $submission->created_at
            ? $submission->created_at->format('y')
            : now()->format('y');
    }

    private function submissionName(
        ClothingSubmission $submission
    ): string {
        $name =
            preg_replace(
                '/[^A-Za-z0-9]+/',
                '',
                Str::ascii(
                    (string)
                    $submission->clothing_name
                )
            ) ?? '';

        if ($name === '') {
            throw new RuntimeException(
                'El nombre de la ropa no produce un código técnico válido.'
            );
        }

        return $name;
    }

    private function sourceTail(
        string $sourceCode
    ): string {
        $clean =
            preg_replace(
                '/[^A-Za-z0-9]+/',
                '',
                Str::ascii(
                    $sourceCode
                )
            ) ?? '';

        if (
            preg_match(
                '/^[A-Za-z]+[0-9]{2}(.+)$/',
                $clean,
                $matches
            ) === 1
        ) {
            return preg_replace(
                '/[^A-Za-z0-9]+/',
                '',
                (string) $matches[1]
            ) ?? '';
        }

        return '';
    }
}
