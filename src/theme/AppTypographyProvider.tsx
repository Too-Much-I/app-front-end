import type { PropsWithChildren } from 'react';
import { TypographyContext } from '@/theme/typography-context';

/** Learning uses the device's reading font; other app areas retain their existing brand font. */
export function AppTypographyProvider({
  variant,
  children,
}: PropsWithChildren<{ variant: 'brand' | 'system' }>) {
  return <TypographyContext.Provider value={variant}>{children}</TypographyContext.Provider>;
}
