"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/components/auth/auth-context"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import {
  Menu,
  Plus,
  LayoutDashboard,
  Clipboard,
  DollarSign,
  Search,
  Settings,
  LogOut,
  Copy,
  Check,
  Scale,
  MessageSquare,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { NotificationBell } from "@/components/notifications/notification-bell"

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const { user, isAuthenticated } = useAuth()
  const pathname = usePathname()
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)

  const isAdmin = user?.role === "ADMIN"

  const getInitials = (name?: string | null) => {
    if (!name) return "?"
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const links = isAdmin
    ? [
        { href: "/admin", label: "Admin", icon: Settings },
        { href: "/creator-dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/browse", label: "Browse", icon: Search },
        { href: "/messages", label: "Messages", icon: MessageSquare },
        { href: "/disputes", label: "Disputes", icon: Scale },
      ]
    : [
        { href: "/creator-dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/tasks", label: "My Tasks", icon: Clipboard },
        { href: "/browse", label: "Browse", icon: Search },
        { href: "/messages", label: "Messages", icon: MessageSquare },
        { href: "/earnings", label: "Earnings", icon: DollarSign },
      ]

  const NavLinks = () => (
    <>
      {links.map((link) => {
        const Icon = link.icon
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors hover:text-primary",
              pathname === link.href ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {link.label}
          </Link>
        )
      })}
    </>
  )

  const truncAddr = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`
  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr)
    setCopiedAddress(addr)
    setTimeout(() => setCopiedAddress(null), 2000)
  }

  const wallets: { address: string; chain: string }[] = []
  if (user?.walletAddress) wallets.push({ address: user.walletAddress, chain: "solana" })
  if (user?.evmWalletAddress) wallets.push({ address: user.evmWalletAddress, chain: "ethereum" })

  const rawEmail = user?.email || ""
  const displayEmail = rawEmail.includes("@privy.io") ? "" : rawEmail
  const displayName = user?.name || (displayEmail ? displayEmail.split("@")[0] : "User")
  const displayRole = user?.role === "ADMIN" ? "Admin" : ""

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container px-4 md:px-6 flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-6">
            <Link
              href={isAuthenticated ? "/creator-dashboard" : "/"}
              className="flex items-center gap-2"
            >
              <Image
                src="/taskforce-logov2.png"
                alt="TaskForce"
                width={32}
                height={32}
                className="h-8 w-8 rounded-lg"
              />
              <span className="text-xl font-youth font-bold">TaskForce</span>
            </Link>

            {/* Desktop Navigation */}
            {isAuthenticated && (
              <nav className="hidden md:flex items-center gap-1">
                <NavLinks />
              </nav>
            )}
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                {/* Create Task Button */}
                <Button asChild size="sm" className="hidden sm:flex">
                  <Link href="/new-task">
                    <Plus className="mr-2 h-4 w-4" />
                    Post Task
                  </Link>
                </Button>

                {/* Notifications */}
                <NotificationBell />

                {/* User Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-72">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{displayName}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {displayEmail}
                        </p>
                        {displayRole && (
                          <p className="text-xs leading-none text-muted-foreground mt-1">
                            Role: {displayRole}
                          </p>
                        )}
                      </div>
                    </DropdownMenuLabel>

                    {/* Wallets */}
                    {wallets.length > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                          Wallets
                        </DropdownMenuLabel>
                        {wallets.map((w) => {
                          const isSolana = w.chain === "solana"
                          const chainLabel = isSolana ? "Solana" : "Base / EVM"
                          const isCopied = copiedAddress === w.address

                          return (
                            <div
                              key={w.address}
                              className="flex items-center justify-between px-2 py-1.5 mx-1 rounded-md hover:bg-accent cursor-pointer group"
                              onClick={() => copyAddress(w.address)}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Image
                                  src={isSolana ? "/solana.png" : "/base.png"}
                                  alt={chainLabel}
                                  width={18}
                                  height={18}
                                  className="rounded-full flex-shrink-0"
                                />
                                <div className="min-w-0">
                                  <p className="text-xs font-medium">{chainLabel}</p>
                                  <p className="text-[11px] text-muted-foreground font-mono">
                                    {truncAddr(w.address)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex-shrink-0 ml-2">
                                {isCopied ? (
                                  <Check className="h-3.5 w-3.5 text-green-500" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </>
                    )}

                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/settings" className="flex items-center">
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href="/api/auth/logout" className="flex items-center">
                        <LogOut className="mr-2 h-4 w-4" />
                        Sign Out
                      </a>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Mobile Menu */}
                <Sheet>
                  <SheetTrigger asChild className="md:hidden">
                    <Button variant="ghost" size="icon">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right">
                    <nav className="flex flex-col gap-4 mt-8">
                      <NavLinks />
                      <DropdownMenuSeparator />
                      <Link href="/new-task">
                        <Button className="w-full">
                          <Plus className="mr-2 h-4 w-4" />
                          Post Task
                        </Button>
                      </Link>
                    </nav>
                  </SheetContent>
                </Sheet>
              </>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link href="/">Sign In</Link>
                </Button>
                <Button asChild>
                  <Link href="/">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t py-6 md:py-0">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            TaskForce - Trustless Work, Guaranteed Payment. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/about" className="hover:text-primary transition-colors">
              About
            </Link>
            <Link href="/how-it-works" className="hover:text-primary transition-colors">
              How It Works
            </Link>
            <Link href="/terms" className="hover:text-primary transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-primary transition-colors">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
