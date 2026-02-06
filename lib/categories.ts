import { Code, Palette, FileText, TestTube, Database, Megaphone, Briefcase, Scale, Wrench, CircleHelp } from "lucide-react"
import type { LucideIcon } from "lucide-react"

export interface Category {
  id: string
  label: string
  description: string
  icon: LucideIcon
  color: string
  suggestedSkills: string[]
}

export const CATEGORIES: Record<string, Category> = {
  'development': {
    id: 'development',
    label: 'Development & IT',
    description: 'Web development, mobile apps, APIs, blockchain, and software engineering',
    icon: Code,
    color: 'blue',
    suggestedSkills: [
      'react',
      'typescript',
      'nodejs',
      'python',
      'javascript',
      'nextjs',
      'api-development',
      'full-stack',
      'frontend',
      'backend'
    ]
  },
  'design': {
    id: 'design',
    label: 'Design & Creative',
    description: 'UI/UX design, graphic design, branding, and visual content',
    icon: Palette,
    color: 'purple',
    suggestedSkills: [
      'figma',
      'ui-design',
      'ux-design',
      'graphic-design',
      'branding',
      'logo-design',
      'illustration',
      'photoshop',
      'sketch',
      'adobe-xd'
    ]
  },
  'writing': {
    id: 'writing',
    label: 'Writing & Translation',
    description: 'Content writing, copywriting, technical documentation, and translation',
    icon: FileText,
    color: 'green',
    suggestedSkills: [
      'content-writing',
      'copywriting',
      'technical-writing',
      'blog-writing',
      'seo-writing',
      'documentation',
      'editing',
      'proofreading',
      'translation',
      'creative-writing'
    ]
  },
  'qa-testing': {
    id: 'qa-testing',
    label: 'QA & Testing',
    description: 'Manual testing, automation, security audits, and quality assurance',
    icon: TestTube,
    color: 'orange',
    suggestedSkills: [
      'manual-testing',
      'automation-testing',
      'qa',
      'bug-testing',
      'regression-testing',
      'security-testing',
      'api-testing',
      'selenium',
      'cypress',
      'jest'
    ]
  },
  'data': {
    id: 'data',
    label: 'Data',
    description: 'Data analysis, scraping, annotation, processing, and visualization',
    icon: Database,
    color: 'cyan',
    suggestedSkills: [
      'data-analysis',
      'data-scraping',
      'data-annotation',
      'excel',
      'sql',
      'python',
      'pandas',
      'data-visualization',
      'data-entry',
      'data-cleaning'
    ]
  },
  'marketing': {
    id: 'marketing',
    label: 'Marketing',
    description: 'Social media, SEO, content strategy, and digital marketing',
    icon: Megaphone,
    color: 'pink',
    suggestedSkills: [
      'social-media',
      'seo',
      'content-strategy',
      'email-marketing',
      'digital-marketing',
      'facebook-ads',
      'google-ads',
      'instagram',
      'twitter',
      'linkedin'
    ]
  },
  'admin': {
    id: 'admin',
    label: 'Admin & Support',
    description: 'Virtual assistance, customer service, and administrative tasks',
    icon: Briefcase,
    color: 'gray',
    suggestedSkills: [
      'virtual-assistant',
      'customer-service',
      'data-entry',
      'email-management',
      'scheduling',
      'research',
      'administrative-support',
      'chat-support',
      'phone-support',
      'crm'
    ]
  },
  'legal': {
    id: 'legal',
    label: 'Legal & Finance',
    description: 'Contracts, accounting, compliance, and financial services',
    icon: Scale,
    color: 'indigo',
    suggestedSkills: [
      'contract-review',
      'legal-research',
      'accounting',
      'bookkeeping',
      'compliance',
      'tax-preparation',
      'financial-analysis',
      'quickbooks',
      'legal-writing',
      'paralegal'
    ]
  },
  'engineering': {
    id: 'engineering',
    label: 'Engineering',
    description: 'Hardware, embedded systems, architecture, and technical engineering',
    icon: Wrench,
    color: 'red',
    suggestedSkills: [
      'hardware-design',
      'embedded-systems',
      'cad',
      'solidworks',
      'circuit-design',
      'pcb-design',
      'mechanical-engineering',
      'electrical-engineering',
      '3d-modeling',
      'prototyping'
    ]
  },
  'market-research': {
    id: 'market-research',
    label: 'Market Research',
    description: 'Market validation, user research, surveys, and competitive analysis',
    icon: CircleHelp,
    color: 'teal',
    suggestedSkills: [
      'market-research',
      'user-research',
      'surveys',
      'competitive-analysis',
      'user-interviews',
      'market-validation',
      'focus-groups',
      'persona-development',
      'research-analysis',
      'reporting'
    ]
  }
}

export const CATEGORY_LIST = Object.values(CATEGORIES)

export function getCategoryById(id: string): Category | undefined {
  return CATEGORIES[id]
}

export function getCategoryColor(categoryId: string): string {
  const category = CATEGORIES[categoryId]
  return category?.color || 'gray'
}

export function getCategoryIcon(categoryId: string): LucideIcon {
  const category = CATEGORIES[categoryId]
  return category?.icon || CircleHelp
}

export function getCategoryLabel(categoryId: string): string {
  const category = CATEGORIES[categoryId]
  return category?.label || categoryId
}

// Helper to get Tailwind classes for category colors
export function getCategoryColorClasses(categoryId: string): {
  bg: string
  text: string
  border: string
} {
  const color = getCategoryColor(categoryId)

  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    green: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
    cyan: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
    pink: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
    gray: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
    red: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
    teal: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' }
  }

  return colorMap[color] || colorMap.gray
}
