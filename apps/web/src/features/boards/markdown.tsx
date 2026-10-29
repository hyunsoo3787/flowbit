import type { UserSummary } from '@flowbit/shared';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toMarkdown } from '@/features/cards/mentions';

const MENTION_PREFIX = 'mention:';

/**
 * Renders user Markdown. Raw HTML is not rendered (react-markdown's default),
 * so card descriptions can't inject markup or scripts. With `people`,
 * mentions (<@userId>) are shown as highlighted names.
 */
export function Markdown({
  children,
  people,
}: {
  children: string;
  people?: Pick<UserSummary, 'id' | 'name'>[];
}) {
  return (
    <div className="grid gap-2 text-sm leading-relaxed break-words [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_table]:border-collapse [&_td]:border [&_td]:px-2 [&_th]:border [&_th]:px-2 [&_ul]:list-disc">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => (url.startsWith(MENTION_PREFIX) ? url : defaultUrlTransform(url))}
        components={{
          a: ({ node: _node, href, children: text, ...props }) =>
            href?.startsWith(MENTION_PREFIX) ? (
              <span className="rounded bg-primary/10 px-1 font-medium text-primary">{text}</span>
            ) : (
              <a href={href} {...props} target="_blank" rel="noopener noreferrer nofollow">
                {text}
              </a>
            ),
        }}
      >
        {people ? toMarkdown(children, people) : children}
      </ReactMarkdown>
    </div>
  );
}
