import { router, type Href } from 'expo-router';

export function returnToRoute(href: Href): void {
  if (typeof router.dismissTo === 'function') {
    router.dismissTo(href);
    return;
  }
  router.replace(href);
}
