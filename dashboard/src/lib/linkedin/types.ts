export type DraftAngle = 'technical' | 'opinion' | 'news-summary' | 'personal';

export interface SourceRef {
  type: 'rss' | 'web' | 'episode';
  url: string;
  title: string;
}

export interface DraftPayload {
  batchId: string;
  topic: string;
  angle: DraftAngle;
  isStarPost: boolean;
  content: string;
  hook: string;
  sources: SourceRef[];
}

export interface GenerationRunSummary {
  runId: number;
  status: 'running' | 'success' | 'error';
  draftsGenerated: number;
  durationMs?: number;
  error?: string;
}
