"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

export function NavLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const current = pathname === href;
  return (
    <a href={href} className={className} aria-current={current ? "page" : undefined}>
      {children}
    </a>
  );
}
