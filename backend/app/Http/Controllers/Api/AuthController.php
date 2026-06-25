<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'login' => 'required|string',
            'password' => 'required',
        ]);

        $login = trim($request->login);

        $user = User::query()
            ->where('is_active', true)
            ->where(function ($q) use ($login) {
                $q->where('email', $login)->orWhere('username', $login);
            })
            ->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'login' => ['Email/username atau password salah.'],
            ]);
        }

        $token = $user->createToken('wo-aps')->plainTextToken;

        return response()->json([
            'user' => $this->userPayload($user),
            'token' => $token,
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out']);
    }

    public function me(Request $request)
    {
        return response()->json($this->userPayload($request->user()));
    }

    /** @return array<string, mixed> */
    private function userPayload(User $user): array
    {
        return array_merge($user->toArray(), [
            'permissions' => $user->permissionNames(),
        ]);
    }
}
