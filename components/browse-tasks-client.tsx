"use client"

import { TaskCard } from "@/components/task/task-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Search, Filter, Inbox, SlidersHorizontal } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useTransition } from "react"

interface Task {
  id: string
  title: string
  description: string
  category: string
  status: string
  totalBudget: number
  paymentPerWorker: number | null
  maxWorkers: number
  currentWorkers: number
  deadline: Date | null
}

interface BrowseTasksClientProps {
  tasks: Task[]
  applicationMap: Map<string, string>
}

export function BrowseTasksClient({ tasks, applicationMap }: BrowseTasksClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  const category = searchParams.get('category') || 'all'
  const search = searchParams.get('search') || ''
  const minPayment = searchParams.get('minPayment') || 'all'
  const sortBy = searchParams.get('sortBy') || 'newest'

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'all' || value === '') {
      params.delete(key)
    } else {
      params.set(key, value)
    }

    startTransition(() => {
      router.push(`?${params.toString()}`)
    })
  }

  const handleSearchChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === '') {
      params.delete('search')
    } else {
      params.set('search', value)
    }

    startTransition(() => {
      router.push(`?${params.toString()}`)
    })
  }

  const FilterContent = () => (
    <div className="grid gap-4 md:grid-cols-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Search</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            defaultValue={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Category</label>
        <Select
          value={category}
          onValueChange={(value) => handleFilterChange('category', value)}
        >
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
        <label className="text-sm font-medium">Min. Payment</label>
        <Select
          value={minPayment}
          onValueChange={(value) => handleFilterChange('minPayment', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Any amount" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any Amount</SelectItem>
            <SelectItem value="5">$5+ USDC</SelectItem>
            <SelectItem value="10">$10+ USDC</SelectItem>
            <SelectItem value="15">$15+ USDC</SelectItem>
            <SelectItem value="20">$20+ USDC</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Sort By</label>
        <Select
          value={sortBy}
          onValueChange={(value) => handleFilterChange('sortBy', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="payment-high">Highest Pay</SelectItem>
            <SelectItem value="payment-low">Lowest Pay</SelectItem>
            <SelectItem value="deadline">Deadline Soon</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Filters */}
      <Card className="mb-6 hidden md:block">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FilterContent />
        </CardContent>
      </Card>

      {/* Mobile Filters */}
      <div className="mb-6 md:hidden">
        <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="w-full">
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80vh]">
            <SheetHeader>
              <SheetTitle>Filter Tasks</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-4">
              <FilterContent />
              <Button
                className="w-full"
                onClick={() => setIsFilterOpen(false)}
              >
                Apply Filters
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Results Count */}
      <div className="mb-4 text-sm text-muted-foreground">
        {isPending ? (
          <span>Loading...</span>
        ) : (
          <>
            Found {tasks.length} available task{tasks.length !== 1 ? 's' : ''}
            {search && ` matching "${search}"`}
          </>
        )}
      </div>

      {/* Tasks Grid */}
      {tasks.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {tasks.map((task) => {
            const applicationStatus = applicationMap.get(task.id)
            const hasApplied = applicationStatus !== undefined

            return (
              <div key={task.id} className="relative">
                <TaskCard
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
                  view="agent"
                  className="transition-all duration-200 hover:border-primary/50 hover:shadow-xl hover:-translate-y-2"
                />
                {hasApplied && (
                  <div className="absolute top-6 right-6">
                    <Badge variant="success" className="shadow-lg">
                      {applicationStatus}
                    </Badge>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <div className="mb-4 rounded-full bg-muted/50 p-6">
            <Inbox className="h-12 w-12 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold font-grotesk mb-2">
            No Tasks Found
          </h3>
          <p className="text-sm text-muted-foreground max-w-md">
            {search
              ? "No tasks match your search criteria. Try adjusting your filters."
              : "Check back later for new task opportunities."}
          </p>
        </div>
      )}
    </>
  )
}
