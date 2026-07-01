<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PartsRequest;
use App\Models\Role;
use App\Models\User;
use App\Models\WorkOrder;
use App\Services\UserExcelService;
use App\Support\Permission;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class UserController extends Controller
{
    public function __construct(private UserExcelService $excel) {}

    public function index(Request $request)
    {
        $query = User::query()->visibleTo($request->user())->orderBy('name');

        $this->applyUserListFilters($query, $request);

        return response()->json($query->paginate($request->integer('per_page', 20)));
    }

    public function store(Request $request)
    {
        $roles = Role::pluck('slug')->all();

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'username' => ['nullable', 'string', 'max:80', 'unique:users,username', 'regex:/^[a-zA-Z0-9._-]+$/'],
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:6',
            'employee_id' => 'nullable|string|max:50|unique:users,employee_id',
            'role' => ['required', Rule::in($roles)],
            'department' => 'nullable|string|max:100',
            'is_active' => 'boolean',
        ]);

        $data['password'] = Hash::make($data['password']);
        $data['is_active'] = $data['is_active'] ?? true;
        if (! $request->user()->canViewAllDepartments()) {
            $data['department'] = $request->user()->department;
        }
        $data['username'] = $this->resolveUsername(
            $data['username'] ?? null,
            $data['name'],
            $data['employee_id'] ?? null,
            $data['email']
        );

        $user = User::create($data);

        return response()->json($this->formatUser($user), 201);
    }

    public function show(Request $request, User $user)
    {
        if (! $user->isVisibleTo($request->user())) {
            return response()->json(['message' => 'Pengguna tidak ditemukan.'], 404);
        }

        return response()->json($this->formatUser($user));
    }

    public function update(Request $request, User $user)
    {
        if (! $user->isVisibleTo($request->user())) {
            return response()->json(['message' => 'Pengguna tidak ditemukan.'], 404);
        }

        $roles = Role::pluck('slug')->all();

        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'username' => ['nullable', 'string', 'max:80', Rule::unique('users', 'username')->ignore($user->id), 'regex:/^[a-zA-Z0-9._-]+$/'],
            'email' => ['sometimes', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => 'nullable|string|min:6',
            'employee_id' => ['nullable', 'string', 'max:50', Rule::unique('users', 'employee_id')->ignore($user->id)],
            'role' => ['sometimes', Rule::in($roles)],
            'department' => 'nullable|string|max:100',
            'is_active' => 'boolean',
        ]);

        if (array_key_exists('username', $data)) {
            $data['username'] = $this->resolveUsername(
                $data['username'],
                $data['name'] ?? $user->name,
                $data['employee_id'] ?? $user->employee_id,
                $data['email'] ?? $user->email,
                $user->id
            );
        }

        if (! empty($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }

        if (! $request->user()->canViewAllDepartments()) {
            $data['department'] = $request->user()->department;
        }

        $user->update($data);

        return response()->json($this->formatUser($user->fresh()));
    }

    public function destroy(Request $request, User $user)
    {
        if (! $user->isVisibleTo($request->user())) {
            return response()->json(['message' => 'Pengguna tidak ditemukan.'], 404);
        }

        $result = $this->attemptDeleteUser($user, $request->user()->id);
        if ($result['error']) {
            return response()->json(['message' => $result['error']], 422);
        }

        return response()->json(['message' => 'Pengguna dihapus.']);
    }

    public function bulkDestroy(Request $request)
    {
        $request->validate([
            'ids' => 'sometimes|array',
            'ids.*' => 'integer|exists:users,id',
            'all_non_admin' => 'sometimes|boolean',
            'search' => 'nullable|string',
            'role' => 'nullable|string',
        ]);

        $currentUserId = $request->user()->id;
        $allNonAdmin = $request->boolean('all_non_admin');

        if ($allNonAdmin) {
            $query = $this->bulkDeleteQuery($request);
        } elseif ($request->has('ids') && count($request->input('ids', [])) > 0) {
            $query = User::query()
                ->visibleTo($request->user())
                ->whereIn('id', $request->input('ids'))
                ->where('role', '!=', 'admin');
        } else {
            return response()->json(['message' => 'Pilih pengguna atau centang hapus semua (kecuali administrator).'], 422);
        }

        $users = $query->where('id', '!=', $currentUserId)->orderBy('id')->get();

        $deleted = 0;
        $skipped = [];
        foreach ($users as $user) {
            $result = $this->attemptDeleteUser($user, $currentUserId);
            if ($result['error']) {
                $skipped[] = "{$user->name}: {$result['error']}";

                continue;
            }
            $deleted++;
        }

        $message = "{$deleted} pengguna dihapus.";
        if (count($skipped) > 0) {
            $message .= ' '.count($skipped).' dilewati (administrator, akun sendiri, atau masih punya WO/Parts).';
        }

        return response()->json([
            'message' => $message,
            'deleted' => $deleted,
            'skipped' => count($skipped),
            'skipped_details' => array_slice($skipped, 0, 10),
        ]);
    }

    public function deletableCount(Request $request)
    {
        $count = $this->bulkDeleteQuery($request)
            ->where('id', '!=', $request->user()->id)
            ->count();

        return response()->json(['count' => $count]);
    }

    /** @return \Illuminate\Database\Eloquent\Builder<User> */
    private function bulkDeleteQuery(Request $request)
    {
        $query = User::query()
            ->visibleTo($request->user())
            ->where('role', '!=', 'admin');

        $this->applyUserListFilters($query, $request);

        return $query;
    }

    /**
     * @param  \Illuminate\Database\Eloquent\Builder<User>  $query
     */
    private function applyUserListFilters($query, Request $request): void
    {
        if ($search = $request->string('search')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('username', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('employee_id', 'like', "%{$search}%");
            });
        }

        if ($role = $request->string('role')->toString()) {
            $query->where('role', $role);
        }

        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }
    }

    /**
     * @return array{error: ?string}
     */
    private function attemptDeleteUser(User $user, int $currentUserId): array
    {
        if ($user->role === 'admin') {
            return ['error' => 'Akun administrator tidak dapat dihapus.'];
        }

        if ($user->id === $currentUserId) {
            return ['error' => 'Tidak dapat menghapus akun sendiri.'];
        }

        if (WorkOrder::where('created_by', $user->id)->exists()) {
            return ['error' => 'Masih memiliki Work Order.'];
        }

        if (PartsRequest::where('created_by', $user->id)->exists()) {
            return ['error' => 'Masih memiliki permintaan Parts.'];
        }

        $user->tokens()->delete();
        $user->delete();

        return ['error' => null];
    }

    public function export(Request $request): StreamedResponse
    {
        $search = $request->string('search')->toString() ?: null;
        $role = $request->string('role')->toString() ?: null;

        $content = $this->excel->buildXlsxContent(
            $this->excel->exportRows($search, $role, $request->user())
        );
        $filename = 'users-'.now()->format('Ymd-His').'.xlsx';

        return response()->streamDownload(
            static function () use ($content) {
                echo $content;
            },
            $filename,
            [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ]
        );
    }

    public function importTemplate(): StreamedResponse
    {
        $content = $this->excel->buildXlsxContent($this->excel->templateRows());
        $filename = 'template-import-users.xlsx';

        return response()->streamDownload(
            static function () use ($content) {
                echo $content;
            },
            $filename,
            [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ]
        );
    }

    public function import(Request $request)
    {
        $request->validate([
            'file' => 'required|file|extensions:xlsx,csv|max:5120',
        ]);

        try {
            $result = $this->excel->importFile($request->file('file'));
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $message = "Import selesai: {$result['imported']} pengguna ditambahkan.";
        if ($result['skipped_empty'] > 0) {
            $message .= " {$result['skipped_empty']} baris kosong/tidak lengkap dilewati.";
        }
        if ($result['skipped_duplicate'] > 0) {
            $message .= " {$result['skipped_duplicate']} email/NIK duplikat dilewati.";
        }
        if ($result['skipped_invalid'] > 0) {
            $message .= " {$result['skipped_invalid']} baris tidak valid.";
        }
        if (($result['auto_email'] ?? 0) > 0) {
            $message .= " {$result['auto_email']} email dibuat otomatis (kolom email kosong).";
        }
        if (($result['auto_username'] ?? 0) > 0) {
            $message .= " {$result['auto_username']} username dibuat otomatis (kolom username kosong).";
        }

        return response()->json([
            'message' => $message,
            ...$result,
        ]);
    }

    private function resolveUsername(
        ?string $username,
        string $name,
        ?string $employeeId,
        ?string $email,
        ?int $ignoreUserId = null
    ): string {
        if ($username !== null && trim($username) !== '') {
            $normalized = User::normalizeUsername(trim($username));
            $query = User::where('username', $normalized);
            if ($ignoreUserId) {
                $query->where('id', '!=', $ignoreUserId);
            }
            if ($query->exists()) {
                return User::makeUniqueUsername($normalized);
            }

            return $normalized;
        }

        return User::suggestUsername($name, $employeeId, $email);
    }

    /** @return array<string, mixed> */
    private function formatUser(User $user): array
    {
        return array_merge($user->toArray(), [
            'permissions' => $user->permissionNames(),
            'role_label' => Role::where('slug', $user->role)->value('name'),
        ]);
    }
}
