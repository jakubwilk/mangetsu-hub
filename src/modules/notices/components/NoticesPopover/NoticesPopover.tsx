'use client'

import { cn } from 'cn'
import { Button, Popover, PopoverContent, PopoverTrigger } from 'common/components/ui'
import { Bell, Info, TriangleAlert, X } from 'lucide-react'
import { useEffect, useSyncExternalStore } from 'react'

import { dismissedNoticesStore } from '../../store'
import type { Notice } from '../../types'

const NOTICE_STYLE: Record<Notice['type'], string> = {
  info: 'border-[#6a7dad]/40 bg-[#6a7dad]/10 [&_svg]:text-[#8a9bd0]',
  warning: 'border-[#b0896b]/40 bg-[#b0896b]/10 [&_svg]:text-[#d0a684]',
}

interface NoticesPopoverProps {
  notices: Notice[]
}

const NoticesPopover = ({ notices }: NoticesPopoverProps) => {
  const dismissed = useSyncExternalStore(
    dismissedNoticesStore.subscribe,
    dismissedNoticesStore.getSnapshot,
    dismissedNoticesStore.getServerSnapshot,
  )

  const active = notices.filter((n) => !dismissed.includes(n.id))

  useEffect(() => {
    dismissedNoticesStore.init()
  }, [])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-lg" aria-label="Ogłoszenia" className="relative">
          <Bell className="size-5" />
          {active.length > 0 && (
            <span className="bg-destructive absolute top-1 right-1 flex size-4 items-center justify-center rounded-full text-[0.65rem] font-semibold text-white">
              {active.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[min(360px,calc(100vw-2rem))] gap-0 p-0">
        <div className="border-b px-4 py-2.5 text-sm font-semibold">Ogłoszenia</div>

        {notices.length === 0 ? (
          <p className="text-muted-foreground p-4 text-sm">Brak ogłoszeń.</p>
        ) : active.length === 0 ? (
          <div className="flex flex-col gap-2 p-4">
            <p className="text-muted-foreground text-sm">Wszystkie ogłoszenia zostały odrzucone.</p>
            <Button variant="ghost" size="sm" onClick={dismissedNoticesStore.reset}>
              Pokaż wszystkie
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 p-3">
            {active.map((notice) => (
              <div
                key={notice.id}
                className={cn('flex gap-3 rounded-md border p-3', NOTICE_STYLE[notice.type])}
              >
                {notice.type === 'warning' ? (
                  <TriangleAlert className="mt-0.5 size-5 shrink-0" />
                ) : (
                  <Info className="mt-0.5 size-5 shrink-0" />
                )}
                <p className="flex-1 text-sm leading-relaxed">{notice.message}</p>
                <button
                  type="button"
                  onClick={() => dismissedNoticesStore.dismiss(notice.id)}
                  aria-label="Odrzuć ogłoszenie"
                  className="text-muted-foreground h-fit hover:text-white"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}

            {dismissed.length > 0 && (
              <Button variant="ghost" size="sm" onClick={dismissedNoticesStore.reset}>
                Pokaż odrzucone ({dismissed.length})
              </Button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

export default NoticesPopover
