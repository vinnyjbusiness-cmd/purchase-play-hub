import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FilterSelectProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export default function FilterSelect({ label, value, onValueChange, options, placeholder }: FilterSelectProps) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-[160px] h-9 text-sm">
          <SelectValue placeholder={placeholder || `All ${label}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All {label}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
