'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export function PublishModal({ draftId, defaultContent }: { draftId: number; defaultContent: string }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState(defaultContent);
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function save() {
    setSaving(true);
    const res = await fetch('/api/linkedin/published', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ draftId, content, linkedinUrl: url }),
    });
    setSaving(false);
    if (res.ok) {
      setOpen(false);
      router.push('/linkedin/published');
    }
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)}>Marcar como publicado</Button>;
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
      <div className="w-full max-w-2xl space-y-4 rounded-[10px] bg-card p-6 ring-1 ring-border">
        <h2 className="text-lg font-semibold">Registrar post publicado</h2>
        <label className="block text-xs text-muted-foreground">Contenido final (como apareció en LinkedIn)</label>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={10}
          className="w-full rounded-[10px] bg-background p-3 text-sm ring-1 ring-border focus:outline-none focus:ring-accent"
        />
        <label className="block text-xs text-muted-foreground">URL del post en LinkedIn</label>
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://www.linkedin.com/posts/..."
          className="w-full rounded-[10px] bg-background p-3 text-sm ring-1 ring-border focus:outline-none focus:ring-accent"
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !url}>
            {saving ? 'Guardando…' : 'Guardar y actualizar voz'}
          </Button>
        </div>
      </div>
    </div>
  );
}
