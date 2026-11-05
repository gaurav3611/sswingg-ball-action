/**
 * The design rules of the SSwinGG web app (angular-cricket-frontend/tools/design-rules.mjs),
 * applied to this app's source. They are the user's rules for anything built for them: flat
 * colour that carries meaning, small radii, SVG icons, plain sentences, and no motion that
 * does not show data.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const SRC = join(__dirname, '..');
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (n === '__tests__') return [];
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) && !n.endsWith('icon-data.ts') ? [p] : [];
  });
}
const sources = files(SRC).map((p) => ({ path: p.replace(SRC + '/', ''), text: readFileSync(p, 'utf8') }));
/** Code with comments removed, since comments are for developers. */
const code = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');

const isPurple = (hex: string) => {
  const n = parseInt(hex.slice(1, 7), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255];
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return false;
  const l = (max + min) / 510;
  const s = d / (255 - Math.abs(max + min - 255));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return h >= 250 && h <= 330 && s >= 0.2 && l >= 0.08 && l <= 0.95;
};

describe('design rules', () => {
  it('has source files to check', () => expect(sources.length).toBeGreaterThan(30));

  it('uses no emoji or symbol characters as icons', () => {
    const re = /[\u{1F000}-\u{1FAFF}←-⇿■-◿☀-➿⬀-⯿️]/u;
    expect(sources.filter((s) => re.test(code(s.text))).map((s) => s.path)).toEqual([]);
  });

  it('uses no em or en dashes', () => {
    expect(sources.filter((s) => /[‒-―]/.test(code(s.text))).map((s) => s.path)).toEqual([]);
  });

  it('has no exclamation marks in text', () => {
    // a word, then !, then a space, a quote or a tag: text. Not TypeScript's value!.x
    const re = /[A-Za-z]{2}!(?=[\s'"`<])/;
    expect(sources.filter((s) => re.test(code(s.text))).map((s) => s.path)).toEqual([]);
  });

  it('has none of the stock phrases', () => {
    const re = /AI[- ]powered|AI coach|elite|masterful|professional-grade|like a pro|train smarter|swing harder/i;
    expect(sources.filter((s) => re.test(code(s.text))).map((s) => s.path)).toEqual([]);
  });

  it('uses no purple and no gradients', () => {
    const bad: string[] = [];
    for (const s of sources) {
      const t = code(s.text);
      if (/gradient/i.test(t)) bad.push(`${s.path}: gradient`);
      for (const m of t.matchAll(/#[0-9a-fA-F]{6}\b/g)) if (isPurple(m[0])) bad.push(`${s.path}: ${m[0]}`);
    }
    expect(bad).toEqual([]);
  });

  it('keeps corners at 8 points or less, so nothing is a pill', () => {
    const bad: string[] = [];
    for (const s of sources)
      for (const m of code(s.text).matchAll(/borderRadius:\s*(\d+)/g)) if (Number(m[1]) > 8) bad.push(`${s.path}: ${m[0]}`);
    // the round recording dot (10 by 10, radius 5) is the only circle and is under 8
    expect(bad).toEqual([]);
  });

  it('adds no animation library and no hover motion', () => {
    const bad = sources.filter((s) => /react-native-reanimated|Animated\.(timing|spring|loop)|LayoutAnimation|withTiming|withSpring/.test(code(s.text))).map((s) => s.path);
    expect(bad).toEqual([]);
  });

  it('draws icons only through the Icon component', () => {
    expect(sources.filter((s) => /@expo\/vector-icons|react-native-vector-icons|lucide-react-native/.test(s.text)).map((s) => s.path)).toEqual([]);
  });
});
