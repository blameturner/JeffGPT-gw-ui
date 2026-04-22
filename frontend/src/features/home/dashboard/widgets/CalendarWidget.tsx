import type { WidgetEnvelope } from '../../../../api/home/types';
import { PlaceholderWidget } from './PlaceholderWidget';

export function CalendarWidget({ env }: { env: WidgetEnvelope<null> | undefined }) {
  return <PlaceholderWidget title="Calendar" message={env?.message || 'Not configured'} />;
}

