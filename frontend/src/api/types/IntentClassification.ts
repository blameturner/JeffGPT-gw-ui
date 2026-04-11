import type { ChatRoute } from './ChatRoute';
import type { ChatIntent } from './ChatIntent';

export interface IntentClassification {
  route: ChatRoute;
  intent: ChatIntent;
  secondary_intent?: ChatIntent | null;
  entities: string[];
  confidence: number;
}
