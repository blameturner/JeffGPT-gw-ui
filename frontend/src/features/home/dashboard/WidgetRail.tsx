import type { HomeOverview } from '../../../api/home/types';
import { CalendarWidget } from './widgets/CalendarWidget';
import { ChatConvosWidget } from './widgets/ChatConvosWidget';
import { CodeConvosWidget } from './widgets/CodeConvosWidget';
import { EmailWidget } from './widgets/EmailWidget';
import { GraphWidget } from './widgets/GraphWidget';
import { ScrapersWidget } from './widgets/ScrapersWidget';

interface Props {
  overview: HomeOverview | null;
  refreshSignal?: unknown;
}

export function WidgetRail({ overview, refreshSignal }: Props) {
  return (
    <div className="space-y-2">
      <EmailWidget env={overview?.widgets.email} />
      <CalendarWidget env={overview?.widgets.calendar} />
      <GraphWidget env={overview?.widgets.graph} />
      <CodeConvosWidget refreshSignal={refreshSignal} />
      <ChatConvosWidget refreshSignal={refreshSignal} />
      <ScrapersWidget refreshSignal={refreshSignal} />
    </div>
  );
}


