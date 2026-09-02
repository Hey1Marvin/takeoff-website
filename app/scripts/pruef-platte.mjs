/* Prueft die Frontplatte auf jeder Crew-Seite: ist sie da, sind die
   Ablesungen lesbar, fuehren verlinkte Ablesungen irgendwohin, und
   ueberlaeuft nichts. Zwei Breiten, beide Themen. */
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os"; import { join } from "node:path";
const BASIS="http://localhost:3400";
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const ROUTEN=["/crew","/crew/schichten","/crew/schichten/verfuegbarkeit","/crew/schichten/plan-bauen",
 "/crew/briefing","/crew/notfall","/crew/uebergabe","/crew/schulungen","/crew/bordbuch",
 "/crew/inventar","/crew/archiv","/crew/leute","/crew/ideen","/crew/abstimmungen",
 "/crew/kalender","/crew/profil","/admin","/admin/rechte","/admin/postfach"];

async function browser(breite){
  const port=9500+Math.floor(Math.random()*400), prof=mkdtempSync(join(tmpdir(),"cr-"));
  spawn("chromium",["--headless","--disable-gpu","--no-sandbox","--hide-scrollbars",
    `--remote-debugging-port=${port}`,`--user-data-dir=${prof}`,`--window-size=${breite},1200`,"about:blank"],{stdio:"ignore"});
  let u; for(let i=0;i<80&&!u;i++){try{u=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t=>t.type==="page")?.webSocketDebuggerUrl;}catch{} if(!u)await sleep(250);}
  const ws=new WebSocket(u); let id=0; const w=new Map();
  ws.addEventListener("message",e=>{const m=JSON.parse(e.data); if(m.id&&w.has(m.id)){w.get(m.id)(m.result);w.delete(m.id);}});
  await new Promise(r=>ws.addEventListener("open",r));
  const send=(m,p={})=>new Promise(res=>{const i=++id;w.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}));});
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride",{width:breite,height:1200,deviceScaleFactor:1,mobile:breite<600});
  const js=async e=>(await send("Runtime.evaluate",{expression:e,returnByValue:true,awaitPromise:true})).result?.value;
  return {js, geh:async(u2,ms=2400)=>{await send("Page.navigate",{url:u2});await sleep(ms);}};
}

const fehler=[];
for (const breite of [390, 1280]) {
  const b=await browser(breite);
  await b.geh(`${BASIS}/crew/login`,2800);
  await b.js(`(()=>{const f=document.querySelectorAll('form')[0];f.querySelector('input[name=email]').value="marvin@friseurtelefon.de";f.querySelector('input[name=passwort]').value="bassbox-marsflug-31";f.requestSubmit();return 1})()`);
  await sleep(3800);
  for (const r of ROUTEN) {
    await b.geh(BASIS+r);
    const d = await b.js(`(() => {
      const p = document.querySelector('.crew-platte');
      if (!p) return { fehlt: true };
      const name = p.querySelector('.crew-platte-name')?.textContent?.trim() ?? '';
      const werte = [...p.querySelectorAll('.crew-ablesung')].map(a => ({
        wert: a.querySelector('.crew-ablesung-wert')?.textContent?.trim() ?? '',
        label: a.querySelector('.crew-ablesung-label')?.textContent?.trim() ?? '',
        h: Math.round(a.getBoundingClientRect().height),
        href: a.getAttribute('href') || null,
      }));
      // Fuehrt ein Anker-Link wirklich irgendwohin?
      const tote = werte.filter(v => v.href?.startsWith('#') && !document.getElementById(v.href.slice(1)));
      return {
        name, werte, tote: tote.map(t => t.href),
        ueberlauf: document.documentElement.scrollWidth > window.innerWidth + 1,
        rohcode: werte.some(v => /^[a-z]+\\.[a-z.]+$/.test(v.wert)),
      };
    })()`);
    const kopf = `${breite}px ${r}`;
    if (!d) { fehler.push(`${kopf}: Seite lieferte nichts`); continue; }
    if (d.fehlt) { fehler.push(`${kopf}: KEINE FRONTPLATTE`); continue; }
    if (d.ueberlauf) fehler.push(`${kopf}: horizontaler Überlauf`);
    if (d.tote?.length) fehler.push(`${kopf}: toter Anker ${d.tote.join(", ")}`);
    if (d.rohcode) fehler.push(`${kopf}: Rohcode in einer Ablesung`);
    for (const v of d.werte) {
      if (v.h < 48) fehler.push(`${kopf}: Ablesung "${v.label}" nur ${v.h}px hoch`);
      if (!v.label) fehler.push(`${kopf}: Ablesung ohne Label`);
      if (v.wert === "") fehler.push(`${kopf}: Ablesung "${v.label}" ohne Wert`);
    }
    if (breite === 1280) console.log(`  ${r.padEnd(34)} ${d.name.padEnd(24)} ${d.werte.map(v=>`${v.wert} ${v.label}`).join(" · ")}`);
  }
}
console.log(fehler.length ? "\n✗ " + fehler.length + " Befunde:\n" + fehler.map(f=>"  "+f).join("\n")
                          : "\n✓ alle Frontplatten in Ordnung, 390px und 1280px");
process.exit(0);
