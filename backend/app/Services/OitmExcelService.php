<?php

namespace App\Services;

use App\Models\Oitm;
use Illuminate\Http\UploadedFile;
use Shuchkin\SimpleXLSX;
use Shuchkin\SimpleXLSXGen;

class OitmExcelService
{
    /** @return list<list<string>> */
    public function exportRows(): array
    {
        $rows = [['U_MIS_UnitNo', 'U_MIS_ModeNo']];

        Oitm::query()
            ->orderBy('U_MIS_UnitNo')
            ->orderBy('U_MIS_ModeNo')
            ->each(function (Oitm $item) use (&$rows) {
                $rows[] = [$item->U_MIS_UnitNo, $item->U_MIS_ModeNo];
            });

        return $rows;
    }

    /** @return list<list<string>> */
    public function templateRows(): array
    {
        return [
            ['U_MIS_UnitNo', 'U_MIS_ModeNo'],
            ['V 039', 'Komatsu HD785'],
            ['E 070', 'Komatsu PC1250'],
        ];
    }

    public function buildXlsxContent(array $rows): string
    {
        return (string) SimpleXLSXGen::fromArray($rows, 'OITM');
    }

    /**
     * @return array{
     *   imported: int,
     *   skipped_empty: int,
     *   skipped_duplicate: int,
     *   skipped: int,
     *   errors: list<string>
     * }
     */
    public function importFile(UploadedFile $file): array
    {
        $parsed = $this->parseRows($file);
        $imported = 0;
        $skippedEmpty = 0;
        $skippedDuplicate = 0;
        $errors = [];

        foreach ($parsed as $row) {
            $line = $row['_line'] ?? 0;
            $unitNo = $this->cleanCell($row['U_MIS_UnitNo'] ?? '');
            $modeNo = $this->cleanCell($row['U_MIS_ModeNo'] ?? '');

            if ($unitNo === '' || $modeNo === '') {
                $skippedEmpty++;

                continue;
            }

            $exists = Oitm::where('U_MIS_UnitNo', $unitNo)
                ->where('U_MIS_ModeNo', $modeNo)
                ->exists();

            if ($exists) {
                $skippedDuplicate++;

                continue;
            }

            try {
                Oitm::create([
                    'U_MIS_UnitNo' => $unitNo,
                    'U_MIS_ModeNo' => $modeNo,
                ]);
                $imported++;
            } catch (\Throwable $e) {
                $errors[] = "Baris {$line}: {$e->getMessage()}";
            }
        }

        return [
            'imported' => $imported,
            'skipped_empty' => $skippedEmpty,
            'skipped_duplicate' => $skippedDuplicate,
            'skipped' => $skippedEmpty + $skippedDuplicate,
            'errors' => $errors,
        ];
    }

    private function cleanCell(mixed $value): string
    {
        $text = trim((string) $value);

        return preg_replace('/\s+/u', ' ', $text) ?? $text;
    }

    /** @return list<array{U_MIS_UnitNo: string, U_MIS_ModeNo: string}> */
    private function parseRows(UploadedFile $file): array
    {
        $extension = strtolower($file->getClientOriginalExtension());
        $rawRows = match ($extension) {
            'csv', 'txt' => $this->parseCsv($file->getRealPath()),
            'xlsx' => $this->parseXlsx($file->getRealPath()),
            default => throw new \InvalidArgumentException('Format file tidak didukung. Gunakan .xlsx atau .csv'),
        };

        return $this->normalizeRows($rawRows);
    }

    /** @return list<list<string>> */
    private function parseCsv(string $path): array
    {
        $handle = fopen($path, 'r');
        if (! $handle) {
            throw new \RuntimeException('Tidak dapat membaca file CSV.');
        }

        $firstLine = fgets($handle) ?: '';
        rewind($handle);
        $delimiter = substr_count($firstLine, ';') > substr_count($firstLine, ',') ? ';' : ',';

        $rows = [];
        while (($data = fgetcsv($handle, 0, $delimiter)) !== false) {
            $rows[] = array_map(fn ($v) => trim((string) $v), $data);
        }
        fclose($handle);

        return $rows;
    }

    /** @return list<list<string>> */
    private function parseXlsx(string $path): array
    {
        $xlsx = SimpleXLSX::parse($path);
        if (! $xlsx) {
            throw new \RuntimeException(SimpleXLSX::parseError() ?: 'Gagal membaca file Excel.');
        }

        return $xlsx->rows();
    }

    /**
     * @param  list<list<string>>  $rawRows
     * @return list<array{U_MIS_UnitNo: string, U_MIS_ModeNo: string, _line: int}>
     */
    private function normalizeRows(array $rawRows): array
    {
        if ($rawRows === []) {
            return [];
        }

        $headerMap = null;
        $result = [];

        foreach ($rawRows as $excelLine => $row) {
            $lineNumber = $excelLine + 1;
            $cells = array_values(array_map(fn ($v) => $this->cleanCell($v), $row));

            if (! $this->rowHasAnyData($cells)) {
                continue;
            }

            if ($headerMap === null && $this->looksLikeHeader($cells)) {
                $headerMap = $this->mapHeaders($cells);

                continue;
            }

            if ($headerMap !== null) {
                $unitNo = $this->cleanCell($cells[$headerMap['unit']] ?? '');
                $modeNo = $this->cleanCell($cells[$headerMap['model']] ?? '');
            } else {
                $unitNo = $this->cleanCell($cells[0] ?? '');
                $modeNo = $this->cleanCell($cells[1] ?? '');
            }

            $result[] = [
                'U_MIS_UnitNo' => $unitNo,
                'U_MIS_ModeNo' => $modeNo,
                '_line' => $lineNumber,
            ];
        }

        return $result;
    }

    /** @param  list<string>  $cells */
    private function rowHasAnyData(array $cells): bool
    {
        foreach ($cells as $cell) {
            if ($cell !== '') {
                return true;
            }
        }

        return false;
    }

    /** @param  list<string>  $cells */
    private function looksLikeHeader(array $cells): bool
    {
        $joined = strtolower(implode(' ', $cells));

        return str_contains($joined, 'unit')
            || str_contains($joined, 'mis')
            || str_contains($joined, 'model')
            || str_contains($joined, 'mode');
    }

    /**
     * @param  list<string>  $headers
     * @return array{unit: int, model: int}
     */
    private function mapHeaders(array $headers): array
    {
        $unitIdx = 0;
        $modelIdx = 1;

        foreach ($headers as $i => $h) {
            $key = strtolower($h);
            if (str_contains($key, 'model') || str_contains($key, 'mode')) {
                $modelIdx = $i;
            } elseif (str_contains($key, 'unit') || str_contains($key, 'ex unit')) {
                $unitIdx = $i;
            }
        }

        return ['unit' => $unitIdx, 'model' => $modelIdx];
    }
}
