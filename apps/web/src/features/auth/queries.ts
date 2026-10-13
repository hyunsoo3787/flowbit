import {
  type QueryClient,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { Locale, UpdateProfileInput } from '@flowbit/shared';
import { api, unwrap } from '@/api/client';
import i18n from '@/i18n';
import { authClient } from '@/lib/auth-client';
import { closeSocket } from '@/lib/realtime';

export const sessionQuery = queryOptions({
  queryKey: ['session'],
  queryFn: async () => (await authClient.getSession()).data ?? null,
  staleTime: 60_000,
});

/** Re-reads the session after signing in or up, so route guards see the new state. */
export function refreshSession(queryClient: QueryClient) {
  return queryClient.fetchQuery({ ...sessionQuery, staleTime: 0 });
}

export const authConfigQuery = queryOptions({
  queryKey: ['auth-config'],
  queryFn: () => unwrap(api.GET('/api/v1/auth/config')),
  staleTime: Infinity,
});

export const meQuery = queryOptions({
  queryKey: ['me'],
  queryFn: () => unwrap(api.GET('/api/v1/me')),
});

export function useMe() {
  return useQuery(meQuery);
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateProfileInput) => unwrap(api.PATCH('/api/v1/me', { body })),
    onSuccess: (me) => queryClient.setQueryData(meQuery.queryKey, me),
  });
}

/** Switches the UI language and, when signed in, remembers it on the account. */
export function useChangeLanguage() {
  const updateProfile = useUpdateProfile();
  return (locale: Locale, signedIn: boolean) => {
    void i18n.changeLanguage(locale);
    if (signedIn) updateProfile.mutate({ locale });
  };
}

export function useSignOut() {
  const queryClient = useQueryClient();
  return async () => {
    await authClient.signOut();
    closeSocket();
    queryClient.clear();
  };
}
