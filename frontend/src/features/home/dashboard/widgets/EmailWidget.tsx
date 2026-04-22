import type { WidgetEnvelope } from '../../../../api/home/types';
import { PlaceholderWidget } from './PlaceholderWidget';

export function EmailWidget({ env }: { env: WidgetEnvelope<null> | undefined }) {
  return <PlaceholderWidget title="Email" message={env?.message || 'Not configured'} />;
}

