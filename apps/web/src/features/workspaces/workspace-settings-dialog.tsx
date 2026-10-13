import type { Workspace } from '@flowbit/shared';
import { useNavigate } from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { errorMessage } from '@/lib/errors';
import { useDeleteWorkspace, useUpdateWorkspace } from './queries';
import { WorkspaceForm } from './workspace-form';

export function WorkspaceSettingsDialog({
  workspace,
  trigger,
}: {
  workspace: Workspace;
  trigger: ReactNode;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const updateWorkspace = useUpdateWorkspace(workspace.id);
  const deleteWorkspace = useDeleteWorkspace(workspace.id);

  const onDelete = async () => {
    try {
      await deleteWorkspace.mutateAsync();
      toast.success(t('workspaces.settings.deleted'));
      setOpen(false);
      await navigate({ to: '/' });
    } catch (error) {
      toast.error(errorMessage(t, error));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setConfirmingDelete(false);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent closeLabel={t('common.close')}>
        {confirmingDelete ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {t('workspaces.settings.deleteConfirmTitle', { name: workspace.name })}
              </DialogTitle>
              <DialogDescription>{t('workspaces.settings.deleteConfirmBody')}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmingDelete(false)}>
                {t('common.cancel')}
              </Button>
              <Button variant="destructive" onClick={onDelete} disabled={deleteWorkspace.isPending}>
                {t('workspaces.settings.delete')}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t('workspaces.settings.title')}</DialogTitle>
            </DialogHeader>
            <WorkspaceForm
              defaultValues={{ name: workspace.name, description: workspace.description ?? '' }}
              onSubmit={async ({ name, description }) => {
                try {
                  await updateWorkspace.mutateAsync({ name, description: description || null });
                  toast.success(t('workspaces.settings.success'));
                  setOpen(false);
                } catch (error) {
                  toast.error(errorMessage(t, error));
                }
              }}
              actions={(isSubmitting) => (
                <DialogFooter>
                  <Button type="submit" disabled={isSubmitting}>
                    {t('common.saveChanges')}
                  </Button>
                </DialogFooter>
              )}
            />
            <div className="grid gap-3 rounded-lg border border-destructive/40 p-4">
              <p className="text-sm font-medium text-destructive">
                {t('workspaces.settings.dangerZone')}
              </p>
              <Button
                variant="outline"
                className="justify-self-start text-destructive"
                onClick={() => setConfirmingDelete(true)}
              >
                {t('workspaces.settings.delete')}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
