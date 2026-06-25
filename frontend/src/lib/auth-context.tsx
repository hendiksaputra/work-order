'use client';

import { createContext, useContext, useMemo } from 'react';
import type { User } from './types';
import { can, type PermissionName } from './permissions';

const AuthContext = createContext<{
  user: User;
  can: (permission: PermissionName) => boolean;
} | null>(null);

export function AuthProvider({ user, children }: { user: User; children: React.ReactNode }) {
  const value = useMemo(
    () => ({
      user,
      can: (permission: PermissionName) => can(user, permission),
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
