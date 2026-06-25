<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckPermission
{
    /**
     * User needs ANY one permission. Use pipe for multiple: permission:a|b|c
     * (Commas are reserved by Laravel's route middleware parser.)
     */
    public function handle(Request $request, Closure $next, string $permissions): Response
    {
        $user = $request->user();
        $required = array_map('trim', explode('|', $permissions));

        $allowed = $user && collect($required)->contains(
            fn (string $permission) => $user->hasPermission($permission)
        );

        if (! $allowed) {
            return response()->json([
                'message' => 'Akses ditolak. Anda tidak memiliki izin untuk melakukan aksi ini.',
                'required_permissions' => $required,
            ], 403);
        }

        return $next($request);
    }
}
