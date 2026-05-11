import { useState, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MarkdownMessageProps {
  content: string;
  className?: string;
  compact?: boolean;
  showCopy?: boolean;
}

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onCopy}
      className={cn('h-6 w-6 opacity-70 hover:opacity-100', className)}
      title={copied ? 'Copied!' : 'Copy'}
    >
      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
    </Button>
  );
}

export const MarkdownMessage = memo(function MarkdownMessage({
  content,
  className,
  compact = false,
  showCopy = true,
}: MarkdownMessageProps) {
  const proseSize = compact ? 'prose-xs' : 'prose-sm';
  return (
    <div className={cn('relative group', className)}>
      {showCopy && (
        <CopyButton
          text={content}
          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur z-10"
        />
      )}
      <div
        className={cn(
          'prose prose-invert max-w-none',
          proseSize,
          // Headings
          '[&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-2 [&_h1]:text-primary',
          '[&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:text-primary/90 [&_h2]:border-b [&_h2]:border-border/50 [&_h2]:pb-1',
          '[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-foreground',
          '[&_h4]:text-xs [&_h4]:font-semibold [&_h4]:mt-2 [&_h4]:mb-0.5',
          // Paragraphs & text
          '[&_p]:mb-2 [&_p]:leading-relaxed',
          '[&_strong]:text-primary [&_strong]:font-semibold',
          '[&_em]:text-foreground/90',
          // Lists
          '[&_ul]:mb-2 [&_ul]:pl-4 [&_ul]:space-y-0.5 [&_ul>li]:list-disc [&_ul>li]:marker:text-primary/60',
          '[&_ol]:mb-2 [&_ol]:pl-4 [&_ol]:space-y-0.5 [&_ol>li]:list-decimal [&_ol>li]:marker:text-primary/60',
          '[&_li]:leading-relaxed',
          // Code
          '[&_code]:text-[0.85em] [&_code]:bg-muted/60 [&_code]:border [&_code]:border-border/50 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-primary [&_code]:font-mono',
          '[&_pre]:bg-muted/40 [&_pre]:border [&_pre]:border-border [&_pre]:rounded-lg [&_pre]:p-2.5 [&_pre]:my-2 [&_pre]:overflow-x-auto',
          '[&_pre_code]:bg-transparent [&_pre_code]:border-0 [&_pre_code]:p-0 [&_pre_code]:text-foreground',
          // Blockquotes
          '[&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_blockquote]:my-2',
          // Tables (responsive: horizontal scroll on overflow)
          'break-words',
          '[&_table]:w-full [&_table]:my-2 [&_table]:border-collapse [&_table]:text-[0.8em] sm:[&_table]:text-[0.85em] [&_table]:rounded-md [&_table]:border [&_table]:border-border [&_table]:block sm:[&_table]:table [&_table]:overflow-x-auto [&_table]:whitespace-nowrap sm:[&_table]:whitespace-normal',
          '[&_thead]:bg-primary/10',
          '[&_th]:px-1.5 sm:[&_th]:px-2 [&_th]:py-1 sm:[&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold [&_th]:text-primary [&_th]:border-b [&_th]:border-border',
          '[&_td]:px-1.5 sm:[&_td]:px-2 [&_td]:py-1 sm:[&_td]:py-1.5 [&_td]:border-b [&_td]:border-border/50',
          '[&_tbody_tr:hover]:bg-muted/30',
          '[&_tbody_tr:last-child_td]:border-b-0',
          // Prevent code/pre overflow on small screens
          '[&_pre]:max-w-full [&_pre]:whitespace-pre [&_pre]:overflow-x-auto',
          '[&_code]:break-words',
          // Horizontal rule
          '[&_hr]:my-3 [&_hr]:border-border',
          // Links
          '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-primary/80',
        )}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </div>
  );
});
