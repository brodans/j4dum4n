import type { UserAccountSafe, TabPermissions, UserRole } from './userManager';
import { DEFAULT_ADMIN_PERMISSIONS, DEFAULT_USER_PERMISSIONS } from './userManager';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Storage key dipisah per-role (sessionStorage — per-tab):
 *   - jadhuman_session_admin  → HANYA menyimpan sesi admin
 *   - jadhuman_session_user   → HANYA menyimpan sesi user
 *
 * sessionStorage terisolasi per-tab, sehingga tab A bisa login admin
 * dan tab B login user tanpa saling menimpa.
 */
const SESSION_KEY: Record<UserRole, string> = {
  admin: 'jadhuman_session_admin',
  user:  'jadhuman_session_user',
};

export const SESSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 menit idle

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface StoredSession {
  currentUser: UserAccountSafe | null; // null = admin lama (tanpa user object)
  tabPermissions: TabPermissions;
  authTime: number;
  /** Role yang di-bind saat login — HARUS cocok dengan currentUser.role */
  boundRole: UserRole;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function createAdminUserAccount(username = 'admin'): UserAccountSafe {
  return {
    id: 'admin',
    username: username.toLowerCase().trim() || 'admin',
    displayName: 'Administrator',
    role: 'admin',
    permissions: DEFAULT_ADMIN_PERMISSIONS,
    createdAt: 0,
    updatedAt: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simpan sesi ke sessionStorage per-role.
 * Sebelum simpan, hapus session role lain agar tidak ada dua session sekaligus.
 */
export function saveSession(user: UserAccountSafe | null, permissions: TabPermissions): void {
  try {
    if (typeof window === 'undefined') return;

    const boundRole: UserRole = user?.role === 'user' ? 'user' : 'admin';

    const session: StoredSession = {
      currentUser: user,
      tabPermissions: permissions,
      authTime: Date.now(),
      boundRole,
    };

    // Hapus session role lain sebelum simpan
    const otherRole: UserRole = boundRole === 'admin' ? 'user' : 'admin';
    sessionStorage.removeItem(SESSION_KEY[otherRole]);

    sessionStorage.setItem(SESSION_KEY[boundRole], JSON.stringify(session));
  } catch (err) {
    console.warn('[sessionManager] Gagal menyimpan session:', err);
  }
}

/**
 * Ambil sesi aktif. Null jika tidak ada / kadaluarsa / rusak / mismatch role.
 */
export function loadSession(): StoredSession | null {
  try {
    if (typeof window === 'undefined') return null;

    const rawAdmin = sessionStorage.getItem(SESSION_KEY.admin);
    const rawUser  = sessionStorage.getItem(SESSION_KEY.user);

    // Anomali: dua session aktif sekaligus — hapus keduanya
    if (rawAdmin && rawUser) {
      clearAllSessions();
      return null;
    }

    const raw = rawAdmin || rawUser;
    const detectedRole: UserRole = rawAdmin ? 'admin' : 'user';
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredSession;

    if (!parsed || !parsed.boundRole || !parsed.authTime) {
      clearAllSessions();
      return null;
    }

    // Validasi: boundRole harus sesuai dengan key yang dibaca
    if (parsed.boundRole !== detectedRole) {
      console.warn('[sessionManager] boundRole mismatch — sesi diinvalidasi');
      clearAllSessions();
      return null;
    }

    // Validasi: currentUser.role harus sesuai boundRole (cegah escalation)
    if (parsed.currentUser && parsed.currentUser.role !== parsed.boundRole) {
      console.warn('[sessionManager] currentUser.role mismatch — sesi diinvalidasi');
      clearAllSessions();
      return null;
    }

    // Validasi timeout idle
    if (Date.now() - parsed.authTime > SESSION_TIMEOUT_MS) {
      clearAllSessions();
      return null;
    }

    return parsed;
  } catch {
    clearAllSessions();
    return null;
  }
}

/**
 * Perbarui timestamp sesi (reset idle timer).
 */
export function touchSession(): void {
  try {
    if (typeof window === 'undefined') return;
    const current = loadSession();
    if (!current) return;
    const updated: StoredSession = { ...current, authTime: Date.now() };
    sessionStorage.setItem(SESSION_KEY[current.boundRole], JSON.stringify(updated));
  } catch (err) {
    console.warn('[sessionManager] Gagal touch session:', err);
  }
}

/**
 * Hapus semua sesi dari tab ini.
 */
export function clearAllSessions(): void {
  try {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(SESSION_KEY.admin);
    sessionStorage.removeItem(SESSION_KEY.user);
    // Hapus juga key localStorage lama
    localStorage.removeItem('jadhuman_auth');
    localStorage.removeItem('jadhuman_auth_time');
  } catch (err) {
    console.warn('[sessionManager] Gagal hapus sesi:', err);
  }
}

/**
 * Hapus sesi role tertentu saja.
 */
export function clearSessionByRole(role: UserRole): void {
  try {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(SESSION_KEY[role]);
  } catch { /* ignore */ }
}

/** @deprecated gunakan clearAllSessions() */
export function clearSession(): void {
  clearAllSessions();
}

// ─── Blank permissions untuk state unauthenticated ───────────────────────────
export const UNAUTHENTICATED_PERMISSIONS: TabPermissions = {
  ...DEFAULT_USER_PERMISSIONS,
  tabLogin: false,
  tabAbsen: false,
};
