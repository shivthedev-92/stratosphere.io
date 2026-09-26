// Stratosphere design tokens — React Native (mobile/). Import into App.tsx.
export const indigo = { 50:'#F1EFFF',100:'#E2DEFF',200:'#C7BFFF',300:'#A79BFF',400:'#8676FF',500:'#6B5CFF',600:'#5B4CF0',700:'#4A3CE0',800:'#3A2DB8',900:'#2B2275',950:'#15123A' };

export const night = {
  bg:'#0B0A14', surface:'rgba(19,18,31,0.78)', surfaceSolid:'#13121F', raised:'#1C1A2B',
  line:'rgba(255,255,255,0.08)', lineStrong:'rgba(255,255,255,0.12)',
  text:'#F3F2F8', textMuted:'#A6A3B8', textSubtle:'#8A879E',
  accent:'#5B4CF0', accentHover:'#6B5CFF', accentSoft:'#C7BFFF', focus:'#8676FF',
  low:'#3CCFB4', lowBg:'rgba(60,207,180,0.12)', med:'#6CC0F5', medBg:'rgba(108,192,245,0.12)',
  high:'#F2B24C', highBg:'rgba(242,178,76,0.12)', notDone:'#8A879E', danger:'#F0707A', dangerBg:'rgba(240,112,122,0.08)',
};
export const dawn: typeof night = {
  bg:'#F7F5F1', surface:'#FFFFFF', surfaceSolid:'#FFFFFF', raised:'#EFECE6',
  line:'#E6E2DA', lineStrong:'#E6E2DA',
  text:'#16151F', textMuted:'#56536A', textSubtle:'#6E6B7E',
  accent:'#4A3CE0', accentHover:'#3A2DB8', accentSoft:'#4A3CE0', focus:'#4A3CE0',
  low:'#0E7A68', lowBg:'#E3F5F1', med:'#1C6AA3', medBg:'#E4F0FA',
  high:'#8A5507', highBg:'#FBF0DD', notDone:'#6E6B7E', danger:'#C0323F', dangerBg:'#FFF5F5',
};

export const radius = { chip:8, control:12, card:20, panel:24, full:999 };
export const space = { 1:4, 2:8, 3:12, 4:16, 6:24, 8:32, 12:48, 16:64 };
export const hitTarget = 44;

// iOS sizes follow Dynamic Type; use allowFontScaling (default true).
export const type = {
  display:{ fontFamily:'InstrumentSans-SemiBold', fontSize:34, letterSpacing:-0.9 },
  title1:{ fontFamily:'InstrumentSans-SemiBold', fontSize:28, letterSpacing:-0.5 },
  title2:{ fontFamily:'InstrumentSans-SemiBold', fontSize:20, letterSpacing:-0.2 },
  body:{ fontFamily:'InstrumentSans-Regular', fontSize:17, lineHeight:24 },
  journal:{ fontFamily:'Newsreader-Italic', fontSize:19, lineHeight:26 },
  label:{ fontFamily:'InstrumentSans-Medium', fontSize:15 },
  caption:{ fontFamily:'InstrumentSans-Medium', fontSize:13, letterSpacing:0.8, textTransform:'uppercase' as const },
};

export const priority = {
  low:{ icon:'Plant', label:'Low' },
  medium:{ icon:'Lightning', label:'Medium' },
  high:{ icon:'Flame', label:'High' },
} as const; // phosphor-react-native component names
