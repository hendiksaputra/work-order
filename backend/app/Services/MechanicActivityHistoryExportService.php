<?php

namespace App\Services;

use App\Models\MechanicActivity;
use App\Support\DecimalHours;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Support\Collection;
use Shuchkin\SimpleXLSXGen;

class MechanicActivityHistoryExportService
{
    public const EXPORT_LIMIT = 10000;

    private const STATUS_LABELS = [
        'draft' => 'Draft',
        'pending_supervisor' => 'Menunggu Supervisor',
        'pending_approval' => 'Menunggu Approval',
        'approved' => 'Disetujui',
        'in_execution' => 'Eksekusi',
        'qc_pending' => 'QC Pending',
        'qc_approved' => 'QC Approved',
        'closed' => 'Closed',
        'rejected' => 'Ditolak',
        'logistic_check' => 'Cek Logistic',
        'taken' => 'Diambil',
    ];

    private const CATEGORY_LABELS = [
        'productive' => 'Produktif',
        'non_productive' => 'Non produktif',
        'mechanic_skill' => 'Mechanic skill',
    ];

    public function buildXlsxContent(Collection $activities): string
    {
        return (string) SimpleXLSXGen::fromArray($this->exportRows($activities), 'Aktivitas Mekanik');
    }

    /**
     * @param  array{title?: string, filters?: string, generated_at?: string}  $meta
     */
    public function buildPdfContent(Collection $activities, array $meta = []): string
    {
        $options = new Options;
        $options->set('isRemoteEnabled', false);
        $options->set('defaultFont', 'DejaVu Sans');

        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($this->buildPdfHtml($activities, $meta));
        $dompdf->setPaper('A4', 'landscape');
        $dompdf->render();

        return $dompdf->output();
    }

    /** @return list<list<string>> */
    public function exportRows(Collection $activities): array
    {
        $rows = [[
            'Tanggal',
            'Mekanik',
            'NIK',
            'WO',
            'Aktivitas',
            'Kategori',
            'Mode',
            'Jam Mulai',
            'Jam Selesai',
            'Total Jam',
            'Status',
            'Keterangan',
            'Catatan Supervisor',
        ]];

        foreach ($activities as $activity) {
            $rows[] = $this->rowFromActivity($activity);
        }

        return $rows;
    }

    /**
     * @param  array{title?: string, filters?: string, generated_at?: string}  $meta
     */
    private function buildPdfHtml(Collection $activities, array $meta): string
    {
        $title = htmlspecialchars($meta['title'] ?? 'Mechanic Activity History', ENT_QUOTES, 'UTF-8');
        $filters = htmlspecialchars($meta['filters'] ?? 'Semua data', ENT_QUOTES, 'UTF-8');
        $generatedAt = htmlspecialchars($meta['generated_at'] ?? now()->format('d/m/Y H:i'), ENT_QUOTES, 'UTF-8');
        $count = $activities->count();

        $headerCells = [
            'Tanggal', 'Mekanik', 'NIK', 'WO', 'Aktivitas', 'Kategori', 'Mode',
            'Jam', 'Total', 'Status',
        ];

        $thead = '';
        foreach ($headerCells as $cell) {
            $thead .= '<th>'.htmlspecialchars($cell, ENT_QUOTES, 'UTF-8').'</th>';
        }

        $tbody = '';
        foreach ($activities as $activity) {
            $row = $this->rowFromActivity($activity);
            $tbody .= '<tr>';
            $tbody .= '<td>'.$this->e($row[0]).'</td>';
            $tbody .= '<td>'.$this->e($row[1]).'</td>';
            $tbody .= '<td>'.$this->e($row[2]).'</td>';
            $tbody .= '<td>'.$this->e($row[3]).'</td>';
            $tbody .= '<td>'.$this->e($row[4]).'</td>';
            $tbody .= '<td>'.$this->e($row[5]).'</td>';
            $tbody .= '<td>'.$this->e($row[6]).'</td>';
            $tbody .= '<td>'.$this->e($row[7].'–'.$row[8]).'</td>';
            $tbody .= '<td>'.$this->e($row[9]).'</td>';
            $tbody .= '<td>'.$this->e($row[10]).'</td>';
            $tbody .= '</tr>';
        }

        if ($count === 0) {
            $tbody = '<tr><td colspan="10" style="text-align:center;color:#64748b;padding:16px;">Tidak ada data aktivitas.</td></tr>';
        }

        return <<<HTML
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<style>
  body { font-family: DejaVu Sans, sans-serif; font-size: 9px; color: #0f172a; }
  h1 { font-size: 14px; margin: 0 0 4px; }
  .meta { font-size: 8px; color: #64748b; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f1f5f9; text-align: left; padding: 5px 4px; border: 1px solid #cbd5e1; font-size: 8px; }
  td { padding: 4px; border: 1px solid #e2e8f0; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
</style>
</head>
<body>
  <h1>{$title}</h1>
  <p class="meta">Filter: {$filters} · {$count} baris · Dicetak {$generatedAt}</p>
  <table>
    <thead><tr>{$thead}</tr></thead>
    <tbody>{$tbody}</tbody>
  </table>
</body>
</html>
HTML;
    }

    /** @return list<string> */
    private function rowFromActivity(MechanicActivity $activity): array
    {
        return [
            $activity->activity_date?->format('d/m/Y') ?? '',
            $activity->user?->name ?? '',
            $activity->user?->employee_id ?? '',
            $activity->workOrder?->wo_number ?? 'Stand by',
            $activity->activityType?->name ?? '',
            self::CATEGORY_LABELS[$activity->activityType?->category ?? ''] ?? ($activity->activityType?->category ?? ''),
            ucfirst((string) ($activity->mode ?? '')),
            substr((string) $activity->start_time, 0, 5),
            substr((string) $activity->end_time, 0, 5),
            DecimalHours::format($activity->total_hours),
            self::STATUS_LABELS[$activity->status] ?? $activity->status,
            $activity->notes ?? '',
            $activity->supervisor_notes ?? '',
        ];
    }

    private function e(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
    }
}
