import type { ThemeTokens } from './tokens';

export function applyTheme(tokens: ThemeTokens): void {
  const root = document.documentElement;
  root.style.setProperty('--color-bg', tokens.colorBg);
  root.style.setProperty('--color-fg', tokens.colorFg);
  root.style.setProperty('--color-paper', tokens.colorPaper);
  root.style.setProperty('--color-border', tokens.colorBorder);
  root.style.setProperty('--color-accent', tokens.colorAccent);
  root.style.setProperty('--color-muted', tokens.colorMuted);
  root.style.setProperty('--transition-fast', tokens.transitionFast);
  root.style.setProperty('--transition-normal', tokens.transitionNormal);
}
