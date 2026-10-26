"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { useLogout } from "@/services";
import { successToast } from "@/lib/toast";

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
} from "@/components/ui/sidebar";
import { Logo } from "@/components/common/logo";
import { Button } from "@/components/ui/button";
import {
  adminNavigation,
  teacherNavigation,
  studentNavigation,
  type NavigationItem,
} from "@/constants/nav-links";

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { mutate: logout, isPending: isLoggingOut } = useLogout();

  const handleLogout = () => {
    logout(undefined, {
      onSuccess: () => {
        successToast("You have been safely signed out.");
        router.replace("/login");
      },
      onError: () => {
        router.replace("/login");
      },
    });
  };

  // Get portal title and navigation items based on current route
  const getPortalInfo = () => {
    if (pathname.startsWith("/teacher")) {
      return {
        title: "Faculty Portal",
        navItems: teacherNavigation,
      };
    }

    if (pathname.startsWith("/student")) {
      return {
        title: "Student Portal",
        navItems: studentNavigation,
      };
    }

    return {
      title: "Admin Portal",
      navItems: adminNavigation,
    };
  };

  const { title: portalTitle, navItems } = getPortalInfo();

  // Check if navigation item is currently active
  const isItemActive = (item: NavigationItem) => {
    if (pathname === item.href) return true;
    if (item.href.endsWith("/dashboard")) return false;
    return pathname.startsWith(`${item.href}/`);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 border-b px-4 flex flex-row items-center justify-between">
        <Logo size="md" showText showTextOnMobile />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
            {portalTitle}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {navItems.map((item) => {
                const active = isItemActive(item);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      size="md"
                      isActive={active}
                      tooltip={item.title}
                      render={<Link href={item.href} />}
                    >
                      <item.icon className="size-4 shrink-0" />
                      <span className="truncate">{item.title}</span>
                      {item.badge && (
                        <span className="ml-auto text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono group-data-[collapsible=icon]:hidden">
                          {item.badge}
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-3">
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          loading={isLoggingOut}
          loadingText="Signing Out..."
          className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <LogOut />
          <span className="group-data-[collapsible=icon]:hidden">Sign Out</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

export default DashboardSidebar;
