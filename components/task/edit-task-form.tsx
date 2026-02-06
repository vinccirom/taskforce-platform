"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  AlertCircle,
  ArrowLeft,
  Calendar as CalendarIcon,
  Lock,
  Plus,
  Save,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { toast } from "sonner"
import Link from "next/link"

const CATEGORIES = [
  { value: "development", label: "Development" },
  { value: "design", label: "Design" },
  { value: "qa-testing", label: "QA & Testing" },
  { value: "writing", label: "Writing" },
  { value: "data-analysis", label: "Data Analysis" },
  { value: "research", label: "Research" },
  { value: "marketing", label: "Marketing" },
  { value: "translation", label: "Translation" },
  { value: "customer-support", label: "Customer Support" },
  { value: "other", label: "Other" },
]

interface MilestoneInput {
  title: string
  description: string
  percentage: number
}

interface TaskData {
  id: string
  title: string
  description: string
  referenceUrl: string
  credentials: string
  requirements: string
  category: string
  skillsRequired: string[]
  totalBudget: number
  paymentType: string
  paymentPerWorker: number
  maxWorkers: number
  deadline: string | null
  milestones: MilestoneInput[]
}

interface EditTaskFormProps {
  task: TaskData
  isDraft: boolean
}

export function EditTaskForm({ task, isDraft }: EditTaskFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Form state
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description)
  const [referenceUrl, setReferenceUrl] = useState(task.referenceUrl)
  const [credentials, setCredentials] = useState(task.credentials)
  const [requirements, setRequirements] = useState(task.requirements)
  const [category, setCategory] = useState(task.category)
  const [skillsRequired, setSkillsRequired] = useState(
    task.skillsRequired.join(", ")
  )
  const [totalBudget, setTotalBudget] = useState(task.totalBudget)
  const [paymentType, setPaymentType] = useState(task.paymentType)
  const [paymentPerWorker, setPaymentPerWorker] = useState(task.paymentPerWorker)
  const [maxWorkers, setMaxWorkers] = useState(task.maxWorkers)
  const [deadline, setDeadline] = useState<Date | undefined>(
    task.deadline ? new Date(task.deadline) : undefined
  )
  const [milestones, setMilestones] = useState<MilestoneInput[]>(task.milestones)

  const milestoneTotalPct = milestones.reduce((s, m) => s + (m.percentage || 0), 0)

  const addMilestone = () =>
    setMilestones((prev) => [...prev, { title: "", description: "", percentage: 0 }])

  const updateMilestone = (i: number, field: keyof MilestoneInput, value: any) =>
    setMilestones((prev) => {
      const copy = [...prev]
      copy[i] = { ...copy[i], [field]: value }
      return copy
    })

  const removeMilestone = (i: number) =>
    setMilestones((prev) => prev.filter((_, idx) => idx !== i))

  const handleSubmit = async () => {
    setLoading(true)
    setError("")

    try {
      const payload: any = {
        title,
        description,
        referenceUrl: referenceUrl || undefined,
        credentials: credentials || undefined,
        requirements,
        skillsRequired: skillsRequired
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        deadline: deadline?.toISOString() || null,
      }

      // Draft-only fields
      if (isDraft) {
        payload.category = category
        payload.totalBudget = totalBudget
        payload.paymentType = paymentType
        payload.paymentPerWorker = paymentPerWorker
        payload.maxWorkers = maxWorkers

        if (paymentType === "MILESTONE") {
          payload.milestones = milestones.map((m, i) => ({
            title: m.title,
            description: m.description || undefined,
            percentage: m.percentage,
          }))
        } else {
          payload.milestones = []
        }
      }

      const res = await fetch(`/api/creator/tasks/${task.id}/edit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to update task")
      }

      toast.success("Task updated successfully!")
      router.push(`/tasks/${task.id}`)
      router.refresh()
    } catch (err: any) {
      setError(err.message || "Failed to update task")
    } finally {
      setLoading(false)
    }
  }

  const LockedField = ({ label }: { label: string }) => (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Lock className="h-3 w-3" />
      <span>{label} — locked after activation (funds in escrow)</span>
    </div>
  )

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" asChild className="mb-4">
          <Link href={`/tasks/${task.id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Task
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Edit Task</h1>
        <div className="mt-2 flex items-center gap-2">
          <p className="text-muted-foreground">
            {isDraft
              ? "All fields are editable for draft tasks."
              : "Some fields are locked because this task is active."}
          </p>
          {!isDraft && (
            <Badge variant="secondary">
              <Lock className="mr-1 h-3 w-3" />
              Limited Editing
            </Badge>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Basic Info */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={500}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="referenceUrl">Reference URL</Label>
            <Input
              id="referenceUrl"
              type="url"
              placeholder="https://..."
              value={referenceUrl}
              onChange={(e) => setReferenceUrl(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="credentials">Credentials</Label>
            <Textarea
              id="credentials"
              value={credentials}
              onChange={(e) => setCredentials(e.target.value)}
              rows={3}
              placeholder="Only shared with accepted workers"
            />
          </div>
        </CardContent>
      </Card>

      {/* Task Configuration */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Task Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            {isDraft ? (
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <>
                <Input value={category} disabled />
                <LockedField label="Category" />
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="requirements">Requirements</Label>
            <Textarea
              id="requirements"
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              rows={6}
              maxLength={2000}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="skills">Skills Required</Label>
            <Input
              id="skills"
              placeholder="react, typescript, figma"
              value={skillsRequired}
              onChange={(e) => setSkillsRequired(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Comma-separated</p>
          </div>

          <div className="space-y-2">
            <Label>Deadline</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !deadline && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {deadline ? format(deadline, "PPP") : "Pick a deadline"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={deadline}
                  onSelect={setDeadline}
                  disabled={(d) => d < new Date()}
                />
              </PopoverContent>
            </Popover>
            {deadline && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setDeadline(undefined)}
              >
                Clear deadline
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pricing */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Pricing & Workers</CardTitle>
          {!isDraft && (
            <CardDescription>
              Financial fields are locked — funds are already in escrow.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Payment Type</Label>
            {isDraft ? (
              <Select value={paymentType} onValueChange={setPaymentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIXED">Fixed Payment</SelectItem>
                  <SelectItem value="MILESTONE">Milestone-Based</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <>
                <Input
                  value={paymentType === "FIXED" ? "Fixed Payment" : "Milestone-Based"}
                  disabled
                />
                <LockedField label="Payment type" />
              </>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Total Budget (USDC)</Label>
              {isDraft ? (
                <Input
                  type="number"
                  min="1"
                  step="0.5"
                  value={totalBudget}
                  onChange={(e) => setTotalBudget(parseFloat(e.target.value) || 0)}
                />
              ) : (
                <>
                  <Input value={`$${totalBudget}`} disabled />
                  <LockedField label="Budget" />
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label>Per Worker (USDC)</Label>
              {isDraft ? (
                <Input
                  type="number"
                  min="1"
                  step="0.5"
                  value={paymentPerWorker}
                  onChange={(e) =>
                    setPaymentPerWorker(parseFloat(e.target.value) || 0)
                  }
                />
              ) : (
                <>
                  <Input value={`$${paymentPerWorker}`} disabled />
                  <LockedField label="Payment" />
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label>Max Workers</Label>
              {isDraft ? (
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={maxWorkers}
                  onChange={(e) => setMaxWorkers(parseInt(e.target.value) || 1)}
                />
              ) : (
                <>
                  <Input value={maxWorkers} disabled />
                  <LockedField label="Workers" />
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Milestones (draft + milestone type only) */}
      {isDraft && paymentType === "MILESTONE" && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Milestones</CardTitle>
            <CardDescription>
              Percentages must sum to 100%.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {milestones.map((m, i) => (
              <div key={i} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">
                    Milestone {i + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeMilestone(i)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={m.title}
                    onChange={(e) => updateMilestone(i, "title", e.target.value)}
                    placeholder="e.g., Design Phase"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={m.description}
                    onChange={(e) =>
                      updateMilestone(i, "description", e.target.value)
                    }
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Percentage</Label>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={m.percentage || ""}
                      onChange={(e) =>
                        updateMilestone(
                          i,
                          "percentage",
                          parseInt(e.target.value) || 0
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <Input
                      value={`$${((totalBudget * (m.percentage || 0)) / 100).toFixed(2)}`}
                      disabled
                    />
                  </div>
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={addMilestone}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Milestone
            </Button>

            <div
              className={cn(
                "rounded-lg border p-3 text-sm",
                milestoneTotalPct === 100
                  ? "border-green-500/50 bg-green-500/10"
                  : "border-yellow-500/50 bg-yellow-500/10"
              )}
            >
              <div className="flex justify-between">
                <span className="font-medium">Total:</span>
                <span className="font-bold">{milestoneTotalPct}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!isDraft && paymentType === "MILESTONE" && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Milestones</CardTitle>
            <CardDescription>
              <Lock className="inline h-3 w-3 mr-1" />
              Milestones are locked after activation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {milestones.map((m, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/50"
                >
                  <span className="text-sm">
                    {i + 1}. {m.title}
                  </span>
                  <span className="text-sm font-semibold">
                    {m.percentage}% — ${((totalBudget * m.percentage) / 100).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save */}
      <div className="flex items-center justify-between">
        <Button variant="outline" asChild>
          <Link href={`/tasks/${task.id}`}>Cancel</Link>
        </Button>
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? "Saving..." : "Save Changes"}
          <Save className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </>
  )
}
