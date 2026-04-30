import type { InputHTMLAttributes } from 'react';

type Density = 'compact' | 'regular';
const DENSITY: Record<Density, string> = {
  compact: 'px-2 py-1 text-xs',
  regular: 'px-2.5 py-1.5 text-sm',
};

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  density?: Density;
  mono?: boolean;
}

export function TextInput({
  density = 'regular',
  mono = false,
  className = '',
  ...rest
}: TextInputProps) {
  return (
    <input
      {...rest}
      className={[
        'w-full bg-bg border border-border rounded-sm focus:outline-none focus:border-fg focus:ring-2 focus:ring-fg/10 transition-colors placeholder:text-muted/70',
        DENSITY[density],
        mono ? 'font-mono' : '',
        className,
      ].join(' ')}
    />
  );
}
