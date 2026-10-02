import './globals.css'

import { Toaster, TooltipProvider } from 'common/components/ui'
import type { Metadata } from 'next'
import { Geist_Mono, Inter, Plus_Jakarta_Sans } from 'next/font/google'

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: '--font-heading',
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

const inter = Inter({
  variable: '--font-body',
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  display: 'swap',
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Mangetsu Hub',
  description: 'Aplikacje dla forum RPG Mangetsu',
  robots: { index: false, follow: false },
}

// Dark-only: the `dark` class is fixed, there is no theme switcher.
const RootLayout = ({ children }: Readonly<{ children: React.ReactNode }>) => (
  <html
    lang="pl"
    data-scroll-behavior="smooth"
    className={`${plusJakartaSans.variable} ${inter.variable} ${geistMono.variable} dark h-full antialiased`}
  >
    <body className="h-full overflow-hidden">
      <TooltipProvider>{children}</TooltipProvider>
      <Toaster position="top-center" visibleToasts={3} duration={10000} closeButton />
    </body>
  </html>
)

export default RootLayout
