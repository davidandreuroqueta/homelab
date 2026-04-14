'use client';
import { useState, useEffect } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Source } from '@/lib/db/schema';

export function SourcesClient() {
  const [sources, setSources] = useState<Source[]>([]);
  const [kind, setKind] = useState<'rss' | 'podcast' | 'web_topic'>('rss');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [priority, setPriority] = useState(5);

  async function load() {
    const res = await fetch('/api/linkedin/sources');
    if (res.ok) setSources((await res.json()).sources);
  }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/linkedin/sources', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind, name, url, priority }),
    });
    if (res.ok) {
      setName(''); setUrl(''); setPriority(5);
      load();
    }
  }

  async function toggle(s: Source) {
    await fetch(`/api/linkedin/sources/${s.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: !s.enabled }),
    });
    load();
  }

  async function remove(id: number) {
    if (!confirm('Eliminar esta fuente?')) return;
    await fetch(`/api/linkedin/sources/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={add} className="grid grid-cols-1 gap-3 rounded-[10px] bg-card p-4 ring-1 ring-border md:grid-cols-[120px_1fr_2fr_80px_auto]">
        <select
          value={kind}
          onChange={e => setKind(e.target.value as 'rss' | 'podcast' | 'web_topic')}
          className="rounded-[10px] bg-background p-2 text-sm ring-1 ring-border"
        >
          <option value="rss">RSS</option>
          <option value="podcast">Podcast</option>
          <option value="web_topic">Web topic</option>
        </select>
        <input
          value={name} onChange={e => setName(e.target.value)} placeholder="Nombre"
          className="rounded-[10px] bg-background p-2 text-sm ring-1 ring-border" required
        />
        <input
          value={url} onChange={e => setUrl(e.target.value)} placeholder="URL o keyword"
          className="rounded-[10px] bg-background p-2 text-sm ring-1 ring-border" required
        />
        <input
          type="number" min={1} max={10} value={priority}
          onChange={e => setPriority(Number(e.target.value))}
          className="rounded-[10px] bg-background p-2 text-sm ring-1 ring-border"
        />
        <Button type="submit"><Plus className="size-4" /></Button>
      </form>

      <div className="overflow-x-auto rounded-[10px] ring-1 ring-border">
        <table className="w-full text-sm">
          <thead className="bg-card text-xs text-muted-foreground">
            <tr>
              <th className="p-3 text-left">Nombre</th>
              <th className="p-3 text-left">Tipo</th>
              <th className="p-3 text-left">URL</th>
              <th className="p-3 text-center">Prio</th>
              <th className="p-3 text-center">Activo</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {sources.map(s => (
              <tr key={s.id} className="border-t border-border">
                <td className="p-3">{s.name}</td>
                <td className="p-3 text-xs text-muted-foreground">{s.kind}</td>
                <td className="p-3 text-xs text-muted-foreground"><code>{s.url.slice(0, 50)}{s.url.length > 50 ? '…' : ''}</code></td>
                <td className="p-3 text-center">{s.priority}</td>
                <td className="p-3 text-center">
                  <button onClick={() => toggle(s)} className="text-xs text-accent hover:underline">
                    {s.enabled ? 'sí' : 'no'}
                  </button>
                </td>
                <td className="p-3">
                  <button onClick={() => remove(s.id)} className="text-destructive hover:opacity-70">
                    <Trash2 className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
