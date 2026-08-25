import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "outline" | "light" | "brand";
}

export function Button({
  className,
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-display text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" && "bg-barney text-white hover:opacity-90",
        variant === "ghost" && "text-white/80 hover:bg-white/5 hover:text-white",
        variant === "outline" &&
          "border border-purple-jam/40 bg-transparent text-white hover:bg-purple-jam/20",
        variant === "light" &&
          "border border-purple-jam/15 bg-white text-ink hover:bg-canvas",
        variant === "brand" &&
          "border border-barney/35 bg-white text-barney hover:bg-barney/5",
        className,
      )}
      {...props}
    />
  );
}
