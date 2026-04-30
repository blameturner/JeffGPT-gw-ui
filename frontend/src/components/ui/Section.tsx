import type { ReactNode } from 'react';
import { Eyebrow } from './Eyebrow';

// Standard section block with optional eyebrow, title and right-side action.
export function SectionHeader({
  eyebrow,
  title,
  right,
  className = '',
}: {
  eyebrow?: ReactNode;
  title?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={['flex items-end justify-between gap-3 mb-3', className].join(' ')}>
      <div className="min-w-0">
        {eyebrow && <Eyebrow className="mb-0.5">{eyebrow}</Eyebrow>}
        {title && (
          <h2 className="font-display text-lg sm:text-xl tracking-tightest leading-tight">
            {title}
          </h2>
        )}
      </div>
      {right && <div className="shrink-0 flex items-center gap-2">{right}</div>}
    </div>
  );
}

export function Section({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={['space-y-3', className].join(' ')}>{children}</section>;
}
