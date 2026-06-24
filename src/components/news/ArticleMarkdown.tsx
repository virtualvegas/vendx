import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { slugify } from "@/lib/newsHelpers";
import { cn } from "@/lib/utils";

interface Props {
  content: string;
  className?: string;
}

/**
 * Shared Markdown renderer for article bodies and the admin preview.
 * Auto-IDs `##`/`###` headings so the TOC scroll-spy can target them.
 */
const ArticleMarkdown = ({ content, className }: Props) => {
  return (
    <div
      className={cn(
        "prose prose-lg max-w-none dark:prose-invert",
        "prose-headings:scroll-mt-28 prose-headings:font-bold",
        "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
        "prose-img:rounded-lg prose-img:my-6",
        "prose-blockquote:border-l-primary prose-blockquote:bg-primary/5",
        "prose-code:before:content-none prose-code:after:content-none",
        "prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm",
        "prose-pre:bg-muted prose-pre:border prose-pre:border-border",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children, ...rest }) => {
            const text = String(children);
            return (
              <h2 id={slugify(text)} {...rest}>
                {children}
              </h2>
            );
          },
          h3: ({ children, ...rest }) => {
            const text = String(children);
            return (
              <h3 id={slugify(text)} {...rest}>
                {children}
              </h3>
            );
          },
          a: ({ children, href, ...rest }) => (
            <a
              href={href}
              target={href?.startsWith("http") ? "_blank" : undefined}
              rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
              {...rest}
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default ArticleMarkdown;
