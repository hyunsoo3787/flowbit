import type { UserSummary } from '@flowbit/shared';
import { cn } from '@/lib/utils';

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (
    (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')
  ).toUpperCase();
}

// A stable color per person, so the same initials look the same everywhere.
const TONES = [
  'bg-sky-600',
  'bg-emerald-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-violet-600',
  'bg-teal-600',
  'bg-fuchsia-600',
  'bg-indigo-600',
];

function tone(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return TONES[Math.abs(hash) % TONES.length];
}

const SIZES = { xs: 'size-5 text-[9px]', sm: 'size-6 text-[10px]', md: 'size-8 text-xs' };

/** A person's picture, or their initials on a color of their own. */
export function Avatar({
  user,
  size = 'sm',
  className,
  title,
}: {
  user: Pick<UserSummary, 'id' | 'name' | 'image'>;
  size?: keyof typeof SIZES;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title ?? user.name}
      className={cn(
        'inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold text-white select-none',
        SIZES[size],
        !user.image && tone(user.id),
        className,
      )}
    >
      {user.image ? (
        <img src={user.image} alt="" className="size-full object-cover" />
      ) : (
        initials(user.name)
      )}
    </span>
  );
}

/** Overlapping avatars, with "+n" for the rest. */
export function AvatarStack({
  users,
  max = 4,
  size = 'sm',
}: {
  users: Pick<UserSummary, 'id' | 'name' | 'image'>[];
  max?: number;
  size?: keyof typeof SIZES;
}) {
  const shown = users.slice(0, max);
  const rest = users.length - shown.length;
  return (
    <span className="flex items-center -space-x-1.5">
      {shown.map((user) => (
        <Avatar key={user.id} user={user} size={size} className="ring-2 ring-background" />
      ))}
      {rest > 0 ? (
        <span
          className={cn(
            'inline-grid place-items-center rounded-full bg-muted font-medium text-muted-foreground ring-2 ring-background',
            SIZES[size],
          )}
        >
          +{rest}
        </span>
      ) : null}
    </span>
  );
}
