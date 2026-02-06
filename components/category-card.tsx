import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { Category } from "@/lib/categories"
import { ArrowRight } from "lucide-react"

interface CategoryCardProps {
  category: Category
  taskCount?: number
  href?: string
  className?: string
}

export function CategoryCard({ category, taskCount, href, className }: CategoryCardProps) {
  const Icon = category.icon

  const cardClass = cn(
    "transition-all duration-200 cursor-pointer group relative overflow-hidden",
    "bg-blue-50 border-2 border-stone-900 hover:border-primary hover:shadow-lg hover:-translate-y-1",
    "h-40 flex flex-col justify-center",
    className
  )

  const iconClass = "h-8 w-8 mb-4 text-primary relative z-10"

  const content = (
    <>
      {/* Grainy texture overlay */}
      <div
        className="absolute inset-0 opacity-40"
        style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")'}}
      />
      <CardHeader className="relative z-10">
        <Icon className={iconClass} />
        <CardTitle className="text-xl flex items-center justify-between">
          {category.label}
          <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
        </CardTitle>
      </CardHeader>
      {taskCount !== undefined && (
        <CardContent className="relative z-10">
          <p className="text-sm text-muted-foreground">
            {taskCount} {taskCount === 1 ? 'task' : 'tasks'} available
          </p>
        </CardContent>
      )}
    </>
  )

  if (href) {
    return (
      <Link href={href} className="block">
        <Card className={cardClass}>{content}</Card>
      </Link>
    )
  }

  return <Card className={cardClass}>{content}</Card>
}
