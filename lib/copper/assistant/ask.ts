"use server";

// Module 2: the server action the Ask Copper chat calls. It streams the
// conversation to the model through callStream (lib/ai/call.ts), with or
// without the tools, and sends back each step as it happens, so the panel can
// show Copper thinking and using its tools. The contract is in
// specs/module-2/spec.md.
import { stepCountIs } from "ai";
import { callStream, THOUGHT_SUMMARIES } from "@/lib/ai/call";
import { createLive, type Live } from "@/lib/ai/live";
import { COPPER_INSTRUCTIONS } from "@/lib/copper/assistant/instructions";
import type { Progress, ToolStep } from "@/lib/copper/assistant/progress";
import { copperTools } from "@/lib/copper/assistant/tools";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type AskCopperRequest = {
  messages: ChatMessage[];
  useTools: boolean;
};

export type AskCopperResult = { progress: Live<Progress> };

/** At most this many model steps (tool calls plus the reply) per question. */
const MAX_STEPS = 5;

const EMPTY_REPLY =
  "Sorry, I couldn't come up with an answer. Please try asking again.";
const ERROR_REPLY =
  "Sorry, something went wrong on my end. Please try again in a moment.";

/** A fresh copy, so updates already sent never change underneath the panel. */
const snapshot = (progress: Progress): Progress => ({
  ...progress,
  steps: progress.steps.map((step) => ({ ...step })),
});

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export async function askCopper(
  request: AskCopperRequest,
): Promise<AskCopperResult> {
  const { live, update, done } = createLive<Progress>();
  // Start reading in the background and return straight away, so the panel
  // can draw each update as it arrives.
  void stream(request, update, done);
  return { progress: live };
}

async function stream(
  { messages, useTools }: AskCopperRequest,
  update: (progress: Progress) => void,
  done: (progress: Progress) => void,
) {
  const progress: Progress = { steps: [], reply: "", status: "working" };
  const send = () => update(snapshot(progress));

  // Tool steps are matched by id across tool-input-start, tool-call and
  // tool-result, so one call never shows up twice.
  const toolStep = (id: string, name?: string): ToolStep => {
    let step = progress.steps.find(
      (s): s is ToolStep => s.type === "tool" && s.id === id,
    );
    if (!step) {
      step = { type: "tool", id, name: name ?? "tool", state: "calling" };
      progress.steps.push(step);
    }
    return step;
  };

  try {
    // Tools off sends no instructions and no tools: the model answers from
    // memory alone, which is the comparison the report is about.
    const result = callStream(
      { module: 2, feature: "ask-copper" },
      useTools
        ? {
            instructions: COPPER_INSTRUCTIONS,
            messages,
            tools: copperTools,
            stopWhen: stepCountIs(MAX_STEPS),
            providerOptions: THOUGHT_SUMMARIES,
          }
        : { messages, providerOptions: THOUGHT_SUMMARIES },
    );

    for await (const part of result.fullStream) {
      switch (part.type) {
        case "reasoning-delta": {
          const last = progress.steps.at(-1);
          if (last?.type === "thinking") last.text += part.text;
          else progress.steps.push({ type: "thinking", text: part.text });
          break;
        }
        case "tool-input-start":
          toolStep(part.id, part.toolName);
          break;
        case "tool-call":
          toolStep(part.toolCallId, part.toolName).input = part.input;
          break;
        case "tool-result": {
          const step = toolStep(part.toolCallId, part.toolName);
          step.output = part.output;
          step.state = "done";
          break;
        }
        case "tool-error": {
          const step = toolStep(part.toolCallId, part.toolName);
          step.output = errorMessage(part.error);
          step.state = "error";
          break;
        }
        case "text-delta":
          progress.reply += part.text;
          break;
        case "error":
          throw part.error;
        default:
          continue;
      }
      send();
    }

    if (!progress.reply.trim()) progress.reply = EMPTY_REPLY;
    progress.status = "done";
  } catch (error) {
    console.error("Ask Copper failed:", errorMessage(error));
    if (!progress.reply.trim()) progress.reply = ERROR_REPLY;
    progress.status = "error";
  }
  done(snapshot(progress));
}
