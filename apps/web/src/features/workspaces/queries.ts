import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateWorkspaceInput, UpdateWorkspaceInput, Workspace } from '@flowbit/shared';
import { api, unwrap } from '@/api/client';

export const workspacesQuery = queryOptions({
  queryKey: ['workspaces'],
  queryFn: async () => (await unwrap(api.GET('/api/v1/workspaces'))).items,
});

export const workspaceQuery = (workspaceId: string) =>
  queryOptions({
    queryKey: ['workspaces', workspaceId],
    queryFn: () =>
      unwrap(api.GET('/api/v1/workspaces/{workspaceId}', { params: { path: { workspaceId } } })),
  });

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateWorkspaceInput) => unwrap(api.POST('/api/v1/workspaces', { body })),
    onSuccess: (workspace) => {
      queryClient.setQueryData(workspaceQuery(workspace.id).queryKey, workspace);
      queryClient.setQueryData(workspacesQuery.queryKey, (list: Workspace[] | undefined) =>
        list ? [...list, workspace] : list,
      );
    },
  });
}

export function useUpdateWorkspace(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateWorkspaceInput) =>
      unwrap(
        api.PATCH('/api/v1/workspaces/{workspaceId}', {
          params: { path: { workspaceId } },
          body,
        }),
      ),
    onSuccess: (workspace) => {
      queryClient.setQueryData(workspaceQuery(workspaceId).queryKey, workspace);
      queryClient.setQueryData(workspacesQuery.queryKey, (list: Workspace[] | undefined) =>
        list?.map((item) => (item.id === workspace.id ? workspace : item)),
      );
    },
  });
}

export function useDeleteWorkspace(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.DELETE('/api/v1/workspaces/{workspaceId}', { params: { path: { workspaceId } } }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: workspaceQuery(workspaceId).queryKey });
      queryClient.setQueryData(workspacesQuery.queryKey, (list: Workspace[] | undefined) =>
        list?.filter((item) => item.id !== workspaceId),
      );
    },
  });
}
