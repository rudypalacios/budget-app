import i18n from '@/localization/i18n';
import { showToast } from '@/store/toast';
import { updateUserSettings, type UpdateUserSettingsInput } from '@/store/user-settings';

// Every Settings control writes on change (Ajustes redesign, RN-AJU-1). The
// write is deliberately not awaited: Firestore only resolves it on server
// ack, which never comes offline, while the local cache — and so the screen,
// via onSnapshot — already has the new value (RN-AJU-4). Same pattern as the
// Set budget sheet. A real rejection (e.g. permission-denied) still gets an
// error toast, replacing any success toast the caller already showed.
export function saveSettings(patch: UpdateUserSettingsInput) {
  updateUserSettings(patch).catch(() => {
    showToast(i18n.t('settings.saveFailed'));
  });
}
