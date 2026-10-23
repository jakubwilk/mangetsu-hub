import { Button } from 'common/components/ui'
import { MessageSquare } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { getSession } from 'server/auth'
import { listDocuments } from 'server/rag'

import type { DocumentRow } from '../api'
import { AddSourceModal, DocumentsTable } from '../components'
import { tutorialsManifest } from '../manifest'

interface HeaderSlots {
  actions: ReactNode
  menuItems: ReactNode
}

interface DocumentsPageProps {
  header: (slots: HeaderSlots) => ReactNode
}

const DocumentsPage = async ({ header }: DocumentsPageProps) => {
  const session = await getSession()
  const isRoot = !!session?.user.isRoot
  // The proxy lets every role of the app in; managing the base is for editors only.
  if (!isRoot && session?.user.apps.tutorials !== 'EDITOR') redirect(tutorialsManifest.path)

  const documents: DocumentRow[] = (await listDocuments(tutorialsManifest.id)).map(
    ({ slug, title, category, sourceUrl, updatedAt, chunks }) => ({
      slug,
      title,
      category,
      sourceUrl,
      updatedAt: updatedAt.toISOString(),
      chunks,
    }),
  )

  return (
    <div className="flex h-full flex-col">
      {header({
        actions: (
          <>
            <Button asChild variant="ghost" className="hidden md:inline-flex">
              <Link href={tutorialsManifest.path}>
                <MessageSquare />
                Wróć do czatu
              </Link>
            </Button>
            <AddSourceModal />
          </>
        ),
        menuItems: <AddSourceModal asMenuItem />,
      })}
      <main className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto p-4 md:p-8">
        <div>
          <h1 className="text-xl font-bold text-white">Baza wiedzy</h1>
          <p className="text-muted-foreground text-sm">
            {isRoot
              ? 'Zmiany i usunięcia trafiają do bazy od razu.'
              : 'Zmiany i usunięcia trafiają do administratora — w bazie pojawią się po akceptacji.'}{' '}
            Treść dokumentów z forum poprawia się na forum.
          </p>
        </div>
        <DocumentsTable documents={documents} isRoot={isRoot} />
      </main>
    </div>
  )
}

export default DocumentsPage
