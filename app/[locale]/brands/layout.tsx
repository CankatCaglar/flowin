import { BrandsBootstrap } from "@/components/brands/BrandsBootstrap";

export default function BrandsLayout({ children }: { children: React.ReactNode }) {
  return <BrandsBootstrap>{children}</BrandsBootstrap>;
}
