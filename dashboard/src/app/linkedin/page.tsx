import { getDb } from '@/lib/db/client';
import { drafts } from '@/lib/db/schema';
import { desc, gte } from 'drizzle-orm';
import { DraftCard } from '@/components/linkedin/draft-card';
import { ManualTriggerButton } from '@/components/linkedin/manual-trigger-button';

export const dynamic = 'force-dynamic';

export default async function LinkedInPage() {
  const db = getDb();
  const since = Math.floor(Date.now() / 1000) - 36 * 3600; // last 36h
  const rows = db.select().from(drafts)
    .where(gte(drafts.generatedAt, since))
    .orderBy(desc(drafts.isStarPost), desc(drafts.generatedAt))
    .all();
  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Drafts</h1>
          <p className="text-sm text-muted-foreground">5 propuestas diarias generadas por Claude</p>
        </div>
        <ManualTriggerButton />
      </header>
      {rows.length === 0 ? (
        <div className="rounded-[10px] bg-card p-8 ring-1 ring-border text-center text-sm text-muted-foreground">
          No hay drafts recientes. Pulsa &quot;Regenerar drafts&quot; para lanzar la investigación ahora.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {rows.map(d => <DraftCard key={d.id} draft={d} />)}
        </div>
      )}
    </div>
  );
}
