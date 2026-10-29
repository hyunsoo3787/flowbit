import type { AdminUser, UpdateInstanceSettingsInput } from '@flowbit/shared';
import {
  infiniteQueryOptions,
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api, unwrap } from '@/api/client';
import { errorMessage } from '@/lib/errors';

export const statsQuery = queryOptions({
  queryKey: ['admin', 'stats'],
  queryFn: () => unwrap(api.GET('/api/v1/admin/stats')),
});

export const settingsQuery = queryOptions({
  queryKey: ['admin', 'settings'],
  queryFn: () => unwrap(api.GET('/api/v1/admin/settings')),
});

export const usersQuery = (query: string) =>
  infiniteQueryOptions({
    queryKey: ['admin', 'users', query],
    queryFn: ({ pageParam }) =>
      unwrap(
        api.GET('/api/v1/admin/users', {
          params: {
            query: { ...(query ? { query } : {}), ...(pageParam ? { cursor: pageParam } : {}) },
          },
        }),
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });

export const actionsQuery = infiniteQueryOptions({
  queryKey: ['admin', 'actions'],
  queryFn: ({ pageParam }) =>
    unwrap(
      api.GET('/api/v1/admin/actions', {
        params: { query: pageParam ? { cursor: pageParam } : {} },
      }),
    ),
  initialPageParam: null as string | null,
  getNextPageParam: (page) => page.nextCursor,
});

export const setupStatusQuery = queryOptions({
  queryKey: ['setup'],
  queryFn: () => unwrap(api.GET('/api/v1/setup')),
});

function useAdminMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
  onSuccess?: (result: TResult) => void,
) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (result) => {
      onSuccess?.(result);
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (error) => toast.error(errorMessage(t, error)),
  });
}

export function useUserActions() {
  const path = (userId: string) => ({ params: { path: { userId } } });
  return {
    suspend: useAdminMutation((userId: string) =>
      unwrap(api.POST('/api/v1/admin/users/{userId}/suspend', path(userId))),
    ),
    reactivate: useAdminMutation((userId: string) =>
      unwrap(api.POST('/api/v1/admin/users/{userId}/reactivate', path(userId))),
    ),
    remove: useAdminMutation((userId: string) =>
      api.DELETE('/api/v1/admin/users/{userId}', path(userId)),
    ),
    resetLink: useAdminMutation((userId: string) =>
      unwrap(api.POST('/api/v1/admin/users/{userId}/password-reset-link', path(userId))),
    ),
    setAdmin: useAdminMutation(({ user, admin }: { user: AdminUser; admin: boolean }) =>
      unwrap(
        admin
          ? api.PUT('/api/v1/admin/users/{userId}/admin', path(user.id))
          : api.DELETE('/api/v1/admin/users/{userId}/admin', path(user.id)),
      ),
    ),
  };
}

export function useUpdateSettings() {
  return useAdminMutation((body: UpdateInstanceSettingsInput) =>
    unwrap(api.PATCH('/api/v1/admin/settings', { body })),
  );
}
