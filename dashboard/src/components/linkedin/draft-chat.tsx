'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ChatMessage } from '@/lib/db/schema';

export function DraftChat({ draftId }: { draftId: number }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/linkedin/drafts/${draftId}/chat`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.messages);
    }
  }, [draftId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setLoading(true);
    setInput('');
    setMessages(prev => [...prev, {
      id: -1, draftId, role: 'user', content: text, createdAt: Math.floor(Date.now() / 1000),
    } as ChatMessage]);
    try {
      const res = await fetch(`/api/linkedin/drafts/${draftId}/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      if (res.ok) await load();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 rounded-[10px] bg-card p-4 ring-1 ring-border">
        {messages.length === 0 && !loading && (
          <p className="text-xs text-muted-foreground">Empieza la conversación para refinar este draft.</p>
        )}
        {messages.map(m => (
          <div key={m.id} className={m.role === 'user' ? 'text-right' : ''}>
            <div className={
              m.role === 'user'
                ? 'inline-block max-w-[85%] rounded-lg bg-accent/15 px-3 py-2 text-sm text-foreground'
                : 'inline-block max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm text-foreground whitespace-pre-wrap'
            }>{m.content}</div>
          </div>
        ))}
        {loading && (
          <div>
            <div className="inline-flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Claude está pensando…
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); }}
          rows={2}
          placeholder="Refina este draft… (Cmd/Ctrl+Enter para enviar)"
          className="flex-1 resize-none rounded-[10px] bg-card p-3 text-sm ring-1 ring-border focus:outline-none focus:ring-accent"
        />
        <Button onClick={send} disabled={loading || !input.trim()}>
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}
