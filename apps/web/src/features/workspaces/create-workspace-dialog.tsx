import { useNavigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { errorMessage } from '@/lib/errors';
import { useCreateWorkspace } from './queries';
import { WorkspaceForm, type WorkspaceFormValues } from './workspace-form';

/** Creates a workspace and opens it. Used by the empty state, the home page and the switcher. */
export function useCreateWorkspaceAndOpen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createWorkspace = useCreateWorkspace();

  return async ({ name, description }: WorkspaceFormValues) => {
    try {
      const workspace = await createWorkspace.mutateAsync({
        name,
        ...(description ? { description } : {}),
      });
      toast.success(t('workspaces.create.success'));
      await navigate({ to: '/w/$workspaceId', params: { workspaceId: workspace.id } });
      return true;
    } catch (error) {
      toast.error(errorMessage(t, error));
      return false;
    }
  };
}

export function CreateWorkspaceDialog({
  trigger,
  open,
  onOpenChange,
}: {
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const createAndOpen = useCreateWorkspaceAndOpen();

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('workspaces.create.title')}</DialogTitle>
        </DialogHeader>
        <WorkspaceForm
          onSubmit={async (values) => {
            if (await createAndOpen(values)) setOpen(false);
          }}
          actions={(isSubmitting) => (
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {t('workspaces.create.submit')}
              </Button>
            </DialogFooter>
          )}
        />
      </DialogContent>
    </Dialog>
  );
}
