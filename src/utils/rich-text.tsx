import React from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

const markdownComponents: Components = {
  p: ({ children }) => <p className="rich-text__p">{children}</p>,
  h1: ({ children }) => <div className="rich-text__heading rich-text__heading--1">{children}</div>,
  h2: ({ children }) => <div className="rich-text__heading rich-text__heading--2">{children}</div>,
  h3: ({ children }) => <div className="rich-text__heading rich-text__heading--3">{children}</div>,
  h4: ({ children }) => <div className="rich-text__heading rich-text__heading--4">{children}</div>,
  ul: ({ children }) => <ul className="rich-text__list">{children}</ul>,
  ol: ({ children }) => <ol className="rich-text__list rich-text__list--ordered">{children}</ol>,
  blockquote: ({ children }) => <blockquote className="rich-text__quote">{children}</blockquote>,
  table: ({ children }) => (
    <div className="rich-text__table-wrap">
      <table className="rich-text__table">{children}</table>
    </div>
  ),
  pre: ({ children }) => <pre className="rich-text__code">{children}</pre>,
  code: ({ className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || '');
    const isInline = !className;
    if (isInline) {
      return <code {...props}>{children}</code>;
    }

    return (
      <code {...props} className={className} data-lang={match?.[1]}>
        {children}
      </code>
    );
  },
  a: ({ children, href }) => (
    <a href={href} title={href} onClick={(event) => event.preventDefault()}>
      {children}
    </a>
  ),
  input: ({ checked }) => <input type="checkbox" checked={Boolean(checked)} readOnly />,
};

export function renderRichText(text: string): React.ReactNode {
  const normalizedText = normalizeMathMarkdown(text);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
      components={markdownComponents}
    >
      {normalizedText}
    </ReactMarkdown>
  );
}

function normalizeMathMarkdown(text: string): string {
  return transformOutsideCodeFences(text.replace(/\r\n/g, '\n'), (chunk) => (
    chunk
      // Claude and many LaTeX examples often use \( ... \) and \[ ... \].
      // remark-math consumes dollar delimiters, so normalize those forms first.
      .replace(/\\\[((?:.|\n)*?)\\\]/g, (_match, body: string) => `\n$$\n${body.trim()}\n$$\n`)
      .replace(/\\\((.+?)\\\)/g, (_match, body: string) => `$${body.trim()}$`)
      // If a shell/session escaped Markdown dollars, make them readable again.
      .replace(/\\\$/g, '$')
  ));
}

function transformOutsideCodeFences(text: string, transform: (chunk: string) => string): string {
  const parts = text.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~)/g);
  return parts
    .map((part) => (/^(```|~~~)/.test(part) ? part : transform(part)))
    .join('');
}
