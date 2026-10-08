import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, X } from "lucide-react";
import "./tag-install.css";

interface InstallEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{outcome: "accepted" | "dismissed"}> }
export function TagInstall({ manifest = "/chat.webmanifest" }: { manifest?: string }) {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(() => window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & {standalone?: boolean}).standalone));
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const head = [
      {selector:'link[rel="manifest"]',attribute:"href",value:manifest},
      {selector:'link[rel="apple-touch-icon"]',attribute:"href",value:"/tag-icon-192.png"},
      {selector:'meta[name="apple-mobile-web-app-title"]',attribute:"content",value:"Tag"},
      {selector:'meta[name="apple-mobile-web-app-status-bar-style"]',attribute:"content",value:"default"},
      {selector:'meta[name="theme-color"]',attribute:"content",value:"#FAF8F5"},
    ].map(setting => ({...setting,node:document.querySelector(setting.selector),original:document.querySelector(setting.selector)?.getAttribute(setting.attribute)}));
    head.forEach(setting => setting.node?.setAttribute(setting.attribute,setting.value));
    const receive = (event: Event) => { event.preventDefault(); setPrompt(event as InstallEvent); };
    const done = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener("beforeinstallprompt", receive);
    window.addEventListener("appinstalled", done);
    return () => { head.forEach(setting => { if (setting.node && setting.original) setting.node.setAttribute(setting.attribute,setting.original); }); window.removeEventListener("beforeinstallprompt", receive); window.removeEventListener("appinstalled", done); };
  }, [manifest]);
  if (installed) return null;
  return <>
    <button type="button" className="tag-install-button" onClick={async () => {
      if (!prompt) { dialog.current?.showModal(); return; }
      try { await prompt.prompt(); const choice = await prompt.userChoice; if (choice.outcome === "accepted") setInstalled(true); }
      catch { dialog.current?.showModal(); }
      finally { setPrompt(null); }
    }}><ArrowDownToLine size={16} aria-hidden="true"/>Install Tag</button>
    <dialog ref={dialog} className="tag-install-dialog" aria-labelledby="tag-install-title"><header><h2 id="tag-install-title">Keep Tag close.</h2><button type="button" aria-label="Close install instructions" onClick={()=>dialog.current?.close()}><X size={20}/></button></header><p>Open Tag from your home screen, in its own window.</p><ol><li><strong>iPhone or iPad</strong><span>In Safari, tap Share, then Add to Home Screen.</span></li><li><strong>Android</strong><span>In Chrome, open the menu and choose Install app or Add to Home screen.</span></li><li><strong>Desktop</strong><span>Use the install icon in Chrome or Edge's address bar when available.</span></li></ol><p className="tag-install-note">Chat needs an internet connection. Previously opened chats can be available offline on this device.</p></dialog>
  </>;
}
