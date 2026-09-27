"use client";

import * as RadixTooltip from "@radix-ui/react-tooltip";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}

export function Tooltip({ content, children, side = "top" }: TooltipProps) {
  return (
    <RadixTooltip.Provider delayDuration={200}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            sideOffset={6}
            className="z-[var(--z-tooltip)] max-w-[220px] rounded-[var(--radius-md)] bg-[var(--color-text-primary)] px-2.5 py-1.5 text-[var(--font-size-xs)] leading-snug text-white shadow-[var(--shadow-md)] animate-in fade-in-0 zoom-in-95"
          >
            {content}
            <RadixTooltip.Arrow className="fill-[var(--color-text-primary)]" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
