import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef<any>();

export function navigate(name: string, params?: Record<string, unknown>) {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate(name, params);
}

export function replace(name: string, params?: Record<string, unknown>) {
  if (!navigationRef.isReady()) return;
  navigationRef.dispatch(CommonActions.navigate({ name, params }));
}
