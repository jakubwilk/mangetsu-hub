'use client'

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'common/components/ui'
import { ChevronDown, ExternalLink, LogOut, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { signOut } from 'next-auth/react'

interface UserMenuProps {
  name: string | null
  image: string | null
  subtitle?: string
  isRoot: boolean
  forumUrl?: string
  // Mobile-only items: on desktop the same actions sit directly in the header.
  children?: React.ReactNode
}

const UserMenu = ({ name, image, subtitle, isRoot, forumUrl, children }: UserMenuProps) => {
  const displayName = name ?? 'Użytkownik'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="hover:bg-accent flex items-center gap-2 rounded-md px-2 py-1.5 outline-none">
        <Avatar className="size-7">
          {image && <AvatarImage src={image} alt={displayName} />}
          <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="flex max-w-30 min-w-0 flex-col text-left leading-tight">
          <span className="truncate text-sm font-medium text-white">{displayName}</span>
          {subtitle && <span className="text-muted-foreground truncate text-xs">{subtitle}</span>}
        </span>
        <ChevronDown className="text-muted-foreground size-3.5" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-52">
        {(children || forumUrl) && (
          <DropdownMenuGroup className="md:hidden">
            {children}
            {forumUrl && (
              <DropdownMenuItem asChild>
                <a href={forumUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink />
                  Przejdź na forum
                </a>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
          </DropdownMenuGroup>
        )}
        {isRoot && (
          <>
            <DropdownMenuItem asChild>
              <Link href="/admin">
                <ShieldCheck />
                Panel administracyjny
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem variant="destructive" onSelect={() => signOut({ redirectTo: '/' })}>
          <LogOut />
          Wyloguj
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default UserMenu
