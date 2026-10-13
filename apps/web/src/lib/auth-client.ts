import { createAuthClient } from 'better-auth/react';

/** Client for Better Auth's endpoints at /api/auth/* (D-020). */
export const authClient = createAuthClient({
  baseURL: window.location.origin,
  basePath: '/api/auth',
});

export const { useSession } = authClient;
