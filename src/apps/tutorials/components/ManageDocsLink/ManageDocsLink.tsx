import { Button, DropdownMenuItem } from 'common/components/ui'
import { Library } from 'lucide-react'
import Link from 'next/link'

import { tutorialsManifest } from '../../manifest'

const DOCS_PATH = `${tutorialsManifest.path}/docs`

interface ManageDocsLinkProps {
  asMenuItem?: boolean
}

const ManageDocsLink = ({ asMenuItem }: ManageDocsLinkProps) => {
  const content = (
    <Link href={DOCS_PATH}>
      <Library />
      Zarządzaj bazą wiedzy
    </Link>
  )

  return asMenuItem ? (
    <DropdownMenuItem asChild>{content}</DropdownMenuItem>
  ) : (
    <Button asChild variant="ghost" className="hidden md:inline-flex">
      {content}
    </Button>
  )
}

export default ManageDocsLink
