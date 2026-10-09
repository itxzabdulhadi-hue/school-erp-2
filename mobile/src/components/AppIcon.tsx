import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

type IonName = ComponentProps<typeof Ionicons>['name'];

/** Fixed icon vocabulary used across the app (single swap point). */
export type IconName =
  | 'home' | 'people' | 'person' | 'cash' | 'calendar' | 'clipboard' | 'book'
  | 'document-text' | 'folder' | 'megaphone' | 'notifications' | 'settings'
  | 'briefcase' | 'stats-chart' | 'search' | 'add' | 'download' | 'cloud-upload'
  | 'chevron-forward' | 'time' | 'card' | 'school' | 'library' | 'bus'
  | 'alert-circle' | 'checkmark-circle' | 'information-circle' | 'refresh'
  | 'log-out' | 'eye' | 'create' | 'trash';

export function AppIcon({ name, size = 22, color = '#334155' }: {
  name: IconName; size?: number; color?: string;
}): React.JSX.Element {
  return <Ionicons name={name as IonName} size={size} color={color} />;
}
