"use client"

import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from "@/components/ui/sidebar"
import Link from "next/link"
import { usePathname } from "next/navigation"

const navItems = [
  { href: "/", label: "일반 결제 테스트", description: "1회성 결제" },
  { href: "/billing", label: "빌링키 결제 테스트", description: "정기 결제" },
  { href: "/billing-and-pay", label: "빌링키+초회결제 테스트", description: "휴대폰 결제 한 번에" },
  { href: "/identity", label: "본인인증 테스트", description: "KG이니시스 통합인증 등" },
] as const

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <>
      <SidebarHeader className="border-b border-sidebar-border bg-sidebar">
        <div className="flex h-14 items-center px-4">
          <Link
            href="/"
            className="font-semibold tracking-tight text-sidebar-primary"
          >
            포트원 샘플
          </Link>
        </div>
      </SidebarHeader>
      <SidebarContent className="bg-sidebar">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href))
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive} size="lg" className="h-16">
                      <Link href={item.href} className="flex flex-col items-start">
                        <span className="font-medium">{item.label}</span>
                        <span className="text-xs text-sidebar-foreground/70">
                          {item.description}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </>
  )
}
