import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { ESCAPE_HANDLED } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface InlineEditProps {
  value: string;
  onSave: (value: string) => void;
  /** Names the action (tooltip) and the input while editing, e.g. "Rename list". */
  label: string;
  maxLength: number;
  disabled?: boolean;
  multiline?: boolean;
  className?: string;
  inputClassName?: string;
}

/**
 * Text that turns into an input when clicked. Enter or leaving the field saves,
 * Escape cancels. Empty values are not saved.
 */
export function InlineEdit({
  value,
  onSave,
  label,
  maxLength,
  disabled,
  multiline,
  className,
  inputClassName,
}: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) ref.current?.select();
  }, [editing]);

  if (disabled || !editing) {
    return (
      <button
        type="button"
        disabled={disabled}
        // The visible text stays the accessible name (so a heading keeps its
        // name); the action is exposed as the description.
        title={disabled ? undefined : label}
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className={cn(
          'min-w-0 rounded-sm px-1 text-left break-words outline-none focus-visible:ring-2 focus-visible:ring-ring enabled:hover:bg-black/5 disabled:cursor-default dark:enabled:hover:bg-white/10',
          className,
        )}
      >
        {value}
      </button>
    );
  }

  const finish = (save: boolean) => {
    setEditing(false);
    const trimmed = draft.trim();
    if (save && trimmed && trimmed !== value) onSave(trimmed);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      finish(false);
    } else if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      finish(true);
    }
  };

  const shared = {
    ...ESCAPE_HANDLED,
    ref,
    value: draft,
    maxLength,
    'aria-label': label,
    onChange: (event: { target: { value: string } }) => setDraft(event.target.value),
    onBlur: () => finish(true),
    onKeyDown,
    // Selecting text with the mouse must not start dragging a parent item.
    onPointerDown: (event: { stopPropagation: () => void }) => event.stopPropagation(),
    className: cn(
      'w-full rounded-sm border border-ring bg-card px-1 text-foreground outline-none ring-2 ring-ring/40',
      inputClassName,
    ),
  };
  return multiline ? <textarea rows={2} {...shared} /> : <input {...shared} />;
}
