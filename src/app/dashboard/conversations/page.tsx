import { createClient } from "@/lib/supabase/server";
import ConversationsClient from "./ConversationsClient";

export default async function ConversationsPage() {
  const supabase = await createClient();

  const [{ data: prospects }, { data: lastMessages }] = await Promise.all([
    supabase
      .from("lk_prospects")
      .select(
        "id, full_name, status, message_count, created_at, ai_enabled, linkedin_url, occupation"
      ),
    supabase
      .from("lk_messages")
      .select("prospect_id, content, sent_at, direction")
      .order("sent_at", { ascending: false }),
  ]);

  // Derniere message par prospect (la liste est deja triee desc)
  const lastMessageMap = new Map<
    string,
    { content: string; sent_at: string; direction: string }
  >();
  for (const msg of lastMessages ?? []) {
    if (!lastMessageMap.has(msg.prospect_id)) {
      lastMessageMap.set(msg.prospect_id, {
        content: msg.content,
        sent_at: msg.sent_at,
        direction: msg.direction,
      });
    }
  }

  const prospectsWithPreview = (prospects ?? [])
    .map((p) => ({
      ...p,
      lastMessage: lastMessageMap.get(p.id) ?? null,
    }))
    .sort((a, b) => {
      const aDate = a.lastMessage?.sent_at ?? a.created_at ?? "";
      const bDate = b.lastMessage?.sent_at ?? b.created_at ?? "";
      return bDate.localeCompare(aDate);
    });

  return (
    <div>
      <h1 className="mb-6 font-display text-xl font-semibold tracking-tight text-foreground">
        Conversations
      </h1>
      <ConversationsClient prospects={prospectsWithPreview} />
    </div>
  );
}
