import { SourcesClient } from '@/components/linkedin/sources-client';

export default function SourcesPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Fuentes</h1>
        <p className="text-sm text-muted-foreground">RSS feeds, podcasts y topics que alimentan la investigación diaria</p>
      </header>
      <SourcesClient />
    </div>
  );
}
