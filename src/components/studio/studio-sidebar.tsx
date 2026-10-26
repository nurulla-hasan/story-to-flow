"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Sparkles, Settings, Video, HelpCircle } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

function StoryForgeLogo() {
  return (
    <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-90">
      <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
        <Sparkles className="size-5" />
      </div>
      <div className="flex flex-col group-data-[collapsible=icon]:hidden">
        <span className="font-bold text-base leading-none text-sidebar-foreground">
          StoryForge
        </span>
        <span className="text-2xs text-muted-foreground mt-1">
          AI Video Studio
        </span>
      </div>
    </Link>
  )
}

export function StudioSidebar() {
  const pathname = usePathname()

  const studioNavItems = [
    {
      title: "Home",
      href: "/",
      icon: Home,
      isActive: pathname === "/",
    },
    {
      title: "Story Studio",
      href: "/studio",
      icon: Sparkles,
      badge: "Active",
      isActive: pathname === "/studio" || pathname.startsWith("/studio/"),
    },
    {
      title: "Video Editor",
      href: "/editor",
      icon: Video,
      badge: "Beta",
      isActive: pathname === "/editor",
    },
  ]

  const toolNavItems = [
    {
      title: "Settings",
      href: "#",
      icon: Settings,
      isActive: false,
    },
    {
      title: "Help & Docs",
      href: "#",
      icon: HelpCircle,
      isActive: false,
    },
  ]

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="h-16 border-b border-sidebar-border px-4 flex flex-row items-center justify-between">
        <StoryForgeLogo />
      </SidebarHeader>

      <SidebarContent>
        {/* Main Studio Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
            Studio
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {studioNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    size="default"
                    isActive={item.isActive}
                    tooltip={item.title}
                    render={<Link href={item.href} />}
                  >
                    <item.icon className="size-4 shrink-0" />
                    <span className="truncate">{item.title}</span>
                    {item.badge && (
                      <span className="ml-auto text-2xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono group-data-[collapsible=icon]:hidden">
                        {item.badge}
                      </span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Tools & Preferences */}
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
            Preferences
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {toolNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    size="default"
                    isActive={item.isActive}
                    tooltip={item.title}
                    render={<Link href={item.href} />}
                  >
                    <item.icon className="size-4 shrink-0" />
                    <span className="truncate">{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-card/40 border border-border/40 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-1">
          <span className="size-2 rounded-full bg-success shrink-0 animate-pulse" />
          <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden">
            <span className="text-xs font-medium text-foreground truncate">
              System Online
            </span>
            <span className="text-2xs text-muted-foreground truncate">
              Ready for generations
            </span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

export default StudioSidebar
