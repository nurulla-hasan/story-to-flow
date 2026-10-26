"use client"

import Link from "next/link"
import { HelpCircle, Layers, FolderKanban, Settings } from "lucide-react"

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

function StoryStudioGlossyIcon() {
  return (
    <svg
      viewBox="0 0 54 54"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="size-10 sm:size-11 shrink-0"
      aria-hidden="true"
    >
      <defs>
        {/* Soft radial glow */}
        <radialGradient id="starGlowBack" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </radialGradient>
        {/* 3D primary gradient */}
        <linearGradient id="mainStarGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="50%" stopColor="var(--primary)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.75" />
        </linearGradient>
      </defs>

      {/* Ambient background glow */}
      <circle cx="24" cy="24" r="18" fill="url(#starGlowBack)" />

      {/* Main 4-pointed 3D Star */}
      <path
        d="M24 6 C24.8 15.5 28.5 19.2 38 20 C28.5 20.8 24.8 24.5 24 34 C23.2 24.5 19.5 20.8 10 20 C19.5 19.2 23.2 15.5 24 6 Z"
        fill="url(#mainStarGrad)"
      />

      {/* 3D inner shine */}
      <path
        d="M24 10 C24.5 16.5 27 19 33.5 19.5 C27.5 20.2 25 22.5 24.2 28.5 C23.8 22.5 21.2 20.2 14.5 19.6 C21 19 23.5 16.5 24 10 Z"
        fill="var(--card)"
        opacity="0.32"
      />

      {/* Top-Right Secondary Sparkle */}
      <path
        d="M40 7 C40.4 10.4 41.6 11.6 45 12 C41.6 12.4 40.4 13.6 40 17 C39.6 13.6 38.4 12.4 35 12 C38.4 11.6 39.6 10.4 40 7 Z"
        fill="var(--primary)"
        opacity="0.85"
      />

      {/* Bottom-Left Mini Sparkle */}
      <path
        d="M13 29 C13.3 31.4 14.1 32.2 16.5 32.5 C14.1 32.8 13.3 33.6 13 36 C12.7 33.6 11.9 32.8 9.5 32.5 C11.9 32.2 12.7 31.4 13 29 Z"
        fill="var(--primary)"
        opacity="0.75"
      />
    </svg>
  )
}

function RightScenicIllustration() {
  return (
    <svg
      viewBox="0 0 340 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-20 w-80 lg:w-96 select-none shrink-0"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="scenerySky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--banner-sky)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--banner-sky)" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="hillBackGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--banner-hill-back)" />
          <stop offset="100%" stopColor="var(--banner-hill-front)" />
        </linearGradient>
        <linearGradient id="hillFrontGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--banner-hill-front)" />
          <stop offset="100%" stopColor="var(--banner-hill-back)" />
        </linearGradient>
        <linearGradient id="riverGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--banner-river)" />
          <stop offset="100%" stopColor="var(--info)" />
        </linearGradient>
      </defs>

      {/* Gentle sky gradient pill */}
      <rect x="0" y="0" width="340" height="80" fill="url(#scenerySky)" />

      {/* Clouds */}
      <path
        d="M20 22 C20 17 25 14 30 14 C33 11 38 11 41 14 C44 13 48 16 48 20 C50 20 52 22 52 24 C52 27 49 29 46 29 L22 29 C19 29 17 27 17 24 C17 23 18 22 20 22 Z"
        fill="var(--card)"
        opacity="0.8"
      />
      <path
        d="M110 16 C110 13 113 10 117 10 C119 8 123 8 125 10 C128 9 131 11 131 14 C133 14 135 16 135 18 C135 20 133 22 130 22 L111 22 C109 22 108 20 108 18 C108 17 109 16 110 16 Z"
        fill="var(--card)"
        opacity="0.7"
      />

      {/* Warm Sun in horizon */}
      <circle cx="190" cy="18" r="14" fill="var(--warning-subtle)" />
      <circle cx="190" cy="18" r="8" fill="var(--warning)" opacity="0.6" />

      {/* Distant Hills */}
      <path
        d="M0 80 Q 70 34 150 56 T 340 50 L 340 80 Z"
        fill="url(#hillBackGrad)"
        opacity="0.9"
      />

      {/* Background Trees */}
      <circle cx="132" cy="52" r="10" fill="var(--banner-tree)" />
      <circle cx="144" cy="48" r="12" fill="var(--banner-tree)" />
      <circle cx="156" cy="54" r="9" fill="var(--banner-tree)" />
      <circle cx="212" cy="53" r="11" fill="var(--banner-tree)" />
      <circle cx="224" cy="49" r="14" fill="var(--banner-tree)" />
      <circle cx="236" cy="54" r="10" fill="var(--banner-tree)" />

      {/* Winding Blue River */}
      <path
        d="M142 80 C 145 70, 156 66, 158 63 C 161 60, 168 58, 171 56 L 180 56 C 176 60, 168 62, 165 65 C 162 70, 154 74, 150 80 Z"
        fill="url(#riverGrad)"
      />

      {/* Foreground Rolling Hill */}
      <path
        d="M24 80 Q 110 42 190 62 Q 240 50 340 68 L 340 80 Z"
        fill="url(#hillFrontGrad)"
      />

      {/* Foreground Shrub clusters */}
      <circle cx="118" cy="65" r="8" fill="var(--banner-hill-back)" />
      <circle cx="125" cy="67" r="6" fill="var(--banner-hill-front)" />
      <circle cx="225" cy="66" r="7" fill="var(--banner-hill-back)" />

      {/* Cute Cozy Cottage */}
      {/* Cottage Walls */}
      <rect x="168" y="52" width="22" height="15" rx="1.5" fill="var(--banner-wall)" />
      {/* Cottage Door */}
      <rect x="177" y="58" width="5" height="9" rx="0.5" fill="var(--banner-roof)" opacity="0.8" />
      {/* Cottage Windows */}
      <rect x="170" y="56" width="4" height="4" rx="0.5" fill="var(--info)" />
      <rect x="184" y="56" width="4" height="4" rx="0.5" fill="var(--info)" />
      {/* Chimney */}
      <rect x="184" y="42" width="3" height="7" fill="var(--muted-foreground)" />
      {/* Chimney Smoke Puff */}
      <circle cx="185.5" cy="39" r="2" fill="var(--card)" opacity="0.7" />
      <circle cx="187.5" cy="35" r="2.5" fill="var(--card)" opacity="0.5" />
      {/* Red Roof */}
      <polygon points="164,52 179,38 194,52" fill="var(--banner-roof)" />

      {/* Playful Tilted Text: "Turn Stories Into Videos" */}
      <g transform="rotate(7 270 32)">
        <text
          x="240"
          y="32"
          fill="var(--banner-ribbon-text)"
          fontFamily="var(--font-sans)"
          fontSize="13"
          fontWeight="800"
          letterSpacing="-0.02em"
        >
          Turn Stories
        </text>
        <text
          x="244"
          y="46"
          fill="var(--banner-ribbon-text)"
          fontFamily="var(--font-sans)"
          fontSize="13"
          fontWeight="800"
          letterSpacing="-0.02em"
        >
          Into Videos
        </text>
        {/* Playful Underline curve */}
        <path
          d="M246 51 Q 280 54 316 48"
          stroke="var(--banner-ribbon-text)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    </svg>
  )
}

export function StudioHeader({ className = "" }: StudioHeaderProps) {
  return (
    <header className={`sticky top-0 z-20 w-full border-b border-border bg-sidebar backdrop-blur shrink-0 ${className}`}>
      {/* Header Container exactly matching Image 1: max 80px (h-20) */}
      <div className="relative flex h-20 w-full items-center justify-between overflow-hidden px-3 sm:px-5">
        {/* Left Side: Sidebar Trigger + Glossy Star + Story Studio + Subtitle */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 z-10">
          <SidebarTrigger className="shrink-0 mr-1" />

          {/* 3D Glossy Star Icon */}
          <StoryStudioGlossyIcon />

          {/* Title & Subtitle */}
          <div className="flex flex-col min-w-0">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground leading-tight truncate">
              Story Studio
            </h1>
            <p className="text-xs text-muted-foreground leading-normal truncate max-w-72 sm:max-w-105 md:max-w-140">
              Write your story, set your preferences, and generate a complete production package.
            </p>
          </div>
        </div>

        {/* Right Side: Scenic Illustration + Actions */}
        <div className="flex items-center gap-2 shrink-0 z-10">
          {/* Drissho / Scenery matching Image 1 (desktop & tablet) */}
          <div className="hidden md:flex items-center overflow-hidden">
            <RightScenicIllustration />
          </div>

          {/* Top-right Controls: ThemeToggle & Menu */}
          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-full outline-hidden focus-visible:ring-2 focus-visible:ring-ring cursor-pointer">
              <Avatar>
                <AvatarFallback>SF</AvatarFallback>
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
                      <Badge variant="secondary">v1.0 Pro</Badge>
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
                  render={<Link href="/settings" />}
                  className="flex items-center gap-2 cursor-pointer text-xs"
                >
                  <Settings className="size-4" />
                  Settings
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
      </div>
    </header>
  )
}

export default StudioHeader
