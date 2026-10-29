import type { BoardMember } from '@flowbit/shared';
import { type KeyboardEvent, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/avatar';
import { ESCAPE_HANDLED } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { mentionQuery } from './mentions';

interface MentionTextareaProps extends Omit<
  React.ComponentProps<'textarea'>,
  'onChange' | 'value'
> {
  value: string;
  onChange: (value: string) => void;
  members: BoardMember[];
  /** Ctrl/Cmd+Enter. */
  onSubmit?: () => void;
  /** Escape cancels the edit (via onKeyDown) instead of closing the dialog. */
  escapeHandled?: boolean;
}

/** A textarea that suggests board members after "@", like a chat app. */
export function MentionTextarea({
  value,
  onChange,
  members,
  onSubmit,
  onKeyDown,
  className,
  escapeHandled = false,
  ...props
}: MentionTextareaProps) {
  const { t } = useTranslation();
  const listId = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);

  const matches =
    query === null
      ? []
      : members
          .filter(({ user }) => user.name.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 6);
  const open = matches.length > 0;

  const update = (next: string, caret: number) => {
    onChange(next);
    setQuery(mentionQuery(next.slice(0, caret)));
    setHighlight(0);
  };

  const choose = (member: BoardMember) => {
    const textarea = ref.current;
    const caret = textarea?.selectionStart ?? value.length;
    const before = value.slice(0, caret).replace(/@[^\s@]*$/u, `@${member.user.name} `);
    const next = before + value.slice(caret);
    onChange(next);
    setQuery(null);
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(before.length, before.length);
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (open) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setHighlight((current) => (current + step + matches.length) % matches.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        choose(matches[highlight]!);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setQuery(null);
        return;
      }
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && onSubmit) {
      event.preventDefault();
      onSubmit();
      return;
    }
    onKeyDown?.(event);
  };

  return (
    <div className="relative">
      <Textarea
        {...(open || escapeHandled ? ESCAPE_HANDLED : {})}
        ref={ref}
        value={value}
        // A multi-line text field that offers suggestions (ARIA allows these
        // attributes on a textbox, which keeps it announced as a text field).
        aria-controls={open ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={open ? `${listId}-${highlight}` : undefined}
        onChange={(event) => update(event.target.value, event.target.selectionStart)}
        onKeyDown={handleKeyDown}
        onBlur={() => setQuery(null)}
        className={className}
        {...props}
      />
      <ul
        id={listId}
        role="listbox"
        aria-label={t('comments.mentionSuggestions')}
        hidden={!open}
        className="absolute inset-x-0 top-full z-50 mt-1 grid max-w-72 gap-0.5 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
      >
        {matches.map((member, index) => (
          <li
            key={member.user.id}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === highlight}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
              index === highlight && 'bg-accent text-accent-foreground',
            )}
            // Keep focus in the textarea.
            onMouseDown={(event) => {
              event.preventDefault();
              choose(member);
            }}
          >
            <Avatar user={member.user} size="xs" />
            <span className="truncate">{member.user.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
