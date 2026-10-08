import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

interface WorkerEvent {
  request: { method: string; mode: string; url: string };
  respondWith(response: Promise<unknown>): void;
  waitUntil(work: Promise<unknown>): void;
}
type WorkerHandler = (event: WorkerEvent) => void;

function worker(offline: boolean) {
  const handlers: Record<string, WorkerHandler> = {};
  const cached: Record<string, unknown> = { "/": "saved-chat-shell", "/offline.html": "offline-page" };
  const put = vi.fn();
  const fetch = vi.fn(async () => { if (offline) throw new Error("offline"); return {ok:true,headers:{get:()=>"text/html"},clone:()=>"public-shell"}; });
  runInNewContext(readFileSync("public/sw.js", "utf8"), { self:{location:{origin:"https://hecz.dev"},addEventListener:(name:string,handler:WorkerHandler)=>{handlers[name]=handler;}},caches:{match:async (key:string)=>cached[key],open:async()=>({put})},fetch,URL,Response });
  return {handlers,put,fetch};
}
async function navigate(state: ReturnType<typeof worker>, path: string) {
  let response: unknown; const work: Promise<unknown>[]=[];
  state.handlers.fetch({request:{method:"GET",mode:"navigate",url:"https://hecz.dev"+path},respondWith:(promise:Promise<unknown>)=>{response=promise;},waitUntil:(promise:Promise<unknown>)=>work.push(promise)});
  const result=await response; await Promise.all(work); return result;
}
describe("offline navigation privacy", () => {
  it("reopens the public chat shell offline, including installed launch URLs", async () => {
    expect(await navigate(worker(true),"/?source=installed")).toBe("saved-chat-shell");
  });
  it("does not serve or store private/shared routes as the chat shell", async () => {
    const online=worker(false); await navigate(online,"/chat/share/private-token"); await navigate(online,"/workspace/private-id");
    expect(online.put).not.toHaveBeenCalled();
    expect(await navigate(worker(true),"/workspace/private-id")).toBe("offline-page");
  });
  it("caches only the canonical public chat shell after a successful load", async () => {
    const online=worker(false); await navigate(online,"/?source=installed");
    expect(online.put).toHaveBeenCalledWith("/","public-shell");
  });
});
