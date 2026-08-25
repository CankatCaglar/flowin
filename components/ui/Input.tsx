import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  variant?: "dark" | "light";
}

export function Input({
  className,
  label,
  leftIcon,
  rightIcon,
  id,
  variant = "dark",
  ...props
}: InputProps) {
  const light = variant === "light";
  return (
    <label className="block space-y-2" htmlFor={id}>
      {label ? (
        <span
          className={cn(
            "text-[13px] font-medium",
            light ? "text-muted" : "text-white/70",
          )}
        >
          {label}
        </span>
      ) : null}
      <span className="relative block">
        {leftIcon ? (
          <span
            className={cn(
              "pointer-events-none absolute inset-y-0 left-3 flex items-center",
              light ? "text-muted" : "text-white/45",
            )}
          >
            {leftIcon}
          </span>
        ) : null}
        <input
          id={id}
          className={cn(
            "w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors",
            light
              ? "border-purple-jam/15 bg-white text-ink placeholder:text-muted focus:border-barney/50"
              : "border-purple-jam/40 bg-midnight/80 text-white placeholder:text-white/35 focus:border-purple-jam/80",
            leftIcon && "pl-10",
            rightIcon && "pr-10",
            props.type === "date" && "hide-native-date-icon",
            className,
          )}
          {...props}
        />
        {rightIcon ? (
          <span
            className={cn(
              "pointer-events-none absolute inset-y-0 right-3 flex items-center",
              light ? "text-muted" : "text-white/45",
            )}
          >
            {rightIcon}
          </span>
        ) : null}
      </span>
    </label>
  );
}
