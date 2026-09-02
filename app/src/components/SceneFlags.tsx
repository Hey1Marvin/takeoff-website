"use client";
/* Haelt `scene-edges` / `is-event` auf <html> bei Client-Navigation aktuell.

   Beim ERSTEN Laden stempelt das BOOT-Script in layout.tsx die Klassen
   bereits vor dem ersten Paint — diese Komponente ist nur fuer die
   Uebergaenge danach zustaendig. `useLayoutEffect` statt `useEffect`,
   damit die Klasse steht, bevor die neue Route gemalt wird.

   Rendert nichts. */
import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { sceneFlags } from "@/lib/sky/scene-routes";

export default function SceneFlags() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    const { edges, event } = sceneFlags(pathname || "/");
    const c = document.documentElement.classList;
    c.toggle("scene-edges", edges);
    c.toggle("is-event", event);
  }, [pathname]);

  return null;
}
