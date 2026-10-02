'use client'

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortDirection,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { type AppId, APPS, getApp, ROOT_LABEL } from 'common/apps'
import {
  Badge,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from 'common/components/ui'
import { notifyError, notifyInfo, notifyWarning } from 'common/utils'
import { ArrowDown, ArrowUp, ArrowUpDown, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { deleteUser, updateUserAppRole } from '../../api'
import type { AdminUser } from '../../types'
import { AppRoleSelect } from '../AppRoleSelect'
import { DeleteUserModal } from '../DeleteUserModal'
import { UserCard } from '../UserCard'
import { UserIdentity } from '../UserIdentity'

const ALL = 'ALL'
const PENDING = 'PENDING'
const ROOT = 'ROOT'
const appFilter = (id: AppId) => `app:${id}`

const STATUS_OPTIONS = [
  { value: ALL, label: 'Wszyscy' },
  { value: PENDING, label: 'Oczekujący na aktywację' },
  { value: ROOT, label: 'Administratorzy' },
  ...APPS.map((app) => ({ value: appFilter(app.id), label: `Dostęp: ${app.name}` })),
]

const isPending = (user: AdminUser) => !user.isRoot && Object.keys(user.apps).length === 0

const matchesStatus = (user: AdminUser, status: string) => {
  if (status === PENDING) return isPending(user)
  if (status === ROOT) return user.isRoot
  const app = APPS.find((a) => appFilter(a.id) === status)
  if (app) return user.apps[app.id] !== undefined
  return true
}

const matchesSearch = (row: { original: AdminUser }, _columnId: string, filterValue: string) => {
  const query = filterValue.trim().toLowerCase()
  if (!query) return true
  const { name, email } = row.original
  return (name ?? '').toLowerCase().includes(query) || (email ?? '').toLowerCase().includes(query)
}

const SortIcon = ({ direction }: { direction: false | SortDirection }) => {
  if (direction === 'asc') return <ArrowUp className="size-3.5" />
  if (direction === 'desc') return <ArrowDown className="size-3.5" />
  return <ArrowUpDown className="size-3.5" />
}

interface UsersTableProps {
  users: AdminUser[]
}

const UsersTable = ({ users: initialUsers }: UsersTableProps) => {
  const [users, setUsers] = useState(initialUsers)
  const [pending, setPending] = useState<{ userId: string; app: AppId } | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(ALL)
  const [sorting, setSorting] = useState<SortingState>([])
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
  const [deleting, setDeleting] = useState(false)

  const visibleUsers = useMemo(() => users.filter((u) => matchesStatus(u, status)), [users, status])

  const pendingAppFor = (userId: string) => (pending?.userId === userId ? pending.app : null)

  const handleRoleChange = async (userId: string, appId: AppId, role: string | null) => {
    const app = getApp(appId)
    setPending({ userId, app: appId })
    try {
      const { webhookOk } = await updateUserAppRole(userId, appId, role)
      setUsers((prev) =>
        prev.map((u) => {
          if (u.id !== userId) return u
          const apps = { ...u.apps }
          if (role === null) delete apps[appId]
          else apps[appId] = role
          return { ...u, apps }
        }),
      )
      const label = app.roles.find((r) => r.id === role)?.label ?? 'brak dostępu'
      notifyInfo(`${app.name}: zmieniono rolę na „${label}”.`)
      if (!webhookOk) {
        notifyWarning('Rola została zmieniona, ale powiadomienie webhooka nie zostało wysłane.')
      }
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Nie udało się zmienić roli.')
    } finally {
      setPending(null)
    }
  }

  const handleDeleteConfirm = async (userId: string, notify: boolean) => {
    setDeleting(true)
    try {
      const { webhookOk } = await deleteUser(userId, notify)
      setUsers((prev) => prev.filter((u) => u.id !== userId))
      notifyInfo('Użytkownik został usunięty.')
      if (!webhookOk) {
        notifyWarning('Użytkownik został usunięty, ale powiadomienie webhooka nie zostało wysłane.')
      }
      setDeleteTarget(null)
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Nie udało się usunąć użytkownika.')
    } finally {
      setDeleting(false)
    }
  }

  const columns: ColumnDef<AdminUser>[] = [
    {
      id: 'name',
      header: 'Użytkownik',
      accessorFn: (u) => u.name ?? u.email ?? '',
      sortingFn: 'text',
      cell: ({ row }) => <UserIdentity user={row.original} />,
    },
    ...APPS.map((app): ColumnDef<AdminUser> => ({
      id: `app-${app.id}`,
      header: app.name,
      enableSorting: false,
      cell: ({ row }) => {
        const user = row.original
        if (user.isRoot) return <Badge>{ROOT_LABEL}</Badge>
        return (
          <AppRoleSelect
            app={app}
            value={user.apps[app.id]}
            disabled={pendingAppFor(user.id) === app.id}
            onChange={(role) => handleRoleChange(user.id, app.id, role)}
          />
        )
      },
    })),
    {
      id: 'createdAt',
      header: 'Dołączył',
      accessorFn: (u) => u.createdAt,
      sortingFn: 'datetime',
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {new Date(row.original.createdAt).toLocaleDateString('pl-PL')}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Akcje',
      enableSorting: false,
      cell: ({ row }) =>
        row.original.isRoot ? null : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteTarget(row.original)}
                aria-label="Usuń użytkownika"
              >
                <Trash2 className="text-destructive" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Usuń użytkownika</TooltipContent>
          </Tooltip>
        ),
    },
  ]

  const table = useReactTable({
    data: visibleUsers,
    columns,
    state: { sorting, globalFilter: search },
    onSortingChange: setSorting,
    onGlobalFilterChange: setSearch,
    globalFilterFn: matchesSearch,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const rows = table.getRowModel().rows

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            placeholder="Szukaj po imieniu lub e-mailu…"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            className="pl-8"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-60" aria-label="Filtr statusu">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.column.getCanSort() ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="flex items-center gap-1 select-none"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <SortIcon direction={header.column.getIsSorted()} />
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-2 md:hidden">
        {rows.map(({ original: user }) => (
          <UserCard
            key={user.id}
            user={user}
            pendingApp={pendingAppFor(user.id)}
            onRoleChange={(app, role) => handleRoleChange(user.id, app, role)}
            onDelete={() => setDeleteTarget(user)}
          />
        ))}
      </div>

      {rows.length === 0 && (
        <p className="text-muted-foreground py-4 text-center text-sm">Brak wyników.</p>
      )}

      <DeleteUserModal
        key={deleteTarget?.id}
        user={deleteTarget}
        loading={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
}

export default UsersTable
