import { zodResolver } from '@hookform/resolvers/zod';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';
import { FormField } from '@/components/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { workspaceFormSchema } from '@/lib/form-schemas';

export type WorkspaceFormValues = z.infer<typeof workspaceFormSchema>;

interface WorkspaceFormProps {
  defaultValues?: WorkspaceFormValues;
  onSubmit: (values: WorkspaceFormValues) => Promise<void>;
  /** Renders the submit area; receives whether the form is submitting. */
  actions: (isSubmitting: boolean) => ReactNode;
}

export function WorkspaceForm({ defaultValues, onSubmit, actions }: WorkspaceFormProps) {
  const { t } = useTranslation();
  const form = useForm<WorkspaceFormValues>({
    resolver: zodResolver(workspaceFormSchema),
    defaultValues: defaultValues ?? { name: '', description: '' },
  });
  const { errors, isSubmitting } = form.formState;

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FormField label={t('workspaces.create.name')} error={errors.name}>
        {(field) => (
          <Input
            placeholder={t('workspaces.create.namePlaceholder')}
            autoFocus
            {...field}
            {...form.register('name')}
          />
        )}
      </FormField>
      <FormField label={t('workspaces.create.description')} error={errors.description}>
        {(field) => (
          <Textarea
            rows={3}
            placeholder={t('workspaces.create.descriptionPlaceholder')}
            {...field}
            {...form.register('description')}
          />
        )}
      </FormField>
      {actions(isSubmitting)}
    </form>
  );
}
