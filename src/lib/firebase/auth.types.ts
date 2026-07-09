export type AuthUnsubscribe = () => void;

// Stage 6: anonymous sign-in only, bridging until Stage 8 adds real
// email/Google/Facebook credentials via linkWithCredential (upgrading the
// same uid in place, not replacing it — see docs/SRS-presupuesto-app.md §11
// Stage 8 and firestore.rules' isOwner(uid) check, which this satisfies now).
export interface AuthClient {
  // Resolves once a uid is available, signing in anonymously if no session
  // exists yet. Resolves to the same uid on every subsequent app launch.
  ensureSignedIn(): Promise<string>;
  onAuthStateChange(onNext: (uid: string | null) => void): AuthUnsubscribe;
}
