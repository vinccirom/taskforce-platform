import { requireAuth } from "@/components/auth/role-guard"
import { prisma } from "@/lib/prisma"
import { AppShell } from "@/components/layouts/app-shell"
import { TaskCard } from "@/components/task/task-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Plus, Search } from "lucide-react"
import { TaskStatus } from "@prisma/client"

interface SearchParams {
  status?: string
  category?: string
  search?: string
  page?: string
}

export default async function TasksListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const session = await requireAuth()
  const params = await searchParams

  const status = params.status as TaskStatus | undefined
  const category = params.category || ''
  const search = params.search || ''
  const page = parseInt(params.page || '1')
  const pageSize = 12

  // Build query filters
  const where: any = {
    creatorId: session.user.id,
  }

  if (status) {
    where.status = status
  }

  if (category && category !== 'all') {
    where.category = category
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ]
  }

  // Fetch tasks with pagination
  const [tasks, totalCount] = await Promise.all([
    prisma.task.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        _count: {
          select: {
            applications: true,
            submissions: true
          }
        }
      }
    }),
    prisma.task.count({ where })
  ])

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold md:text-4xl">My Tasks</h1>
            <p className="mt-2 text-muted-foreground">
              Manage all your tasks
            </p>
          </div>
          <Button asChild>
            <Link href="/new-task">
              <Plus className="mr-2 h-4 w-4" />
              Create Task
            </Link>
          </Button>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select name="status" defaultValue={status || 'all'}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <Select name="category" defaultValue={category || 'all'}>
                  <SelectTrigger>
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="development">Development</SelectItem>
                    <SelectItem value="design">Design</SelectItem>
                    <SelectItem value="qa-testing">QA & Testing</SelectItem>
                    <SelectItem value="writing">Writing</SelectItem>
                    <SelectItem value="data-analysis">Data Analysis</SelectItem>
                    <SelectItem value="research">Research</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="translation">Translation</SelectItem>
                    <SelectItem value="customer-support">Customer Support</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    name="search"
                    placeholder="Search tasks..."
                    defaultValue={search}
                    className="pl-9"
                  />
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Results Count */}
        <div className="mb-4 text-sm text-muted-foreground">
          Showing {tasks.length} of {totalCount} task{totalCount !== 1 ? 's' : ''}
          {search && ` matching "${search}"`}
        </div>

        {/* Tasks Grid */}
        {tasks.length > 0 ? (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={{
                    id: task.id,
                    title: task.title,
                    description: task.description,
                    category: task.category,
                    status: task.status as any,
                    totalBudget: task.totalBudget,
                    paymentPerWorker: task.paymentPerWorker ?? undefined,
                    maxWorkers: task.maxWorkers,
                    currentWorkers: task.currentWorkers,
                    deadline: task.deadline
                  }}
                  view="creator"
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                {page > 1 && (
                  <Button variant="outline" asChild>
                    <Link href={`/tasks?page=${page - 1}${status ? `&status=${status}` : ''}${category && category !== 'all' ? `&category=${category}` : ''}${search ? `&search=${search}` : ''}`}>
                      Previous
                    </Link>
                  </Button>
                )}

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const pageNum = i + 1
                    return (
                      <Button
                        key={pageNum}
                        variant={page === pageNum ? "default" : "outline"}
                        size="sm"
                        asChild
                      >
                        <Link href={`/tasks?page=${pageNum}${status ? `&status=${status}` : ''}${category && category !== 'all' ? `&category=${category}` : ''}${search ? `&search=${search}` : ''}`}>
                          {pageNum}
                        </Link>
                      </Button>
                    )
                  })}
                  {totalPages > 5 && <span className="px-2">...</span>}
                </div>

                {page < totalPages && (
                  <Button variant="outline" asChild>
                    <Link href={`/tasks?page=${page + 1}${status ? `&status=${status}` : ''}${category && category !== 'all' ? `&category=${category}` : ''}${search ? `&search=${search}` : ''}`}>
                      Next
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </>
        ) : (
          <Card className="text-center py-12">
            <CardHeader>
              <CardTitle>No Tasks Found</CardTitle>
              <CardDescription>
                {search ? `No tasks match "${search}"` : "You haven't created any tasks yet"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!search && (
                <Button asChild>
                  <Link href="/new-task">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Your First Task
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
