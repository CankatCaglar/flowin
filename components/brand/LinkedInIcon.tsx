"use client";

import { FaFacebook, FaInstagram, FaLinkedin } from "react-icons/fa6";
import { cn } from "@/lib/utils";

/** Font Awesome 6 brand marks (official LinkedIn / Instagram / Facebook glyphs). */
export function LinkedInIcon({ className }: { className?: string }) {
  return (
    <FaLinkedin
      aria-hidden
      title="LinkedIn"
      color="#0A66C2"
      className={cn("h-4 w-4 shrink-0", className)}
    />
  );
}

export function InstagramIcon({ className }: { className?: string }) {
  return (
    <FaInstagram
      aria-hidden
      title="Instagram"
      color="#E4405F"
      className={cn("h-4 w-4 shrink-0", className)}
    />
  );
}

export function FacebookIcon({ className }: { className?: string }) {
  return (
    <FaFacebook
      aria-hidden
      title="Facebook"
      color="#1877F2"
      className={cn("h-4 w-4 shrink-0", className)}
    />
  );
}
