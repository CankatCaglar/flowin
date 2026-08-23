import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Input({
  className,
  label,
  leftIcon,
  rightIcon,
  id,
  ...props
}: InputProps) {
  return (
    <label className="block space-y-2" htmlFor={id}>
      {label ? (
        <span className="text-[13px] font-medium text-white/70">{label}</span>
      ) : null}
      <span className="relative block">
        {leftIcon ? (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-white/45">
            {leftIcon}
          </span>
        ) : null}
        <input
          id={id}
          className={cn(
            "w-full rounded-xl border border-purple-jam/40 bg-midnight/80 px-3 py-2.5 text-sm text-white placeholder:text-white/35 outline-none transition-colors focus:border-purple-jam/80",
            leftIcon && "pl-10",
            rightIcon && "pr-10",
            className,
          )}
          {...props}
        />
        {rightIcon ? (
          <span className="absolute inset-y-0 right-3 flex items-center text-white/45">
            {rightIcon}
          </span>
        ) : null}
      </span>
    </label>
  );
}
