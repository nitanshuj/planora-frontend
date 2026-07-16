import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import ReactMarkdown from "react-markdown";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Sparkles, Send, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "planora.ai.chat.v1";

export function AiDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [input, setInput] = useState("");
  const [initial, setInitial] = useState<any[]>([]);
  const [ready, setReady] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setInitial(JSON.parse(raw));
    } catch {}
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <ChatBody
      key={initial.length ? "seeded" : "fresh"}
      open={open}
      onOpenChange={onOpenChange}
      initial={initial}
      input={input}
      setInput={setInput}
      inputRef={inputRef}
      scrollRef={scrollRef}
      onClear={() => {
        localStorage.removeItem(STORAGE_KEY);
        setInitial([]);
      }}
    />
  );
}

function ChatBody({
  open,
  onOpenChange,
  initial,
  input,
  setInput,
  inputRef,
  scrollRef,
  onClear,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: any[];
  input: string;
  setInput: (v: string) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onClear: () => void;
}) {
  const { messages, sendMessage, status } = useChat({
    id: "planora-chat",
    messages: initial,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onError: (e) => console.error(e),
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open, inputRef]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, scrollRef]);

  const busy = status === "submitted" || status === "streaming";

  const submit = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    await sendMessage({ text });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col gap-0">
        <SheetHeader className="p-4 border-b border-border/60 flex-row items-center justify-between space-y-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <span className="h-8 w-8 rounded-lg bg-primary/10 text-primary grid place-items-center">
              <Sparkles className="h-4 w-4" />
            </span>
            AI Financial Agent
          </SheetTitle>
          <Button variant="ghost" size="icon" onClick={onClear} title="New conversation">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-sm text-muted-foreground space-y-3">
              <p>Hi — I'm your Planora agent. Ask me about your spending, categories, or receipts.</p>
              <div className="grid gap-2">
                {[
                  "How much did I spend this month?",
                  "Which category am I over-budget on?",
                  "Summarize my last 5 transactions.",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage({ text: q })}
                    className="text-left px-3 py-2 rounded-lg border border-border/60 hover:bg-accent transition-colors text-foreground"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl text-sm leading-relaxed",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground px-4 py-2"
                    : "text-foreground",
                )}
              >
                {m.parts.map((p, i) =>
                  p.type === "text" ? (
                    m.role === "assistant" ? (
                      <div key={i} className="prose prose-sm max-w-none prose-p:my-2 prose-headings:mb-2 prose-headings:mt-3">
                        <ReactMarkdown>{p.text}</ReactMarkdown>
                      </div>
                    ) : (
                      <span key={i}>{p.text}</span>
                    )
                  ) : null,
                )}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex justify-start">
              <div className="text-xs text-muted-foreground animate-pulse">Thinking…</div>
            </div>
          )}
        </div>

        <div className="border-t border-border/60 p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="flex items-end gap-2"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={1}
              placeholder="Ask about your spending…"
              className="flex-1 resize-none max-h-32 rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <Button type="submit" size="icon" disabled={busy || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
