import type { OutreachMessage } from "@/types";

export function isReactionNotice(body: string) {
  const text = body.replace(/\s+/g, " ").trim();
  return /reacted\s+\S+$/i.test(text) || /tepki verdi/i.test(text);
}

export function reactionEmojiFromNotice(body: string) {
  return body.trim().match(/reacted\s+(\S+)\s*$/i)?.[1] ?? "";
}

export type ChatBubble = OutreachMessage & { reactions: string[] };

export function toChatBubbles(messages: OutreachMessage[]): ChatBubble[] {
  const chronological = [...messages].sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
  const notices = chronological.filter((item) => isReactionNotice(item.body));
  const outboundBodies = new Set(
    chronological
      .filter((item) => item.direction === "outbound" && !isReactionNotice(item.body))
      .map((item) => item.body.replace(/\s+/g, " ").trim().toLocaleLowerCase()),
  );

  const bubbles: ChatBubble[] = chronological
    .filter((item) => !isReactionNotice(item.body))
    .filter((item) => {
      if (item.direction !== "inbound") return true;
      return !outboundBodies.has(item.body.replace(/\s+/g, " ").trim().toLocaleLowerCase());
    })
    .map((item) => ({ ...item, reactions: [...(item.reactions ?? [])] }));

  for (const notice of notices) {
    const emoji = reactionEmojiFromNotice(notice.body);
    if (!emoji) continue;
    const target =
      [...bubbles].reverse().find((item) => item.sentAt.getTime() <= notice.sentAt.getTime()) ??
      bubbles[0];
    if (!target) continue;
    if (!target.reactions.includes(emoji)) target.reactions.push(emoji);
  }

  return bubbles;
}
