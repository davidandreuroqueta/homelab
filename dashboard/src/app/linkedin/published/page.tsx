import { getDb } from '@/lib/db/client';
import { published } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { PublishedForm } from '@/components/linkedin/published-form';

export const dynamic = 'force-dynamic';

export default async function PublishedPage() {
  const db = getDb();
  const rows = db.select().from(published).orderBy(desc(published.publishedAt)).limit(100).all();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Publicados</h1>
        <p className="text-sm text-muted-foreground">Histórico de posts publicados en LinkedIn</p>
      </header>
      <PublishedForm />
      <div className="space-y-3">
        {rows.length === 0 ? (
          <p className="rounded-[10px] bg-card p-6 text-center text-sm text-muted-foreground ring-1 ring-border">
            Aún no has registrado ningún post publicado.
          </p>
        ) : rows.map(p => (
          <article key={p.id} className="space-y-2 rounded-[10px] bg-card p-4 ring-1 ring-border">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{new Date(p.publishedAt * 1000).toLocaleString('es')}</span>
              <a href={p.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Ver en LinkedIn ↗</a>
            </div>
            <pre className="whitespace-pre-wrap text-sm leading-relaxed">{p.content}</pre>
          </article>
        ))}
      </div>
    </div>
  );
}
