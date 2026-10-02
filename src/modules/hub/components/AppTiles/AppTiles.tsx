import type { App } from 'common/apps'
import { ArrowRight } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

interface AppTilesProps {
  apps: App[]
}

const AppTiles = ({ apps }: AppTilesProps) => (
  <div className="grid h-full grid-cols-1 gap-4 overflow-auto p-4 md:grid-cols-4">
    {apps.map(({ id, path, name, description, icon: Icon, background }) => (
      <Link
        key={id}
        href={path}
        className="group bg-card hover:border-primary relative isolate flex h-75 flex-col justify-between overflow-hidden rounded-xl border p-6 transition-colors md:h-full md:min-h-48"
      >
        <Image
          src={background}
          alt=""
          fill
          sizes="(min-width: 768px) 25vw, 100vw"
          className="-z-20 object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 -z-10 bg-linear-to-t from-black/95 via-black/90 to-black/80" />
        <div className="flex flex-col gap-4">
          <Icon className="text-mangetsu-4 size-10" />
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-2xl font-extrabold text-white">{name}</h2>
            <p className="text-sm text-white/80">{description}</p>
          </div>
        </div>
        <span className="text-mangetsu-4 flex items-center gap-1 text-sm font-medium">
          Otwórz
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </span>
      </Link>
    ))}
  </div>
)

export default AppTiles
