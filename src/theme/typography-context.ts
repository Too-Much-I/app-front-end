import { createContext } from 'react';

/** Default keeps the production brand font. Only the learning stack opts into system text. */
export const TypographyContext = createContext<'brand' | 'system'>('brand');
