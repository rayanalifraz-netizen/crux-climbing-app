import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getDarkMode, saveDarkMode } from '../storage';

export const LIGHT = {
  bg:          '#e8e0d0',
  surface:     '#f5f0e8',
  surfaceAlt:  '#ede8dc',
  border:      '#8a7a6a',
  borderLight: '#c8bfaa',
  ink:         '#2a2018',
  inkLight:    '#4a3e32',
  sand:        '#7a6e60',
  dust:        '#a89880',
  terra:       '#c4734a',
  terraBg:     '#faf0e8',
  terraBorder: '#c4734a',
  terraDark:   '#9a5535',
  amber:       '#c4843a',
  amberBg:     '#fef8ee',
  amberBorder: '#c4843a',
  red:         '#c44a3a',
  redBg:       '#fef5f4',
  redBorder:   '#c44a3a',
  green:       '#5a8a4a',
  greenBg:     '#f4faf0',
  greenBorder: '#5a8a4a',
  blue:        '#4a6a9a',
  blueBg:      '#f0f4fa',
  blueBorder:  '#4a6a9a',
  goal:        '#7a5aaa',
  goalBg:      '#f8f4ff',
  goalBorder:  '#7a5aaa',
};

export const DARK = {
  bg:          '#1a1410',
  surface:     '#242018',
  surfaceAlt:  '#2e2820',
  border:      '#4a3e32',
  borderLight: '#3a3028',
  ink:         '#f0ebe0',
  inkLight:    '#c8c0b0',
  sand:        '#9a8e80',
  dust:        '#6a5e50',
  terra:       '#d4845a',
  terraBg:     '#2a1a10',
  terraBorder: '#c4734a',
  terraDark:   '#d4845a',
  amber:       '#d49440',
  amberBg:     '#2a2010',
  amberBorder: '#c4843a',
  red:         '#d45a4a',
  redBg:       '#2a1410',
  redBorder:   '#c44a3a',
  green:       '#6a9a5a',
  greenBg:     '#141e10',
  greenBorder: '#5a8a4a',
  blue:        '#5a7aaa',
  blueBg:      '#141824',
  blueBorder:  '#4a6a9a',
  goal:        '#8a6aba',
  goalBg:      '#1e1428',
  goalBorder:  '#7a5aaa',
};

type ColorPalette = typeof LIGHT;
type ThemeContextType = { C: ColorPalette; isDark: boolean; toggleDark: () => void };
const ThemeContext = createContext<ThemeContextType>({ C: LIGHT, isDark: false, toggleDark: () => {} });

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    getDarkMode().then(val => setIsDark(val));
  }, []);
  const toggleDark = useCallback(() => {
    setIsDark(prev => {
      const next = !prev;
      saveDarkMode(next);
      return next;
    });
  }, []);
  return (
    <ThemeContext.Provider value={{ C: isDark ? DARK : LIGHT, isDark, toggleDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
