import { toast } from 'sonner'

export const notifyError = (message: string) => toast.error(message)

export const notifyInfo = (message: string) => toast.info(message)

export const notifyWarning = (message: string) => toast.warning(message)
