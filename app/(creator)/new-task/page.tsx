"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/layouts/app-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { AlertCircle, CheckCircle2, Calendar as CalendarIcon, ArrowRight, ArrowLeft, Plus, X } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

const STEPS = ['Basic Info', 'Task Configuration', 'Pricing & Workers', 'Milestones', 'Review']

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

interface FormData {
  title: string
  description: string
  referenceUrl: string
  credentials: string
  requirements: string
  category: string
  skillsRequired: string
  totalBudget: number
  paymentType: 'FIXED' | 'MILESTONE' | ''
  paymentPerWorker: number
  maxWorkers: number
  deadline?: Date
  milestones: MilestoneInput[]
  acceptTerms: boolean
}

export default function NewTaskPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState<FormData>({
    title: "",
    description: "",
    referenceUrl: "",
    credentials: "",
    requirements: "",
    category: "",
    skillsRequired: "",
    totalBudget: 50,
    paymentType: "FIXED",
    paymentPerWorker: 50,
    maxWorkers: 1,
    deadline: undefined,
    milestones: [],
    acceptTerms: false,
  })

  const updateField = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError("")
  }

  const addMilestone = () => {
    setFormData(prev => ({
      ...prev,
      milestones: [
        ...prev.milestones,
        { title: "", description: "", percentage: 0 }
      ]
    }))
  }

  const updateMilestone = (index: number, field: keyof MilestoneInput, value: any) => {
    setFormData(prev => {
      const milestones = [...prev.milestones]
      milestones[index] = { ...milestones[index], [field]: value }
      return { ...prev, milestones }
    })
  }

  const removeMilestone = (index: number) => {
    setFormData(prev => ({
      ...prev,
      milestones: prev.milestones.filter((_, i) => i !== index)
    }))
  }

  const milestoneTotalPercentage = formData.milestones.reduce((sum, m) => sum + (m.percentage || 0), 0)

  const validateStep = () => {
    switch (step) {
      case 0: // Basic Info
        if (!formData.title.trim()) {
          setError("Title is required")
          return false
        }
        if (formData.title.length < 5) {
          setError("Title must be at least 5 characters")
          return false
        }
        if (!formData.description.trim()) {
          setError("Description is required")
          return false
        }
        if (formData.description.length < 20) {
          setError("Description must be at least 20 characters")
          return false
        }
        if (formData.referenceUrl) {
          try {
            new URL(formData.referenceUrl)
          } catch {
            setError("Please enter a valid reference URL")
            return false
          }
        }
        break

      case 1: // Task Configuration
        if (!formData.category) {
          setError("Please select a category")
          return false
        }
        if (!formData.requirements.trim()) {
          setError("Requirements are required")
          return false
        }
        if (formData.requirements.length < 10) {
          setError("Requirements must be at least 10 characters")
          return false
        }
        break

      case 2: // Pricing & Workers
        if (!formData.paymentType) {
          setError("Please select a payment type")
          return false
        }
        if (formData.totalBudget < 1) {
          setError("Total budget must be at least $1")
          return false
        }
        if (formData.maxWorkers < 1) {
          setError("Max workers must be at least 1")
          return false
        }
        if (formData.maxWorkers > 100) {
          setError("Max workers cannot exceed 100")
          return false
        }
        if (formData.paymentPerWorker < 1) {
          setError("Payment per worker must be at least $1")
          return false
        }
        if (formData.paymentPerWorker * formData.maxWorkers > formData.totalBudget) {
          setError("Payment per worker × max workers cannot exceed total budget")
          return false
        }
        break

      case 3: // Milestones
        if (formData.paymentType === 'MILESTONE') {
          if (formData.milestones.length < 2) {
            setError("Milestone-based tasks require at least 2 milestones")
            return false
          }
          for (let i = 0; i < formData.milestones.length; i++) {
            if (!formData.milestones[i].title.trim()) {
              setError(`Milestone ${i + 1} requires a title`)
              return false
            }
            if (formData.milestones[i].percentage <= 0) {
              setError(`Milestone ${i + 1} requires a percentage greater than 0`)
              return false
            }
          }
          if (milestoneTotalPercentage !== 100) {
            setError(`Milestone percentages must sum to 100% (currently ${milestoneTotalPercentage}%)`)
            return false
          }
        }
        break

      case 4: // Review
        if (!formData.acceptTerms) {
          setError("Please accept the terms and conditions")
          return false
        }
        break
    }

    setError("")
    return true
  }

  const nextStep = () => {
    if (validateStep()) {
      // Skip milestones step if payment type is FIXED
      if (step === 2 && formData.paymentType === 'FIXED') {
        setStep(4) // Skip to review
      } else {
        setStep(prev => Math.min(prev + 1, STEPS.length - 1))
      }
    }
  }

  const prevStep = () => {
    // Skip milestones step if payment type is FIXED
    if (step === 4 && formData.paymentType === 'FIXED') {
      setStep(2)
    } else {
      setStep(prev => Math.max(prev - 1, 0))
    }
    setError("")
  }

  const handleSubmit = async () => {
    if (!validateStep()) return

    setLoading(true)
    setError("")

    try {
      const skillsArray = formData.skillsRequired
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)

      const res = await fetch('/api/creator/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          referenceUrl: formData.referenceUrl || undefined,
          credentials: formData.credentials || undefined,
          requirements: formData.requirements,
          category: formData.category,
          skillsRequired: skillsArray,
          totalBudget: formData.totalBudget,
          paymentType: formData.paymentType,
          paymentPerWorker: formData.paymentPerWorker,
          maxWorkers: formData.maxWorkers,
          deadline: formData.deadline?.toISOString() || undefined,
          milestones: formData.paymentType === 'MILESTONE' ? formData.milestones.map((m, i) => ({
            title: m.title,
            description: m.description || undefined,
            order: i + 1,
            percentage: m.percentage,
            amount: (formData.totalBudget * m.percentage) / 100,
          })) : undefined,
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create task')
      }

      toast.success('Task created successfully!')

      if (data.checkoutUrl) {
        const shouldRedirect = window.confirm(
          `Task created! Total budget: $${formData.totalBudget} USDC\n\n` +
          `You'll be redirected to complete payment. Click OK to proceed.`
        )

        if (shouldRedirect) {
          window.location.href = data.checkoutUrl
        } else {
          router.push(`/tasks`)
        }
      } else {
        router.push('/tasks')
      }
    } catch (err: any) {
      setError(err.message || "Failed to create task. Please try again.")
      toast.error(err.message || "Failed to create task")
    } finally {
      setLoading(false)
    }
  }

  const renderStepContent = () => {
    switch (step) {
      case 0: // Basic Info
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Task Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Build a Landing Page for SaaS Product"
                value={formData.title}
                onChange={(e) => updateField('title', e.target.value)}
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">
                {formData.title.length}/100 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Describe what the task involves and what you need done..."
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                rows={4}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                {formData.description.length}/500 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="referenceUrl">Reference URL (Optional)</Label>
              <Input
                id="referenceUrl"
                type="url"
                placeholder="https://example.com"
                value={formData.referenceUrl}
                onChange={(e) => updateField('referenceUrl', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Link to the product, repo, or reference material
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="credentials">Credentials (Optional)</Label>
              <Textarea
                id="credentials"
                placeholder="Username: test@example.com&#10;Password: testpass123&#10;API Key: sk-..."
                value={formData.credentials}
                onChange={(e) => updateField('credentials', e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Credentials will be encrypted and only shared with accepted workers
              </p>
            </div>
          </div>
        )

      case 1: // Task Configuration
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => updateField('category', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="skillsRequired">Skills Required (Optional)</Label>
              <Input
                id="skillsRequired"
                placeholder="e.g., react, typescript, figma, api-testing"
                value={formData.skillsRequired}
                onChange={(e) => updateField('skillsRequired', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated list of skills
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="requirements">Requirements *</Label>
              <Textarea
                id="requirements"
                placeholder="Detailed task instructions:&#10;1. Set up the project&#10;2. Build the landing page&#10;3. Deploy to staging..."
                value={formData.requirements}
                onChange={(e) => updateField('requirements', e.target.value)}
                rows={6}
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground">
                {formData.requirements.length}/2000 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deadline">Deadline (Optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.deadline && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.deadline ? format(formData.deadline, "PPP") : "Pick a deadline"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.deadline}
                    onSelect={(date) => updateField('deadline', date)}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )

      case 2: // Pricing & Workers
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="paymentType">Payment Type *</Label>
              <Select
                value={formData.paymentType}
                onValueChange={(value) => updateField('paymentType', value as 'FIXED' | 'MILESTONE')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select payment type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIXED">Fixed Payment</SelectItem>
                  <SelectItem value="MILESTONE">Milestone-Based</SelectItem>
                </SelectContent>
              </Select>
              <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                {formData.paymentType === 'FIXED' && "Single payment upon task completion and approval"}
                {formData.paymentType === 'MILESTONE' && "Phased payments released as milestones are completed"}
                {!formData.paymentType && "Select a payment type to see description"}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="totalBudget">Total Budget (USDC) *</Label>
              <Input
                id="totalBudget"
                type="number"
                min="1"
                step="0.5"
                value={formData.totalBudget}
                onChange={(e) => updateField('totalBudget', parseFloat(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">
                Total amount allocated for this task
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentPerWorker">Payment Per Worker (USDC) *</Label>
              <Input
                id="paymentPerWorker"
                type="number"
                min="1"
                step="0.5"
                value={formData.paymentPerWorker}
                onChange={(e) => updateField('paymentPerWorker', parseFloat(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">
                Amount each worker will earn for completing the task
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxWorkers">Maximum Workers *</Label>
              <Input
                id="maxWorkers"
                type="number"
                min="1"
                max="100"
                value={formData.maxWorkers}
                onChange={(e) => updateField('maxWorkers', parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">
                How many workers can participate (1-100)
              </p>
            </div>

            <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">Payment Summary</h3>
                <div className="text-3xl font-bold text-primary">
                  ${formData.totalBudget.toFixed(2)}
                  <span className="text-base font-normal text-muted-foreground ml-2">USDC</span>
                </div>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Payment per worker:</span>
                  <span>${formData.paymentPerWorker} USDC</span>
                </div>
                <div className="flex justify-between">
                  <span>Number of workers:</span>
                  <span>{formData.maxWorkers}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total budget:</span>
                  <span>${formData.totalBudget} USDC</span>
                </div>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Payment will be held in escrow and released to workers after you approve their submissions.
              </AlertDescription>
            </Alert>
          </div>
        )

      case 3: // Milestones
        return (
          <div className="space-y-6">
            {formData.paymentType === 'MILESTONE' ? (
              <>
                <div className="rounded-lg bg-muted p-4 text-sm">
                  <p className="font-medium mb-1">Milestone-Based Payment</p>
                  <p className="text-muted-foreground">
                    Define milestones for phased delivery. Each milestone must have a percentage of the total budget.
                    Percentages must sum to 100%.
                  </p>
                </div>

                {formData.milestones.map((milestone, index) => (
                  <Card key={index}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Milestone {index + 1}</CardTitle>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMilestone(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Title *</Label>
                        <Input
                          placeholder="e.g., Design Phase Complete"
                          value={milestone.title}
                          onChange={(e) => updateMilestone(index, 'title', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Description (Optional)</Label>
                        <Textarea
                          placeholder="What should be delivered for this milestone..."
                          value={milestone.description}
                          onChange={(e) => updateMilestone(index, 'description', e.target.value)}
                          rows={2}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Percentage of Budget *</Label>
                          <Input
                            type="number"
                            min="1"
                            max="100"
                            value={milestone.percentage || ''}
                            onChange={(e) => updateMilestone(index, 'percentage', parseInt(e.target.value) || 0)}
                            placeholder="e.g., 50"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Amount (USDC)</Label>
                          <Input
                            type="text"
                            value={`$${((formData.totalBudget * (milestone.percentage || 0)) / 100).toFixed(2)}`}
                            disabled
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  onClick={addMilestone}
                  className="w-full"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Milestone
                </Button>

                <div className={cn(
                  "rounded-lg border p-4 text-sm",
                  milestoneTotalPercentage === 100
                    ? "border-success/50 bg-success/10"
                    : "border-warning/50 bg-warning/10"
                )}>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Total Percentage:</span>
                    <span className={cn(
                      "font-bold text-lg",
                      milestoneTotalPercentage === 100 ? "text-success" : "text-warning"
                    )}>
                      {milestoneTotalPercentage}%
                    </span>
                  </div>
                  {milestoneTotalPercentage !== 100 && (
                    <p className="text-warning text-xs mt-1">
                      Must equal 100% ({100 - milestoneTotalPercentage}% remaining)
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Milestones are only available for milestone-based payment tasks.</p>
                <p className="text-sm mt-2">You selected fixed payment — skip to the review step.</p>
              </div>
            )}
          </div>
        )

      case 4: // Review
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Task Details</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Title:</dt>
                    <dd className="font-medium">{formData.title}</dd>
                  </div>
                  {formData.referenceUrl && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Reference URL:</dt>
                      <dd className="font-medium truncate max-w-[200px]">{formData.referenceUrl}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Category:</dt>
                    <dd className="font-medium capitalize">{formData.category.replace('-', ' ')}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Payment Type:</dt>
                    <dd className="font-medium">{formData.paymentType === 'FIXED' ? 'Fixed' : 'Milestone-Based'}</dd>
                  </div>
                  {formData.skillsRequired && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Skills:</dt>
                      <dd className="font-medium">{formData.skillsRequired}</dd>
                    </div>
                  )}
                  {formData.deadline && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Deadline:</dt>
                      <dd className="font-medium">{format(formData.deadline, "PPP")}</dd>
                    </div>
                  )}
                </dl>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {formData.description}
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Requirements</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {formData.requirements}
                </p>
              </div>

              {formData.paymentType === 'MILESTONE' && formData.milestones.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Milestones</h3>
                  <div className="space-y-2">
                    {formData.milestones.map((m, i) => (
                      <div key={i} className="flex justify-between text-sm border rounded-lg p-3">
                        <span>{i + 1}. {m.title}</span>
                        <span className="font-semibold">
                          {m.percentage}% — ${((formData.totalBudget * m.percentage) / 100).toFixed(2)} USDC
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
                <h3 className="font-semibold mb-3">Payment Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Total budget:</span>
                    <span className="font-semibold">${formData.totalBudget} USDC</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Payment per worker:</span>
                    <span className="font-semibold">${formData.paymentPerWorker} USDC</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Maximum workers:</span>
                    <span className="font-semibold">{formData.maxWorkers}</span>
                  </div>
                  <div className="border-t pt-2 mt-2 flex justify-between text-base font-bold">
                    <span>You will pay:</span>
                    <span className="text-primary">${formData.totalBudget.toFixed(2)} USDC</span>
                  </div>
                </div>
              </div>

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="terms"
                  checked={formData.acceptTerms}
                  onCheckedChange={(checked) => updateField('acceptTerms', checked as boolean)}
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="terms"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    I accept the terms and conditions
                  </label>
                  <p className="text-sm text-muted-foreground">
                    You agree to pay ${formData.totalBudget.toFixed(2)} USDC for this task and release payments to workers after approving their submissions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )
    }
  }

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Create New Task</h1>
          <p className="mt-2 text-muted-foreground">
            Set up a new task for workers to complete
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Step {step + 1} of {STEPS.length}: {STEPS[step]}</CardTitle>
            <Progress value={((step + 1) / STEPS.length) * 100} className="mt-2" />
          </CardHeader>

          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {renderStepContent()}
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={step === 0 || loading}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>

            {step < STEPS.length - 1 ? (
              <Button onClick={nextStep} disabled={loading}>
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={loading || !formData.acceptTerms}>
                {loading ? "Creating..." : "Create Task & Pay"}
                <CheckCircle2 className="ml-2 h-4 w-4" />
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </AppShell>
  )
}
