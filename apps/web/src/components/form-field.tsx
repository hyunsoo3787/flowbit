import { PASSWORD_MIN_LENGTH } from '@flowbit/shared';
import { type ReactNode, useId } from 'react';
import type { FieldError } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';

interface FormFieldProps {
  label: ReactNode;
  error?: FieldError | undefined;
  hint?: ReactNode;
  aside?: ReactNode;
  children: (props: {
    id: string;
    'aria-invalid': boolean;
    'aria-describedby'?: string;
  }) => ReactNode;
}

/** A labelled form control with a translated validation message (see lib/form-schemas.ts). */
export function FormField({ label, error, hint, aside, children }: FormFieldProps) {
  const { t } = useTranslation();
  const id = useId();
  const messageId = `${id}-message`;
  const message = error?.message
    ? t(error.message as never, { min: PASSWORD_MIN_LENGTH })
    : undefined;

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {aside}
      </div>
      {children({
        id,
        'aria-invalid': Boolean(error),
        ...(message || hint ? { 'aria-describedby': messageId } : {}),
      })}
      {message ? (
        <p id={messageId} className="text-sm text-destructive">
          {message}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
