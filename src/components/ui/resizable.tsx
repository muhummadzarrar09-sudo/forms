"use client"

import * as React from "react"
import { GripVerticalIcon } from "lucide-react"
import * as ResizablePrimitive from "react-resizable-panels"

import { cn } from "@/lib/utils"

function ResizablePanelGroup({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Group> & {
  orientation?: "horizontal" | "vertical"
}) {
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      orientation={orientation}
      className={cn("flex h-full w-full", orientation === "vertical" && "flex-col", className)}
      {...props}
    />
  )
}

function ResizablePanel({
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Panel>) {
  return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Separator> & {
  withHandle?: boolean
}) {
  return (
    <ResizablePrimitive.Separator
      data-slot="resizable-handle"
      className={cn(
        "bg-border focus-visible:ring-ring relative flex w-px items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-3 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden",
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className="bg-border z-10 flex h-6 w-5 items-center justify-center rounded-sm border">
          <GripVerticalIcon className="size-3" />
        </div>
      )}
    </ResizablePrimitive.Separator>
  )
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
