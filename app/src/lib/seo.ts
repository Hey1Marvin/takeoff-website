/* ============================================================
   Suchmaschinen-Freigabe.

   Standard ist AUS. Solange die Seite als Prototyp unter einer
   vercel.app-Adresse liegt, darf sie nicht in den Index: sie
   wuerde spaeter mit takeoff-potsdam.de um dieselben Begriffe
   konkurrieren, und wer takeoff sucht, landet auf einem
   Zwischenstand statt auf der echten Seite.

   Zum echten Start genau EINE Umgebungsvariable setzen:

     TAKEOFF_INDEX=1

   Auf Vercel unter Project Settings -> Environment Variables,
   danach neu bauen. Der Wert wird beim Build eingebacken, weil
   alle oeffentlichen Seiten statisch vorgerendert werden — ein
   Setzen zur Laufzeit hat keine Wirkung.
   ============================================================ */
export const indexingAllowed = process.env.TAKEOFF_INDEX === "1";
