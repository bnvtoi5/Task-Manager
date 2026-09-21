import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy, Terminal, Code2, ExternalLink } from 'lucide-react';

interface RichMarkdownRendererProps {
  content: string;
  isUser?: boolean;
}

interface CodeBlockProps {
  language?: string;
  value: string;
  isUser?: boolean;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, value, isUser = false }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayLang = (language || 'text').toLowerCase();

  return (
    <div
      className={`my-2 rounded-xl overflow-hidden border shadow-xs transition-all ${
        isUser
          ? 'bg-black/40 border-white/20 text-white'
          : 'bg-[#1e2433] dark:bg-[#0d131f] border-slate-700/70 text-slate-100'
      }`}
    >
      {/* Code Header Bar */}
      <div
        className={`px-3 py-1.5 flex items-center justify-between text-[11px] font-mono select-none border-b ${
          isUser
            ? 'bg-black/30 border-white/10 text-white/80'
            : 'bg-[#181d2a] dark:bg-[#080d17] border-slate-700/60 text-slate-300'
        }`}
      >
        <div className="flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="font-semibold uppercase tracking-wider text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
            {displayLang}
          </span>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-sans font-medium transition cursor-pointer ${
            copied
              ? 'bg-emerald-500/20 text-emerald-300'
              : 'hover:bg-white/10 text-slate-300 hover:text-white'
          }`}
          title="Sao chép đoạn mã"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span>Đã chép</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Sao chép</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content */}
      <div className="p-3 overflow-x-auto text-[11px] font-mono leading-relaxed select-text">
        <pre className="!bg-transparent !p-0 !m-0">
          <code>{value}</code>
        </pre>
      </div>
    </div>
  );
};

export const RichMarkdownRenderer: React.FC<RichMarkdownRendererProps> = ({
  content,
  isUser = false,
}) => {
  return (
    <div
      className={`markdown-body select-text text-xs leading-relaxed ${
        isUser ? 'text-white' : 'text-slate-800 dark:text-slate-200'
      }`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Custom Code Renderer (inline vs block)
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const rawContent = String(children).replace(/\n$/, '');
            const isMultiLine = rawContent.includes('\n');

            // If it's a code block with language or multiple lines
            if (match || isMultiLine) {
              return (
                <CodeBlock
                  language={match ? match[1] : undefined}
                  value={rawContent}
                  isUser={isUser}
                />
              );
            }

            // Inline code badge
            return (
              <code
                className={`px-1.5 py-0.5 mx-0.5 rounded-md font-mono text-[11px] font-medium select-text ${
                  isUser
                    ? 'bg-white/20 text-white'
                    : 'bg-amber-500/10 dark:bg-amber-400/10 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                }`}
                {...props}
              >
                {children}
              </code>
            );
          },

          // Pre wrapper bypass (handled inside CodeBlock)
          pre({ children }) {
            return <>{children}</>;
          },

          // GFM Table Responsive Wrapper with custom borders and zebra stripes
          table({ children }) {
            return (
              <div className="overflow-x-auto my-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs bg-white dark:bg-slate-900/60 select-text">
                <table className="w-full text-left border-collapse text-[11px]">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return (
              <thead
                className={`${
                  isUser
                    ? 'bg-black/20 text-white'
                    : 'bg-slate-100/90 dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 font-semibold'
                }`}
              >
                {children}
              </thead>
            );
          },
          th({ children }) {
            return (
              <th className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 font-semibold text-[11px] whitespace-nowrap">
                {children}
              </th>
            );
          },
          tbody({ children }) {
            return (
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/80">
                {children}
              </tbody>
            );
          },
          tr({ children }) {
            return (
              <tr
                className={`transition-colors ${
                  isUser
                    ? 'hover:bg-white/10'
                    : 'even:bg-slate-50/50 dark:even:bg-slate-800/30 hover:bg-amber-500/5'
                }`}
              >
                {children}
              </tr>
            );
          },
          td({ children }) {
            return (
              <td className="px-3 py-2 text-[11px] leading-relaxed align-top">
                {children}
              </td>
            );
          },

          // Typography Headings
          h1({ children }) {
            return (
              <h1 className="text-[13px] font-bold mt-3 mb-1.5 text-inherit flex items-center gap-1.5 border-b border-slate-200/50 dark:border-slate-700/50 pb-1">
                {children}
              </h1>
            );
          },
          h2({ children }) {
            return (
              <h2 className="text-xs font-bold mt-2.5 mb-1 text-inherit flex items-center gap-1">
                {children}
              </h2>
            );
          },
          h3({ children }) {
            return (
              <h3 className="text-xs font-semibold mt-2 mb-1 text-inherit">
                {children}
              </h3>
            );
          },
          h4({ children }) {
            return (
              <h4 className="text-[11px] font-semibold mt-1.5 mb-0.5 text-inherit">
                {children}
              </h4>
            );
          },

          // Paragraphs & Spacing
          p({ children }) {
            return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>;
          },

          // Lists
          ul({ children }) {
            return (
              <ul className="list-disc pl-4 space-y-1 my-1.5 marker:text-amber-500 dark:marker:text-amber-400">
                {children}
              </ul>
            );
          },
          ol({ children }) {
            return (
              <ol className="list-decimal pl-4 space-y-1 my-1.5 marker:text-amber-600 dark:marker:text-amber-400 font-medium">
                {children}
              </ol>
            );
          },
          li({ children }) {
            return <li className="leading-relaxed pl-0.5">{children}</li>;
          },

          // Blockquotes
          blockquote({ children }) {
            return (
              <blockquote
                className={`border-l-3 pl-3 my-2 italic py-1 pr-2 rounded-r-lg ${
                  isUser
                    ? 'border-white bg-black/20 text-white/90'
                    : 'border-amber-500 bg-amber-500/5 dark:bg-amber-400/5 text-slate-700 dark:text-slate-300'
                }`}
              >
                {children}
              </blockquote>
            );
          },

          // Links
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-0.5 font-medium underline underline-offset-2 transition-colors ${
                  isUser
                    ? 'text-white hover:text-amber-100'
                    : 'text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300'
                }`}
              >
                <span>{children}</span>
                <ExternalLink className="w-2.5 h-2.5 inline-block opacity-70" />
              </a>
            );
          },

          // Horizontal rule
          hr() {
            return (
              <hr
                className={`my-2.5 border-t ${
                  isUser ? 'border-white/20' : 'border-slate-200 dark:border-slate-800'
                }`}
              />
            );
          },

          // Strong & Emphasis
          strong({ children }) {
            return <strong className="font-semibold text-inherit">{children}</strong>;
          },
          em({ children }) {
            return <em className="italic text-inherit">{children}</em>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
