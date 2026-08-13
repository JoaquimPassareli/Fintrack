import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  value: string;           // "yyyy-mm-dd"
  onChange: (raw: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

function rawToDate(raw: string): Date | undefined {
  if (!raw) return undefined;
  const [y, m, d] = raw.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function dateToRaw(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function formatDisplay(raw: string): string {
  if (!raw) return "";
  const [y, m, d] = raw.split("-");
  return `${d}/${m}/${y}`;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Selecione uma data",
  className,
  id,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = rawToDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        className={cn(
          "inline-flex h-8 w-full items-center justify-start gap-2 rounded-lg border border-input",
          "bg-background px-2.5 text-sm font-normal transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          !value && "text-muted-foreground",
          className
        )}
      >
        <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
        {value ? formatDisplay(value) : <span>{placeholder}</span>}
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            if (date) {
              onChange(dateToRaw(date));
              setOpen(false);
            }
          }}
          defaultMonth={selected ?? new Date()}
          locale={ptBR}
          className="rounded-lg border border-border"
          footer={
            <div className="flex justify-between border-t border-border px-3 py-2">
              <button
                type="button"
                onClick={() => { onChange(""); setOpen(false); }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={() => { onChange(dateToRaw(new Date())); setOpen(false); }}
                className="text-xs text-primary hover:opacity-80 transition-opacity font-medium"
              >
                Hoje
              </button>
            </div>
          }
        />
      </PopoverContent>
    </Popover>
  );
}
