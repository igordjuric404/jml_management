"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Shield,
  AlertTriangle,
  FolderOpen,
  Grid3X3,
  History,
  FileText,
  Settings,
  BookOpen,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cases", label: "Offboarding Cases", icon: FolderOpen },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/artifacts", label: "Access Artifacts", icon: Shield },
  { href: "/findings", label: "Findings", icon: AlertTriangle },
  { href: "/apps", label: "OAuth Apps", icon: Grid3X3 },
  { href: "/scan-history", label: "Scan History", icon: History },
  { href: "/audit-log", label: "Audit Log", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/docs", label: "Documentation", icon: BookOpen },
  { href: "/chat", label: "AI Chat", icon: MessageCircle },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col border-r bg-card transition-all duration-200",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-14 items-center border-b px-4">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="font-semibold text-lg">JML</span>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "ml-auto rounded-md p-1.5 hover:bg-accent",
            collapsed && "mx-auto"
          )}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                isActive
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-4">
        {!collapsed && (
          <p className="text-xs text-muted-foreground">
            Frappe SoR v1.0
          </p>
        )}
      </div>
    </aside>
  );
}
