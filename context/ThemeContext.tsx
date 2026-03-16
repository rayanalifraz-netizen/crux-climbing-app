import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getDarkMode, saveDarkMode } from '../storage';

export const LIGHT = {
  bg:          '#F2F0ED',
  surface:     '#FFFFFF',
  surfaceAlt:  '#F7F6F3',
  border:      '#E8E6E1',
  borderLight: '#F0EEEA',
  ink:         '#1A1714',
  inkLight:    '#3A342E',
  sand:        '#8A837A',
  dust:        '#B8B0A8',
  terra:       '#C8622A',
  terraBg:     '#FFF4EE',
  terraBorder: '#EDCBB8',
  terraDark:   '#9A4818',
  amber:       '#D4880A',
  amberBg:     '#FFFAEE',
  amberBorder: '#F0D090',
  red:         '#E03030',
  redBg:       '#FFF2F2',
  redBorder:   '#F4BABA',
  green:       '#2DA06B',
  greenBg:     '#EDFAF4',
  greenBorder: '#A8DECA',
  blue:        '#3B82F6',
  blueBg:      '#EFF6FF',
  blueBorder:  '#BFDBFE',
  goal:        '#7C3AED',
  goalBg:      '#F5F3FF',
  goalBorder:  '#C4B5FD',
};

export const DARK = {
  bg:          '#111110',
  surface:     '#1C1C1A',
  surfaceAlt:  '#252523',
  border:      '#2E2E2C',
  borderLight: '#383836',
  ink:         '#F2F0ED',
  inkLight:    '#D8D4CE',
  sand:        '#9A9590',
  dust:        '#6A6560',
  terra:       '#E07040',
  terraBg:     '#2A1810',
  terraBorder: '#6A3820',
  terraDark:   '#E07040',
  amber:       '#F0A020',
  amberBg:     '#201A08',
  amberBorder: '#604010',
  red:         '#FF5050',
  redBg:       '#200A0A',
  redBorder:   '#601818',
  green:       '#3DBE80',
  greenBg:     '#0A2018',
  greenBorder: '#1A6040',
  blue:        '#60A0FF',
  blueBg:      '#0A1428',
  blueBorder:  '#1A3060',
  goal:        '#A07AFF',
  goalBg:      '#180A2A',
  goalBorder:  '#3A1A60',
};

export const GRADE_COLORS: Record<string, string> = {
  'VB':'#F5C518','V0':'#F5C518',
  'V1':'#52B788','V2':'#52B788',
  'V3':'#4895EF','V4':'#4895EF',
  'V5':'#9B5DE5','V6':'#9B5DE5',
  'V7':'#F4845F','V8':'#F4845F',
  'V9':'#E63946','V10':'#E63946',
  'V11':'#2B2D42','V12':'#2B2D42',
};
export const GRADE_BG_COLORS: Record<string, string> = {
  'VB':'#FDF8E1','V0':'#FDF8E1',
  'V1':'#E8F5EE','V2':'#E8F5EE',
  'V3':'#EBF4FF','V4':'#EBF4FF',
  'V5':'#F3EEFF','V6':'#F3EEFF',
  'V7':'#FEF2EC','V8':'#FEF2EC',
  'V9':'#FEECEE','V10':'#FEECEE',
  'V11':'#EEEEF5','V12':'#EEEEF5',
};
export function gradeColor(grade: string): string {
  return GRADE_COLORS[grade] || '#8A837A';
}
export function gradeColorBg(grade: string): string {
  return GRADE_BG_COLORS[grade] || '#F7F6F3';
}

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
