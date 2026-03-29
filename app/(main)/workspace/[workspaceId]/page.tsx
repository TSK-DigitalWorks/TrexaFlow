"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  MessageSquare, Hash, Plus, ChevronDown, LogOut,
  Send, Smile, Paperclip, Search, Bell, Settings,
  Users, Lock, X, Check, Loader2, MoreHorizontal,
  Pin, User, Copy
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRequireAuth } from "@/lib/useAuth";

type Profile = { id: string; full_name: string; job_title: string; avatar_url: string; email: string };
type Workspace = { id: string; name: string; description: string; image_url: string; workspace_code: string; owner_id: string };
type Channel = { id: string; name: string; is_private: boolean; is_default: boolean };
type Message = { id: string; content: string; created_at: string; sender_id: string; is_pinned: boolean; is_system?: boolean; sender?: Profile };
type Member = { user_id: string; role: string; profile?: Profile; is_online?: boolean };

export default function WorkspacePage() {
  const { checking } = useRequireAuth();  // ← add this line
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const router = useRouter();

  const [me, setMe] = useState<Profile | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hoveredMessage, setHoveredMessage] = useState<string | null>(null);
  const [showPinnedMessages, setShowPinnedMessages] = useState(false);

  // Panels
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showMemberProfile, setShowMemberProfile] = useState<Member | null>(null);
  const [showWorkspaceInfo, setShowWorkspaceInfo] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Create channel form
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDesc, setNewChannelDesc] = useState("");
  const [newChannelPrivate, setNewChannelPrivate] = useState(false);
  const [creatingChannel, setCreatingChannel] = useState(false);

  // Channel settings panel
  const [showChannelSettings, setShowChannelSettings] = useState(false);
  const [editChannelName, setEditChannelName] = useState("");
  const [editChannelDesc, setEditChannelDesc] = useState("");
  const [editChannelPrivate, setEditChannelPrivate] = useState(false);
  const [savingChannel, setSavingChannel] = useState(false);
  const [channelMembers, setChannelMembers] = useState<Member[]>([]);
  const [nonChannelMembers, setNonChannelMembers] = useState<Member[]>([]);
  const [channelSettingsTab, setChannelSettingsTab] = useState<"about" | "members">("about");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Boot ──
  useEffect(() => {
    init();
  }, [workspaceId]);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.replace("/auth");

    const { data: profile } = await supabase.from("users").select("*").eq("id", user.id).single();

    // If profile not set up yet, go to onboarding
    if (!profile?.full_name) return router.replace("/onboarding");

    setMe(profile);

    // Verify this user is a member of this workspace
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      // Not a member — redirect to their actual workspace
      const { data: anyMembership } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();
      if (anyMembership) return router.replace(`/workspace/${anyMembership.workspace_id}`);
      return router.replace("/onboarding");
    }

    const { data: ws } = await supabase.from("workspaces").select("*").eq("id", workspaceId).single();
    setWorkspace(ws);

    const { data: chans } = await supabase.from("channels").select("*").eq("workspace_id", workspaceId).order("is_default", { ascending: false }).order("created_at");
    setChannels(chans || []);

    const lobby = chans?.find((c: Channel) => c.is_default) || chans?.[0];
    if (lobby) setActiveChannel(lobby);

    await loadMembers();
    setLoading(false);
  };

  const loadMembers = async () => {
    const { data } = await supabase.from("workspace_members").select("user_id, role").eq("workspace_id", workspaceId);
    if (!data) return;
    const profiles = await Promise.all(
      data.map(async (m: { user_id: string; role: string }) => {
        const { data: p } = await supabase.from("users").select("*").eq("id", m.user_id).single();
        return { ...m, profile: p };
      })
    );
    setMembers(profiles);
  };

  const copyWorkspaceCode = async () => {
    if (!workspace) return;
    try {
      await navigator.clipboard.writeText(workspace.workspace_code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy workspace code:", error);
    }
  };

  // ── Load messages when channel changes ──
  useEffect(() => {
    if (!activeChannel) return;
    loadMessages(activeChannel.id);

    const sub = supabase.channel(`messages:${activeChannel.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${activeChannel.id}` },
        async (payload) => {
          const { data: sender } = await supabase.from("users").select("*").eq("id", payload.new.sender_id).single();
          setMessages(prev => [...prev, { ...payload.new as Message, sender }]);
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [activeChannel]);

  const loadMessages = async (channelId: string) => {
    const { data } = await supabase.from("messages").select("*").eq("channel_id", channelId).order("created_at");
    if (!data) return;
    const withSenders = await Promise.all(
      data.map(async (msg: Message) => {
        const { data: sender } = await supabase.from("users").select("*").eq("id", msg.sender_id).single();
        return { ...msg, sender };
      })
    );
    setMessages(withSenders);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  // ── Create channel ──
  const createChannel = async () => {
    if (!newChannelName.trim() || !me) return;
    setCreatingChannel(true);
    const { data } = await supabase.from("channels").insert({
      workspace_id: workspaceId,
      name: newChannelName.trim().toLowerCase().replace(/\s+/g, "-"),
      description: newChannelDesc.trim() || null,
      is_private: newChannelPrivate,
      is_default: false,
      created_by: me.id,
    }).select().single();
    if (data) {
      setChannels(prev => [...prev, data]);
      setActiveChannel(data);
    }
    setNewChannelName(""); setNewChannelDesc(""); setNewChannelPrivate(false);
    setShowCreateChannel(false);
    setCreatingChannel(false);
  };

  // ── Open channel settings ──
  const openChannelSettings = async () => {
    if (!activeChannel) return;
    setEditChannelName(activeChannel.name);
    setEditChannelDesc("");
    setEditChannelPrivate(activeChannel.is_private);
    setChannelSettingsTab("about");

    // Load channel description
    const { data } = await supabase.from("channels").select("description").eq("id", activeChannel.id).single();
    if (data) setEditChannelDesc(data.description || "");

    // Load channel members
    await loadChannelMembers();
    setShowChannelSettings(true);
  };

  const loadChannelMembers = async () => {
    if (!activeChannel) return;
    const { data: cm } = await supabase.from("channel_members").select("user_id").eq("channel_id", activeChannel.id);
    const memberIds = cm?.map((m: { user_id: string }) => m.user_id) || [];

    const inChannel = members.filter(m => memberIds.includes(m.user_id));
    const notInChannel = members.filter(m => !memberIds.includes(m.user_id));
    setChannelMembers(inChannel);
    setNonChannelMembers(notInChannel);
  };

  // ── Save channel edits ──
  const saveChannelSettings = async () => {
    if (!activeChannel || !editChannelName.trim()) return;
    setSavingChannel(true);
    const { data } = await supabase.from("channels").update({
      name: editChannelName.trim().toLowerCase().replace(/\s+/g, "-"),
      description: editChannelDesc.trim() || null,
      is_private: editChannelPrivate,
    }).eq("id", activeChannel.id).select().single();

    if (data) {
      setChannels(prev => prev.map(c => c.id === data.id ? data : c));
      setActiveChannel(data);
    }
    setSavingChannel(false);
  };

  // ── Add member to channel ──
  const addMemberToChannel = async (userId: string) => {
    if (!activeChannel) return;
    await supabase.from("channel_members").insert({ channel_id: activeChannel.id, user_id: userId });
    await loadChannelMembers();
  };

  // ── Remove member from channel ──
  const removeMemberFromChannel = async (userId: string) => {
    if (!activeChannel) return;
    await supabase.from("channel_members").delete().eq("channel_id", activeChannel.id).eq("user_id", userId);
    await loadChannelMembers();
  };

  // ── Delete channel ──
  const deleteChannel = async () => {
    if (!activeChannel || activeChannel.is_default) return;
    if (!confirm(`Delete #${activeChannel.name}? This cannot be undone.`)) return;
    await supabase.from("channels").delete().eq("id", activeChannel.id);
    const remaining = channels.filter(c => c.id !== activeChannel.id);
    setChannels(remaining);
    setActiveChannel(remaining[0] || null);
    setShowChannelSettings(false);
  };

  // ── Sign out ──
  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  // ── Send message ──
  const sendMessage = async () => {
    const content = newMessage.trim();
    if (!content || !activeChannel || !me || sending) return;
    setNewMessage("");
    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      channel_id: activeChannel.id,
      sender_id: me.id,
      content,
      is_pinned: false,
    });
    if (error) {
      console.error("Send error:", error);
      setNewMessage(content); // restore on error
    }
    setSending(false);
    textareaRef.current?.focus();
  };

  // ── Toggle Pin message ──
  const togglePinMessage = async (msg: Message) => {
    const { data } = await supabase
      .from("messages")
      .update({ is_pinned: !msg.is_pinned })
      .eq("id", msg.id)
      .select()
      .single();

    if (data) {
      setMessages(prev => prev.map(m => m.id === data.id ? { ...m, is_pinned: data.is_pinned, sender: m.sender } : m));
    }
  };

  const formatTime = (ts: string) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const formatDate = (ts: string) => new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });

  const getInitials = (name: string) => name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";

  const Avatar = ({ profile, size = 32 }: { profile?: Profile | null; size?: number }) => (
    profile?.avatar_url
      ? <img src={profile.avatar_url} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} alt="" />
      : <div style={{ width: size, height: size, borderRadius: "50%", backgroundColor: "#E01E5A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
          {getInitials(profile?.full_name || "?")}
        </div>
  );

  if (loading || checking) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0f1114", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader2 size={28} color="#E01E5A" className="animate-spin" />
    </div>
  );

  const isLobby = activeChannel?.is_default;
  const pinnedMessages = messages.filter(m => m.is_pinned);

  const formatMessageContent = (content: string) => {
    // Render **bold** text
    const parts = content.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) =>
      i % 2 === 1
        ? <strong key={i} style={{ color: "#fff", fontWeight: 600 }}>{part}</strong>
        : part
    );
  };

  // ─────────────────────────────────────────
  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: "#0f1114", color: "#fff", fontFamily: "var(--font-geist-sans), -apple-system, sans-serif", overflow: "hidden" }}>

      {/* ══════════════════ SIDEBAR ══════════════════ */}
      <div style={{ width: 240, flexShrink: 0, backgroundColor: "#13161a", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Workspace header */}
        <div style={{ padding: "12px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div
            onClick={() => setShowWorkspaceInfo(true)}
            style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", padding: "8px", borderRadius: "10px", transition: "background 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)")}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            {workspace?.image_url
              ? <img src={workspace.image_url} style={{ width: 34, height: 34, borderRadius: 9, objectFit: "cover", flexShrink: 0 }} alt="" />
              : <div style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: "#E01E5A", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <MessageSquare size={16} color="#fff" />
                </div>
            }
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div style={{ fontWeight: 700, fontSize: "0.88rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{workspace?.name}</div>
              <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.3)", marginTop: "1px" }}>Click to view details</div>
            </div>
            <ChevronDown size={14} color="rgba(255,255,255,0.3)" style={{ flexShrink: 0 }} />
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: "10px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: "8px", padding: "7px 10px", cursor: "pointer" }}>
            <Search size={13} color="rgba(255,255,255,0.3)" />
            <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.3)" }}>Search</span>
          </div>
        </div>

        {/* Channels */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          <div style={{ padding: "6px 16px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Channels</span>
            <button onClick={() => setShowCreateChannel(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", display: "flex", padding: "2px" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
            >
              <Plus size={14} />
            </button>
          </div>

          {channels.map(ch => (
            <button key={ch.id} onClick={() => setActiveChannel(ch)} style={{
              width: "calc(100% - 12px)", display: "flex", alignItems: "center", gap: "7px",
              padding: "6px 16px", border: "none", cursor: "pointer", textAlign: "left",
              backgroundColor: activeChannel?.id === ch.id ? "rgba(224,30,90,0.12)" : "transparent",
              color: activeChannel?.id === ch.id ? "#fff" : "rgba(255,255,255,0.5)",
              borderRadius: "6px", margin: "1px 6px",
              transition: "all 0.15s",
            }}
              onMouseEnter={e => { if (activeChannel?.id !== ch.id) e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={e => { if (activeChannel?.id !== ch.id) { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; } }}
            >
              {ch.is_private ? <Lock size={13} /> : <Hash size={13} />}
              <span style={{ fontSize: "0.875rem", fontWeight: activeChannel?.id === ch.id ? 600 : 400 }}>{ch.name}</span>
            </button>
          ))}

          {/* DMs section */}
          <div style={{ marginTop: "8px" }}>
            <div style={{ padding: "6px 16px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Direct Messages
              </span>
            </div>
            {members.filter(m => m.user_id !== me?.id).length === 0 && (
              <p style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.2)", padding: "4px 16px" }}>
                No other members yet.
              </p>
            )}
            {members.filter(m => m.user_id !== me?.id).map(m => (
              <button
                key={m.user_id}
                onClick={() => router.push(`/dm/${m.user_id}?from=${workspaceId}`)}
                style={{
                  width: "calc(100% - 12px)", display: "flex", alignItems: "center", gap: "8px",
                  padding: "6px 10px", border: "none", cursor: "pointer", textAlign: "left",
                  backgroundColor: "transparent", color: "rgba(255,255,255,0.5)",
                  borderRadius: "6px", margin: "1px 6px", transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
              >
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <Avatar profile={m.profile} size={24} />
                  <div style={{
                    position: "absolute", bottom: -1, right: -1,
                    width: 8, height: 8, borderRadius: "50%",
                    backgroundColor: "#4ade80",
                    border: "1.5px solid #13161a",
                  }} />
                </div>
                <span style={{ fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {m.profile?.full_name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* My profile strip */}
        <div style={{ padding: "10px 12px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: "9px" }}>
          <div style={{ position: "relative" }}>
            <Avatar profile={me} size={30} />
            <div style={{ position: "absolute", bottom: 0, right: 0, width: 9, height: 9, borderRadius: "50%", backgroundColor: "#4ade80", border: "2px solid #13161a" }} />
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <div style={{ fontSize: "0.82rem", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{me?.full_name}</div>
            <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{me?.job_title}</div>
          </div>
          <button onClick={signOut} title="Sign out" style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: "4px" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#f87171")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>

      {/* ══════════════════ MAIN AREA ══════════════════ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Channel top bar */}
        <div style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {activeChannel?.is_private ? <Lock size={16} color="rgba(255,255,255,0.5)" /> : <Hash size={16} color="rgba(255,255,255,0.5)" />}
            <button
              onClick={openChannelSettings}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#fff", fontWeight: 600, fontSize: "0.95rem", padding: "4px 6px", borderRadius: "6px" }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)")}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              {activeChannel?.name}
            </button>
            <div style={{ width: 1, height: 16, backgroundColor: "rgba(255,255,255,0.1)", margin: "0 4px" }} />
            <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.35)" }}>
              {members.length} member{members.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            {/* Pinned messages button — shows count if any */}
            {pinnedMessages.length > 0 && (
              <button
                onClick={() => setShowPinnedMessages(p => !p)}
                style={{
                  display: "flex", alignItems: "center", gap: "5px",
                  background: showPinnedMessages ? "rgba(224,30,90,0.12)" : "none",
                  border: showPinnedMessages ? "1px solid rgba(224,30,90,0.2)" : "1px solid transparent",
                  cursor: "pointer", color: showPinnedMessages ? "#E01E5A" : "rgba(255,255,255,0.35)",
                  padding: "5px 10px", borderRadius: "7px", fontSize: "0.78rem", fontWeight: 500,
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.color = "#E01E5A"; e.currentTarget.style.borderColor = "rgba(224,30,90,0.2)"; }}
                onMouseLeave={e => {
                  if (!showPinnedMessages) {
                    e.currentTarget.style.color = "rgba(255,255,255,0.35)";
                    e.currentTarget.style.borderColor = "transparent";
                  }
                }}
              >
                <Pin size={13} />
                {pinnedMessages.length} pinned
              </button>
            )}
            <button
              onClick={openChannelSettings}
              style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", padding: "6px", borderRadius: "6px" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
            ><Settings size={16} /></button>
            <button
              style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", padding: "6px", borderRadius: "6px" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
            ><Bell size={16} /></button>
          </div>
        </div>

        {/* Pinned messages banner */}
        {showPinnedMessages && pinnedMessages.length > 0 && (
          <div style={{ backgroundColor: "rgba(224,30,90,0.06)", borderBottom: "1px solid rgba(224,30,90,0.12)", padding: "0", flexShrink: 0, maxHeight: "220px", overflowY: "auto" }}>
            <div style={{ padding: "10px 20px 6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Pin size={13} color="#E01E5A" />
                <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#E01E5A", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Pinned Messages — {pinnedMessages.length}
                </span>
              </div>
              <button onClick={() => setShowPinnedMessages(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: "2px" }}>
                <X size={14} />
              </button>
            </div>
            {pinnedMessages.map((msg, i) => (
              <div key={msg.id} style={{
                display: "flex", alignItems: "flex-start", gap: "10px",
                padding: "8px 20px",
                borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none",
              }}>
                <Avatar profile={msg.sender} size={26} />
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "7px", marginBottom: "2px" }}>
                    <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>{msg.sender?.full_name}</span>
                    <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.3)" }}>{formatTime(msg.created_at)}</span>
                  </div>
                  <p style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.65)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {msg.content}
                  </p>
                </div>
                {me?.id === workspace?.owner_id && (
                  <button
                    onClick={() => togglePinMessage(msg)}
                    title="Unpin"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: "2px", flexShrink: 0 }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#f87171")}
                    onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Messages area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 0" }}>

          {/* Lobby header */}
          {isLobby && (
            <div style={{ marginBottom: "32px", paddingBottom: "24px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: "rgba(224,30,90,0.12)", border: "1px solid rgba(224,30,90,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Hash size={22} color="#E01E5A" />
                </div>
                <div>
                  <h2 style={{ fontSize: "1.3rem", fontWeight: 700 }}>Welcome to #{activeChannel?.name}!</h2>
                  {workspace?.description && <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.45)", marginTop: "3px" }}>{workspace.description}</p>}
                </div>
              </div>

              {/* Members grid */}
              <div style={{ marginTop: "20px" }}>
                <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "rgba(255,255,255,0.35)", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {members.length} Member{members.length !== 1 ? "s" : ""}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                  {members.map(m => (
                    <div key={m.user_id} onClick={() => setShowMemberProfile(m)} style={{
                      display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
                      padding: "12px 14px", borderRadius: "12px", cursor: "pointer",
                      backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)",
                      minWidth: "80px", transition: "all 0.15s",
                    }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)"; }}
                    >
                      <div style={{ position: "relative" }}>
                        <Avatar profile={m.profile} size={40} />
                        <div style={{ position: "absolute", bottom: 1, right: 1, width: 10, height: 10, borderRadius: "50%", backgroundColor: "#4ade80", border: "2px solid #0f1114" }} />
                      </div>
                      <span style={{ fontSize: "0.78rem", fontWeight: 500, textAlign: "center", color: "rgba(255,255,255,0.8)" }}>
                        {m.profile?.full_name?.split(" ")[0]}
                      </span>
                      {m.role === "admin" && (
                        <span style={{ fontSize: "0.65rem", color: "#E01E5A", fontWeight: 600 }}>Admin</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, i) => {
            const isMe = msg.sender_id === me?.id;
            const showDate = i === 0 || formatDate(messages[i - 1].created_at) !== formatDate(msg.created_at);

            // ── System message ──
            if ((msg as any).is_system) {
              return (
                <div key={msg.id}>
                  {showDate && (
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "20px 0 16px" }}>
                      <div style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.06)" }} />
                      <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>{formatDate(msg.created_at)}</span>
                      <div style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.06)" }} />
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "center", margin: "10px 0" }}>
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: "7px",
                      backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: "999px", padding: "5px 14px",
                    }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#4ade80" }} />
                      <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)" }}>
                        {formatMessageContent(msg.content)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            }

            {/* ── Normal message ── */}
            return (
              <div key={msg.id}>
                {showDate && (
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "20px 0 16px" }}>
                    <div style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.06)" }} />
                    <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>{formatDate(msg.created_at)}</span>
                    <div style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.06)" }} />
                  </div>
                )}
                <div
                  style={{ position: "relative", display: "flex", gap: "10px", marginBottom: "2px", padding: "4px 8px", borderRadius: "8px", transition: "background 0.1s", backgroundColor: hoveredMessage === msg.id ? "rgba(255,255,255,0.03)" : "transparent" }}
                  onMouseEnter={() => setHoveredMessage(msg.id)}
                  onMouseLeave={() => setHoveredMessage(null)}
                >
                  <Avatar profile={msg.sender} size={34} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "3px" }}>
                      <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>{msg.sender?.full_name || "Unknown"}</span>
                      <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.3)" }}>{formatTime(msg.created_at)}</span>
                      {msg.is_pinned && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "0.7rem", color: "#E01E5A" }}>
                          <Pin size={10} /> pinned
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.85)", lineHeight: 1.55, margin: 0 }}>
                      {formatMessageContent(msg.content)}
                    </p>
                  </div>

                  {/* Hover action toolbar */}
                  {hoveredMessage === msg.id && (
                    <div style={{
                      position: "absolute", top: -14, right: 12,
                      display: "flex", alignItems: "center", gap: "2px",
                      backgroundColor: "#1e2227", border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px", padding: "3px 4px",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
                      zIndex: 10,
                    }}>
                      <button
                        onClick={() => togglePinMessage(msg)}
                        title={msg.is_pinned ? "Unpin message" : "Pin message"}
                        style={{
                          background: "none", border: "none", cursor: "pointer", padding: "5px 7px", borderRadius: "6px",
                          color: msg.is_pinned ? "#E01E5A" : "rgba(255,255,255,0.5)",
                          display: "flex", alignItems: "center",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.07)")}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        <Pin size={14} />
                      </button>
                      <button
                        title="React"
                        style={{
                          background: "none", border: "none", cursor: "pointer", padding: "5px 7px", borderRadius: "6px",
                          color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.07)")}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        <Smile size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} style={{ height: 20 }} />
        </div>

        {/* Message input */}
        <div style={{ padding: "12px 20px 16px", flexShrink: 0 }}>
          <div style={{ backgroundColor: "#1e2227", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", overflow: "hidden" }}>
            <textarea
              ref={textareaRef}
              id="message-input"
              name="message-input"
              autoComplete="off"
              value={newMessage}
              onChange={e => {
                setNewMessage(e.target.value);
                // Auto resize
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
              }}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.stopPropagation();
                  sendMessage();
                }
              }}
              placeholder={`Message #${activeChannel?.name || "..."}`}
              style={{
                width: "100%", padding: "13px 16px 6px",
                background: "none", border: "none",
                color: "#fff", fontSize: "0.9rem", outline: "none",
                resize: "none", fontFamily: "inherit", lineHeight: 1.5,
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
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  sendMessage();
                }}
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

      {/* ══════════════ CREATE CHANNEL MODAL ══════════════ */}
      {showCreateChannel && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setShowCreateChannel(false); }}
        >
          <div style={{ backgroundColor: "#13161a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "20px", padding: "32px", width: "100%", maxWidth: "420px", boxShadow: "0 24px 80px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Create a channel</h2>
              <button onClick={() => setShowCreateChannel(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", padding: "4px" }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 500, color: "rgba(255,255,255,0.5)", marginBottom: "6px" }}>Channel name *</label>
              <div style={{ position: "relative" }}>
                <Hash size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)" }} />
                <input type="text" placeholder="e.g. marketing" value={newChannelName}
                  onChange={e => setNewChannelName(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                  style={{ width: "100%", padding: "10px 12px 10px 30px", backgroundColor: "#0f1114", border: "1.5px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#fff", fontSize: "0.88rem", outline: "none" }}
                  onFocus={e => (e.target.style.borderColor = "#E01E5A")}
                  onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
                />
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 500, color: "rgba(255,255,255,0.5)", marginBottom: "6px" }}>Description <span style={{ color: "rgba(255,255,255,0.25)" }}>(optional)</span></label>
              <input type="text" placeholder="What's this channel about?" value={newChannelDesc}
                onChange={e => setNewChannelDesc(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", backgroundColor: "#0f1114", border: "1.5px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "#fff", fontSize: "0.88rem", outline: "none" }}
                onFocus={e => (e.target.style.borderColor = "#E01E5A")}
                onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", backgroundColor: "rgba(255,255,255,0.03)", borderRadius: "10px", marginBottom: "24px", cursor: "pointer" }}
              onClick={() => setNewChannelPrivate(p => !p)}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Lock size={15} color="rgba(255,255,255,0.5)" />
                <div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 500 }}>Private channel</div>
                  <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)" }}>Only invited members can see it</div>
                </div>
              </div>
              <div style={{ width: 36, height: 20, borderRadius: 999, backgroundColor: newChannelPrivate ? "#E01E5A" : "rgba(255,255,255,0.1)", position: "relative", transition: "background 0.2s" }}>
                <div style={{ position: "absolute", top: 2, left: newChannelPrivate ? 18 : 2, width: 16, height: 16, borderRadius: "50%", backgroundColor: "#fff", transition: "left 0.2s" }} />
              </div>
            </div>

            <button onClick={createChannel} disabled={!newChannelName.trim() || creatingChannel} style={{
              width: "100%", padding: "12px", borderRadius: "10px",
              backgroundColor: newChannelName.trim() ? "#E01E5A" : "rgba(255,255,255,0.08)",
              color: newChannelName.trim() ? "#fff" : "rgba(255,255,255,0.3)",
              border: "none", fontSize: "0.9rem", fontWeight: 600, cursor: newChannelName.trim() ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            }}>
              {creatingChannel ? <Loader2 size={16} className="animate-spin" /> : <><Plus size={16} /> Create Channel</>}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════ MEMBER PROFILE PANEL ══════════════ */}
      {showMemberProfile && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setShowMemberProfile(null); }}
        >
          <div style={{ backgroundColor: "#13161a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "20px", width: "100%", maxWidth: "320px", overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,0.5)" }}>
            {/* Banner */}
            <div style={{ height: 80, background: "linear-gradient(135deg, #E01E5A 0%, #c084fc 100%)", position: "relative" }}>
              <button onClick={() => setShowMemberProfile(null)} style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.3)", border: "none", cursor: "pointer", color: "#fff", borderRadius: "6px", padding: "4px 6px" }}>
                <X size={14} />
              </button>
            </div>
            <div style={{ padding: "0 20px 24px" }}>
              <div style={{ marginTop: "-28px", marginBottom: "14px", position: "relative", display: "inline-block" }}>
                <Avatar profile={showMemberProfile.profile} size={56} />
                <div style={{ position: "absolute", bottom: 2, right: 2, width: 13, height: 13, borderRadius: "50%", backgroundColor: "#4ade80", border: "2.5px solid #13161a" }} />
              </div>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "2px" }}>{showMemberProfile.profile?.full_name}</h3>
              <p style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.45)", marginBottom: "16px" }}>{showMemberProfile.profile?.job_title}</p>
              <div style={{ backgroundColor: "rgba(255,255,255,0.03)", borderRadius: "10px", padding: "12px 14px", marginBottom: "16px" }}>
                <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>Email</div>
                <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.7)" }}>{showMemberProfile.profile?.email}</div>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <div style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.03)", borderRadius: "10px", padding: "12px 14px" }}>
                  <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>Role</div>
                  <div style={{ fontSize: "0.85rem", color: showMemberProfile.role === "admin" ? "#E01E5A" : "rgba(255,255,255,0.7)", fontWeight: 500, textTransform: "capitalize" }}>{showMemberProfile.role}</div>
                </div>
                <div style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.03)", borderRadius: "10px", padding: "12px 14px" }}>
                  <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>Status</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#4ade80" }} />
                    <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.7)" }}>Active</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ CHANNEL SETTINGS PANEL ══════════════ */}
      {showChannelSettings && activeChannel && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex" }}
          onClick={e => { if (e.target === e.currentTarget) setShowChannelSettings(false); }}
        >
          {/* Backdrop */}
          <div style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)" }}
            onClick={() => setShowChannelSettings(false)} />

          {/* Slide-in panel */}
          <div style={{
            width: "100%", maxWidth: "360px", height: "100%",
            backgroundColor: "#13161a", borderLeft: "1px solid rgba(255,255,255,0.07)",
            display: "flex", flexDirection: "column", overflowY: "auto",
            boxShadow: "-16px 0 48px rgba(0,0,0,0.4)",
          }}>
            {/* Panel header */}
            <div style={{ padding: "20px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {activeChannel.is_private ? <Lock size={16} color="rgba(255,255,255,0.5)" /> : <Hash size={16} color="rgba(255,255,255,0.5)" />}
                <span style={{ fontWeight: 700, fontSize: "1rem" }}>{activeChannel.name}</span>
              </div>
              <button onClick={() => setShowChannelSettings(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", padding: "4px" }}>
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: "4px", padding: "16px 20px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
              {(["about", "members"] as const).map(tab => (
                <button key={tab} onClick={() => setChannelSettingsTab(tab)} style={{
                  padding: "8px 16px", border: "none", cursor: "pointer", background: "none",
                  fontSize: "0.85rem", fontWeight: 500, textTransform: "capitalize",
                  color: channelSettingsTab === tab ? "#fff" : "rgba(255,255,255,0.4)",
                  borderBottom: channelSettingsTab === tab ? "2px solid #E01E5A" : "2px solid transparent",
                  marginBottom: "-1px", transition: "all 0.15s",
                }}>
                  {tab}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>

              {/* ── About tab ── */}
              {channelSettingsTab === "about" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
                      Channel Name
                    </label>
                    <div style={{ position: "relative" }}>
                      <Hash size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)" }} />
                      <input
                        id="edit-channel-name"
                        name="edit-channel-name"
                        type="text"
                        value={editChannelName}
                        onChange={e => setEditChannelName(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                        disabled={activeChannel.is_default}
                        style={{
                          width: "100%", padding: "10px 12px 10px 30px",
                          backgroundColor: "#0f1114", border: "1.5px solid rgba(255,255,255,0.08)",
                          borderRadius: "8px", color: activeChannel.is_default ? "rgba(255,255,255,0.3)" : "#fff",
                          fontSize: "0.88rem", outline: "none",
                        }}
                        onFocus={e => { if (!activeChannel.is_default) e.target.style.borderColor = "#E01E5A"; }}
                        onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
                      />
                    </div>
                    {activeChannel.is_default && (
                      <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.25)", marginTop: "5px" }}>The Lobby channel name cannot be changed.</p>
                    )}
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
                      Description
                    </label>
                    <textarea
                      id="edit-channel-desc"
                      name="edit-channel-desc"
                      value={editChannelDesc}
                      onChange={e => setEditChannelDesc(e.target.value)}
                      rows={3}
                      placeholder="What's this channel about?"
                      style={{
                        width: "100%", padding: "10px 12px", resize: "none",
                        backgroundColor: "#0f1114", border: "1.5px solid rgba(255,255,255,0.08)",
                        borderRadius: "8px", color: "#fff", fontSize: "0.88rem", outline: "none",
                        fontFamily: "inherit",
                      }}
                      onFocus={e => (e.target.style.borderColor = "#E01E5A")}
                      onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
                    />
                  </div>

                  {/* Private toggle */}
                  {!activeChannel.is_default && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", backgroundColor: "rgba(255,255,255,0.03)", borderRadius: "10px", cursor: "pointer" }}
                      onClick={() => setEditChannelPrivate(p => !p)}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <Lock size={15} color="rgba(255,255,255,0.5)" />
                        <div>
                          <div style={{ fontSize: "0.85rem", fontWeight: 500 }}>Private channel</div>
                          <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)" }}>Only invited members can see it</div>
                        </div>
                      </div>
                      <div style={{ width: 36, height: 20, borderRadius: 999, backgroundColor: editChannelPrivate ? "#E01E5A" : "rgba(255,255,255,0.1)", position: "relative", transition: "background 0.2s" }}>
                        <div style={{ position: "absolute", top: 2, left: editChannelPrivate ? 18 : 2, width: 16, height: 16, borderRadius: "50%", backgroundColor: "#fff", transition: "left 0.2s" }} />
                      </div>
                    </div>
                  )}

                  <button onClick={saveChannelSettings} disabled={savingChannel || !editChannelName.trim()} style={{
                    width: "100%", padding: "11px", borderRadius: "9px",
                    backgroundColor: "#E01E5A", color: "#fff", border: "none",
                    fontSize: "0.88rem", fontWeight: 600, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                    opacity: savingChannel ? 0.7 : 1,
                  }}>
                    {savingChannel ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                    Save Changes
                  </button>

                  {/* Danger zone */}
                  {!activeChannel.is_default && me?.id === workspace?.owner_id && (
                    <div style={{ marginTop: "8px", padding: "16px", backgroundColor: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.12)", borderRadius: "10px" }}>
                      <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "#f87171", marginBottom: "10px" }}>Danger Zone</p>
                      <button onClick={deleteChannel} style={{
                        width: "100%", padding: "9px", borderRadius: "8px",
                        backgroundColor: "transparent", color: "#f87171",
                        border: "1px solid rgba(248,113,113,0.3)", fontSize: "0.85rem", fontWeight: 500, cursor: "pointer",
                      }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(248,113,113,0.08)")}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        Delete Channel
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── Members tab ── */}
              {channelSettingsTab === "members" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

                  {/* In channel */}
                  <div>
                    <p style={{ fontSize: "0.78rem", fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "10px" }}>
                      In this channel — {channelMembers.length}
                    </p>
                    {channelMembers.length === 0 && (
                      <p style={{ fontSize: "0.83rem", color: "rgba(255,255,255,0.25)" }}>No members yet.</p>
                    )}
                    {channelMembers.map(m => (
                      <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <Avatar profile={m.profile} size={32} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "0.87rem", fontWeight: 500 }}>{m.profile?.full_name}</div>
                          <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)" }}>{m.profile?.job_title}</div>
                        </div>
                        {m.user_id !== me?.id && !activeChannel.is_default && (
                          <button onClick={() => removeMemberFromChannel(m.user_id)} style={{
                            background: "none", border: "1px solid rgba(248,113,113,0.25)", borderRadius: "6px",
                            color: "#f87171", fontSize: "0.75rem", padding: "3px 10px", cursor: "pointer",
                          }}>
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Add members */}
                  {nonChannelMembers.length > 0 && (
                    <div>
                      <p style={{ fontSize: "0.78rem", fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "10px" }}>
                        Add to channel
                      </p>
                      {nonChannelMembers.map(m => (
                        <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <Avatar profile={m.profile} size={32} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: "0.87rem", fontWeight: 500 }}>{m.profile?.full_name}</div>
                            <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)" }}>{m.profile?.job_title}</div>
                          </div>
                          <button onClick={() => addMemberToChannel(m.user_id)} style={{
                            background: "none", border: "1px solid rgba(224,30,90,0.3)", borderRadius: "6px",
                            color: "#E01E5A", fontSize: "0.75rem", padding: "3px 10px", cursor: "pointer",
                          }}>
                            Add
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ WORKSPACE INFO MODAL ══════════════ */}
      {showWorkspaceInfo && workspace && (
        <div
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setShowWorkspaceInfo(false); }}
        >
          <div style={{
            width: "100%", maxWidth: "440px",
            backgroundColor: "#13161a", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "22px", overflow: "hidden",
            boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
          }}>

            {/* Banner */}
            <div style={{ height: 90, background: "linear-gradient(135deg, #1a1d21 0%, #2a1520 50%, #1a1d21 100%)", position: "relative", display: "flex", alignItems: "flex-end", padding: "0 24px 0" }}>
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(224,30,90,0.15) 0%, transparent 70%)", pointerEvents: "none" }} />
              <button
                onClick={() => setShowWorkspaceInfo(false)}
                style={{ position: "absolute", top: 14, right: 14, background: "rgba(255,255,255,0.08)", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.6)", borderRadius: "7px", padding: "5px 7px", display: "flex" }}
              >
                <X size={15} />
              </button>
            </div>

            <div style={{ padding: "0 24px 28px" }}>
              {/* Workspace avatar */}
              <div style={{ marginTop: "-24px", marginBottom: "16px" }}>
                {workspace.image_url
                  ? <img src={workspace.image_url} style={{ width: 52, height: 52, borderRadius: 13, objectFit: "cover", border: "3px solid #13161a" }} alt="" />
                  : <div style={{ width: 52, height: 52, borderRadius: 13, backgroundColor: "#E01E5A", display: "flex", alignItems: "center", justifyContent: "center", border: "3px solid #13161a" }}>
                      <MessageSquare size={22} color="#fff" />
                    </div>
                }
              </div>

              {/* Workspace name & description */}
              <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "6px" }}>{workspace.name}</h2>
              {workspace.description && (
                <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: "20px" }}>
                  {workspace.description}
                </p>
              )}

              {/* Stats row */}
              <div style={{ display: "flex", gap: "10px", marginBottom: "24px", marginTop: workspace.description ? "0" : "16px" }}>
                <div style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "12px 14px" }}>
                  <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#fff" }}>{members.length}</div>
                  <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)", marginTop: "2px" }}>Members</div>
                </div>
                <div style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "12px 14px" }}>
                  <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#fff" }}>{channels.length}</div>
                  <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)", marginTop: "2px" }}>Channels</div>
                </div>
                <div style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "12px 14px" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 600, color: workspace.owner_id === me?.id ? "#E01E5A" : "rgba(255,255,255,0.6)", textTransform: "capitalize" }}>
                    {workspace.owner_id === me?.id ? "Admin" : "Member"}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.35)", marginTop: "2px" }}>Your role</div>
                </div>
              </div>

              {/* Workspace ID share section */}
              <div style={{ backgroundColor: "rgba(224,30,90,0.06)", border: "1px solid rgba(224,30,90,0.15)", borderRadius: "14px", padding: "18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <Users size={14} color="#E01E5A" />
                  <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#E01E5A", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Workspace ID
                  </span>
                </div>
                <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.4)", marginBottom: "14px", lineHeight: 1.5 }}>
                  Share this ID with teammates so they can join your workspace during sign up.
                </p>

                {/* Code display */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{
                    flex: 1, backgroundColor: "#0f1114", border: "1.5px solid rgba(255,255,255,0.08)",
                    borderRadius: "10px", padding: "12px 16px",
                    fontFamily: "monospace", fontSize: "1.3rem", fontWeight: 700,
                    letterSpacing: "0.18em", color: "#fff", textAlign: "center",
                  }}>
                    {workspace.workspace_code}
                  </div>
                  <button
                    onClick={copyWorkspaceCode}
                    style={{
                      padding: "12px 18px", borderRadius: "10px", border: "none", cursor: "pointer",
                      backgroundColor: codeCopied ? "rgba(74,222,128,0.15)" : "#E01E5A",
                      color: codeCopied ? "#4ade80" : "#fff",
                      fontSize: "0.85rem", fontWeight: 600, transition: "all 0.2s",
                      display: "flex", alignItems: "center", gap: "6px", flexShrink: 0,
                    }}
                  >
                    {codeCopied ? <><Check size={15} /> Copied!</> : <><Copy size={15} /> Copy</>}
                  </button>
                </div>
              </div>

              {/* Sign out */}
              <button
                onClick={signOut}
                style={{
                  width: "100%", marginTop: "14px", padding: "10px", borderRadius: "9px",
                  background: "none", border: "1px solid rgba(255,255,255,0.07)",
                  color: "rgba(255,255,255,0.35)", fontSize: "0.85rem", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "7px",
                }}
                onMouseEnter={e => { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.borderColor = "rgba(248,113,113,0.2)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.35)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; }}
              >
                <LogOut size={15} /> Sign out
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}