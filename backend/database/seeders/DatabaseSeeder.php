<?php

namespace Database\Seeders;

use App\Models\ActivityType;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(RolePermissionSeeder::class);
        $this->call(AppSettingSeeder::class);
        $this->call(OitmSeeder::class);

        $users = [
            ['name' => 'Admin APS', 'username' => 'admin', 'email' => 'admin@aps.local', 'role' => 'admin', 'employee_id' => 'EMP001'],
            ['name' => 'Administrator Sistem', 'username' => 'administrator', 'email' => 'administrator@aps.local', 'role' => 'admin', 'employee_id' => 'EMP000'],
            ['name' => 'Service Analyst', 'username' => 'planner', 'email' => 'planner@aps.local', 'role' => 'planner', 'employee_id' => 'EMP002'],
            ['name' => 'Supervisor Workshop', 'username' => 'supervisor', 'email' => 'supervisor@aps.local', 'role' => 'supervisor', 'employee_id' => 'EMP003'],
            ['name' => 'Mekanik A', 'username' => 'mekanik1', 'email' => 'mekanik1@aps.local', 'role' => 'mechanic', 'employee_id' => 'EMP004'],
            ['name' => 'Mekanik B', 'username' => 'mekanik2', 'email' => 'mekanik2@aps.local', 'role' => 'mechanic', 'employee_id' => 'EMP005'],
            ['name' => 'Logistic Team', 'username' => 'logistic', 'email' => 'logistic@aps.local', 'role' => 'logistic', 'employee_id' => 'EMP006'],
        ];

        foreach ($users as $u) {
            User::updateOrCreate(
                ['email' => $u['email']],
                [...$u, 'password' => Hash::make('password'), 'department' => 'Workshop', 'is_active' => true]
            );
        }

        $productive = [
            'Pre Washing', 'Washing', 'Dismantle', 'Inspection', 'Assembly', 'Testing',
            'Welding', 'Cutting', 'Grinding', 'Body Repair', 'Painting', 'Packing Component',
            'Refill APAR', 'Repair & Maintenance', 'Service Operator', 'Rigger / Spotter',
        ];
        $nonProductive = ['Stand by', 'Briefing', 'Housekeeping', 'Meeting', 'Training', 'Toilet', 'Sholat', 'Istirahat'];
        $mechanicSkills = ['Bubut', 'Line Boring', 'Boring', 'Sloting', 'Drilling', 'Surface Grinding', 'Electroplating', 'Metal Spray'];

        foreach ($productive as $name) {
            ActivityType::updateOrCreate(['name' => $name], ['category' => 'productive', 'is_active' => true]);
        }
        foreach ($nonProductive as $name) {
            ActivityType::updateOrCreate(['name' => $name], ['category' => 'non_productive', 'is_active' => true]);
        }
        foreach ($mechanicSkills as $name) {
            ActivityType::updateOrCreate(['name' => $name], ['category' => 'mechanic_skill', 'is_active' => true]);
        }

        $planner = User::where('email', 'planner@aps.local')->first();

        $main1 = WorkOrder::updateOrCreate(
            ['wo_number' => 'WO-ADIKARA-001'],
            [
                'type' => 'main',
                'main_category' => 'component',
                'title' => 'Recondition Final Drive Komatsu PC1250',
                'component_name' => 'Final Drive',
                'component_serial' => 'FD-PC1250-001',
                'status' => 'in_execution',
                'manpower_count' => 4,
                'estimated_hours' => 120,
                'target_hours' => 100,
                'created_by' => $planner->id,
                'opened_at' => now()->subDays(5),
            ]
        );

        WorkOrder::updateOrCreate(
            ['wo_number' => 'WO-ADIKARA-002'],
            [
                'type' => 'main',
                'main_category' => 'unit',
                'title' => 'Overhaul Engine & Repair Brake System V 039',
                'unit_model' => 'Komatsu HD785',
                'unit_number' => 'V-039',
                'status' => 'approved',
                'manpower_count' => 6,
                'estimated_hours' => 200,
                'created_by' => $planner->id,
                'opened_at' => now()->subDays(2),
            ]
        );

        WorkOrder::updateOrCreate(
            ['wo_number' => 'SWO-ADIKARA-001'],
            [
                'type' => 'sub',
                'parent_id' => $main1->id,
                'workshop' => 'rebuild',
                'title' => 'Rebuild Final Drive - Sub Job',
                'status' => 'in_execution',
                'manpower_count' => 4,
                'estimated_hours' => 80,
                'created_by' => $planner->id,
                'opened_at' => now()->subDays(4),
            ]
        );
    }
}
