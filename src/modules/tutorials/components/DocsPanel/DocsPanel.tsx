import { cn } from 'cn'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface DocsPanelProps {
  content: string
  fluid?: boolean
}

const DocsPanel = ({ content, fluid = false }: DocsPanelProps) => (
  <aside
    className={cn(
      'bg-panel flex flex-col overflow-hidden',
      fluid ? 'flex-1' : 'w-[20vw] max-w-75 shrink-0 border-l',
    )}
  >
    {!fluid && (
      <div className="text-muted-foreground shrink-0 border-b px-4 py-2.5 text-sm font-semibold select-none">
        Baza wiedzy
      </div>
    )}

    <div className="prose prose-sm prose-invert prose-a:text-mangetsu-4 prose-table:block prose-table:overflow-x-auto min-h-0 flex-1 overflow-y-auto p-4">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  </aside>
)

export default DocsPanel
