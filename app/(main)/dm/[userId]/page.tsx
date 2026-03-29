"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Send, Smile, Paperclip, Loader2, MessageSquare } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Profile = { id: string; full_name: string; job_title: string; avatar_url: string; email: string };
type DM = { id: string; content: string; created_at: string; sender_id: string; receiver_id: string };

export default function DMPage() {
  const { userId } = useParams<{ userId: string }>();
  const searchParams = useSearchParams();
  const fromWorkspace = searchParams.get("from");
  const router = useRouter();

  const [me, setMe] = useState<Profile | null>(null);
  const [other, setOther] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<DM[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [workspaceId, setWorkspaceId] = useState(fromWorkspace || "");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { init(); }, [userId]);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.replace("/auth");

    const [{ data: myProfile }, { data: otherProfile }] = await Promise.all([
      supabase.from("users").select("*").eq("id", user.id).single(),
      supabase.from("users").select("*").eq("id", userId).single(),
    ]);

    setMe(myProfile);
    setOther(otherProfile);

    // Get workspace if not passed via query
    if (!fromWorkspace) {
      const { data: myWs } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();
      if (myWs) setWorkspaceId(myWs.workspace_id);
    }

    await loadMessages(user.id);
    setLoading(false);

    // Realtime subscription
    const channelKey = [user.id, userId].sort().join("-");
    const sub = supabase.channel(`dm:${channelKey}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "direct_messages",
      }, (payload) => {
        const msg = payload.new as DM;
        const isRelevant =
          (msg.sender_id === user.id && msg.receiver_id === userId) ||
          (msg.sender_id === userId && msg.receiver_id === user.id);
        if (isRelevant) {
          setMessages(prev => [...prev, msg]);
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  };

  const loadMessages = async (myId: string) => {
    const { data } = await supabase
      .from("direct_messages")
      .select("*")
      .or(`and(sender_id.eq.${myId},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${myId})`)
      .order("created_at");
    setMessages(data || []);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const sendMessage = async () => {
    const content = newMessage.trim();
    if (!content || !me || sending) return;
    setNewMessage("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setSending(true);
    const { error } = await supabase.from("direct_messages").insert({
      sender_id: me.id,
      receiver_id: userId,
      content,
    });
    if (error) { console.error("DM error:", error); setNewMessage(content); }
    setSending(false);
    textareaRef.current?.focus();
  };

  const formatTime = (ts: string) =>
    new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const formatDate = (ts: string) =>
    new Date(ts).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });

  const getInitials = (name: string) =>
    name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";

  const Avatar = ({ profile, size = 32 }: { profile?: Profile | null; size?: number }) => (
    profile?.avatar_url
      ? <img src={profile.avatar_url} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} alt="" />
      : <div style={{ width: size, height: size, borderRadius: "50%", backgroundColor: "#E01E5A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
          {getInitials(profile?.full_name || "?")}
        </div>
  );

  const goBack = () => {
    if (workspaceId) router.push(`/workspace/${workspaceId}`);
    else router.back();
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0f1114", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader2 size={28} color="#E01E5A" className="animate-spin" />
    </div>
  );

  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: "#0f1114", color: "#fff", fontFamily: "var(--font-geist-sans), -apple-system, sans-serif", flexDirection: "column" }}>

      {/* ── Header ── */}
      <div style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: "12px", padding: "0 20px", flexShrink: 0, backgroundColor: "#13161a" }}>
        <button onClick={goBack} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", display: "flex", alignItems: "center", padding: "6px", borderRadius: "7px" }}
          onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.4)"; e.currentTarget.style.backgroundColor = "transparent"; }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ width: 1, height: 20, backgroundColor: "rgba(255,255,255,0.08)" }} />
        <div style={{ position: "relative" }}>
          <Avatar profile={other} size={34} />
          <div style={{ position: "absolute", bottom: 0, right: 0, width: 10, height: 10, borderRadius: "50%", backgroundColor: "#4ade80", border: "2px solid #13161a" }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: "0.92rem" }}>{other?.full_name}</div>
          <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.35)" }}>{other?.job_title}</div>
        </div>
      </div>

      {/* ── Messages ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 20px 0" }}>

        {/* Empty state */}
        {messages.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "80%", gap: "16px" }}>
            <div style={{ position: "relative" }}>
              <Avatar profile={other} size={72} />
              <div style={{ position: "absolute", bottom: 3, right: 3, width: 16, height: 16, borderRadius: "50%", backgroundColor: "#4ade80", border: "3px solid #0f1114" }} />
            </div>
            <div style={{ textAlign: "center" }}>
              <h3 style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: "6px" }}>{other?.full_name}</h3>
              <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.4)" }}>{other?.job_title}</p>
            </div>
            <div style={{ padding: "10px 20px", backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "999px" }}>
              <p style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.4)" }}>
                This is the beginning of your conversation with <strong style={{ color: "rgba(255,255,255,0.7)" }}>{other?.full_name}</strong>
              </p>
            </div>
          </div>
        )}

        {/* Messages list */}
        {messages.map((msg, i) => {
          const isMe = msg.sender_id === me?.id;
          const senderProfile = isMe ? me : other;
          const showDate = i === 0 || formatDate(messages[i - 1].created_at) !== formatDate(msg.created_at);
          const showAvatar = i === 0 || messages[i - 1].sender_id !== msg.sender_id || showDate;

          return (
            <div key={msg.id}>
              {showDate && (
                <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "20px 0 16px" }}>
                  <div style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.06)" }} />
                  <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>{formatDate(msg.created_at)}</span>
                  <div style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.06)" }} />
                </div>
              )}
              <div style={{ display: "flex", gap: "10px", marginBottom: "2px", padding: "3px 8px", borderRadius: "8px", transition: "background 0.1s" }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.03)")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                {/* Avatar — only show when sender changes */}
                <div style={{ width: 34, flexShrink: 0 }}>
                  {showAvatar && <Avatar profile={senderProfile} size={34} />}
                </div>
                <div style={{ flex: 1 }}>
                  {showAvatar && (
                    <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "3px" }}>
                      <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>{senderProfile?.full_name}</span>
                      <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.3)" }}>{formatTime(msg.created_at)}</span>
                    </div>
                  )}
                  <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.85)", lineHeight: 1.55, margin: 0 }}>
                    {msg.content}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} style={{ height: 20 }} />
      </div>

      {/* ── Input ── */}
      <div style={{ padding: "12px 20px 16px", flexShrink: 0 }}>
        <div style={{ backgroundColor: "#1e2227", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", overflow: "hidden" }}>
          <textarea
            ref={textareaRef}
            id="dm-input"
            name="dm-input"
            autoComplete="off"
            value={newMessage}
            onChange={e => {
              setNewMessage(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={`Message ${other?.full_name || "..."}`}
            style={{
              width: "100%", padding: "13px 16px 6px",
              background: "none", border: "none", color: "#fff",
              fontSize: "0.9rem", outline: "none", resize: "none",
              fontFamily: "inherit", lineHeight: 1.5,
              minHeight: "44px", maxHeight: "120px", display: "block",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 10px 8px" }}>
            <div style={{ display: "flex", gap: "4px" }}>
              <button type="button" style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: "5px", borderRadius: "6px" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
              ><Paperclip size={17} /></button>
              <button type="button" style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: "5px", borderRadius: "6px" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
              ><Smile size={17} /></button>
            </div>
            <button
              type="button"
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending}
              style={{
                backgroundColor: newMessage.trim() ? "#E01E5A" : "rgba(255,255,255,0.08)",
                border: "none", borderRadius: "7px", padding: "7px 12px",
                cursor: newMessage.trim() ? "pointer" : "default",
                color: newMessage.trim() ? "#fff" : "rgba(255,255,255,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
              }}
            >
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>
        </div>
        <p style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.2)", marginTop: "6px", textAlign: "center" }}>
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
