"use client";

import * as React from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { StudioSidebar } from "@/components/studio/studio-sidebar";
import { StudioHeader } from "@/components/studio/studio-header";

interface StudioShellProps {
  children: React.ReactNode;
  className?: string;
}

export function StudioShell({ children, className = "" }: StudioShellProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      <StudioSidebar />
      <SidebarInset className="bg-background flex flex-col min-h-screen">
        <StudioHeader />
        <main className={`flex-1 p-4 sm:p-6 w-full ${className}`}>
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default StudioShell;
