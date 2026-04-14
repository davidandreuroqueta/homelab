'use client';
import { useState, useCallback, useEffect } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export function ManualTriggerButton() {
  const [loading, setLoading] = useState(false);
  const [runId, setRunId] = useState<number | null>(null);
  const router = useRouter();

  const poll = useCallback(async (id: number) => {
    const res = await fetch(`/api/linkedin/runs/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.run?.status === 'success' || data.run?.status === 'error') {
      setLoading(false);
      setRunId(null);
      router.refresh();
    }
  }, [router]);

  useEffect(() => {
    if (!runId) return;
    const int = setInterval(() => poll(runId), 5000);
    return () => clearInterval(int);
  }, [runId, poll]);

  async function trigger() {
    setLoading(true);
    const res = await fetch('/api/linkedin/runs', { method: 'POST' });
    if (!res.ok) { setLoading(false); return; }
    const data = await res.json();
    setRunId(data.runId);
  }

  return (
    <Button onClick={trigger} disabled={loading} variant="default">
      {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
      {loading ? 'Claude investigando…' : 'Regenerar drafts'}
    </Button>
  );
}
