import { getRagCategories } from 'apps'
import { cn } from 'cn'

import { tutorialsManifest } from '../../manifest'

interface KnowledgeDocument {
  title: string
  category: string
  sourceUrl: string | null
}

interface DocsPanelProps {
  documents: KnowledgeDocument[]
  fluid?: boolean
}

const DocsPanel = ({ documents, fluid = false }: DocsPanelProps) => {
  const groups = getRagCategories(tutorialsManifest.id)
    .map((category) => ({
      ...category,
      documents: documents
        .filter((document) => document.category === category.id)
        .sort((a, b) => a.title.localeCompare(b.title, 'pl')),
    }))
    .filter((group) => group.documents.length > 0)

  return (
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

      <div className="prose prose-sm prose-invert prose-a:text-mangetsu-4 min-h-0 flex-1 overflow-y-auto p-4">
        <p>
          System posiada wiedzę wyłącznie z poniższych dokumentów (odnośniki do forum otwierają się
          w tej samej karcie, co aplikacja):
        </p>
        {groups.map((group) => (
          <div key={group.id}>
            <p>
              <strong>{group.label}</strong>
            </p>
            <ul>
              {group.documents.map((document) => (
                <li key={document.title}>
                  {document.sourceUrl ? (
                    <a href={document.sourceUrl}>{document.title}</a>
                  ) : (
                    document.title
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </aside>
  )
}

export default DocsPanel
