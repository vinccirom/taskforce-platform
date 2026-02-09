"use client"

export function CopyButton({ text }: { text: string }) {
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text)
      }}
      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      title="Copy address"
    >
      📋
    </button>
  )
}
