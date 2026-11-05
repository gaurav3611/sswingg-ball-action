/**
 * The "Ground" theme of the SSwinGG web app, as values for React Native.
 *
 * The names and values are the ones in angular-cricket-frontend/src/app/shared/palette.ts and
 * the :root block of its dashboard stylesheet. Each colour keeps its meaning:
 *   forest (accent)  the brand and the main action
 *   field green      a good result
 *   ochre            an estimate, a fair result
 *   slate blue       a value the user typed in
 *   red              stop, recording, errors
 * Flat fills only: no gradients, no purple, no pill shapes.
 */
export const colors = {
  bg: '#f7f5ee', // the page: warm ivory
  surface: '#ffffff', // cards
  surface2: '#f0f3ec', // supporting areas: pale sage
  border: '#dcdfd4',
  line: '#c9d3c4', // crease and boundary lines
  text: '#17241c', // deep green-black
  muted: '#5a695f', // secondary text
  accent: '#1e5b3a',
  accentHover: '#164a2e',
  accentSoft: '#e3eee6',
  ochre: '#a8620f',
  ochreSoft: '#f6ebdd',
  green: '#3a8a3f',
  greenSoft: '#e4f0e2',
  leg: '#2b5b86',
  legSoft: '#e3ebf3',
  red: '#b42318',
  redSoft: '#fbe9e7',
  gold: '#a67c1f',
  onAccent: '#ffffff',
  /** Behind the camera and the replay: a very dark green-black, so overlays stay readable. */
  stage: '#0e1611',
} as const;

/**
 * Colours for drawing on top of video. The page colours are too dark to read on footage, so
 * these are lighter tints of the same meanings: slate blue for the left side, ochre for the
 * right, and a dark halo under every line so it stays visible on any background.
 */
export const overlay = {
  left: '#9cc3ea',
  right: '#f2c27b',
  centre: '#ffffff',
  halo: 'rgba(14, 22, 17, 0.75)',
  /** The chosen bowler's box. */
  bowler: '#7fcf86',
} as const;

/** Corner radii: 4 for chips, 6 for buttons and inputs, 8 for cards. Never a pill. */
export const radius = { sm: 4, md: 6, lg: 8 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Smallest touch target, in points. */
export const TOUCH = 48;

export const fonts = {
  ui: 'Inter_400Regular',
  uiMedium: 'Inter_500Medium',
  uiSemi: 'Inter_600SemiBold',
  uiBold: 'Inter_700Bold',
  display: 'SourceSerif4_600SemiBold',
  displayBold: 'SourceSerif4_700Bold',
} as const;

export type ColorName = keyof typeof colors;
