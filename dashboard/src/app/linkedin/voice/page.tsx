import { promises as fs } from 'node:fs';
import { getDb } from '@/lib/db/client';
import { voiceProfileUpdates, published } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { voiceProfilePath } from '@/lib/linkedin/paths';
import { VoiceEditor } from '@/components/linkedin/voice-editor';

export const dynamic = 'force-dynamic';

export default async function VoicePage() {
  let content = '';
  try {
    content = await fs.readFile(voiceProfilePath(), 'utf8');
  } catch {
    content = '# Voice Profile\n\n(vacío — empieza publicando posts para construir tu perfil)\n';
  }
  const db = getDb();
  const updates = db.select({
    id: voiceProfileUpdates.id,
    createdAt: voiceProfileUpdates.createdAt,
    summary: voiceProfileUpdates.summary,
    publishedUrl: published.linkedinUrl,
  })
    .from(voiceProfileUpdates)
    .leftJoin(published, eq(voiceProfileUpdates.triggeredByPublishedId, published.id))
    .orderBy(desc(voiceProfileUpdates.createdAt))
    .limit(20)
    .all();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Perfil de voz</h1>
        <p className="text-sm text-muted-foreground">
          Claude actualiza este perfil tras cada post que publicas. Puedes editarlo a mano cuando quieras.
        </p>
      </header>
      <VoiceEditor initialContent={content} updates={updates} />
    </div>
  );
}
