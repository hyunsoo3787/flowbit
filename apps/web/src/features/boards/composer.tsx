import { PlusIcon, XIcon } from 'lucide-react';
import { type FormEvent, type KeyboardEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ComposerProps {
  /** Text of the button that opens the composer. */
  openLabel: string;
  placeholder: string;
  submitLabel: string;
  maxLength: number;
  onSubmit: (value: string) => void;
  multiline?: boolean;
  className?: string;
}

/**
 * "Add a card" / "Add a list": a button that expands into a small form. It
 * stays open after submitting, so several items can be added in a row.
 */
export function Composer({
  openLabel,
  placeholder,
  submitLabel,
  maxLength,
  onSubmit,
  multiline,
  className,
}: ComposerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');

  if (!open) {
    return (
      <Button
        variant="ghost"
        className={cn('w-full justify-start text-muted-foreground', className)}
        onClick={() => setOpen(true)}
      >
        <PlusIcon />
        {openLabel}
      </Button>
    );
  }

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const trimmed = value.trim();
    if (trimmed) onSubmit(trimmed);
    setValue('');
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      setOpen(false);
      setValue('');
    } else if (event.key === 'Enter' && !event.shiftKey) {
      submit(event);
    }
  };

  const fieldClass =
    'w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

  return (
    <form className={cn('grid gap-2', className)} onSubmit={submit}>
      {multiline ? (
        <textarea
          autoFocus
          rows={3}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
          className={cn(fieldClass, 'resize-none')}
        />
      ) : (
        <input
          autoFocus
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
          className={fieldClass}
        />
      )}
      <div className="flex items-center gap-1">
        <Button type="submit" size="sm">
          {submitLabel}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={t('common.cancel')}
          onClick={() => {
            setOpen(false);
            setValue('');
          }}
        >
          <XIcon />
        </Button>
      </div>
    </form>
  );
}
