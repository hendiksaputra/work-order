<?php

namespace Database\Seeders;

use App\Models\Oitm;
use Illuminate\Database\Seeder;

class OitmSeeder extends Seeder
{
    public function run(): void
    {
        $items = [
            ['U_MIS_UnitNo' => 'E 070', 'U_MIS_ModeNo' => 'Komatsu PC1250'],
            ['U_MIS_UnitNo' => 'V 039', 'U_MIS_ModeNo' => 'Komatsu HD785'],
            ['U_MIS_UnitNo' => 'V 039', 'U_MIS_ModeNo' => 'Mitsubishi Triton GLS'],
        ];

        foreach ($items as $item) {
            Oitm::updateOrCreate(
                [
                    'U_MIS_UnitNo' => $item['U_MIS_UnitNo'],
                    'U_MIS_ModeNo' => $item['U_MIS_ModeNo'],
                ],
                $item
            );
        }
    }
}
