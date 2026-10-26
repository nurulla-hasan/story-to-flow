"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserRound, LogOut } from "lucide-react";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { getInitials } from "@/lib/utils";
import { useGetMe, useLogout } from "@/services";
import { successToast } from "@/lib/toast";

export function DashboardHeader() {
  const router = useRouter();
  const { data, isPending } = useGetMe();
  const { mutate: logout, isPending: isLoggingOut } = useLogout();

  const user = data?.data?.user;
  const role = user?.role;

  const profileHref =
    role === "TEACHER"
      ? "/teacher/profile"
      : role === "STUDENT"
      ? "/student/profile"
      : "/admin/profile";

  const roleBadgeVariant =
    role === "ADMIN"
      ? ("admin" as const)
      : role === "TEACHER"
      ? ("manager" as const)
      : ("success" as const);

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

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-sidebar px-4 sm:px-6">
      <SidebarTrigger className="shrink-0" />

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />

        {/* User Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full outline-hidden focus-visible:ring-3 focus-visible:ring-ring/50 cursor-pointer">
            <Avatar size="default">
              <AvatarImage
                src={user?.imageUrl || "/assets/fallback-avatar.png"}
                alt={user?.name || "User Avatar"}
              />
              <AvatarFallback>
                {getInitials(user?.name || "User")}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-semibold text-foreground leading-tight">
                    {user?.name || (isPending ? "Loading..." : "User")}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user?.email || ""}
                  </p>
                  {user?.role && (
                    <div className="mt-1">
                      <Badge variant={roleBadgeVariant} size="sm">
                        {user.role}
                      </Badge>
                    </div>
                  )}
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuItem
                render={<Link href={profileHref} />}
                className="flex items-center gap-2 cursor-pointer"
              >
                <UserRound className="size-4" />
                Profile
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex items-center gap-2 text-destructive focus:text-destructive cursor-pointer"
            >
              <LogOut className="size-4" />
              {isLoggingOut ? "Signing out..." : "Log out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export default DashboardHeader;
