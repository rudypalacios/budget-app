export type AuthUnsubscribe = () => void;

export interface AuthUser {
  uid: string;
  email: string | null;
  isAnonymous: boolean;
}

export interface GoogleAccountConflict {
  email: string | null;
  // Opaque platform-specific OAuth credential captured from the conflicting
  // Google sign-in attempt — round-tripped back into completeGoogleLink
  // once the user has proven ownership of the existing account by signing
  // in with their password. Never inspected by callers.
  pendingCredential: unknown;
}

export type GoogleSignInResult =
  | { status: 'linked'; user: AuthUser }
  | { status: 'cancelled' }
  // This Google account's email already belongs to a different, real
  // account (signed up some other way, e.g. email/password) — Firebase
  // enforces one account per email, so linking can't complete here. The
  // caller must have the user sign in with their existing credential for
  // that account first, then call completeGoogleLink with this conflict's
  // pendingCredential to actually join the two.
  | { status: 'account-exists'; conflict: GoogleAccountConflict };

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
  // of use-auth-form.ts's sign-up-to-sign-in mode switch. If the Google
  // account's *email* (not yet linked to Google, but registered some other
  // way) belongs to a different real account, returns an 'account-exists'
  // conflict instead of throwing — see completeGoogleLink.
  // 'cancelled' means the user backed out of the native picker/web popup —
  // not an error, callers should treat it as a silent no-op.
  signInWithGoogle(): Promise<GoogleSignInResult>;

  // Finishes linking a Google credential captured from a prior
  // signInWithGoogle() 'account-exists' conflict onto the *currently signed
  // in* user. Call only immediately after the user has signed in with their
  // existing credential (e.g. signInWithEmail) for that same conflicting
  // account — that's what actually merges the Google identity onto it.
  completeGoogleLink(pendingCredential: unknown): Promise<AuthUser>;

  signOut(): Promise<void>;

  sendPasswordReset(email: string): Promise<void>;

  // Returns null only in the should-be-impossible case of no current user
  // post-bootstrap.
  getCurrentUser(): AuthUser | null;
}
