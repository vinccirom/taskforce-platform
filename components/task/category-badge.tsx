import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Code, Palette, FileText, TestTube, Database, Megaphone, Briefcase, Scale, Wrench, CircleHelp } from "lucide-react"

interface CategoryBadgeProps {
  category: string
  className?: string
  showIcon?: boolean
}

const categoryConfig: Record<string, { label: string; className: string; icon: any }> = {
  'development': {
    label: 'Development',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: Code
  },
  'design': {
    label: 'Design',
    className: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: Palette
  },
  'writing': {
    label: 'Writing',
    className: 'bg-green-50 text-green-700 border-green-200',
    icon: FileText
  },
  'qa-testing': {
    label: 'QA & Testing',
    className: 'bg-orange-50 text-orange-700 border-orange-200',
    icon: TestTube
  },
  'data': {
    label: 'Data',
    className: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    icon: Database
  },
  'marketing': {
    label: 'Marketing',
    className: 'bg-pink-50 text-pink-700 border-pink-200',
    icon: Megaphone
  },
  'admin': {
    label: 'Admin & Support',
    className: 'bg-gray-50 text-gray-700 border-gray-200',
    icon: Briefcase
  },
  'legal': {
    label: 'Legal & Finance',
    className: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    icon: Scale
  },
  'engineering': {
    label: 'Engineering',
    className: 'bg-red-50 text-red-700 border-red-200',
    icon: Wrench
  },
  'market-research': {
    label: 'Market Research',
    className: 'bg-teal-50 text-teal-700 border-teal-200',
    icon: CircleHelp
  }
}

export function CategoryBadge({ category, className, showIcon = true }: CategoryBadgeProps) {
  const config = categoryConfig[category] || {
    label: category,
    className: 'bg-gray-50 text-gray-700 border-gray-200',
    icon: CircleHelp
  }
  const Icon = config.icon

  return (
    <Badge
      variant="outline"
      className={cn(config.className, className)}
    >
      {showIcon && <Icon className="mr-1 h-3 w-3" />}
      {config.label}
    </Badge>
  )
}
