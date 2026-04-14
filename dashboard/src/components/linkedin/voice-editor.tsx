'use client';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Pencil, Save, X } from 'lucide-react';

interface VoiceUpdate {
  id: number;
  createdAt: number;
  summary: string | null;
  publishedUrl: string | null;
}

export function VoiceEditor({
  initialContent,
  updates,
}: {
  initialContent: string;
  updates: VoiceUpdate[];
}) {
  const [content, setContent] = useState(initialContent);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const res = await fetch('/api/linkedin/voice', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    setSaving(false);
    if (res.ok) setEditing(false);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-3">
        <div className="flex justify-end gap-2">
          {editing ? (
            <>
              <Button variant="ghost" onClick={() => { setContent(initialContent); setEditing(false); }}>
                <X className="size-4" /> Cancelar
              </Button>
              <Button onClick={save} disabled={saving}>
                <Save className="size-4" /> {saving ? 'Guardando…' : 'Guardar'}
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => setEditing(true)}>
              <Pencil className="size-4" /> Editar
            </Button>
          )}
        </div>
        {editing ? (
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={30}
            className="w-full rounded-[10px] bg-background p-4 font-mono text-xs ring-1 ring-border focus:outline-none focus:ring-accent"
          />
        ) : (
          <article className="prose prose-invert max-w-none rounded-[10px] bg-card p-6 ring-1 ring-border">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </article>
        )}
      </div>
      <aside className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Historial de actualizaciones</h2>
        <ul className="space-y-2">
          {updates.length === 0 && <li className="text-xs text-muted-foreground">Sin actualizaciones aún</li>}
          {updates.map(u => (
            <li key={u.id} className="rounded-[10px] bg-card p-3 text-xs ring-1 ring-border">
              <div className="text-muted-foreground">{new Date(u.createdAt * 1000).toLocaleString('es')}</div>
              {u.summary && <div className="mt-1 text-foreground">{u.summary}</div>}
              {u.publishedUrl && (
                <a href={u.publishedUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block text-accent hover:underline">
                  Post origen ↗
                </a>
              )}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
