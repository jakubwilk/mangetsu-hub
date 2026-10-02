import Link from 'next/link'

import { Logo } from '../Logo'
import { Separator } from '../ui'

interface AppHeaderProps {
  title?: string
  children?: React.ReactNode
}

const AppHeader = ({ title, children }: AppHeaderProps) => (
  <header className="bg-panel flex h-15 shrink-0 items-center justify-between gap-2 border-b px-4">
    <div className="flex min-w-0 items-center gap-3">
      <Link href="/" aria-label="Strona główna">
        <Logo />
      </Link>
      {title && (
        <>
          <Separator orientation="vertical" className="h-6" />
          <span className="text-muted-foreground truncate text-sm font-semibold">{title}</span>
        </>
      )}
    </div>
    <div className="flex items-center gap-1">{children}</div>
  </header>
)

export default AppHeader
