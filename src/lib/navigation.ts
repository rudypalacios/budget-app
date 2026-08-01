import { router, type Href } from 'expo-router';

const HOME_HREF: Href = '/';

// A screen normally reached by pushing from a known parent can still be hit
// directly (URL load/reload on web, deep link) with empty navigation history
// — router.back() then silently no-ops, stranding the user. Falls back to a
// caller-supplied route in that case, or home if none is given, so every
// call site is guaranteed to land somewhere even with a bare goBack().
export function goBack(fallbackHref: Href = HOME_HREF) {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallbackHref);
  }
}
