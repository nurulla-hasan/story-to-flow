"use client"

import Link from "next/link"
import { Clapperboard, HelpCircle, Layers, FolderKanban } from "lucide-react"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface StudioHeaderProps {
  className?: string
}

export function StudioHeader({ className = "" }: StudioHeaderProps) {
  return (
    <header className={`sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-card/80 backdrop-blur px-4 sm:px-6 shrink-0 ${className}`}>
      {/* Sidebar toggle button */}
      <SidebarTrigger className="shrink-0" />

      {/* Breadcrumb / Title information */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex items-center gap-2">
          <Clapperboard className="size-4 text-primary shrink-0 hidden sm:block" />
          <h1 className="text-sm sm:text-base font-semibold text-foreground truncate">
            Story Studio
          </h1>
        </div>
        <Badge variant="outline" className="hidden sm:inline-flex text-2xs font-normal border-border bg-card">
          Cartesia & Google Flow
        </Badge>
      </div>

      {/* Right side actions */}
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />

        {/* Studio Quick Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full outline-hidden focus-visible:ring-2 focus-visible:ring-ring cursor-pointer">
            <Avatar className="size-8">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                SF
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-semibold text-foreground leading-tight">
                    Story Studio
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    Flow Production Suite
                  </p>
                  <div className="mt-1">
                    <Badge variant="secondary" className="text-2xs">
                      v1.0 Pro
                    </Badge>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuItem
                render={<Link href="/editor" />}
                className="flex items-center gap-2 cursor-pointer text-xs"
              >
                <Layers className="size-4" />
                Video Editor
              </DropdownMenuItem>
              <DropdownMenuItem
                render={<Link href="/" />}
                className="flex items-center gap-2 cursor-pointer text-xs"
              >
                <FolderKanban className="size-4" />
                All Projects
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuItem className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <HelpCircle className="size-4" />
              Documentation
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

export default StudioHeader
