"use client";

import { useState, useEffect, memo } from "react";
import { Copy, Check } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CopyableCellProps {
  value: string;
}

function CopyableCell({ value }: CopyableCellProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);

  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => setCopied(true));
  };

  return (
    <div className="flex items-center gap-1.5 group/cell">
      <span className="truncate">{value}</span>
      <Tooltip open={copied || undefined}>
        <TooltipTrigger asChild>
          <button
            onClick={handleCopy}
            className="shrink-0 opacity-0 group-hover/cell:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
            aria-label="Copy to clipboard"
          >
            {copied ? (
              <Check className="size-3 text-green-500" />
            ) : (
              <Copy className="size-3 text-muted-foreground" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {copied ? "Copied!" : "Copy"}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export default memo(CopyableCell);