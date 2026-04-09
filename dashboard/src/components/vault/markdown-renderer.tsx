'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
// rehypeRaw removed — vault content is untrusted, no raw HTML rendering
import Link from 'next/link';
import type { Components } from 'react-markdown';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .trim();
}

function resolveWikiLinks(content: string): string {
  return content.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_match, target: string, alias: string | undefined) => {
      const label = alias ?? target;
      const href = `/vault/${target.replace(/\s+/g, '%20')}`;
      return `[${label}](${href})`;
    }
  );
}

const components: Components = {
  h1: ({ children, ...props }) => {
    const id = slugify(String(children));
    return (
      <h1
        id={id}
        className="mt-8 mb-4 text-3xl font-bold tracking-tight text-foreground first:mt-0"
        {...props}
      >
        <a href={`#${id}`} className="no-underline hover:underline">
          {children}
        </a>
      </h1>
    );
  },
  h2: ({ children, ...props }) => {
    const id = slugify(String(children));
    return (
      <h2
        id={id}
        className="mt-8 mb-3 text-2xl font-semibold tracking-tight text-foreground"
        {...props}
      >
        <a href={`#${id}`} className="no-underline hover:underline">
          {children}
        </a>
      </h2>
    );
  },
  h3: ({ children, ...props }) => {
    const id = slugify(String(children));
    return (
      <h3
        id={id}
        className="mt-6 mb-2 text-xl font-semibold text-foreground"
        {...props}
      >
        <a href={`#${id}`} className="no-underline hover:underline">
          {children}
        </a>
      </h3>
    );
  },
  h4: ({ children, ...props }) => (
    <h4 className="mt-4 mb-2 text-lg font-medium text-foreground" {...props}>
      {children}
    </h4>
  ),
  p: ({ children, ...props }) => (
    <p className="mb-4 leading-7 text-foreground/90" {...props}>
      {children}
    </p>
  ),
  a: ({ href, children, ...props }) => {
    const isInternal = href?.startsWith('/');
    if (isInternal && href) {
      return (
        <Link
          href={href}
          className="text-accent underline underline-offset-4 hover:text-accent/80 transition-colors"
        >
          {children}
        </Link>
      );
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent underline underline-offset-4 hover:text-accent/80 transition-colors"
        {...props}
      >
        {children}
      </a>
    );
  },
  ul: ({ children, ...props }) => (
    <ul className="mb-4 ml-6 list-disc space-y-1 text-foreground/90" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="mb-4 ml-6 list-decimal space-y-1 text-foreground/90" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="leading-7" {...props}>
      {children}
    </li>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="mb-4 border-l-4 border-accent pl-4 italic text-muted-foreground"
      {...props}
    >
      {children}
    </blockquote>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = className?.includes('language-');
    if (isBlock) {
      return (
        <code
          className={`${className ?? ''} block overflow-x-auto rounded-[10px] bg-muted p-4 text-sm font-mono`}
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded-md bg-muted px-1.5 py-0.5 text-sm font-mono text-accent"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children, ...props }) => (
    <pre
      className="mb-4 overflow-x-auto rounded-[10px] bg-muted text-sm"
      {...props}
    >
      {children}
    </pre>
  ),
  table: ({ children, ...props }) => (
    <div className="mb-4 overflow-x-auto rounded-[10px] border border-border">
      <table className="w-full text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="bg-muted text-left" {...props}>
      {children}
    </thead>
  ),
  th: ({ children, ...props }) => (
    <th
      className="border-b border-border px-4 py-2 font-medium text-foreground"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="border-b border-border px-4 py-2 text-foreground/90" {...props}>
      {children}
    </td>
  ),
  hr: (props) => <hr className="my-6 border-border" {...props} />,
  img: ({ src, alt, ...props }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt ?? ''}
      className="my-4 max-w-full rounded-[10px]"
      loading="lazy"
      {...props}
    />
  ),
};

export function MarkdownRenderer({ content }: { content: string }) {
  const processed = resolveWikiLinks(content);

  return (
    <article className="prose-custom max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {processed}
      </ReactMarkdown>
    </article>
  );
}
