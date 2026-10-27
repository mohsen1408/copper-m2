"use client";

// Module 2: one Ask Copper answer, drawn as stations on a rail in the order
// they happened (spec.md section 5): the tools Copper could use, its
// thinking, each tool call as an open card, what's happening now, and then the
// reply. The point is to show *how* Copper answered, not just what it said.
import {
  BrainIcon,
  ListIcon,
  Loader2Icon,
  TriangleAlertIcon,
  WrenchIcon,
} from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  type Progress,
  type Step,
  TOOL_LABELS,
  type ToolStep,
} from "@/lib/copper/assistant/progress";

const TOOL_NAMES = Object.keys(TOOL_LABELS);

const PRODUCT_NAMES: Record<string, string> = {
  "copper-home": "Copper Home",
  "copper-notes": "Copper Notes",
};
const PLAN_NAMES: Record<string, string> = {
  free: "Free",
  "copper-plus": "Copper Plus",
};

/** "$149", "$7.99". The panel only shows numbers the tools sent back. */
const usd = (amount: unknown) => {
  const n = Number(amount);
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
};

/** "2026-11-14" → "Nov 14, 2026". */
const longDate = (iso: string) => {
  const date = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      });
};

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

/** Renders the **bold** and `code` marks in Gemini's thought summaries. */
export function MarkdownLite({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((piece, j) =>
            piece.startsWith("**") && piece.endsWith("**") && piece.length > 4 ? (
              <strong key={j} className="text-foreground/80 not-italic">
                {piece.slice(2, -2)}
              </strong>
            ) : piece.startsWith("`") && piece.endsWith("`") && piece.length > 2 ? (
              <code key={j} className="font-mono text-xs not-italic">
                {piece.slice(1, -1)}
              </code>
            ) : (
              <Fragment key={j}>{piece}</Fragment>
            ),
          )}
        </Fragment>
      ))}
    </>
  );
}

function Station({
  icon,
  node,
  label,
  children,
}: {
  icon: ReactNode;
  node: string;
  label?: string;
  children: ReactNode;
}) {
  return (
    <li className="relative pl-10">
      <span
        aria-hidden
        className={cn(
          "ring-secondary absolute top-0 left-0 flex size-7 items-center justify-center rounded-full ring-4",
          node,
        )}
      >
        {icon}
      </span>
      {label && (
        <p className="text-muted-foreground mb-2 pt-1.5 text-[0.7rem] font-semibold tracking-widest uppercase">
          {label}
        </p>
      )}
      {children}
    </li>
  );
}

function ToolsStation({
  used,
  useTools,
}: {
  used: Set<string>;
  useTools: boolean;
}) {
  if (!useTools) {
    return (
      <Station
        icon={<ListIcon className="size-3.5" />}
        node="bg-chart-3 text-primary-foreground"
        label="Tools given to Copper: none"
      >
        <div className="flex flex-wrap gap-1.5">
          {TOOL_NAMES.map((name) => (
            <span
              key={name}
              className="text-muted-foreground/70 rounded-full border px-2 py-0.5 font-mono text-xs line-through"
            >
              {name}
            </span>
          ))}
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          Copper has to answer from memory alone.
        </p>
      </Station>
    );
  }
  return (
    <Station
      icon={<ListIcon className="size-3.5" />}
      node="bg-primary text-primary-foreground"
      label="Tools Copper can use"
    >
      <div className="flex flex-wrap gap-1.5">
        {TOOL_NAMES.map((name) => (
          <span
            key={name}
            className={cn(
              "rounded-full border px-2 py-0.5 font-mono text-xs",
              used.has(name)
                ? "bg-accent text-accent-foreground border-accent font-bold"
                : "text-muted-foreground bg-background/60",
            )}
          >
            {name}
          </span>
        ))}
      </div>
    </Station>
  );
}

function SentRows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
      {rows.map(([label, value]) => (
        <Fragment key={label}>
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-medium">{value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

/** What Copper sent, as a labelled list. Never raw JSON. */
function WhatSent({ step }: { step: ToolStep }) {
  if (step.name === "get_prices")
    return <p>Nothing, it just asked for the price list.</p>;
  if (step.name === "get_products")
    return <p>Nothing, it just asked what Copper sells.</p>;
  if (step.input === undefined)
    return <p className="text-muted-foreground italic">filling in the details…</p>;

  const input = record(step.input);
  if (step.name === "calculate_cost") {
    const products = Array.isArray(input.products) ? input.products : [];
    return (
      <SentRows
        rows={[
          [
            "Products",
            products.length
              ? products.map((p) => PRODUCT_NAMES[String(p)] ?? String(p)).join(", ")
              : "None",
          ],
          ["Plan", PLAN_NAMES[String(input.plan)] ?? String(input.plan)],
          ["Billing", String(input.billing)],
          ["Years", String(input.years)],
        ]}
      />
    );
  }
  if (step.name === "check_availability") {
    return (
      <SentRows
        rows={[
          ["Product", PRODUCT_NAMES[String(input.product)] ?? String(input.product)],
          ["Color", input.color ? String(input.color) : "Every color"],
        ]}
      />
    );
  }
  return (
    <SentRows
      rows={Object.entries(input).map(([key, value]) => [key, String(value)])}
    />
  );
}

const STOCK_PILL: Record<string, string> = {
  in_stock: "bg-accent text-accent-foreground",
  low_stock: "bg-chart-4 text-primary-foreground",
  backordered: "bg-chart-3 text-primary-foreground",
};

/** What came back, drawn for each tool. */
function WhatCameBack({ step }: { step: ToolStep }) {
  if (step.state === "calling") {
    return (
      <p className="text-muted-foreground flex items-center gap-2 italic">
        <Loader2Icon className="size-4 animate-spin" aria-hidden />
        the app is running the code…
      </p>
    );
  }
  if (step.state === "error") {
    return (
      <p className="text-muted-foreground">
        The tool couldn&apos;t answer: {String(step.output)}
      </p>
    );
  }

  const output = record(step.output);

  if (step.name === "calculate_cost") {
    const lines = Array.isArray(output.lines) ? output.lines.map(record) : [];
    return (
      <div className="flex flex-col gap-1">
        {lines.map((line, i) => (
          <div key={i} className="flex justify-between gap-4">
            <span>{String(line.item)}</span>
            <span className="font-medium tabular-nums">{usd(line.usd)}</span>
          </div>
        ))}
        <div className="border-accent/40 mt-1 flex items-baseline justify-between gap-4 border-t pt-2">
          <span className="font-semibold">Total</span>
          <span className="text-primary text-2xl font-extrabold tabular-nums">
            {usd(output.totalUsd)}
          </span>
        </div>
      </div>
    );
  }

  if (step.name === "get_products") {
    const products = Array.isArray(output.products) ? output.products.map(record) : [];
    return (
      <div className="flex flex-col gap-3">
        {products.map((p) => (
          <div key={String(p.id)}>
            <div className="flex justify-between gap-4 font-semibold">
              <span>{String(p.name)}</span>
              <span className="tabular-nums">{usd(p.priceUsd)}</span>
            </div>
            <p className="text-muted-foreground text-xs">{String(p.type)}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {(Array.isArray(p.colors) ? p.colors : []).map((c) => (
                <span
                  key={String(c)}
                  className="bg-accent/20 rounded-full px-2 py-0.5 text-xs"
                >
                  {String(c)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (step.name === "get_prices") {
    const products = Array.isArray(output.products) ? output.products.map(record) : [];
    const plans = Array.isArray(output.plans) ? output.plans.map(record) : [];
    return (
      <div className="flex flex-col gap-1">
        {products.map((p) => (
          <div key={String(p.id)} className="flex justify-between gap-4">
            <span>{String(p.name)}</span>
            <span className="font-medium tabular-nums">{usd(p.priceUsd)}</span>
          </div>
        ))}
        {plans
          .filter((p) => Number(p.monthlyUsd) > 0)
          .map((p) => (
            <div key={String(p.id)} className="flex justify-between gap-4">
              <span>{String(p.name)}</span>
              <span className="font-medium tabular-nums">
                {usd(p.monthlyUsd)}/mo · {usd(p.annualUsd)}/yr
              </span>
            </div>
          ))}
      </div>
    );
  }

  if (step.name === "check_availability") {
    if (output.status === "not_a_color") {
      const colors = Array.isArray(output.colors) ? output.colors.map(String) : [];
      return (
        <p>
          {String(output.product)} doesn&apos;t come in {String(output.color)}. It
          comes in {colors.join(", ")}.
        </p>
      );
    }
    if (output.status === "unavailable") return <p>{String(output.message)}</p>;
    const colors = Array.isArray(output.colors) ? output.colors.map(record) : [];
    return (
      <div className="flex flex-col gap-1.5">
        <p className="font-semibold">{String(output.product)}</p>
        {colors.map((c) => (
          <div key={String(c.color)} className="flex items-center justify-between gap-4">
            <span>{String(c.color)}</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-semibold",
                STOCK_PILL[String(c.stock)],
              )}
            >
              {c.stock === "in_stock"
                ? "In stock"
                : c.stock === "low_stock"
                  ? "Low stock"
                  : `Back-ordered until ${longDate(String(c.restockDate))}`}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <pre className="overflow-x-auto font-mono text-xs whitespace-pre-wrap">
      {JSON.stringify(step.output, null, 2)}
    </pre>
  );
}

/** One tool call: always open, a round trip from what was sent to what came back. */
export function ToolCard({ step, number }: { step: ToolStep; number: number }) {
  return (
    <div
      data-testid="tool-call"
      data-tool={step.name}
      className="bg-background overflow-hidden rounded-xl border text-sm"
    >
      <div className="bg-accent text-accent-foreground flex flex-wrap items-center gap-2 px-3 py-2">
        <span className="font-mono font-bold">{step.name}()</span>
        <span className="bg-background/30 rounded-full px-1.5 text-[0.65rem] font-semibold">
          tool {number}
        </span>
        <span className="ml-auto text-xs">{TOOL_LABELS[step.name] ?? step.name}</span>
      </div>
      <div className="px-3 py-2.5">
        <p className="text-muted-foreground mb-1.5 text-[0.7rem] font-semibold tracking-widest uppercase">
          → What Copper sent
        </p>
        <WhatSent step={step} />
      </div>
      <div className="bg-accent/10 border-t px-3 py-2.5">
        <p className="text-muted-foreground mb-1.5 text-[0.7rem] font-semibold tracking-widest uppercase">
          ← What came back
        </p>
        <WhatCameBack step={step} />
      </div>
    </div>
  );
}

function nowText(progress: Progress, useTools: boolean) {
  if (progress.reply) return "Writing the answer…";
  if (!useTools) return "Answering from memory…";
  return progress.steps.length ? "Deciding what to do next…" : "Reading your question…";
}

function stepStation(step: Step, toolNumber: number, useTools: boolean, key: number) {
  if (step.type === "thinking") {
    return (
      <Station
        key={key}
        icon={<BrainIcon className="size-3.5" />}
        node={cn(useTools ? "bg-primary" : "bg-chart-3", "text-primary-foreground")}
        label="Copper is thinking"
      >
        <p
          data-testid="thinking"
          className="text-muted-foreground border-l-2 pl-3 text-sm italic"
        >
          <MarkdownLite text={step.text} />
        </p>
      </Station>
    );
  }
  return (
    <Station
      key={key}
      icon={<WrenchIcon className="size-3.5" />}
      node="bg-accent text-accent-foreground"
      label={step.state === "calling" ? "Copper is calling a tool" : "Copper called a tool"}
    >
      <ToolCard step={step} number={toolNumber} />
    </Station>
  );
}

/** One answer: the stations on the rail, then the reply bubble. */
export function AskCopperAnswer({
  progress,
  useTools,
}: {
  progress: Progress;
  useTools: boolean;
}) {
  const working = progress.status === "working";
  const used = new Set(
    progress.steps.filter((s): s is ToolStep => s.type === "tool").map((s) => s.name),
  );
  let toolNumber = 0;

  return (
    <div className="flex flex-col gap-4">
      <ol className="relative flex flex-col gap-5">
        <span
          aria-hidden
          className={cn(
            "absolute top-2 bottom-2 left-[13px] w-0.5 rounded-full bg-gradient-to-b",
            useTools ? "from-primary via-accent to-accent" : "from-chart-3 to-chart-3",
          )}
        />
        <ToolsStation used={used} useTools={useTools} />
        {progress.steps.map((step, i) =>
          stepStation(step, step.type === "tool" ? ++toolNumber : 0, useTools, i),
        )}
        {working && (
          <Station
            icon={
              <span className="flex gap-0.5">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="bg-primary-foreground size-1 animate-bounce rounded-full"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </span>
            }
            node={cn("animate-pulse", useTools ? "bg-primary" : "bg-chart-3")}
          >
            <p className="text-muted-foreground pt-1 text-sm">
              {nowText(progress, useTools)}
            </p>
          </Station>
        )}
      </ol>

      {(progress.reply || !working) && (
        <div className="bg-background ml-10 rounded-2xl rounded-tl-sm border p-3.5 shadow-sm">
          <p className="text-primary mb-1 text-xs font-bold">Copper</p>
          {!useTools && (
            <div className="border-chart-3 bg-chart-3/10 mb-2.5 rounded-lg border p-2.5 text-xs">
              <p className="flex items-center gap-1.5 font-bold">
                <TriangleAlertIcon className="text-chart-3 size-4" aria-hidden />
                Answered without tools: may be made up
              </p>
              <p className="text-muted-foreground mt-1">
                With tools off, Copper can&apos;t see today&apos;s prices or stock. The
                AI only has what it learned in training, so it fills the gaps with
                guesses that sound right. That&apos;s a hallucination.
              </p>
            </div>
          )}
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {progress.reply}
            {working && (
              <span
                aria-hidden
                className="bg-primary ml-0.5 inline-block h-4 w-0.5 animate-pulse align-text-bottom"
              />
            )}
          </p>
        </div>
      )}
    </div>
  );
}
