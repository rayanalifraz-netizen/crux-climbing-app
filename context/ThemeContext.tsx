import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getDarkMode, getGradeSystem, saveDarkMode, saveGradeSystem } from '../storage';

export type GradeSystem = 'V' | 'font';

export const LIGHT = {
  // Core backgrounds
  bg:          '#F3EFE9',
  surface:     '#FFFFFF',
  surfaceAlt:  '#F0EBE3',
  border:      'rgba(34,29,24,0.12)',
  borderLight: 'rgba(34,29,24,0.07)',
  // Text
  ink:         '#221D18',
  inkLight:    '#4A4038',
  sand:        '#7B7268',
  dust:        '#A79E92',
  // Terracotta (accent)
  terra:       '#BC5E2E',
  terraBg:     '#F5E5D8',
  terraBorder: '#E0C4B0',
  terraDark:   '#A64E22',
  // Amber
  amber:       '#C5892B',
  amberBg:     '#F5EAD3',
  amberBorder: '#DFC9A0',
  // Clay (red)
  red:         '#BC4B43',
  redBg:       '#F6E1DE',
  redBorder:   '#E0BFBC',
  // Sage (green)
  green:       '#5E8C73',
  greenBg:     '#E2ECE5',
  greenBorder: '#B8D4C0',
  // Blue (unchanged)
  blue:        '#3B82F6',
  blueBg:      '#EFF6FF',
  blueBorder:  '#BFDBFE',
  // Plum (goal)
  goal:        '#7A6E9C',
  goalBg:      '#ECE8F1',
  goalBorder:  '#CEC8E8',
  // New design tokens
  paper2:      '#ECE7DF',
  accentSoft:  '#F5E5D8',
  accentText:  '#A64E22',
  amberText:   '#9C6B1C',
  sageSoft:    '#E2ECE5',
  sageText:    '#477159',
  claySoft:    '#F6E1DE',
  clayText:    '#9E3A33',
  plumSoft:    '#ECE8F1',
  plumText:    '#5F5384',
  hairline:    'rgba(34,29,24,0.07)',
};

export const DARK = {
  bg:          '#16130F',
  surface:     '#221D18',
  surfaceAlt:  '#2C261F',
  border:      'rgba(255,255,255,0.12)',
  borderLight: 'rgba(255,255,255,0.08)',
  ink:         '#F3EEE7',
  inkLight:    '#D8D4CE',
  sand:        '#A89E92',
  dust:        '#7C7264',
  terra:       '#DB7C42',
  terraBg:     'rgba(219,124,66,0.18)',
  terraBorder: 'rgba(219,124,66,0.35)',
  terraDark:   '#E89460',
  amber:       '#E0A23F',
  amberBg:     'rgba(224,162,63,0.16)',
  amberBorder: 'rgba(224,162,63,0.32)',
  red:         '#E0726A',
  redBg:       'rgba(224,114,106,0.16)',
  redBorder:   'rgba(224,114,106,0.30)',
  green:       '#80B395',
  greenBg:     'rgba(128,179,149,0.15)',
  greenBorder: 'rgba(128,179,149,0.30)',
  blue:        '#60A0FF',
  blueBg:      '#0A1428',
  blueBorder:  '#1A3060',
  goal:        '#A99BCB',
  goalBg:      'rgba(169,155,203,0.16)',
  goalBorder:  'rgba(169,155,203,0.30)',
  paper2:      '#1C1813',
  accentSoft:  'rgba(219,124,66,0.18)',
  accentText:  '#E89460',
  amberText:   '#E6B05E',
  sageSoft:    'rgba(128,179,149,0.15)',
  sageText:    '#97C4A9',
  claySoft:    'rgba(224,114,106,0.16)',
  clayText:    '#EB8B84',
  plumSoft:    'rgba(169,155,203,0.16)',
  plumText:    '#BDB2D8',
  hairline:    'rgba(255,255,255,0.08)',
};

export const GRADE_COLORS: Record<string, string> = {
  'VB':'#F5C518','V0':'#F5C518',
  'V1':'#52B788','V2':'#52B788',
  'V3':'#4895EF','V4':'#4895EF',
  'V5':'#9B5DE5','V6':'#9B5DE5',
  'V7':'#F4845F','V8':'#F4845F',
  'V9':'#E63946','V10':'#E63946',
  'V11':'#2B2D42','V12':'#2B2D42',
  'V13+':'#C9A84C',
};
export const GRADE_BG_COLORS: Record<string, string> = {
  'VB':'#FDF8E1','V0':'#FDF8E1',
  'V1':'#E8F5EE','V2':'#E8F5EE',
  'V3':'#EBF4FF','V4':'#EBF4FF',
  'V5':'#F3EEFF','V6':'#F3EEFF',
  'V7':'#FEF2EC','V8':'#FEF2EC',
  'V9':'#FEECEE','V10':'#FEECEE',
  'V11':'#EEEEF5','V12':'#EEEEF5',
  'V13+':'#FDF8E8',
};
export function gradeColor(grade: string): string {
  return GRADE_COLORS[grade] || '#8A837A';
}
export function gradeColorBg(grade: string): string {
  return GRADE_BG_COLORS[grade] || '#F7F6F3';
}

export const V_TO_FONT: Record<string, string> = {
  VB: '3',  V0: '4',  V1: '5',  V2: '5+',
  V3: '6a', V4: '6b', V5: '6c', V6: '7a',
  V7: '7a+',V8: '7b', V9: '7c', V10: '8a',
  V11: '8a+',V12: '8b',
  'V13+': '8b+',
};

export const toDisplayGrade = (vGrade: string, system: GradeSystem): string => {
  if (system === 'font') return V_TO_FONT[vGrade] ?? vGrade;
  return vGrade;
};

type ColorPalette = typeof LIGHT;
type ThemeContextType = {
  C: ColorPalette;
  isDark: boolean;
  toggleDark: () => void;
  gradeSystem: GradeSystem;
  toggleGradeSystem: () => void;
};
const ThemeContext = createContext<ThemeContextType>({
  C: LIGHT, isDark: false, toggleDark: () => {},
  gradeSystem: 'V', toggleGradeSystem: () => {},
});

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(false);
  const [gradeSystem, setGradeSystem] = useState<GradeSystem>('V');

  useEffect(() => {
    getDarkMode().then(val => setIsDark(val));
    getGradeSystem().then(val => setGradeSystem(val));
  }, []);

  const toggleDark = useCallback(() => {
    setIsDark(prev => {
      const next = !prev;
      saveDarkMode(next);
      return next;
    });
  }, []);

  const toggleGradeSystem = useCallback(() => {
    setGradeSystem(prev => {
      const next: GradeSystem = prev === 'V' ? 'font' : 'V';
      saveGradeSystem(next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ C: isDark ? DARK : LIGHT, isDark, toggleDark, gradeSystem, toggleGradeSystem }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
