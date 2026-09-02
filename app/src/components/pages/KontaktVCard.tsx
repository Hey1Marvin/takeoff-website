"use client";
/* Kontakt als .vcf-Datei speichern — Portierung von buildVCard()/
   wireVCard() aus assets/js/pages/kontakt.js. Mail/Telegram/Instagram
   kommen aus settings() (Props von der Seite), nicht hartkodiert. */
export default function KontaktVCard({
  buttonLabel, note, orgName, email, telegram, instagram,
}: {
  buttonLabel: string;
  note: string;
  orgName: string;
  email: string;
  telegram: string;
  instagram: string;
}) {
  const onClick = () => {
    const vcard = [
      "BEGIN:VCARD", "VERSION:3.0",
      `FN:${orgName}`, `ORG:${orgName}`,
      `EMAIL;TYPE=INTERNET:${email}`,
      `URL;TYPE=Telegram:${telegram}`,
      `URL;TYPE=Instagram:${instagram}`,
      "NOTE:Rave-Kollektiv Potsdam — ehrenamtlich unterwegs",
      "END:VCARD",
    ].join("\r\n");
    const blob = new Blob([vcard], { type: "text/vcard;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "takeoff-potsdam.vcf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  return (
    <>
      <button type="button" className="btn btn-ghost fs-btn-ico" onClick={onClick}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3v12m0 0-4-4m4 4 4-4" />
          <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
        {buttonLabel}
      </button>
      <p className="lu-note">{note}</p>
    </>
  );
}
