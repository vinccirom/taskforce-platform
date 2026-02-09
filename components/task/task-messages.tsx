"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, Loader2, Paperclip, X, FileText, Download } from "lucide-react"
import { format } from "date-fns"
import Image from "next/image"

interface Attachment {
  url: string
  filename?: string
  contentType?: string
  size?: number
}

interface Message {
  id: string
  content: string
  attachments?: Attachment[] | null
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

function isImageType(contentType?: string, url?: string): boolean {
  if (contentType?.startsWith("image/")) return true
  if (url) {
    const lower = url.toLowerCase()
    return /\.(png|jpg|jpeg|gif|webp)(\?|$)/.test(lower)
  }
  return false
}

function AttachmentDisplay({ attachment, isCurrentUser }: { attachment: Attachment; isCurrentUser: boolean }) {
  const isImage = isImageType(attachment.contentType, attachment.url)
  const filename = attachment.filename || attachment.url.split("/").pop() || "file"

  if (isImage) {
    return (
      <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="block mt-2">
        <img
          src={attachment.url}
          alt={filename}
          className="max-w-full max-h-[300px] rounded-md object-contain"
        />
      </a>
    )
  }

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-2 mt-2 p-2 rounded-md text-sm ${
        isCurrentUser ? "bg-primary-foreground/10" : "bg-background/50"
      }`}
    >
      <FileText className="h-4 w-4 flex-shrink-0" />
      <span className="truncate">{filename}</span>
      <Download className="h-3 w-3 flex-shrink-0 ml-auto" />
    </a>
  )
}

export function TaskMessages({ taskId, currentUserId, isParticipant, applicationStatus }: TaskMessagesProps) {
  const isPendingApplicant = applicationStatus === "PENDING"
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const fetchMessages = async (cursor?: string) => {
    try {
      const url = cursor 
        ? `/api/tasks/${taskId}/messages?cursor=${cursor}&limit=50`
        : `/api/tasks/${taskId}/messages?limit=50`
      const response = await fetch(url)
      if (!response.ok) throw new Error("Failed to fetch messages")
      return await response.json()
    } catch (error) {
      console.error("Error fetching messages:", error)
      return { messages: [], nextCursor: undefined }
    }
  }

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

  const uploadFile = async (file: File): Promise<Attachment | null> => {
    const formData = new FormData()
    formData.append("file", file)
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Upload failed")
      }
      const data = await res.json()
      return { url: data.url, filename: data.filename || file.name, contentType: data.contentType || file.type, size: data.size || file.size }
    } catch (error: any) {
      console.error("Upload error:", error)
      alert(`Failed to upload ${file.name}: ${error.message}`)
      return null
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length + pendingFiles.length > 10) {
      alert("Maximum 10 files per message")
      return
    }
    setPendingFiles(prev => [...prev, ...files])
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSend = async () => {
    if ((!newMessage.trim() && pendingFiles.length === 0) || sending) return

    setSending(true)
    setUploading(pendingFiles.length > 0)
    try {
      // Upload files first
      let attachments: Attachment[] = []
      if (pendingFiles.length > 0) {
        const results = await Promise.all(pendingFiles.map(uploadFile))
        attachments = results.filter((a): a is Attachment => a !== null)
        if (attachments.length === 0 && !newMessage.trim()) {
          return // All uploads failed and no text
        }
      }
      setUploading(false)

      const body: any = {}
      if (newMessage.trim()) body.content = newMessage.trim()
      if (attachments.length > 0) body.attachments = attachments

      const response = await fetch(`/api/tasks/${taskId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        alert(data.error || "Failed to send message")
        return
      }

      const { message } = await response.json()
      setMessages(prev => [...prev, message])
      setNewMessage("")
      setPendingFiles([])
      setTimeout(scrollToBottom, 100)
    } catch (error) {
      console.error("Error sending message:", error)
      alert("Failed to send message")
    } finally {
      setSending(false)
      setUploading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!isParticipant) return null

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
                      <div key={message.id} className="text-center py-2 text-sm text-muted-foreground italic">
                        {message.content}
                      </div>
                    )
                  }

                  const isCurrentUser = message.sender?.id === currentUserId
                  const senderName = message.sender?.name || message.sender?.email || message.agentName || (message as any).agent?.name || "Unknown"
                  const attachments = (message.attachments as Attachment[] | null) || []

                  return (
                    <div key={message.id} className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-lg p-3 ${isCurrentUser ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        {!isCurrentUser && (
                          <div className="text-xs font-semibold mb-1">{senderName}</div>
                        )}
                        {message.content && (
                          <div className="text-sm whitespace-pre-wrap break-words">{message.content}</div>
                        )}
                        {attachments.length > 0 && (
                          <div className="space-y-1">
                            {attachments.map((att, i) => (
                              <AttachmentDisplay key={i} attachment={att} isCurrentUser={isCurrentUser} />
                            ))}
                          </div>
                        )}
                        <div className={`text-xs mt-1 ${isCurrentUser ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          {format(new Date(message.createdAt), "MMM d, h:mm a")}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {isPendingApplicant && (
              <div className="mb-3 px-3 py-2 rounded-md bg-amber-50 border border-amber-200 text-sm text-amber-700">
                💡 You can send one message before acceptance. Make it count!
              </div>
            )}

            {/* Pending file previews */}
            {pendingFiles.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {pendingFiles.map((file, i) => (
                  <div key={i} className="flex items-center gap-1 bg-muted rounded-md px-2 py-1 text-sm">
                    <FileText className="h-3 w-3" />
                    <span className="truncate max-w-[150px]">{file.name}</span>
                    <button onClick={() => removePendingFile(i)} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                accept="image/*,.pdf,.txt,.csv,.doc,.docx,.zip,.json"
                onChange={handleFileSelect}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending}
                title="Attach files"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
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
                disabled={(!newMessage.trim() && pendingFiles.length === 0) || sending}
                size="icon"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            {uploading && (
              <div className="text-xs text-muted-foreground mt-1">Uploading files...</div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
