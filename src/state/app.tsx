import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import * as Crypto from 'expo-crypto';
import * as auth from '@/data/auth';
import { buildExport, shareExport } from '@/data/exportData';
import { expiredSessions } from '@/data/retention';
import {
  KEYS,
  deleteAllSessionFiles,
  deleteSessionFiles,
  readJson,
  writeJson,
} from '@/data/storage';
import { DEFAULT_SETTINGS, type Account, type BowlerProfile, type Role, type Session, type Settings } from '@/data/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface State {
  ready: boolean;
  account: Account | null;
  onboarded: boolean;
  bowlers: BowlerProfile[];
  activeBowlerId: string | null;
  sessions: Session[];
  settings: Settings;
}

type Action =
  | { type: 'loaded'; state: Omit<State, 'ready'> }
  | { type: 'account'; account: Account | null }
  | { type: 'onboarded' }
  | { type: 'bowlers'; bowlers: BowlerProfile[] }
  | { type: 'active'; id: string | null }
  | { type: 'sessions'; sessions: Session[] }
  | { type: 'settings'; settings: Settings }
  | { type: 'wiped' };

const initial: State = {
  ready: false,
  account: null,
  onboarded: false,
  bowlers: [],
  activeBowlerId: null,
  sessions: [],
  settings: DEFAULT_SETTINGS,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'loaded':
      return { ...action.state, ready: true };
    case 'account':
      return { ...state, account: action.account };
    case 'onboarded':
      return { ...state, onboarded: true };
    case 'bowlers':
      return { ...state, bowlers: action.bowlers };
    case 'active':
      return { ...state, activeBowlerId: action.id };
    case 'sessions':
      return { ...state, sessions: action.sessions };
    case 'settings':
      return { ...state, settings: action.settings };
    case 'wiped':
      return { ...initial, ready: true, onboarded: state.onboarded };
  }
}

export interface AppApi extends State {
  /** The bowlers that belong to the signed-in account. */
  myBowlers: BowlerProfile[];
  activeBowler: BowlerProfile | null;
  /** Sessions of the active account's bowlers, newest first. */
  mySessions: Session[];
  register(input: { name: string; email: string; password: string; role: Role }): Promise<void>;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  completeOnboarding(): Promise<void>;
  saveBowler(b: Omit<BowlerProfile, 'id' | 'ownerId' | 'createdAt'> & { id?: string }): Promise<BowlerProfile>;
  deleteBowler(id: string): Promise<void>;
  setActiveBowler(id: string): Promise<void>;
  addSession(s: Session): Promise<void>;
  updateSession(id: string, patch: Partial<Session>): Promise<void>;
  deleteSession(id: string): Promise<void>;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  exportData(): Promise<boolean>;
  deleteEverything(): Promise<void>;
}

const Ctx = createContext<AppApi | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  // The latest state, for actions that read it after an await.
  const ref = useRef(state);
  ref.current = state;

  useEffect(() => {
    (async () => {
      const [account, onboarded, bowlers, activeBowlerId, sessions, settings] = await Promise.all([
        auth.currentAccount(),
        readJson<boolean>(KEYS.onboarded, false),
        readJson<BowlerProfile[]>(KEYS.bowlers, []),
        readJson<string | null>(KEYS.activeBowler, null),
        readJson<Session[]>(KEYS.sessions, []),
        readJson<Settings>(KEYS.settings, DEFAULT_SETTINGS),
      ]);
      const merged = { ...DEFAULT_SETTINGS, ...settings };
      // Retention: sessions past the chosen age are removed, files included.
      const old = expiredSessions(sessions, merged.retentionDays, Date.now());
      old.forEach((s) => deleteSessionFiles(s.id));
      const kept = sessions.filter((s) => !old.includes(s));
      if (old.length) await writeJson(KEYS.sessions, kept);
      dispatch({ type: 'loaded', state: { account, onboarded, bowlers, activeBowlerId, sessions: kept, settings: merged } });
    })();
  }, []);

  const setSessions = useCallback(async (sessions: Session[]) => {
    await writeJson(KEYS.sessions, sessions);
    dispatch({ type: 'sessions', sessions });
  }, []);

  const api = useMemo<AppApi>(() => {
    const myBowlersOf = (s: State) => s.bowlers.filter((b) => b.ownerId === s.account?.id);
    return {
      ...state,
      myBowlers: myBowlersOf(state),
      activeBowler: myBowlersOf(state).find((b) => b.id === state.activeBowlerId) ?? myBowlersOf(state)[0] ?? null,
      mySessions: state.sessions
        .filter((s) => myBowlersOf(state).some((b) => b.id === s.bowlerId))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),

      async register(input) {
        dispatch({ type: 'account', account: await auth.register(input) });
      },
      async login(email, password) {
        dispatch({ type: 'account', account: await auth.login(email, password) });
      },
      async logout() {
        await auth.logout();
        dispatch({ type: 'account', account: null });
      },
      async completeOnboarding() {
        await writeJson(KEYS.onboarded, true);
        dispatch({ type: 'onboarded' });
      },

      async saveBowler(input) {
        const s = ref.current;
        if (!s.account) throw new Error('Not signed in.');
        const existing = input.id ? s.bowlers.find((b) => b.id === input.id) : undefined;
        const bowler: BowlerProfile = {
          ...input,
          id: existing?.id ?? Crypto.randomUUID(),
          ownerId: existing?.ownerId ?? s.account.id,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
        };
        const bowlers = existing ? s.bowlers.map((b) => (b.id === bowler.id ? bowler : b)) : [...s.bowlers, bowler];
        await writeJson(KEYS.bowlers, bowlers);
        dispatch({ type: 'bowlers', bowlers });
        if (!s.activeBowlerId || !existing) {
          await writeJson(KEYS.activeBowler, bowler.id);
          dispatch({ type: 'active', id: bowler.id });
        }
        return bowler;
      },
      async deleteBowler(id) {
        const s = ref.current;
        // A bowler's sessions go with them, files included.
        s.sessions.filter((x) => x.bowlerId === id).forEach((x) => deleteSessionFiles(x.id));
        await setSessions(s.sessions.filter((x) => x.bowlerId !== id));
        const bowlers = s.bowlers.filter((b) => b.id !== id);
        await writeJson(KEYS.bowlers, bowlers);
        dispatch({ type: 'bowlers', bowlers });
        if (s.activeBowlerId === id) {
          await writeJson(KEYS.activeBowler, null);
          dispatch({ type: 'active', id: null });
        }
      },
      async setActiveBowler(id) {
        await writeJson(KEYS.activeBowler, id);
        dispatch({ type: 'active', id });
      },

      async addSession(session) {
        await setSessions([...ref.current.sessions, session]);
      },
      async updateSession(id, patch) {
        await setSessions(ref.current.sessions.map((s) => (s.id === id ? { ...s, ...patch } : s)));
      },
      async deleteSession(id) {
        deleteSessionFiles(id);
        await setSessions(ref.current.sessions.filter((s) => s.id !== id));
      },

      async updateSettings(patch) {
        const settings = { ...ref.current.settings, ...patch };
        await writeJson(KEYS.settings, settings);
        dispatch({ type: 'settings', settings });
      },

      async exportData() {
        const s = ref.current;
        if (!s.account) return false;
        return shareExport(buildExport({ account: s.account, bowlers: s.bowlers, sessions: s.sessions, settings: s.settings }));
      },
      async deleteEverything() {
        const s = ref.current;
        deleteAllSessionFiles();
        if (s.account) await auth.deleteAccount(s.account.id);
        await AsyncStorage.multiRemove(Object.values(KEYS).filter((k) => k !== KEYS.onboarded));
        dispatch({ type: 'wiped' });
      },
    };
  }, [state, setSessions]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useApp(): AppApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppProvider');
  return v;
}
