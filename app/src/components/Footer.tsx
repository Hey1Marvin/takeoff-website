/* Footer — Server-Teil: holt die Daten. Darstellung: FooterView. */
import { settings } from "@/lib/data";
import FooterView from "./FooterView";

export default async function Footer() {
  const s = await settings();
  return (
    <FooterView
      social={{ instagram: s.instagram, telegram: s.telegram, soundcloud: s.soundcloud, tiktok: s.tiktok, email: s.email }}
    />
  );
}
