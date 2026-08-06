"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer relative inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-transparent outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:[&>span]:bg-primary data-[state=unchecked]:[&>span]:bg-input dark:data-[state=unchecked]:[&>span]:bg-input/80",
        className
      )}
      {...props}
    >
      <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-6 -translate-y-1/2 rounded-full border border-transparent shadow-xs transition-colors" />
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none relative z-10 block size-5 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
