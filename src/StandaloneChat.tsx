import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ArrowUp, Check, Copy, Download, KeyRound, Menu, MessageSquarePlus, RotateCcw, Search, Square, Trash2, Upload, X } from "lucide-react";
import { ChatWelcome } from "./components/chat/ChatWelcome";
import { TagInstall } from "./components/chat/TagInstall";
import { SYNTHETIC_MODELS } from "./lib/syntheticModels";
import { completeChat, isProvider, PROVIDERS, type Connection, type Provider } from "./lib/provider";
import { downloadFile, newConversation, parseConversations, readConversations, writeConversations, type Conversation } from "./lib/conversations";
import "./standalone.css";

const MessageContent = lazy(() => import("./components/chat/MessageContent"));
const CONFIG_KEY = "tag_local_connection_v1";
function readConnection(): Connection {
  const fallback: Connection = { provider: "openrouter", model: PROVIDERS.openrouter.model, key: "", systemPrompt: "" };
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(CONFIG_KEY) ?? "null");
    if (!stored || typeof stored !== "object") return fallback;
    const config = stored as Record<string, unknown>;
    if (isProvider(config.provider)) return { provider: config.provider,
      model: typeof config.model === "string" ? config.model : PROVIDERS[config.provider].model,
      systemPrompt: typeof config.systemPrompt === "string" ? config.systemPrompt : "", key: "" };
  } catch { /* Settings are optional; never recover an API key from storage. */ }
  return fallback;
}

export default function StandaloneChat() {
  const [initial] = useState(readConversations);
  const [conversations, setConversations] = useState<Conversation[]>(() => initial.conversations.length ? initial.conversations : [newConversation()]);
  const [activeId, setActiveId] = useState(conversations[0].id);
  const [connection, setConnection] = useState(readConnection);
  const [draftConnection, setDraftConnection] = useState(connection);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 760px)").matches);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [storageWarning, setStorageWarning] = useState(initial.warning);
  const [savingPaused, setSavingPaused] = useState(!!initial.warning);
  const [copied, setCopied] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const feed = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = conversations.find((thread) => thread.id === activeId) ?? conversations[0];
  const connected = connection.provider === "ollama" || !!connection.key.trim();

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update); window.addEventListener("offline", update);
    const viewport = window.visualViewport;
    const resize = () => document.documentElement.style.setProperty("--tag-viewport-height", `${viewport?.height ?? window.innerHeight}px`);
    resize(); viewport?.addEventListener("resize", resize);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); viewport?.removeEventListener("resize", resize); document.documentElement.style.removeProperty("--tag-viewport-height"); };
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 760px)");
    const update = () => setMobile(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (savingPaused) return;
    const timer = setTimeout(() => {
      try { writeConversations(conversations); setStorageWarning(""); }
      catch { setStorageWarning("History couldn't be saved. Export a backup, then free some browser storage or delete older chats."); }
    }, 400);
    return () => clearTimeout(timer);
  }, [conversations, savingPaused]);

  useEffect(() => () => { controller.current?.abort(); if (copyTimer.current) clearTimeout(copyTimer.current); }, []);
  useEffect(() => {
    if (active.messages.length === 0) feed.current?.scrollTo({ top: 0 });
    else if (nearBottom.current) feed.current?.scrollTo({ top: feed.current.scrollHeight });
  }, [active.messages]);
  useEffect(() => {
    if (composer.current) { composer.current.style.height = "auto"; composer.current.style.height = `${Math.min(composer.current.scrollHeight, 180)}px`; }
  }, [draft]);
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || dialog.current?.open) return;
      if (event.key.toLowerCase() === "k") { event.preventDefault(); composer.current?.focus(); }
      if (event.key.toLowerCase() === "f" && event.shiftKey) { event.preventDefault(); setSidebarOpen(true); setTimeout(() => searchInput.current?.focus(), 0); }
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);

  function openSettings() { setDraftConnection(connection); dialog.current?.showModal(); }
  function chooseThread(id: string) { if (busy) return; setActiveId(id); setDraft(""); setError(""); setDeleteId(null); setSidebarOpen(false); nearBottom.current = true; }
  function createThread() {
    if (busy) return;
    if (conversations.length >= 100) { setError("You have 100 conversations. Export a backup and delete an older chat before starting another."); return; }
    const empty = conversations.find((thread) => thread.messages.length === 0);
    if (empty) { chooseThread(empty.id); composer.current?.focus(); return; }
    const thread = newConversation(); setConversations((prev) => [thread, ...prev]); chooseThread(thread.id); composer.current?.focus();
  }
  function deleteThread(id: string) {
    const remaining = conversations.filter((thread) => thread.id !== id);
    if (!remaining.length) remaining.push(newConversation());
    setConversations(remaining); setDeleteId(null);
    if (active.id === id) { setActiveId(remaining[0].id); setDraft(""); setError(""); }
  }

  async function send(retry = false) {
    if (controller.current || busy) return;
    if (!online && connection.provider !== "ollama") { setError("You're offline. Reconnect to send; your draft stays here."); return; }
    if (!connected) { openSettings(); return; }
    let messages = [...active.messages];
    if (retry) {
      const lastUser = messages.map((message) => message.role).lastIndexOf("user");
      if (lastUser < 0) return;
      messages = messages.slice(0, lastUser + 1);
    } else {
      if (!draft.trim()) return;
      messages.push({ id: crypto.randomUUID(), role: "user", content: draft.trim() });
    }
    if (messages.length >= 499) { setError("This conversation is full. Start a new chat to keep going."); return; }
    const replyId = crypto.randomUUID();
    const threadId = active.id;
    const title = messages.find((message) => message.role === "user")?.content.slice(0, 70) ?? "New conversation";
    const next = [...messages, { id: replyId, role: "assistant" as const, content: "", model: connection.model }];
    setConversations((prev) => prev.map((thread) => thread.id === threadId ? { ...thread, title, messages: next, updatedAt: Date.now() } : thread));
    setDraft(""); setError(""); setBusy(true); nearBottom.current = true;
    const aborter = new AbortController(); controller.current = aborter;
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; aborter.abort(); }, 120_000);
    try {
      await completeChat(connection, messages, aborter.signal, (text) => {
        setConversations((prev) => prev.map((thread) => thread.id === threadId ? { ...thread,
          messages: thread.messages.map((message) => message.id === replyId ? { ...message, content: message.content + text } : message),
        } : thread));
      });
    } catch (cause) {
      if (timedOut) setError("The provider took too long. Any partial answer is saved; retry when you're ready.");
      else if (!aborter.signal.aborted) setError(cause instanceof Error ? cause.message : "Something went wrong. Try again.");
    } finally { clearTimeout(timeout); controller.current = null; setBusy(false); composer.current?.focus(); }
  }

  async function copyMessage(id: string, text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(id); if (copyTimer.current) clearTimeout(copyTimer.current); copyTimer.current = setTimeout(() => setCopied(""), 1800); }
    catch { setError("Clipboard access was blocked. Select the text to copy it instead."); }
  }
  function exportChat() {
    const markdown = `# ${active.title}\n\n${active.messages.map((message) => `## ${message.role === "user" ? "You" : "Tag"}\n\n${message.content}`).join("\n\n---\n\n")}\n`;
    downloadFile("tag-conversation.md", markdown, "text/markdown");
  }

  return (
    <div className="tag-app">
      <a className="tag-skip" href="#tag-message">Skip to message</a>
      {sidebarOpen && <button className="tag-sidebar-backdrop" aria-label="Close conversations" onClick={() => setSidebarOpen(false)} />}
      <aside id="tag-sidebar" ref={node => { if (node) node.inert = mobile && !sidebarOpen; }} className={`tag-sidebar ${sidebarOpen ? "is-open" : ""}`} aria-hidden={mobile && !sidebarOpen} aria-label="Conversations">
        <div className="tag-brand"><img src="/logos/tag-graffiti.webp" alt="Tag" width="160" height="88" /><button className="tag-icon-button tag-mobile-only" aria-label="Close conversations" onClick={() => setSidebarOpen(false)}><X size={18} /></button></div>
        <button className="tag-new-chat" onClick={createThread} disabled={busy}><MessageSquarePlus size={17} />New conversation<span aria-hidden="true">＋</span></button>
        <label className="tag-search"><Search size={15} aria-hidden="true" /><input ref={searchInput} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a conversation" aria-label="Search conversations" /></label>
        <div className="tag-sidebar-label">Your conversations <span>{conversations.filter((thread) => thread.messages.length > 0).length}</span></div>
        <nav className="tag-thread-list" aria-label="Saved conversations">
          {conversations.filter((thread) => `${thread.title} ${thread.messages.map((message) => message.content).join(" ")}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => b.updatedAt - a.updatedAt).map((thread) => (
            <div key={thread.id} className={`tag-thread ${active.id === thread.id ? "is-active" : ""}`}>
              <button disabled={busy} aria-current={active.id === thread.id ? "page" : undefined} onClick={() => chooseThread(thread.id)}><span>{thread.title}</span><small>{thread.messages.length ? `${Math.ceil(thread.messages.length / 2)} exchanges` : "A fresh start"}</small></button>
              <button disabled={busy} className="tag-icon-button" aria-label={`Delete ${thread.title}`} onClick={() => setDeleteId(thread.id)}><Trash2 size={14} /></button>
              {deleteId === thread.id && <div className="tag-delete-confirm"><span>Delete this chat?</span><button onClick={() => deleteThread(thread.id)}>Delete</button><button onClick={() => setDeleteId(null)}>Cancel</button></div>}
            </div>
          ))}
          {search && !conversations.some((thread) => `${thread.title} ${thread.messages.map((message) => message.content).join(" ")}`.toLowerCase().includes(search.toLowerCase())) && <p className="tag-no-results">No conversations match.<button onClick={() => setSearch("")}>Clear search</button></p>}
        </nav>
        <div className="tag-sidebar-bottom">
          <TagInstall manifest="/manifest.webmanifest" />
          <button className="tag-connection" onClick={openSettings}><KeyRound size={16} /><span>{connected ? PROVIDERS[connection.provider].name : "Connect a provider"}<small>{connected ? "Key stays in this tab" : "Your models. Your key."}</small></span><span className={`tag-status-dot ${connected ? "connected" : ""}`} /></button>
          <div className="tag-backup-actions"><button onClick={() => downloadFile("tag-backup.json", JSON.stringify(conversations, null, 2), "application/json")}><Download size={13} />Backup</button><button disabled={busy} onClick={() => importInput.current?.click()}><Upload size={13} />Restore</button></div>
          <input ref={importInput} className="sr-only" type="file" accept=".json,application/json" aria-label="Import conversation backup" onChange={async (event) => {
            const file = event.target.files?.[0]; event.target.value = ""; if (!file || busy) return;
            try {
              if (file.size > 4_000_000) throw new Error("Keep backups under 4 MB.");
              const imported = parseConversations(await file.text());
              const merged = [...imported, ...conversations.filter((thread) => !imported.some((incoming) => incoming.id === thread.id))];
              if (merged.length > 100) throw new Error("The combined history exceeds 100 conversations. Delete older chats first.");
              if (new Blob([JSON.stringify(merged)]).size > 4_000_000) throw new Error("The combined history exceeds 4 MB. Export a backup and delete older chats first.");
              setConversations(merged); setSavingPaused(false); setError(""); if (imported[0]) chooseThread(imported[0].id);
            } catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn't read this backup."); }
          }} />
          <div className="tag-sidebar-links"><a href="https://github.com/h3cz/tag" target="_blank" rel="noreferrer">Source code ↗</a><a href="https://hecz.dev/chat" target="_blank" rel="noreferrer">Hosted Tag ↗</a></div>
        </div>
      </aside>
      <main className="tag-main" ref={node => { if (node) node.inert = mobile && sidebarOpen; }}>
        <header className="tag-header"><button className="tag-icon-button tag-mobile-only" aria-label="Open conversations" aria-expanded={sidebarOpen} aria-controls="tag-sidebar" onClick={() => setSidebarOpen(!sidebarOpen)}><Menu size={20} /></button><div><span className="tag-header-label">TAG / LOCAL CHAT</span><h1>{active.messages.length ? active.title : "New conversation"}</h1></div><button className="tag-model-button" onClick={openSettings}><span className={`tag-status-dot ${connected ? "connected" : ""}`} /><span className="tag-model-name">{connection.model}</span><KeyRound size={14} /></button>{active.messages.length > 0 && <button className="tag-icon-button" aria-label="Export conversation as Markdown" onClick={exportChat}><Download size={17} /></button>}</header>
        {storageWarning && <div className="tag-alert" role="status">{storageWarning}{savingPaused && <button className="tag-recovery-button" onClick={() => setSavingPaused(false)}>Start fresh</button>}</div>}
        <div ref={feed} className="tag-feed" onScroll={() => { const element = feed.current; if (element) nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 100; }}>
          {active.messages.length === 0 ? <ChatWelcome onPickPrompt={(prompt) => { setDraft(prompt); composer.current?.focus(); }} subtitle="No account. No middleman. Just you and your models." /> : <div className="tag-messages" aria-label="Conversation">
            {active.messages.map((message, index) => <article key={message.id} className={`tag-message tag-message-${message.role}`} aria-label={message.role === "user" ? "Your message" : "Tag's reply"}>
              <div className="tag-message-heading"><span>{message.role === "user" ? "YOU" : "TAG"}</span>{message.role === "assistant" && <small>{message.model}</small>}</div>
              {message.content ? <Suspense fallback={<p className="tag-plain-message">{message.content}</p>}><MessageContent content={message.content} /></Suspense> : <p role="status" className="tag-thinking">{busy ? "Waiting for the model…" : "No answer yet. Try again when you're ready."}</p>}
              {message.content && <div className="tag-message-actions"><button onClick={() => void copyMessage(message.id, message.content)} aria-label={copied === message.id ? "Message copied" : "Copy message"}>{copied === message.id ? <Check size={14} /> : <Copy size={14} />}{copied === message.id ? "Copied" : "Copy"}</button>{message.role === "assistant" && index === active.messages.length - 1 && <button disabled={busy} onClick={() => void send(true)}><RotateCcw size={14} />Try again</button>}</div>}
            </article>)}
          </div>}
        </div>
        <div className="tag-composer-area">
          {error && <div className="tag-error" role="alert"><span>{error}</span>{active.messages.some((message) => message.role === "user") && <button disabled={busy} onClick={() => void send(true)}>Retry</button>}<button className="tag-icon-button" aria-label="Dismiss error" onClick={() => setError("")}><X size={16} /></button></div>}
          <form className="tag-composer" onSubmit={(event) => { event.preventDefault(); void send(); }}>
            <textarea id="tag-message" ref={composer} aria-label="Message Tag" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Message Tag…" rows={2} maxLength={100_000} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && !window.matchMedia("(pointer: coarse)").matches) { event.preventDefault(); void send(); } }} />
            <div className="tag-composer-toolbar"><button type="button" onClick={openSettings}><KeyRound size={14} />{connected ? PROVIDERS[connection.provider].name : "Add your key"}</button><span>{busy ? "Writing…" : "Enter to send · Shift + Enter for a new line"}</span>{busy ? <button type="button" className="tag-send" aria-label="Stop response" onClick={() => controller.current?.abort()}><Square size={16} /></button> : <button className="tag-send" type="submit" aria-label="Send message" disabled={!draft.trim()}><ArrowUp size={20} /></button>}</div>
          </form>
          <p className="tag-composer-note">History stays in this browser. AI can make mistakes. Keep a little judgment in the loop.</p>
        </div>
      </main>
      <dialog ref={dialog} className="tag-settings" aria-labelledby="tag-settings-title">
        <form onSubmit={(event) => {
          event.preventDefault(); const next = { ...draftConnection, model: draftConnection.model.trim(), key: draftConnection.key.trim() };
          setConnection(next);
          try { localStorage.setItem(CONFIG_KEY, JSON.stringify({ provider: next.provider, model: next.model, systemPrompt: next.systemPrompt })); }
          catch { setStorageWarning("Connection settings couldn't be saved. Your key still works for this tab."); }
          dialog.current?.close(); composer.current?.focus();
        }}>
          <div className="tag-settings-heading"><div><p>MAKE YOURSELF AT HOME</p><h2 id="tag-settings-title">Your connection.</h2></div><button type="button" className="tag-icon-button" aria-label="Close connection settings" onClick={() => dialog.current?.close()}><X size={20} /></button></div>
          <p className="tag-settings-intro">Choose a provider and bring a key. Requests go directly from your browser to that provider.</p>
          <label>Provider<select value={draftConnection.provider} disabled={busy} onChange={(event) => { const provider = event.target.value as Provider; setDraftConnection((prev) => ({ ...prev, provider, model: PROVIDERS[provider].model, key: provider === connection.provider ? connection.key : "" })); }}>{Object.entries(PROVIDERS).map(([id, provider]) => <option key={id} value={id}>{provider.name}</option>)}</select></label>
          {draftConnection.provider === "synthetic" && <label>Synthetic models<select disabled={busy} value={SYNTHETIC_MODELS.some(m => m.id === draftConnection.model) ? draftConnection.model : ""} onChange={event => { if (event.target.value) setDraftConnection(prev => ({...prev,model:event.target.value})); }}><option value="">Custom model ID</option>{SYNTHETIC_MODELS.map(model => <option key={model.id} value={model.id}>{model.label} · {Math.round(model.contextWindow / 1024)}k</option>)}</select></label>}
          <label>Model ID<input required maxLength={200} disabled={busy} value={draftConnection.model} onChange={(event) => setDraftConnection((prev) => ({ ...prev, model: event.target.value }))} placeholder={PROVIDERS[draftConnection.provider].model} /></label>
          <label>API key {draftConnection.provider === "ollama" && "(optional)"}<input type="password" autoComplete="off" spellCheck={false} required={draftConnection.provider !== "ollama"} disabled={busy} value={draftConnection.key} onChange={(event) => setDraftConnection((prev) => ({ ...prev, key: event.target.value }))} placeholder="Kept in memory for this tab" /></label>
          <p className="tag-key-note">Your key is never saved to browser storage or included in backups. Reloading clears it. <a href={PROVIDERS[draftConnection.provider].keysUrl} target="_blank" rel="noreferrer">{draftConnection.provider === "ollama" ? "Ollama setup" : "Get a key"} ↗</a></p>
          {draftConnection.provider === "ollama" && <p className="tag-local-note">Start Ollama with this app's origin in OLLAMA_ORIGINS. Use Tag on localhost to avoid mixed-content restrictions. See the README for commands.</p>}
          <label>A little guidance <span>(optional)</span><textarea rows={3} maxLength={4000} disabled={busy} value={draftConnection.systemPrompt} onChange={(event) => setDraftConnection((prev) => ({ ...prev, systemPrompt: event.target.value }))} placeholder="Be concise. Ask questions when something is unclear." /></label>
          <div className="tag-settings-footer"><button type="button" disabled={busy || !connection.key} onClick={() => { setConnection((prev) => ({ ...prev, key: "" })); setDraftConnection((prev) => ({ ...prev, key: "" })); }}>Forget key</button><button type="submit" disabled={busy}>Save connection <ArrowUp size={16} /></button></div>
          {busy && <p className="tag-key-note">Stop the current response before changing your connection.</p>}
        </form>
      </dialog>
    </div>
  );
}
