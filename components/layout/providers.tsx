"use client"

import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { GoogleAuthProvider } from "@/lib/auth/google-auth"
import { QuizStoreProvider } from "@/lib/store/quiz-store"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider>
        <GoogleAuthProvider>
          <QuizStoreProvider>
            {children}
            <Toaster position="bottom-right" richColors closeButton />
          </QuizStoreProvider>
        </GoogleAuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  )
}
