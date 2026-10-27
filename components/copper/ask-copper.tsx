"use client";

// Module 2: Ask Copper, the floating shopping chat (spec.md sections 4 and 5).
// A launcher opens a Sheet with two separate chats, tools on and tools off,
// so the tools-off model can never copy an answer the tools worked out. Each
// answer streams in from askCopper() and is drawn by AskCopperAnswer.
import { ArrowUpIcon, MessageCircleIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { AskCopperAnswer } from "@/components/copper/ask-copper-answer";
import { SetupRequired } from "@/components/setup-required";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { readLive } from "@/lib/ai/live";
import { askCopper, type ChatMessage } from "@/lib/copper/assistant/ask";
import type { Progress } from "@/lib/copper/assistant/progress";

/** The three starter questions, word for word (they open the report too). */
const STARTERS = [
  "How much is Copper Home with Copper Plus, paid yearly, for 2 years?",
  "Is Copper Notes in Night Sky in stock?",
  "Is Copper Plus cheaper monthly or yearly?",
];

const FAILED: Progress = {
  steps: [],
  reply: "Sorry, I couldn't reach Copper just now. Please try again.",
  status: "error",
};

type Turn = { question: string; progress: Progress };
type Chats = { on: Turn[]; off: Turn[] };

/** The finished turns as plain messages: questions and Copper's replies only. */
const historyOf = (turns: Turn[]): ChatMessage[] =>
  turns.flatMap((turn) => [
    { role: "user" as const, content: turn.question },
    ...(turn.progress.status === "working" || !turn.progress.reply
      ? []
      : [{ role: "assistant" as const, content: turn.progress.reply }]),
  ]);

export function AskCopper({ aiConfigured }: { aiConfigured: boolean }) {
  const [open, setOpen] = useState(false);
  const [useTools, setUseTools] = useState(true);
  const [chats, setChats] = useState<Chats>({ on: [], off: [] });
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const key = useTools ? "on" : "off";
  const turns = chats[key];
  const busy = turns.some((turn) => turn.progress.status === "working");

  // Open on /#ask, on a hash change to #ask, and on any click of an #ask link:
  // once the address already ends in #ask, clicking again fires no hashchange.
  useEffect(() => {
    const openIfAsk = () => {
      if (window.location.hash === "#ask") setOpen(true);
    };
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a");
      if (link?.getAttribute("href")?.endsWith("#ask")) setOpen(true);
    };
    openIfAsk();
    window.addEventListener("hashchange", openIfAsk);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", openIfAsk);
      document.removeEventListener("click", onClick);
    };
  }, []);

  // Keep the newest step in view as it streams in.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, open]);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    const chat = key;
    const tools = useTools;
    const messages = [...historyOf(chats[chat]), { role: "user" as const, content: text }];
    const index = chats[chat].length;
    const setProgress = (progress: Progress) =>
      setChats((all) => ({
        ...all,
        [chat]: all[chat].map((turn, i) => (i === index ? { ...turn, progress } : turn)),
      }));

    setDraft("");
    setChats((all) => ({
      ...all,
      [chat]: [
        ...all[chat],
        { question: text, progress: { steps: [], reply: "", status: "working" } },
      ],
    }));

    try {
      const { progress } = await askCopper({ messages, useTools: tools });
      for await (const update of readLive(progress)) setProgress(update);
    } catch {
      setProgress(FAILED);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void ask(draft);
  }

  return (
    <>
      <Button
        type="button"
        data-testid="ask-copper-launcher"
        onClick={() => setOpen(true)}
        className="fixed right-5 bottom-5 z-40 h-12 gap-2 rounded-full px-5 text-base shadow-lg"
      >
        <MessageCircleIcon className="size-5" aria-hidden />
        Ask Copper
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          showCloseButton={false}
          data-testid="ask-copper"
          className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
        >
          <div className="bg-foreground text-background">
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="bg-primary flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full">
                <Image
                  src="/assets/brand/copper-mascot.png"
                  alt="Copper, the robot mascot, waving"
                  width={40}
                  height={40}
                  className="size-9 object-contain"
                />
              </span>
              <div className="min-w-0 flex-1">
                <SheetTitle className="text-background text-lg font-bold">
                  Ask Copper
                </SheetTitle>
                <SheetDescription className="text-background/70 text-xs">
                  Prices, totals and stock, checked with tools.
                </SheetDescription>
              </div>
              <SheetClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-background hover:bg-background/10 hover:text-background"
                >
                  <XIcon className="size-5" aria-hidden />
                  <span className="sr-only">Close</span>
                </Button>
              </SheetClose>
            </div>
            {aiConfigured && (
              <div className="bg-background/10 flex items-center gap-3 px-4 py-2">
                <div className="flex-1">
                  <p className="text-sm font-semibold">Use tools</p>
                  <p className="text-background/70 text-xs">
                    {useTools ? "Checks every answer" : "Model guesses alone"}
                  </p>
                </div>
                <Switch
                  aria-label="Use tools"
                  checked={useTools}
                  onCheckedChange={setUseTools}
                />
              </div>
            )}
          </div>

          {aiConfigured ? (
            <>
              <div
                ref={scrollRef}
                className="bg-secondary text-secondary-foreground flex-1 overflow-y-auto px-4 py-5"
              >
                <div className="flex flex-col gap-6">
                  {turns.length === 0 && (
                    <p className="text-muted-foreground text-sm">
                      {useTools
                        ? "Hi! I'm Copper. Ask me about prices, totals or what's in stock today."
                        : "Tools are off: Copper will answer from memory alone."}
                    </p>
                  )}
                  {turns.map((turn, i) => (
                    <div key={i} className="flex flex-col gap-4">
                      <p className="bg-primary text-primary-foreground ml-auto max-w-[85%] rounded-2xl rounded-tr-sm px-3.5 py-2 text-sm">
                        {turn.question}
                      </p>
                      <AskCopperAnswer progress={turn.progress} useTools={useTools} />
                    </div>
                  ))}
                  {!busy && (
                    <div className="flex flex-col gap-2">
                      {turns.length > 0 && (
                        <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                          Try another
                        </p>
                      )}
                      {STARTERS.map((starter) => (
                        <button
                          key={starter}
                          type="button"
                          onClick={() => void ask(starter)}
                          className="bg-background hover:border-primary rounded-xl border px-3 py-2 text-left text-sm transition-colors"
                        >
                          {starter}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <form
                onSubmit={onSubmit}
                className="bg-background flex items-center gap-2 border-t p-3"
              >
                <input
                  type="text"
                  aria-label="Your question"
                  placeholder="Ask about prices, totals or stock…"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  className="border-input focus-visible:ring-ring/50 h-10 min-w-0 flex-1 rounded-full border px-4 text-sm outline-none focus-visible:ring-3"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={busy || !draft.trim()}
                  className="size-10 shrink-0 rounded-full"
                >
                  <ArrowUpIcon className="size-5" aria-hidden />
                  <span className="sr-only">Send</span>
                </Button>
              </form>
            </>
          ) : (
            <div className="bg-secondary flex-1 overflow-y-auto px-4">
              <SetupRequired service="ai" />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
