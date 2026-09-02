"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navLinks } from "@/lib/site";
import { useI18n } from "./I18nProvider";
import { tLabel } from "@/lib/i18n";

export default function NavLinks() {
  const { t, locale } = useI18n();
  const path = usePathname();
  return (
    <nav className="nav-links" aria-label={t("a11y.nav.main")}>
      <ul>
        {navLinks().map(l => (
          <li key={l.href}>
            <Link href={l.href} aria-current={path.startsWith(l.href) ? "true" : undefined}>
              {tLabel(l.key, l.label, locale)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
