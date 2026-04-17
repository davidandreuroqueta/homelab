'use client';
import { useState } from 'react';
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CopyContextProps {
  draftContent: string;
  topic: string;
  angle: string;
  sources: { type: string; url: string; title: string }[];
  voiceProfile: string;
  recentPublished: string[];
}

function buildContext(props: CopyContextProps): string {
  const srcList = props.sources
    .map((s) => `- ${s.title || s.url} (${s.url})`)
    .join('\n');

  const recentList = props.recentPublished
    .map((p, i) => `--- Post ${i + 1} ---\n${p}`)
    .join('\n\n');

  return `Quiero que me ayudes a refinar este borrador de post de LinkedIn.

## Draft actual
Tema: ${props.topic}
Ángulo: ${props.angle}

${props.draftContent}

## Fuentes del draft
${srcList || '(sin fuentes)'}

## Mi perfil de voz (cómo escribo)
${props.voiceProfile || '(perfil de voz aún no definido — escribe en un tono profesional pero personal, en español)'}

## Mis últimos posts publicados (referencia de estilo)
${recentList || '(aún no he publicado posts)'}

## Instrucciones
- Ayúdame a mejorar este draft manteniendo mi estilo
- Máximo 2800 caracteres
- El hook (primera línea) es crucial — es lo que se ve en el feed
- Español, sin em-dashes, sin clichés
- Si incluyes datos, necesito que sean verificables`;
}

export function CopyContext(props: CopyContextProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const context = buildContext(props);

  async function copy() {
    await navigator.clipboard.writeText(context);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button onClick={copy} variant={copied ? 'default' : 'secondary'}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? 'Copiado' : 'Copiar contexto para Claude'}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          {expanded ? 'Ocultar' : 'Ver contexto'}
        </Button>
      </div>
      {expanded && (
        <pre className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-[10px] bg-muted p-4 text-xs ring-1 ring-border">
          {context}
        </pre>
      )}
    </div>
  );
}
