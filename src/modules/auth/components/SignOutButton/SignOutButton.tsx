'use client'

import { Button } from 'common/components/ui'
import { LogOut } from 'lucide-react'
import { signOut } from 'next-auth/react'

type SignOutButtonProps = Omit<React.ComponentProps<typeof Button>, 'onClick'>

const SignOutButton = ({ variant = 'ghost', ...props }: SignOutButtonProps) => (
  <Button variant={variant} onClick={() => signOut({ redirectTo: '/' })} {...props}>
    <LogOut />
    Wyloguj
  </Button>
)

export default SignOutButton
