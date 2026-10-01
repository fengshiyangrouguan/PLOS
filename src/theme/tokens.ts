export interface ThemeTokens {
  colorBg: string;
  colorFg: string;
  colorPaper: string;
  colorBorder: string;
  colorAccent: string;
  colorMuted: string;
  transitionFast: string;
  transitionNormal: string;
}

export const themes: Record<'light' | 'dark', ThemeTokens> = {
  // 沿用 Rhine 的“纸面、墨色、细线、单一强调色”关系，但改为偏冷白配色。
  light: { colorBg: '#eef3f2', colorFg: '#111817', colorPaper: '#f7faf9', colorBorder: '#a9b7b6', colorAccent: '#287988', colorMuted: '#697675', transitionFast: '160ms', transitionNormal: '280ms' },
  dark: { colorBg: '#11191a', colorFg: '#edf3f2', colorPaper: '#1b2527', colorBorder: '#536366', colorAccent: '#75c1ce', colorMuted: '#a1acad', transitionFast: '160ms', transitionNormal: '280ms' },
};
