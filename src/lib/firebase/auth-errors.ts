export function mapAuthErrorMessage(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Incorrect email or password.';
    case 'auth/credential-already-in-use':
      return 'This email is already linked to another account.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled for this app yet.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google sign-in popup. Please allow popups for this site and try again.';
    default:
      // This maps *any* thrown error's code, not just auth/-prefixed
      // Firebase ones — a native Google Sign-In failure (e.g. Android's
      // DEVELOPER_ERROR, code '10', almost always a SHA-1 fingerprint or
      // client ID mismatch — see CLAUDE.md's Auth entry) lands here too,
      // with no case of its own since those codes aren't Firebase's. With
      // no device logs to point a user at, surfacing the raw code directly
      // in the message is the only diagnostic they can hand back.
      return code ? `Something went wrong (${code}). Please try again.` : 'Something went wrong. Please try again.';
  }
}
