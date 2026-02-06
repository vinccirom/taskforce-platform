"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Plus, Trash2, Calendar as CalendarIcon, GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

export interface MilestoneFormData {
  id: string
  title: string
  description: string
  percentage: number
  dueDate?: Date
}

interface MilestoneFormProps {
  totalBudget: number
  milestones: MilestoneFormData[]
  onChange: (milestones: MilestoneFormData[]) => void
  maxMilestones?: number
  className?: string
}

export function MilestoneForm({
  totalBudget,
  milestones,
  onChange,
  maxMilestones = 5,
  className
}: MilestoneFormProps) {
  const addMilestone = () => {
    if (milestones.length >= maxMilestones) return

    const remainingPercentage = 100 - milestones.reduce((sum, m) => sum + m.percentage, 0)
    const suggestedPercentage = Math.max(10, Math.min(50, remainingPercentage))

    const newMilestone: MilestoneFormData = {
      id: `milestone-${Date.now()}`,
      title: `Milestone ${milestones.length + 1}`,
      description: '',
      percentage: suggestedPercentage
    }

    onChange([...milestones, newMilestone])
  }

  const removeMilestone = (id: string) => {
    onChange(milestones.filter(m => m.id !== id))
  }

  const updateMilestone = (id: string, updates: Partial<MilestoneFormData>) => {
    onChange(
      milestones.map(m =>
        m.id === id ? { ...m, ...updates } : m
      )
    )
  }

  const totalPercentage = milestones.reduce((sum, m) => sum + m.percentage, 0)
  const isValidTotal = totalPercentage === 100

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Milestones</h3>
          <p className="text-sm text-muted-foreground">
            Break your task into phases for progressive payment
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium">
            Total: {totalPercentage}%
          </div>
          {!isValidTotal && (
            <div className="text-xs text-destructive">
              Must equal 100%
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {milestones.map((milestone, index) => {
          const amount = (totalBudget * milestone.percentage) / 100

          return (
            <Card key={milestone.id}>
              <CardHeader className="pb-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1 cursor-grab">
                    <GripVertical className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">
                          Milestone {index + 1}
                        </span>
                        <span className="text-sm font-semibold text-primary">
                          ${amount.toFixed(2)} USDC
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMilestone(milestone.id)}
                        className="h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor={`milestone-${milestone.id}-title`}>
                          Title
                        </Label>
                        <Input
                          id={`milestone-${milestone.id}-title`}
                          value={milestone.title}
                          onChange={(e) => updateMilestone(milestone.id, { title: e.target.value })}
                          placeholder="e.g., Initial Design Mockups"
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor={`milestone-${milestone.id}-description`}>
                          Description (Optional)
                        </Label>
                        <Textarea
                          id={`milestone-${milestone.id}-description`}
                          value={milestone.description}
                          onChange={(e) => updateMilestone(milestone.id, { description: e.target.value })}
                          placeholder="Describe what needs to be delivered for this milestone"
                          rows={2}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor={`milestone-${milestone.id}-percentage`}>
                            Percentage
                          </Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id={`milestone-${milestone.id}-percentage`}
                              type="number"
                              min="1"
                              max="100"
                              value={milestone.percentage}
                              onChange={(e) => {
                                const value = Math.max(1, Math.min(100, parseInt(e.target.value) || 0))
                                updateMilestone(milestone.id, { percentage: value })
                              }}
                              className="w-24"
                            />
                            <span className="text-sm text-muted-foreground">%</span>
                          </div>
                        </div>

                        <div className="grid gap-2">
                          <Label>Due Date (Optional)</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                className={cn(
                                  "justify-start text-left font-normal",
                                  !milestone.dueDate && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {milestone.dueDate ? (
                                  format(milestone.dueDate, "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={milestone.dueDate}
                                onSelect={(date) => updateMilestone(milestone.id, { dueDate: date })}
                                disabled={(date) => date < new Date()}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>
          )
        })}
      </div>

      {milestones.length < maxMilestones && (
        <Button
          type="button"
          variant="outline"
          onClick={addMilestone}
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Milestone
        </Button>
      )}

      {milestones.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <p className="text-sm text-muted-foreground mb-4">
              No milestones added yet. Add milestones to enable progressive payments.
            </p>
            <Button type="button" onClick={addMilestone}>
              <Plus className="mr-2 h-4 w-4" />
              Add First Milestone
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
