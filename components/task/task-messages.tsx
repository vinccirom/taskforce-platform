"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, Loader2 } from "lucide-react"
import { format } from "date-fns"

interface Message {
  id: string
  content: string
  type: "USER" | "SYSTEM"
  createdAt: string
  agentName?: string | null
  sender?: {
    id: string
    name: string | null
    email: string
  } | null
}

interface TaskMessagesProps {
  taskId: string
  currentUserId: string
  isParticipant: boolean
  applicationStatus?: string | null
}

export function TaskMessages({ taskId, currentUserId, isParticipant, applicationStatus }: TaskMessagesProps) {
  const isPendingApplicant = applicationStatus === "PENDING"
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [limitReached, setLimitReached] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  // Fetch messages
  const fetchMessages = async (cursor?: string) => {
    try {
      const url = cursor 
        ? `/api/tasks/${taskId}/messages?cursor=${cursor}&limit=50`
        : `/api/tasks/${taskId}/messages?limit=50`
      
      const response = await fetch(url)
      if (!response.ok) throw new Error("Failed to fetch messages")
      
      const data = await response.json()
      return data
    } catch (error) {
      console.error("Error fetching messages:", error)
      return { messages: [], nextCursor: undefined }
    }
  }

  // Load initial messages
  useEffect(() => {
    const loadMessages = async () => {
      setLoading(true)
      const data = await fetchMessages()
      setMessages(data.messages || [])
      setLoading(false)
      setTimeout(scrollToBottom, 100)
    }
    loadMessages()
  }, [taskId])

  // Poll for new messages every 5 seconds
  useEffect(() => {
    if (!isParticipant) return

    const pollInterval = setInterval(async () => {
      if (messages.length === 0) return
      
      const lastMessageId = messages[messages.length - 1]?.id
      if (!lastMessageId) return

      const data = await fetchMessages(lastMessageId)
      if (data.messages && data.messages.length > 0) {
        setMessages(prev => [...prev, ...data.messages])
        setTimeout(scrollToBottom, 100)
      }
    }, 5000)

    return () => clearInterval(pollInterval)
  }, [messages, taskId, isParticipant])

  // Send message
  const handleSend = async () => {
    if (!newMessage.trim() || sending) return

    setSending(true)
    try {
      const response = await fetch(`/api/tasks/${taskId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newMessage.trim() })
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        const errorMsg = data.error || "Failed to send message"
        alert(errorMsg)
        return
      }

      const { message } = await response.json()
      setMessages(prev => [...prev, message])
      setNewMessage("")
      setTimeout(scrollToBottom, 100)
    } catch (error) {
      console.error("Error sending message:", error)
      alert("Failed to send message")
    } finally {
      setSending(false)
    }
  }

  // Handle Enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!isParticipant) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Messages</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Messages List */}
            <div 
              ref={messagesContainerRef}
              className="space-y-4 mb-4 max-h-[500px] overflow-y-auto pr-2"
            >
              {messages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No messages yet. Start the conversation!
                </div>
              ) : (
                messages.map((message) => {
                  if (message.type === "SYSTEM") {
                    return (
                      <div 
                        key={message.id}
                        className="text-center py-2 text-sm text-muted-foreground italic"
                      >
                        {message.content}
                      </div>
                    )
                  }

                  const isCurrentUser = message.sender?.id === currentUserId
                  const senderName = message.sender?.name || message.sender?.email || message.agentName || (message as any).agent?.name || "Unknown"

                  return (
                    <div 
                      key={message.id}
                      className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                    >
                      <div 
                        className={`max-w-[70%] rounded-lg p-3 ${
                          isCurrentUser 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted'
                        }`}
                      >
                        {!isCurrentUser && (
                          <div className="text-xs font-semibold mb-1">
                            {senderName}
                          </div>
                        )}
                        <div className="text-sm whitespace-pre-wrap break-words">
                          {message.content}
                        </div>
                        <div 
                          className={`text-xs mt-1 ${
                            isCurrentUser 
                              ? 'text-primary-foreground/70' 
                              : 'text-muted-foreground'
                          }`}
                        >
                          {format(new Date(message.createdAt), "MMM d, h:mm a")}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Pre-acceptance notice */}
            {isPendingApplicant && (
              <div className="mb-3 px-3 py-2 rounded-md bg-amber-50 border border-amber-200 text-sm text-amber-700">
                💡 You can send one message before acceptance. Make it count!
              </div>
            )}

            {/* Input Box */}
            <div className="flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={isPendingApplicant ? "Type a message (max 1000 chars)..." : "Type a message..."}
                disabled={sending}
                maxLength={isPendingApplicant ? 1000 : 5000}
              />
              <Button 
                onClick={handleSend} 
                disabled={!newMessage.trim() || sending}
                size="icon"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
