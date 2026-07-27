export type AuthUnsubscribe = () => void;

export interface AuthUser {
  uid: string;
  email: string | null;
  isAnonymous: boolean;
}

// Stage 6: anonymous sign-in only. Stage 9a adds email/password on top of
// that same session via linkWithCredential (upgrading the anonymous uid in
// place, not replacing it — see docs/SRS-presupuesto-app.md §11 Stage 9a and
// firestore.rules' isOwner(uid) check, which this satisfies either way).
// Google (9b) and Facebook (9c) will follow the same account-joining
// principle once added.
export interface AuthClient {
  // Resolves once a uid is available, signing in anonymously if no session
  // exists yet. Resolves to the same uid on every subsequent app launch.
  ensureSignedIn(): Promise<string>;
  onAuthStateChange(onNext: (uid: string | null) => void): AuthUnsubscribe;

  // Upgrades the current anonymous session in place, preserving uid (and
  // therefore all existing Firestore documents under it). Throws the
  // underlying Firebase error on failure — most notably
  // `auth/email-already-in-use`, which means this email belongs to a
  // different, already-real account and can't be linked here.
  signUpWithEmail(email: string, password: string): Promise<AuthUser>;

  // Signs in to an existing real account, replacing whatever anonymous
  // session was active. Deliberately does not attempt linkWithCredential —
  // linking a credential already tied to another uid would fail with
  // `auth/credential-already-in-use`.
  signInWithEmail(email: string, password: string): Promise<AuthUser>;

  // Signs in with Google, upgrading the current anonymous session in place —
  // same account-joining principle as signUpWithEmail. Falls back to a plain
  // sign-in with the Google credential, abandoning the anonymous session, if
  // this Google account is already linked to a different real account
  // (`auth/credential-already-in-use`) — there's no form to redirect through
  // here, so the fallback happens transparently inside this one call instead
  // of use-auth-form.ts's sign-up-to-sign-in mode switch.
  // Returns null if the user cancels the native picker/web popup — not an
  // error, callers should treat it as a silent no-op.
  signInWithGoogle(): Promise<AuthUser | null>;

  signOut(): Promise<void>;

  sendPasswordReset(email: string): Promise<void>;

  // Returns null only in the should-be-impossible case of no current user
  // post-bootstrap.
  getCurrentUser(): AuthUser | null;
}
