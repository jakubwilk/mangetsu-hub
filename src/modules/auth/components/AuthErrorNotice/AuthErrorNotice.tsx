'use client'

import { notifyError } from 'common/utils'
import { useEffect } from 'react'

const ERROR_MESSAGES: Record<string, string> = {
  Configuration: 'Błąd konfiguracji serwera logowania. Skontaktuj się z administratorem.',
  AccessDenied: 'Odmowa dostępu. Nie masz uprawnień, aby się zalogować.',
  OAuthAccountNotLinked: 'To konto Discord jest już powiązane z innym sposobem logowania.',
  Verification: 'Link weryfikacyjny wygasł lub został już użyty.',
  Default: 'Wystąpił błąd podczas logowania. Spróbuj ponownie.',
}

interface AuthErrorNoticeProps {
  error: string
}

const AuthErrorNotice = ({ error }: AuthErrorNoticeProps) => {
  useEffect(() => {
    notifyError(ERROR_MESSAGES[error] ?? ERROR_MESSAGES.Default)
  }, [error])

  return null
}

export default AuthErrorNotice
