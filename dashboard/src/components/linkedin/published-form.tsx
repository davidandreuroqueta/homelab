'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export function PublishedForm() {
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || !url.trim()) return;
    setSaving(true);
    const res = await fetch('/api/linkedin/published', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content, linkedinUrl: url }),
    });
    setSaving(false);
    if (res.ok) {
      setContent('');
      setUrl('');
      router.refresh();
    }
  }

  return (
    <form onSubmit={save} className="space-y-3 rounded-[10px] bg-card p-4 ring-1 ring-border">
      <h2 className="text-sm font-semibold">Registrar post publicado</h2>
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        rows={6}
        placeholder="Pega aquí el texto tal como lo publicaste en LinkedIn"
        className="w-full rounded-[10px] bg-background p-3 text-sm ring-1 ring-border focus:outline-none focus:ring-accent"
      />
      <input
        value={url}
        onChange={e => setUrl(e.target.value)}
        placeholder="URL del post en LinkedIn"
        className="w-full rounded-[10px] bg-background p-3 text-sm ring-1 ring-border focus:outline-none focus:ring-accent"
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={saving || !content.trim() || !url.trim()}>
          {saving ? 'Guardando…' : 'Guardar y actualizar voz'}
        </Button>
      </div>
    </form>
  );
}
