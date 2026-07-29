import i18n from '@/localization/i18n';

export function mapAuthErrorMessage(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return i18n.t('auth.errors.emailAlreadyInUse');
    case 'auth/invalid-email':
      return i18n.t('auth.errors.invalidEmail');
    case 'auth/weak-password':
      return i18n.t('auth.errors.weakPassword');
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return i18n.t('auth.errors.incorrectCredentials');
    case 'auth/credential-already-in-use':
      return i18n.t('auth.errors.credentialAlreadyInUse');
    case 'auth/too-many-requests':
      return i18n.t('auth.errors.tooManyRequests');
    case 'auth/operation-not-allowed':
      return i18n.t('auth.errors.operationNotAllowed');
    case 'auth/network-request-failed':
      return i18n.t('auth.errors.networkRequestFailed');
    case 'auth/popup-blocked':
      return i18n.t('auth.errors.popupBlocked');
    default:
      // This maps *any* thrown error's code, not just auth/-prefixed
      // Firebase ones — a native Google Sign-In failure (e.g. Android's
      // DEVELOPER_ERROR, code '10', almost always a SHA-1 fingerprint or
      // client ID mismatch — see CLAUDE.md's Auth entry) lands here too,
      // with no case of its own since those codes aren't Firebase's. With
      // no device logs to point a user at, surfacing the raw code directly
      // in the message is the only diagnostic they can hand back.
      return code ? i18n.t('auth.errors.unknownWithCode', { code }) : i18n.t('auth.errors.unknown');
  }
}
