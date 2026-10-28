"use client";

import Link from "next/link";
import { HelpCircle, Layers, Settings } from "lucide-react";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface StudioHeaderProps {
  className?: string;
}

export function StudioHeader({ className = "" }: StudioHeaderProps) {
  return (
    <header
      className={`sticky top-0 z-20 w-full border-b border-border bg-sidebar/95 backdrop-blur shrink-0 ${className}`}
    >
      {/* Clean, Minimal Header Container */}
      <div className="flex h-18 sm:h-20 w-full items-center justify-between px-4 sm:px-6">
        {/* Left Side: Sidebar Toggle + 3D Sparkle + Story Studio Title + Subtitle */}
        <SidebarTrigger className="shrink-0" />
        {/* Right Side: ThemeToggle and User Menu */}
        <div className="flex items-center gap-2.5 shrink-0 ml-4">
          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-full outline-hidden focus-visible:ring-2 focus-visible:ring-ring cursor-pointer">
              <Avatar>
                <AvatarFallback>SF</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-normal flex justify-between items-center gap-2">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-semibold text-foreground leading-tight">
                      Story Studio
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      Flow Production Suite
                    </p>
                  </div>
                  <Badge variant="secondary">v1.5.8</Badge>
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
                  render={<Link href="/settings" />}
                  className="flex items-center gap-2 cursor-pointer text-xs"
                >
                  <Settings className="size-4" />
                  Settings
                </DropdownMenuItem>
              </DropdownMenuGroup>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                render={<Link href="/docs" />}
                className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer"
              >
                <HelpCircle className="size-4" />
                Documentation
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

export default StudioHeader;
