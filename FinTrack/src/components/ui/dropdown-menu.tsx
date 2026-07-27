import * as React from "react"
import { cn } from "@/lib/utils"

// ── Context ───────────────────────────────────────────────────────────────────
type DropdownContextValue = {
  open: boolean
  setOpen: (v: boolean) => void
  containerRef: React.RefObject<HTMLDivElement | null>
}

const DropdownContext = React.createContext<DropdownContextValue>({
  open: false,
  setOpen: () => {},
  containerRef: React.createRef(),
})

// ── Root ──────────────────────────────────────────────────────────────────────
function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement | null>(null)

  // Close when clicking outside the entire container (trigger + popup)
  React.useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (containerRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    // Use mousedown so we catch it before any onClick fires inside
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open])

  return (
    <DropdownContext.Provider value={{ open, setOpen, containerRef }}>
      <div ref={containerRef} className="relative inline-block">
        {children}
      </div>
    </DropdownContext.Provider>
  )
}

// ── Trigger ───────────────────────────────────────────────────────────────────
function DropdownMenuTrigger({
  children,
  asChild,
  className,
}: {
  children: React.ReactNode
  asChild?: boolean
  className?: string
}) {
  const { open, setOpen } = React.useContext(DropdownContext)
  const handleClick = () => setOpen(!open)

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(
      children as React.ReactElement<
        React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement> }
      >,
      {
        onClick: handleClick,
        "aria-expanded": open,
        "aria-haspopup": "menu" as const,
      }
    )
  }

  return (
    <button
      className={cn("outline-none", className)}
      onClick={handleClick}
      aria-expanded={open}
      aria-haspopup="menu"
    >
      {children}
    </button>
  )
}

// ── Content ───────────────────────────────────────────────────────────────────
function DropdownMenuContent({
  children,
  className,
  align = "end",
}: {
  children: React.ReactNode
  className?: string
  align?: "start" | "center" | "end"
}) {
  const { open } = React.useContext(DropdownContext)
  if (!open) return null

  const alignClass =
    align === "start"
      ? "left-0"
      : align === "center"
      ? "left-1/2 -translate-x-1/2"
      : "right-0"

  return (
    <div
      role="menu"
      className={cn(
        "absolute top-full z-50 mt-1 min-w-[8rem] overflow-hidden rounded-lg border border-border bg-card p-1 text-card-foreground shadow-md",
        alignClass,
        className
      )}
    >
      {children}
    </div>
  )
}

// ── Item ──────────────────────────────────────────────────────────────────────
function DropdownMenuItem({
  children,
  className,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  className?: string
  onClick?: () => void
  disabled?: boolean
}) {
  const { setOpen } = React.useContext(DropdownContext)

  return (
    <div
      role="menuitem"
      tabIndex={disabled ? -1 : 0}
      onMouseDown={(e) => {
        // Prevent the document mousedown handler from firing first
        e.stopPropagation()
      }}
      onClick={() => {
        if (disabled) return
        onClick?.()
        setOpen(false)
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          if (!disabled) {
            onClick?.()
            setOpen(false)
          }
        }
      }}
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors",
        "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
        disabled && "pointer-events-none opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
    >
      {children}
    </div>
  )
}

// ── Label ─────────────────────────────────────────────────────────────────────
function DropdownMenuLabel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("px-2 py-1.5 text-xs font-medium text-muted-foreground", className)}>
      {children}
    </div>
  )
}

// ── Separator ─────────────────────────────────────────────────────────────────
function DropdownMenuSeparator({ className }: { className?: string }) {
  return <div role="separator" className={cn("-mx-1 my-1 h-px bg-border", className)} />
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
}
