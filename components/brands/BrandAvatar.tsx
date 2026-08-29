import { brandInitial, cn } from "@/lib/utils";
import type { Brand } from "@/types";

export function BrandAvatar({
  brand,
  size = "md",
  className,
}: {
  brand: Pick<Brand, "name" | "avatarColor" | "avatarUrl">;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dim =
    size === "sm"
      ? "h-9 w-9 text-sm"
      : size === "lg"
        ? "h-16 w-16 text-2xl"
        : "h-14 w-14 text-xl";
  const rounded = size === "sm" ? "rounded-lg" : "rounded-2xl";

  if (brand.avatarUrl) {
    return (
      // LinkedIn CDN blocks some referrers; keep a plain img.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={brand.avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        className={cn("object-cover", dim, rounded, className)}
      />
    );
  }

  return (
    <span
      className={cn(
        "flex items-center justify-center font-bold text-white",
        dim,
        rounded,
        className,
      )}
      style={{
        background: `linear-gradient(145deg, ${brand.avatarColor}, #AE1BB6)`,
      }}
    >
      {brandInitial(brand.name)}
    </span>
  );
}
