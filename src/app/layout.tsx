import './globals.css'

import { Toaster, TooltipProvider } from 'common/components/ui'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mangetsu Hub',
  description: 'Aplikacje dla forum RPG Mangetsu',
  robots: { index: false, follow: false },
}

// Dark-only: the `dark` class is fixed, there is no theme switcher.
const RootLayout = ({ children }: Readonly<{ children: React.ReactNode }>) => (
  <html lang="pl" data-scroll-behavior="smooth" className="dark h-full antialiased">
    <body className="h-full overflow-hidden">
      <TooltipProvider>{children}</TooltipProvider>
      <Toaster position="top-center" visibleToasts={3} duration={10000} closeButton />
    </body>
  </html>
)

export default RootLayout
