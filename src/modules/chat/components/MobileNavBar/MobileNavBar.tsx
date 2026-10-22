import { BookOpen, History } from 'lucide-react'

interface MobileNavBarProps {
  onOpenSidebar: () => void
  onOpenDocsPanel: () => void
}

const NAV_BUTTON = 'text-muted-foreground flex flex-col items-center gap-1 px-8 py-1 text-xs'

const MobileNavBar = ({ onOpenSidebar, onOpenDocsPanel }: MobileNavBarProps) => (
  <nav className="bg-panel flex shrink-0 justify-around border-t py-2 md:hidden">
    <button type="button" onClick={onOpenSidebar} className={NAV_BUTTON}>
      <History className="size-5" />
      Historia
    </button>
    <button type="button" onClick={onOpenDocsPanel} className={NAV_BUTTON}>
      <BookOpen className="size-5" />
      Baza wiedzy
    </button>
  </nav>
)

export default MobileNavBar
