'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from 'common/components/ui'
import { useState } from 'react'

import { MobileNavBar } from '../MobileNavBar'

type Drawer = 'sidebar' | 'docs' | null

interface TutorialsShellProps {
  children: React.ReactNode
  sidebar: React.ReactNode
  sidebarDrawer: React.ReactNode
  docsPanel: React.ReactNode
  docsPanelDrawer: React.ReactNode
}

const TutorialsShell = ({
  children,
  sidebar,
  sidebarDrawer,
  docsPanel,
  docsPanelDrawer,
}: TutorialsShellProps) => {
  const [openDrawer, setOpenDrawer] = useState<Drawer>(null)

  const handleOpenChange = (drawer: Drawer) => (open: boolean) =>
    setOpenDrawer(open ? drawer : null)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="hidden md:contents">{sidebar}</div>
        <main className="flex-1 overflow-hidden">{children}</main>
        <div className="hidden md:contents">{docsPanel}</div>
      </div>

      <MobileNavBar
        onOpenSidebar={() => setOpenDrawer('sidebar')}
        onOpenDocsPanel={() => setOpenDrawer('docs')}
      />

      <Sheet open={openDrawer === 'sidebar'} onOpenChange={handleOpenChange('sidebar')}>
        <SheetContent side="left" className="bg-panel w-80 gap-0 p-0">
          <SheetHeader className="border-b">
            <SheetTitle>Historia czatów</SheetTitle>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col">{sidebarDrawer}</div>
        </SheetContent>
      </Sheet>

      <Sheet open={openDrawer === 'docs'} onOpenChange={handleOpenChange('docs')}>
        <SheetContent side="right" className="bg-panel w-96 gap-0 p-0">
          <SheetHeader className="border-b">
            <SheetTitle>Baza wiedzy</SheetTitle>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col">{docsPanelDrawer}</div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

export default TutorialsShell
