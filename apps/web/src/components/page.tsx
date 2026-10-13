import type { ReactNode } from 'react';

/** The centered, padded container of regular (non-board) pages. */
export function Page({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>;
}
