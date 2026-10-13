import { cn } from '@/lib/utils';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('size-7', className)}>
      <rect width="32" height="32" rx="7" className="fill-primary" />
      <rect x="7" y="8" width="7" height="16" rx="2" className="fill-primary-foreground" />
      <rect
        x="18"
        y="8"
        width="7"
        height="10"
        rx="2"
        className="fill-primary-foreground"
        opacity="0.8"
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-lg font-semibold', className)}>
      <LogoMark />
      {/* eslint-disable-next-line i18next/no-literal-string -- product name */}
      <span>Flowbit</span>
    </span>
  );
}
