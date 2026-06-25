<?php

namespace App\Http\Controllers\Concerns;

use Illuminate\Http\JsonResponse;

trait AuthorizesRequests
{
    protected function denyUnless(bool $condition, string $message = 'Akses ditolak.'): ?JsonResponse
    {
        if (! $condition) {
            return response()->json(['message' => $message], 403);
        }

        return null;
    }

    protected function denyUnlessPermission(string $permission, string $message = 'Akses ditolak.'): ?JsonResponse
    {
        return $this->denyUnless(request()->user()?->hasPermission($permission) ?? false, $message);
    }
}
