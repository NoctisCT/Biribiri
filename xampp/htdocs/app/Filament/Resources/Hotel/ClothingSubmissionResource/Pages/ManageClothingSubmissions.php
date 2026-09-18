<?php

namespace App\Filament\Resources\Hotel\ClothingSubmissionResource\Pages;

use App\Filament\Resources\Hotel\ClothingSubmissionResource;
use Filament\Resources\Pages\ManageRecords;

class ManageClothingSubmissions extends ManageRecords
{
    protected static string $resource =
        ClothingSubmissionResource::class;

    protected function getHeaderActions(): array
    {
        return [];
    }
}