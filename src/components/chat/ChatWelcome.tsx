import { useState } from "react";
import { ArrowUpRight, Code2, Lightbulb, PenLine } from "lucide-react";
import "./chat-welcome.css";

const STARTERS = {
  Create: [
    { title: "Find the right words", detail: "An email that sounds like you.", prompt: "Help me write an email. Ask me who it's for, what I want to say, and the tone before drafting." },
    { title: "Get an idea unstuck", detail: "Turn a rough thought into something real.", prompt: "Help me develop an idea. Start by asking what I'm thinking about, then explore three directions with me." },
    { title: "Make it clearer", detail: "Less noise. More meaning.", prompt: "Help me edit something I've written for clarity. Ask me to paste it and tell you who will read it." },
  ],
  Build: [
    { title: "Find the bug", detail: "A second pair of eyes on your code.", prompt: "Help me debug a problem. Ask for the code, the error, and what I expected before suggesting a fix." },
    { title: "From idea to first version", detail: "A small, shippable starting point.", prompt: "Help me plan the first version of an app. Ask who it's for and the one problem it should solve. Keep the first release small." },
    { title: "Review my approach", detail: "Catch the tradeoffs before you commit.", prompt: "Review a technical approach with me. Ask what I'm building and the constraints, then help me spot risks and simpler alternatives." },
  ],
  Learn: [
    { title: "Make it click", detail: "A tricky concept, explained simply.", prompt: "Teach me a concept. Ask what I want to understand and what I already know. Use an example, then check my understanding." },
    { title: "Quiz me", detail: "Practice that meets you where you are.", prompt: "Quiz me on a topic. Ask what I'm studying and my level. Give one question at a time and explain the answer after I try." },
    { title: "Connect the dots", detail: "Find the important parts of a long read.", prompt: "Help me understand something I've read. Ask me to paste it, then explain the main idea, key evidence, and open questions." },
  ],
};

type Category = keyof typeof STARTERS;
const ICONS = { Create: PenLine, Build: Code2, Learn: Lightbulb };

export interface ChatWelcomeProps {
  onPickPrompt: (prompt: string) => void;
  subtitle: string;
  modelName?: string;
  onOpenSettings?: () => void;
  customPrompts?: Array<{ id: string; name: string; content: string }>;
}

export function ChatWelcome({ onPickPrompt, subtitle, modelName, onOpenSettings, customPrompts = [] }: ChatWelcomeProps) {
  const [category, setCategory] = useState<Category>("Create");
  return (
    <section className="tag-welcome" aria-labelledby="tag-welcome-title">
      <div className="tag-welcome-eyebrow"><span aria-hidden="true" /> A little curiosity goes a long way</div>
      <h2 id="tag-welcome-title">Big ideas.<br /><span>Start here.</span></h2>
      <p className="tag-welcome-intro">A blank page is just a beginning. Make something, work through a problem, or follow a thought.</p>
      <div className="tag-starter-categories" aria-label="Prompt categories">
        {(Object.keys(STARTERS) as Category[]).map((name) => {
          const Icon = ICONS[name];
          return <button key={name} type="button" aria-pressed={category === name} onClick={() => setCategory(name)}><Icon size={16} aria-hidden="true" />{name}</button>;
        })}
      </div>
      <div className="tag-starter-list">
        {STARTERS[category].map((starter, i) => (
          <button key={starter.title} type="button" onClick={() => onPickPrompt(starter.prompt)}>
            <span className="tag-starter-number" aria-hidden="true">0{i + 1}</span>
            <span className="tag-starter-copy"><strong>{starter.title}</strong><span>{starter.detail}</span></span>
            <ArrowUpRight size={19} aria-hidden="true" />
          </button>
        ))}
      </div>
      {customPrompts.length > 0 && <details className="tag-saved-prompts"><summary>Your saved prompts</summary><div>{customPrompts.map((prompt) => <button key={prompt.id} type="button" onClick={() => onPickPrompt(prompt.content.replace(/\{\{selection\}\}|\{\{\}\}/g, ""))}>{prompt.name}<ArrowUpRight size={14} aria-hidden="true" /></button>)}</div></details>}
      <footer className="tag-welcome-footer"><span>{subtitle}</span>{modelName && <button type="button" onClick={onOpenSettings} disabled={!onOpenSettings}>{modelName}<ArrowUpRight size={13} aria-hidden="true" /></button>}</footer>
    </section>
  );
}
