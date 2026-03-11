import { Sidebar, SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import type { Metadata } from "next"
import { AppSidebar } from "./components/app-sidebar"
import "./globals.css"

export const metadata: Metadata = {
  title: "포트원 결제연동 샘플",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <body className="w-full">
        <SidebarProvider>
          <Sidebar variant="sidebar">
            <AppSidebar />
          </Sidebar>
          <SidebarInset className="rounded-none!">
            {children}
          </SidebarInset>
        </SidebarProvider>
      </body>
    </html>
  )
}
