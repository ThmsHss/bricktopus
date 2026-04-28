import { useCallback, useRef, useState, type DragEvent } from "react";
import { FileText, Image as ImageIcon, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface DropZoneProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  /** Comma-separated MIME hints for the file picker. */
  accept?: string;
  /** Predicate used to validate dropped/selected files. Defaults to image/* + application/pdf. */
  isAccepted?: (file: File) => boolean;
  disabled?: boolean;
}

const DEFAULT_ACCEPT = "image/*,application/pdf";

function defaultPredicate(file: File): boolean {
  return file.type.startsWith("image/") || file.type === "application/pdf";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DropZone({
  file,
  onFileChange,
  accept = DEFAULT_ACCEPT,
  isAccepted = defaultPredicate,
  disabled = false,
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isOver, setIsOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFile = useCallback(
    (next: File | null) => {
      // Revoke any previous object URL so we don't leak.
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (next && next.type.startsWith("image/")) {
        setPreviewUrl(URL.createObjectURL(next));
      } else {
        setPreviewUrl(null);
      }
      onFileChange(next);
    },
    [onFileChange, previewUrl],
  );

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsOver(false);
    if (disabled) return;
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && isAccepted(dropped)) {
      handleFile(dropped);
    }
  };

  if (file) {
    const isImage = file.type.startsWith("image/");
    return (
      <div className="flex items-center gap-3 rounded-xl border border-foreground/10 bg-card/60 p-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
          {previewUrl && isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={file.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <FileText className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {isImage ? (
              <ImageIcon className="h-3 w-3 text-muted-foreground" />
            ) : (
              <FileText className="h-3 w-3 text-muted-foreground" />
            )}
            <span className="truncate text-sm font-medium">{file.name}</span>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {formatBytes(file.size)} · {file.type || "unknown type"}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => handleFile(null)}
          disabled={disabled}
          aria-label="Remove file"
          className="shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={onDrop}
      onClick={() => {
        if (!disabled) inputRef.current?.click();
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/30 px-6 py-10 text-center transition-colors",
        "cursor-pointer hover:border-foreground/40 hover:bg-muted/50",
        isOver && "border-primary/60 bg-primary/5",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <Upload className="h-6 w-6 text-muted-foreground" />
      <div className="text-sm font-medium">
        Drag a screenshot or PDF here
      </div>
      <div className="text-xs text-muted-foreground">
        Or click to browse · image/* and application/pdf · 10 MB max
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const next = e.target.files?.[0] ?? null;
          if (next && !isAccepted(next)) return;
          handleFile(next);
          // Reset value so picking the same file again still fires onChange.
          e.target.value = "";
        }}
      />
    </div>
  );
}
