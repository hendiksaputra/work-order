<?php

namespace App\Services;

use App\Models\Role;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Validator;
use Shuchkin\SimpleXLSX;
use Shuchkin\SimpleXLSXGen;

class UserExcelService
{
    public const DEFAULT_PASSWORD = 'password';

    /** @return list<list<string>> */
    public function templateRows(): array
    {
        return [
            ['Nama', 'Username', 'Email', 'Password', 'NIK', 'Role', 'Departemen', 'Aktif'],
            ['Budi Santoso', 'budi.santoso', 'budi.santoso@aps.local', self::DEFAULT_PASSWORD, 'EMP001', 'mechanic', 'Workshop', 'ya'],
            ['Andi Mekanik', 'andi.mekanik', '', self::DEFAULT_PASSWORD, '', 'mechanic', 'Workshop', 'ya'],
            ['Contoh Otomatis', '', '', self::DEFAULT_PASSWORD, '', 'mechanic', 'Workshop', 'ya'],
        ];
    }

    public function buildXlsxContent(array $rows): string
    {
        return (string) SimpleXLSXGen::fromArray($rows, 'Users');
    }

    /**
     * @return array{
     *   imported: int,
     *   skipped_empty: int,
     *   skipped_duplicate: int,
     *   skipped_invalid: int,
     *   auto_email: int,
     *   auto_username: int,
     *   skipped: int,
     *   errors: list<string>
     * }
     */
    public function importFile(UploadedFile $file): array
    {
        $validRoles = Role::pluck('slug')->all();
        $parsed = $this->parseRows($file);
        $imported = 0;
        $skippedEmpty = 0;
        $skippedDuplicate = 0;
        $skippedInvalid = 0;
        $autoEmail = 0;
        $autoUsername = 0;
        $errors = [];

        foreach ($parsed as $row) {
            $line = $row['_line'] ?? 0;
            $name = $this->cleanCell($row['name'] ?? '');
            $rawUsername = $this->cleanCell($row['username'] ?? '');
            $rawEmail = strtolower($this->cleanCell($row['email'] ?? ''));
            $password = $this->cleanCell($row['password'] ?? '') ?: self::DEFAULT_PASSWORD;
            $employeeId = $this->cleanCell($row['employee_id'] ?? '') ?: null;
            $role = strtolower($this->cleanCell($row['role'] ?? ''));
            $department = $this->cleanCell($row['department'] ?? '') ?: 'Workshop';
            $isActive = $this->parseActive($row['is_active'] ?? 'ya');

            if ($name === '' || $role === '') {
                $skippedEmpty++;

                continue;
            }

            if (! in_array($role, $validRoles, true)) {
                $skippedInvalid++;
                $errors[] = "Baris {$line}: role \"{$role}\" tidak valid. Gunakan: ".implode(', ', $validRoles);

                continue;
            }

            if ($rawEmail === '') {
                $email = $this->resolveEmail($name, $employeeId, $line);
                $autoEmail++;
            } else {
                $email = $rawEmail;
            }

            if ($rawUsername === '') {
                $username = User::suggestUsername($name, $employeeId, $email);
                $autoUsername++;
            } else {
                $username = User::normalizeUsername($rawUsername);
                if ($username === '') {
                    $skippedInvalid++;
                    $errors[] = "Baris {$line}: username tidak valid.";

                    continue;
                }
                if (User::where('username', $username)->exists()) {
                    $skippedDuplicate++;
                    $errors[] = "Baris {$line}: username {$username} sudah terdaftar (dilewati).";

                    continue;
                }
            }

            $validator = Validator::make(
                ['email' => $email, 'password' => $password, 'employee_id' => $employeeId, 'username' => $username],
                [
                    'email' => 'required|email',
                    'password' => 'string|min:6',
                    'employee_id' => 'nullable|string|max:50',
                    'username' => 'required|string|max:80',
                ]
            );

            if ($validator->fails()) {
                $skippedInvalid++;
                $errors[] = "Baris {$line}: ".$validator->errors()->first();

                continue;
            }

            if (User::where('email', $email)->exists()) {
                $skippedDuplicate++;

                continue;
            }

            if ($employeeId && User::where('employee_id', $employeeId)->exists()) {
                $skippedDuplicate++;
                $errors[] = "Baris {$line}: NIK {$employeeId} sudah terdaftar (dilewati).";

                continue;
            }

            try {
                User::create([
                    'name' => $name,
                    'username' => $username,
                    'email' => $email,
                    'password' => $password,
                    'employee_id' => $employeeId,
                    'role' => $role,
                    'department' => $department,
                    'is_active' => $isActive,
                ]);
                $imported++;
            } catch (\Throwable $e) {
                $errors[] = "Baris {$line}: {$e->getMessage()}";
                $skippedInvalid++;
            }
        }

        return [
            'imported' => $imported,
            'skipped_empty' => $skippedEmpty,
            'skipped_duplicate' => $skippedDuplicate,
            'skipped_invalid' => $skippedInvalid,
            'auto_email' => $autoEmail,
            'auto_username' => $autoUsername,
            'skipped' => $skippedEmpty + $skippedDuplicate + $skippedInvalid,
            'errors' => $errors,
        ];
    }

    private function resolveEmail(string $name, ?string $employeeId, int $line): string
    {
        if ($employeeId !== null && $employeeId !== '') {
            $base = strtolower(preg_replace('/[^a-z0-9]/i', '', $employeeId) ?? '');
            if ($base !== '') {
                return $this->ensureUniqueEmail("{$base}@import.aps.local");
            }
        }

        $slug = $this->slugFromName($name);

        return $this->ensureUniqueEmail("{$slug}.{$line}@import.aps.local");
    }

    private function slugFromName(string $name): string
    {
        $slug = strtolower(preg_replace('/[^a-z0-9]+/i', '.', $name) ?? '');
        $slug = trim($slug, '.');

        return $slug !== '' ? $slug : 'user';
    }

    private function ensureUniqueEmail(string $email): string
    {
        if (! User::where('email', $email)->exists()) {
            return $email;
        }

        [$local, $domain] = array_pad(explode('@', $email, 2), 2, 'import.aps.local');
        $n = 2;
        while (User::where('email', "{$local}+{$n}@{$domain}")->exists()) {
            $n++;
        }

        return "{$local}+{$n}@{$domain}";
    }

    private function parseActive(mixed $value): bool
    {
        $text = strtolower($this->cleanCell($value));

        if (in_array($text, ['tidak', 'no', 'n', '0', 'false', 'nonaktif', 'inactive'], true)) {
            return false;
        }

        return true;
    }

    private function cleanCell(mixed $value): string
    {
        $text = trim((string) $value);

        return preg_replace('/\s+/u', ' ', $text) ?? $text;
    }

    /** @return list<array<string, mixed>> */
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
     * @return list<array<string, mixed>>
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
                $result[] = [
                    'name' => $this->cleanCell($cells[$headerMap['name']] ?? ''),
                    'username' => $this->cleanCell($cells[$headerMap['username']] ?? ''),
                    'email' => $this->cleanCell($cells[$headerMap['email']] ?? ''),
                    'password' => $this->cleanCell($cells[$headerMap['password']] ?? ''),
                    'employee_id' => $this->cleanCell($cells[$headerMap['employee_id']] ?? ''),
                    'role' => $this->cleanCell($cells[$headerMap['role']] ?? ''),
                    'department' => $this->cleanCell($cells[$headerMap['department']] ?? ''),
                    'is_active' => $this->cleanCell($cells[$headerMap['is_active']] ?? 'ya'),
                    '_line' => $lineNumber,
                ];
            } else {
                $result[] = [
                    'name' => $this->cleanCell($cells[0] ?? ''),
                    'username' => $this->cleanCell($cells[1] ?? ''),
                    'email' => $this->cleanCell($cells[2] ?? ''),
                    'password' => $this->cleanCell($cells[3] ?? ''),
                    'employee_id' => $this->cleanCell($cells[4] ?? ''),
                    'role' => $this->cleanCell($cells[5] ?? ''),
                    'department' => $this->cleanCell($cells[6] ?? ''),
                    'is_active' => $this->cleanCell($cells[7] ?? 'ya'),
                    '_line' => $lineNumber,
                ];
            }
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

        return str_contains($joined, 'email')
            || str_contains($joined, 'nama')
            || str_contains($joined, 'username')
            || str_contains($joined, 'role');
    }

    /**
     * @param  list<string>  $headers
     * @return array{name: int, username: int, email: int, password: int, employee_id: int, role: int, department: int, is_active: int}
     */
    private function mapHeaders(array $headers): array
    {
        $map = [
            'name' => 0,
            'username' => 1,
            'email' => 2,
            'password' => 3,
            'employee_id' => 4,
            'role' => 5,
            'department' => 6,
            'is_active' => 7,
        ];

        foreach ($headers as $i => $h) {
            $key = strtolower($h);
            if (str_contains($key, 'username') || $key === 'user') {
                $map['username'] = $i;
            } elseif (str_contains($key, 'email')) {
                $map['email'] = $i;
            } elseif (str_contains($key, 'password') || str_contains($key, 'sandi')) {
                $map['password'] = $i;
            } elseif (str_contains($key, 'nik') || str_contains($key, 'employee')) {
                $map['employee_id'] = $i;
            } elseif ($key === 'role' || str_contains($key, 'peran')) {
                $map['role'] = $i;
            } elseif (str_contains($key, 'depart')) {
                $map['department'] = $i;
            } elseif (str_contains($key, 'aktif') || str_contains($key, 'active') || str_contains($key, 'status')) {
                $map['is_active'] = $i;
            } elseif (str_contains($key, 'nama') || $key === 'name') {
                $map['name'] = $i;
            }
        }

        return $map;
    }
}
