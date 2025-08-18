import type React from "react"
import { StoreProvider } from "@/contexts/store-context"

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <StoreProvider>
      {children}
    </StoreProvider>
  )
}
