"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  MessageSquare, Globe, Plus, ChevronDown, LogOut,
  Send, Paperclip, Settings, Users, Lock, X, Check,
  Loader2, MoreHorizontal, Pin, User, Copy, Sun, Moon,
  Monitor, Pencil, Trash2, Upload, MailOpen, Smile,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRequireAuth } from "@/lib/useAuth";

// ─── Types ───────────────────────────────────────────────
type Profile = {
  id: string;
  full_name: string;
  job_title: string;
  avatar_url: string;
  email: string;
};
type Workspace = {
  id: string;
  name: string;
  description: string;
  image_url: string;
  workspace_code: string;
  owner_id: string;
};
type Channel = {
  id: string;
  name: string;
  is_private: boolean;
  is_default: boolean;
};
type Message = {
  id: string;
  channel_id: string;
  content: string;
  created_at: string;
  sender_id: string;
  is_pinned: boolean;
  is_system?: boolean;
  sender?: Profile;
};
type Member = {
  user_id: string;
  role: string;
  profile?: Profile;
  is_online?: boolean;
};
type DM = {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  receiver_id: string;
};
type ThemeMode = "system" | "dark" | "light";
type View = "channel" | "dm";

// ─── Component ───────────────────────────────────────────
export default function WorkspacePage() {
  const { checking } = useRequireAuth();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialChannelId = searchParams.get("channel");

  // ── View mode ──
  const [view, setView] = useState<View>("channel");
  const [activeDmUserId, setActiveDmUserId] = useState<string | null>(null);
  const [activeDmUser, setActiveDmUser] = useState<Profile | null>(null);

  // ── Workspace & channel state ──
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

  // ── DM state ──
  const [dmMessages, setDmMessages] = useState<DM[]>([]);
  const [dmNewMessage, setDmNewMessage] = useState("");
  const [dmSending, setDmSending] = useState(false);
  const [dmHoveredMessage, setDmHoveredMessage] = useState<string | null>(null);
  const [dmEditingMessageId, setDmEditingMessageId] = useState<string | null>(null);
  const [dmEditingContent, setDmEditingContent] = useState("");
  const [dmOpenMenuMessageId, setDmOpenMenuMessageId] = useState<string | null>(null);
  const [dmUnreadFromMessageId, setDmUnreadFromMessageId] = useState<string | null>(null);
  const [dmUnreadCount, setDmUnreadCount] = useState(0);
  const [isOtherOnline, setIsOtherOnline] = useState(false);

  // ── Panels ──
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showMemberProfile, setShowMemberProfile] = useState<Member | null>(null);
  const [showWorkspaceInfo, setShowWorkspaceInfo] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // ── Workspace edit ──
  const [editingWorkspace, setEditingWorkspace] = useState(false);
  const [wsEditName, setWsEditName] = useState("");
  const [wsEditDesc, setWsEditDesc] = useState("");
  const [wsEditImageFile, setWsEditImageFile] = useState<File | null>(null);
  const [wsEditImagePreview, setWsEditImagePreview] = useState<string | null>(null);
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const wsEditImageInputRef = useRef<HTMLInputElement | null>(null);

  // ── Profile edit ──
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileEditName, setProfileEditName] = useState("");
  const [profileEditRole, setProfileEditRole] = useState("");
  const [profileEditImageFile, setProfileEditImageFile] = useState<File | null>(null);
  const [profileEditImagePreview, setProfileEditImagePreview] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const profileEditImageInputRef = useRef<HTMLInputElement | null>(null);

  // ── Create channel form ──
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDesc, setNewChannelDesc] = useState("");
  const [newChannelPrivate, setNewChannelPrivate] = useState(false);
  const [creatingChannel, setCreatingChannel] = useState(false);

  // ── Channel settings ──
  const [showChannelSettings, setShowChannelSettings] = useState(false);
  const [editChannelName, setEditChannelName] = useState("");
  const [editChannelDesc, setEditChannelDesc] = useState("");
  const [editChannelPrivate, setEditChannelPrivate] = useState(false);
  const [savingChannel, setSavingChannel] = useState(false);
  const [channelMembers, setChannelMembers] = useState<Member[]>([]);
  const [nonChannelMembers, setNonChannelMembers] = useState<Member[]>([]);
  const [channelSettingsTab, setChannelSettingsTab] = useState<"about" | "members">("about");

  // ── Unread / theme / misc ──
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [lastReadMap, setLastReadMap] = useState<Record<string, string>>({});
  const [dmUnreadCounts, setDmUnreadCounts] = useState<Record<string, number>>({});
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [unreadFromMessageId, setUnreadFromMessageId] = useState<string | null>(null);
  const [openMenuMessageId, setOpenMenuMessageId] = useState<string | null>(null);

  // ── Refs ──
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const dmMessagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dmTextareaRef = useRef<HTMLTextAreaElement>(null);
  const activeChannelRef = useRef<Channel | null>(null);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const themePickerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const dmMenuRef = useRef<HTMLDivElement | null>(null);
  const dmSubRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const allDmSubRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const meIdRef = useRef<string | null>(null);

  // ─── useEffects ──────────────────────────────────────────

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    init().then(fn => { cleanup = fn as (() => void) | undefined; });
    return () => {
      cleanup?.();
      if (dmSubRef.current) {
        supabase.removeChannel(dmSubRef.current);
        dmSubRef.current = null;
      }
      if (allDmSubRef.current) {
        supabase.removeChannel(allDmSubRef.current);
        allDmSubRef.current = null;
      }
    };
  }, [workspaceId]);

  useEffect(() => {
    if (activeChannel) loadChannelMembers();
  }, [activeChannel]);

  useEffect(() => {
    activeChannelRef.current = activeChannel;
    if (activeChannel) markChannelAsRead(activeChannel.id);
  }, [activeChannel]);

  useEffect(() => {
    return () => {
      if (presenceChannelRef.current) {
        presenceChannelRef.current.untrack();
        supabase.removeChannel(presenceChannelRef.current);
      }
    };
  }, []);

  // Theme init
  useEffect(() => {
    const saved = (localStorage.getItem("trexaflow_theme") as ThemeMode) || "dark";
    setThemeMode(saved);
    applyTheme(saved);
  }, []);

  // DM unread counts from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = JSON.parse(localStorage.getItem("trexaflow:dm:unread") || "{}");
      setDmUnreadCounts(stored);
    }
  }, []);

  // Close theme picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (themePickerRef.current && !themePickerRef.current.contains(e.target as Node)) {
        setShowThemePicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close channel message menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuMessageId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close DM message menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dmMenuRef.current && !dmMenuRef.current.contains(e.target as Node)) {
        setDmOpenMenuMessageId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Scroll to bottom when channel messages load
  useEffect(() => {
    if (view !== "channel" || loading || messages.length === 0) return;
    const timer = setTimeout(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }, 80);
    return () => clearTimeout(timer);
  }, [view, loading, messages.length]);

  // Scroll to bottom when DM messages load
  useEffect(() => {
    if (view !== "dm" || dmMessages.length === 0) return;
    const timer = setTimeout(() => {
      if (dmMessagesContainerRef.current) {
        dmMessagesContainerRef.current.scrollTop = dmMessagesContainerRef.current.scrollHeight;
      }
    }, 80);
    return () => clearTimeout(timer);
  }, [view, dmMessages.length]);

  // Load DM messages when switching to a DM conversation
  useEffect(() => {
    if (view === "dm" && activeDmUserId && me) {
      loadDmMessages(me.id, activeDmUserId);
    }
  }, [view, activeDmUserId]);

  // Subscribe to realtime DM updates for active conversation
  useEffect(() => {
    if (!me || !activeDmUserId) return;
    if (dmSubRef.current) {
      supabase.removeChannel(dmSubRef.current);
      dmSubRef.current = null;
    }
    const key = [me.id, activeDmUserId].sort().join("-");
    const sub = supabase
      .channel(`dm-${key}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, payload => {
        const msg = payload.new as DM;
        const isRelevant =
          (msg.sender_id === me.id && msg.receiver_id === activeDmUserId) ||
          (msg.sender_id === activeDmUserId && msg.receiver_id === me.id);
        if (!isRelevant) return;
        // Only append incoming (not own — own already appended optimistically)
        if (msg.sender_id === me.id) return;
        setDmMessages(prev => {
          if (prev.find(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      })
      .subscribe();
    dmSubRef.current = sub;
    return () => {
      supabase.removeChannel(sub);
      dmSubRef.current = null;
    };
  }, [me?.id, activeDmUserId]);
    // ─── init ────────────────────────────────────────────────
  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return router.replace("/auth");
    const user = session.user;

    meIdRef.current = user.id;

    const { data: profile } = await supabase
      .from("users").select("*").eq("id", user.id).single();

    if (!profile?.full_name) return router.replace("/onboarding");
    setMe(profile);

    // Verify membership
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      const { data: anyMembership } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();
      if (anyMembership) return router.replace(`/workspace/${anyMembership.workspace_id}`);
      return router.replace("/onboarding");
    }

    const { data: ws } = await supabase
      .from("workspaces").select("*").eq("id", workspaceId).single();
    setWorkspace(ws);

    // Fetch public channels
    const { data: publicChans } = await supabase
      .from("channels")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("is_private", false)
      .order("is_default", { ascending: false })
      .order("created_at");

    // Fetch private channels user is a member of
    const { data: privateMemberships } = await supabase
      .from("channel_members")
      .select("channel_id")
      .eq("user_id", user.id);

    const privateChannelIds = privateMemberships?.map(m => m.channel_id) || [];
    let privateChans: Channel[] = [];
    if (privateChannelIds.length > 0) {
      const { data } = await supabase
        .from("channels")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("is_private", true)
        .in("id", privateChannelIds)
        .order("created_at");
      privateChans = data || [];
    }

    const chans = [
      ...(publicChans || []).sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0)),
      ...privateChans,
    ];
    setChannels(chans);
    await fetchUnreadCounts(chans);
    await loadMembers();

    // Active channel
    const targetChannel = initialChannelId
      ? chans.find(c => c.id === initialChannelId) || chans.find(c => c.is_default) || chans[0]
      : chans.find(c => c.is_default) || chans[0];

    if (targetChannel) {
      setActiveChannel(targetChannel);
      markChannelAsRead(targetChannel.id);
    }

    setLoading(false);

    // ── Presence channel (shared with DM page — same channel name) ──
    if (presenceChannelRef.current) {
      presenceChannelRef.current.untrack();
      supabase.removeChannel(presenceChannelRef.current);
      presenceChannelRef.current = null;
    }

    const presenceCh = supabase.channel(`presence-workspace-${workspaceId}`, {
      config: { presence: { key: user.id } },
    });

    presenceCh
      .on("presence", { event: "sync" }, () => {
        const state = presenceCh.presenceState();
        const online = new Set(Object.keys(state));
        setOnlineUsers(online);
        if (activeDmUserId) setIsOtherOnline(online.has(activeDmUserId));
      })
      .on("presence", { event: "join" }, ({ key }) => {
        setOnlineUsers(prev => {
          const next = new Set(prev);
          next.add(key);
          return next;
        });
        if (key === activeDmUserId) setIsOtherOnline(true);
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        setOnlineUsers(prev => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        if (key === activeDmUserId) setIsOtherOnline(false);
      })
      .subscribe(async status => {
        if (status === "SUBSCRIBED") {
          await presenceCh.track({
            user_id: user.id,
            full_name: profile?.full_name,
            online_at: new Date().toISOString(),
          });
        }
      });

    presenceChannelRef.current = presenceCh;

    // ── Realtime: channel messages ──
    const msgSub = supabase
      .channel(`messages-${workspaceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        async payload => {
          const ch = activeChannelRef.current;
          if (!ch) return;

          if (payload.eventType === "INSERT") {
            const msg = payload.new as Message;
            if (msg.channel_id !== ch.id) {
              // Update unread badge for other channels
              setUnreadCounts(prev => ({
                ...prev,
                [msg.channel_id]: (prev[msg.channel_id] || 0) + 1,
              }));
              return;
            }
            // Fetch sender profile
            const { data: sender } = await supabase
              .from("users").select("*").eq("id", msg.sender_id).single();
            setMessages(prev => {
              if (prev.find(m => m.id === msg.id)) return prev;
              return [...prev, { ...msg, sender }];
            });
          }

          if (payload.eventType === "UPDATE") {
            const msg = payload.new as Message;
            if (msg.channel_id !== ch.id) return;
            setMessages(prev =>
              prev.map(m => m.id === msg.id ? { ...m, ...msg } : m)
            );
          }

          if (payload.eventType === "DELETE") {
            setMessages(prev => prev.filter(m => m.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    // ── Realtime: watch ALL incoming DMs for sidebar badge ──
    if (allDmSubRef.current) {
      supabase.removeChannel(allDmSubRef.current);
      allDmSubRef.current = null;
    }

    const allDmSub = supabase
      .channel(`all-dm-watcher-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `receiver_id=eq.${user.id}`,
        },
        payload => {
          const msg = payload.new as DM;
          // If user is already looking at this DM conversation, don't badge
          if (msg.sender_id === activeDmUserId) return;
          setDmUnreadCounts(prev => {
            const updated = { ...prev, [msg.sender_id]: (prev[msg.sender_id] || 0) + 1 };
            if (typeof window !== "undefined") {
              localStorage.setItem("trexaflow:dm:unread", JSON.stringify(updated));
            }
            return updated;
          });
        }
      )
      .subscribe();

    allDmSubRef.current = allDmSub;

    return () => {
      supabase.removeChannel(msgSub);
      if (allDmSubRef.current) {
        supabase.removeChannel(allDmSubRef.current);
        allDmSubRef.current = null;
      }
    };
  };

  // ─── Load channel messages ────────────────────────────────
  const loadChannelMessages = async (channelId: string) => {
    const { data } = await supabase
      .from("messages")
      .select("*, sender:users(*)")
      .eq("channel_id", channelId)
      .order("created_at");
    setMessages(data || []);
  };

  // ─── Switch active channel ────────────────────────────────
  const switchChannel = async (channel: Channel) => {
    setView("channel");
    setActiveDmUserId(null);
    setActiveDmUser(null);
    setActiveChannel(channel);
    setMessages([]);
    setUnreadFromMessageId(null);
    markChannelAsRead(channel.id);
    await loadChannelMessages(channel.id);
  };

  // ─── Open a DM conversation ───────────────────────────────
  const openDm = async (userId: string, userProfile?: Profile | null) => {
    setView("dm");
    setActiveDmUserId(userId);
    setActiveDmUser(userProfile || null);
    setDmMessages([]);
    setDmUnreadFromMessageId(null);
    setDmUnreadCount(0);

    // Clear badge for this user
    setDmUnreadCounts(prev => {
      const updated = { ...prev, [userId]: 0 };
      if (typeof window !== "undefined") {
        localStorage.setItem("trexaflow:dm:unread", JSON.stringify(updated));
      }
      return updated;
    });

    // Fetch the profile if not passed
    if (!userProfile) {
      const { data: p } = await supabase
        .from("users").select("*").eq("id", userId).single();
      setActiveDmUser(p);
    }

    // Update presence indicator for DM header
    setIsOtherOnline(onlineUsers.has(userId));

    if (me) await loadDmMessages(me.id, userId);
  };

  // ─── Load DM messages ─────────────────────────────────────
  const loadDmMessages = async (myId: string, otherId: string) => {
    const { data } = await supabase
      .from("direct_messages")
      .select("*")
      .or(
        `and(sender_id.eq.${myId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${myId})`
      )
      .order("created_at");
    setDmMessages(data || []);

    // Clear unread badge
    setDmUnreadCounts(prev => {
      const updated = { ...prev, [otherId]: 0 };
      if (typeof window !== "undefined") {
        localStorage.setItem("trexaflow:dm:unread", JSON.stringify(updated));
      }
      return updated;
    });
  };

  // ─── Load workspace members ───────────────────────────────
  const loadMembers = async () => {
    const { data: mems } = await supabase
      .from("workspace_members")
      .select("user_id, role")
      .eq("workspace_id", workspaceId);

    if (!mems) return;

    const profiles = await Promise.all(
      mems.map(async (m: any) => {
        const { data: p } = await supabase
          .from("users").select("*").eq("id", m.user_id).single();
        return { ...m, profile: p };
      })
    );
    setMembers(profiles);
  };

  // ─── Load channel members ─────────────────────────────────
  const loadChannelMembers = async () => {
    if (!activeChannel) return;

    const { data: cms } = await supabase
      .from("channel_members")
      .select("user_id")
      .eq("channel_id", activeChannel.id);

    const memberIds = cms?.map((m: any) => m.user_id) || [];

    const inChannel = members.filter(m => memberIds.includes(m.user_id));
    const notInChannel = members.filter(m => !memberIds.includes(m.user_id));

    setChannelMembers(inChannel);
    setNonChannelMembers(notInChannel);
  };
    // ─── Send channel message ─────────────────────────────────
  const sendMessage = async () => {
    const content = newMessage.trim();
    if (!content || !me || !activeChannel || sending) return;
    setNewMessage("");
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
      setNewMessage(content);
    }
    setSending(false);
    textareaRef.current?.focus();
  };

  // ─── Send DM ──────────────────────────────────────────────
  const sendDmMessage = async () => {
    const content = dmNewMessage.trim();
    if (!content || !me || !activeDmUserId || dmSending) return;
    setDmNewMessage("");
    if (dmTextareaRef.current) dmTextareaRef.current.style.height = "auto";
    setDmSending(true);

    const { data: sent, error } = await supabase
      .from("direct_messages")
      .insert({ sender_id: me.id, receiver_id: activeDmUserId, content })
      .select()
      .single();

    if (error) {
      console.error("DM error:", error);
      setDmNewMessage(content);
      setDmSending(false);
      dmTextareaRef.current?.focus();
      return;
    }

    // Optimistic append
    if (sent) setDmMessages(prev => [...prev, sent as DM]);

    setDmSending(false);
    dmTextareaRef.current?.focus();
    setDmUnreadFromMessageId(null);
    setDmUnreadCount(0);
    setDmUnreadCounts(prev => {
      const updated = { ...prev, [activeDmUserId]: 0 };
      if (typeof window !== "undefined") {
        localStorage.setItem("trexaflow:dm:unread", JSON.stringify(updated));
      }
      return updated;
    });
  };

  // ─── Edit channel message ─────────────────────────────────
  const saveEditMessage = async (msgId: string) => {
    const trimmed = editingContent.trim();
    if (!trimmed) return;
    await supabase.from("messages").update({ content: trimmed }).eq("id", msgId);
    setMessages(prev =>
      prev.map(m => m.id === msgId ? { ...m, content: trimmed } : m)
    );
    setEditingMessageId(null);
    setEditingContent("");
  };

  // ─── Delete channel message ───────────────────────────────
  const deleteMessage = async (msgId: string) => {
    setOpenMenuMessageId(null);
    await supabase.from("messages").delete().eq("id", msgId);
    setMessages(prev => prev.filter(m => m.id !== msgId));
  };

  // ─── Toggle pin ───────────────────────────────────────────
  const togglePinMessage = async (msg: Message) => {
    const { data } = await supabase
      .from("messages")
      .update({ is_pinned: !msg.is_pinned })
      .eq("id", msg.id)
      .select()
      .single();
    if (data) {
      setMessages(prev =>
        prev.map(m => m.id === data.id ? { ...m, is_pinned: data.is_pinned, sender: m.sender } : m)
      );
    }
  };

  // ─── Mark channel message as unread ──────────────────────
  const markAsUnread = (msg: Message) => {
    if (!activeChannel) return;
    setOpenMenuMessageId(null);
    setHoveredMessage(null);
    const justBefore = new Date(new Date(msg.created_at).getTime() - 1).toISOString();
    setLastReadMap(prev => ({ ...prev, [activeChannel.id]: justBefore }));
    setUnreadFromMessageId(msg.id);
    const msgsAfter = messages.filter(m => m.created_at >= msg.created_at);
    setUnreadCounts(prev => ({ ...prev, [activeChannel.id]: msgsAfter.length }));
    if (typeof window !== "undefined") {
      const stored = JSON.parse(localStorage.getItem("trexaflow_lastread") || "{}");
      stored[activeChannel.id] = justBefore;
      localStorage.setItem("trexaflow_lastread", JSON.stringify(stored));
    }
  };

  // ─── Mark channel as read ─────────────────────────────────
  const markChannelAsRead = (channelId: string) => {
    const now = new Date().toISOString();
    setLastReadMap(prev => ({ ...prev, [channelId]: now }));
    setUnreadCounts(prev => ({ ...prev, [channelId]: 0 }));
    setUnreadFromMessageId(null);
    if (typeof window !== "undefined") {
      const stored = JSON.parse(localStorage.getItem("trexaflow_lastread") || "{}");
      stored[channelId] = now;
      localStorage.setItem("trexaflow_lastread", JSON.stringify(stored));
    }
  };

  // ─── Fetch unread counts for all channels ─────────────────
  const loadLastReadMap = (): Record<string, string> => {
    if (typeof window === "undefined") return {};
    return JSON.parse(localStorage.getItem("trexaflow_lastread") || "{}");
  };

  const fetchUnreadCounts = async (channelList: Channel[]) => {
    const stored = loadLastReadMap();
    setLastReadMap(stored);
    const counts: Record<string, number> = {};
    await Promise.all(
      channelList.map(async ch => {
        const lastRead = stored[ch.id];
        if (!lastRead) {
          const { count } = await supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("channel_id", ch.id)
            .eq("is_system", false);
          counts[ch.id] = count || 0;
        } else {
          const { count } = await supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("channel_id", ch.id)
            .eq("is_system", false)
            .gt("created_at", lastRead);
          counts[ch.id] = count || 0;
        }
      })
    );
    setUnreadCounts(counts);
  };

  // ─── Edit DM message ──────────────────────────────────────
  const saveDmEditMessage = async (msgId: string) => {
    const trimmed = dmEditingContent.trim();
    if (!trimmed) return;
    await supabase.from("direct_messages").update({ content: trimmed }).eq("id", msgId);
    setDmMessages(prev =>
      prev.map(m => m.id === msgId ? { ...m, content: trimmed } : m)
    );
    setDmEditingMessageId(null);
    setDmEditingContent("");
  };

  // ─── Delete DM message ────────────────────────────────────
  const deleteDmMessage = async (msgId: string) => {
    setDmOpenMenuMessageId(null);
    await supabase.from("direct_messages").delete().eq("id", msgId);
    setDmMessages(prev => prev.filter(m => m.id !== msgId));
  };

  // ─── Mark DM as unread ────────────────────────────────────
  const markDmAsUnread = (msg: DM) => {
    setDmOpenMenuMessageId(null);
    setDmHoveredMessage(null);
    const justBefore = new Date(new Date(msg.created_at).getTime() - 1).toISOString();
    setDmUnreadFromMessageId(msg.id);
    const count = dmMessages.filter(m => m.created_at >= msg.created_at).length;
    setDmUnreadCount(count);
    if (activeDmUserId) {
      setDmUnreadCounts(prev => ({ ...prev, [activeDmUserId]: count }));
      if (typeof window !== "undefined") {
        const stored = JSON.parse(localStorage.getItem("trexaflow_dm_lastread") || "{}");
        stored[activeDmUserId] = justBefore;
        localStorage.setItem("trexaflow_dm_lastread", JSON.stringify(stored));
      }
    }
  };

  // ─── Theme ────────────────────────────────────────────────
  const applyTheme = (mode: ThemeMode) => {
    const root = document.documentElement;
    if (mode === "system") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", mode);
    }
  };

  const handleThemeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    applyTheme(mode);
    localStorage.setItem("trexaflow_theme", mode);
    setShowThemePicker(false);
  };

  // ─── Copy workspace code ──────────────────────────────────
  const copyWorkspaceCode = () => {
    if (!workspace?.workspace_code) return;
    navigator.clipboard.writeText(workspace.workspace_code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  // ─── Save profile edit ────────────────────────────────────
  const saveProfileEdit = async () => {
    if (!me || !profileEditName.trim()) return;
    setSavingProfile(true);
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) { setSavingProfile(false); return; }

    let avatarUrl = me.avatar_url;
    if (profileEditImageFile) {
      const filePath = `${user.id}/avatar`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, profileEditImageFile, { upsert: true, contentType: profileEditImageFile.type });
      if (!uploadError) {
        const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
        avatarUrl = `${data.publicUrl}?t=${Date.now()}`;
      }
    }

    const { data: updated } = await supabase
      .from("users")
      .update({
        full_name: profileEditName.trim(),
        job_title: profileEditRole.trim() || null,
        avatar_url: avatarUrl,
      })
      .eq("id", user.id)
      .select()
      .single();

    if (updated) setMe(updated);
    setSavingProfile(false);
    setEditingProfile(false);
    setProfileEditImageFile(null);
    setProfileEditImagePreview(null);
  };

  // ─── Save workspace edit ──────────────────────────────────
  const saveWorkspaceEdit = async () => {
    if (!workspace || !wsEditName.trim()) return;
    setSavingWorkspace(true);

    let imageUrl = workspace.image_url;
    if (wsEditImageFile) {
      const filePath = `${workspace.id}/cover`;
      const { error: uploadError } = await supabase.storage
        .from("workspace-images")
        .upload(filePath, wsEditImageFile, { upsert: true, contentType: wsEditImageFile.type });
      if (!uploadError) {
        const { data } = supabase.storage.from("workspace-images").getPublicUrl(filePath);
        imageUrl = `${data.publicUrl}?t=${Date.now()}`;
      }
    }

    const { data: updated } = await supabase
      .from("workspaces")
      .update({
        name: wsEditName.trim(),
        description: wsEditDesc.trim() || null,
        image_url: imageUrl,
      })
      .eq("id", workspace.id)
      .select()
      .single();

    if (updated) setWorkspace(updated);
    setSavingWorkspace(false);
    setEditingWorkspace(false);
    setWsEditImageFile(null);
    setWsEditImagePreview(null);
  };

  // ─── Create channel ───────────────────────────────────────
  const createChannel = async () => {
    if (!newChannelName.trim() || creatingChannel) return;
    setCreatingChannel(true);

    const { data: chan, error } = await supabase
      .from("channels")
      .insert({
        workspace_id: workspaceId,
        name: newChannelName.trim().toLowerCase().replace(/\s+/g, "-"),
        description: newChannelDesc.trim() || null,
        is_private: newChannelPrivate,
        is_default: false,
      })
      .select()
      .single();

    if (error || !chan) { setCreatingChannel(false); return; }

    // Add creator as channel member
    await supabase.from("channel_members").insert({
      channel_id: chan.id,
      user_id: me?.id,
    });

    // System message
    await supabase.from("messages").insert({
      channel_id: chan.id,
      sender_id: me?.id,
      content: `${me?.full_name} created this channel.`,
      is_pinned: false,
      is_system: true,
    });

    setChannels(prev => [...prev, chan]);
    setCreatingChannel(false);
    setShowCreateChannel(false);
    setNewChannelName("");
    setNewChannelDesc("");
    setNewChannelPrivate(false);
    await switchChannel(chan);
  };

  // ─── Save channel settings ────────────────────────────────
  const saveChannelSettings = async () => {
    if (!activeChannel || !editChannelName.trim()) return;
    setSavingChannel(true);

    const { data: updated } = await supabase
      .from("channels")
      .update({
        name: editChannelName.trim().toLowerCase().replace(/\s+/g, "-"),
        description: editChannelDesc.trim() || null,
        is_private: editChannelPrivate,
      })
      .eq("id", activeChannel.id)
      .select()
      .single();

    if (updated) {
      setChannels(prev => prev.map(c => c.id === updated.id ? updated : c));
      setActiveChannel(updated);
    }
    setSavingChannel(false);
  };

  // ─── Delete channel ───────────────────────────────────────
  const deleteChannel = async () => {
    if (!activeChannel || activeChannel.is_default) return;
    await supabase.from("channels").delete().eq("id", activeChannel.id);
    const remaining = channels.filter(c => c.id !== activeChannel.id);
    setChannels(remaining);
    setShowChannelSettings(false);
    const fallback = remaining.find(c => c.is_default) || remaining[0];
    if (fallback) await switchChannel(fallback);
  };

  // ─── Add member to channel ────────────────────────────────
  const addMemberToChannel = async (userId: string) => {
    if (!activeChannel) return;
    await supabase.from("channel_members").insert({
      channel_id: activeChannel.id,
      user_id: userId,
    });
    await loadChannelMembers();
  };

  // ─── Remove member from channel ───────────────────────────
  const removeMemberFromChannel = async (userId: string) => {
    if (!activeChannel) return;
    await supabase.from("channel_members").delete()
      .eq("channel_id", activeChannel.id)
      .eq("user_id", userId);
    await loadChannelMembers();
  };

  // ─── Leave workspace ──────────────────────────────────────
  const leaveWorkspace = async () => {
    if (!me) return;
    await supabase.from("workspace_members").delete()
      .eq("workspace_id", workspaceId)
      .eq("user_id", me.id);
    await supabase.auth.signOut();
    router.replace("/auth");
  };
    // ─── Helpers ──────────────────────────────────────────────
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

  const PresenceDot = ({ userId, size = 9, borderColor = "var(--bg-sidebar)" }: { userId: string; size?: number; borderColor?: string }) => {
    const isOnline = onlineUsers.has(userId);
    return (
      <div style={{
        width: size, height: size, borderRadius: "50%",
        backgroundColor: isOnline ? "#4ade80" : "var(--text-muted)",
        border: `2px solid ${borderColor}`,
        transition: "background-color 0.4s ease",
        flexShrink: 0,
      }} />
    );
  };

  const formatMessageContent = (content: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const boldRegex = /\*\*(.+?)\*\*/g;
    const urlParts = content.split(urlRegex);
    return urlParts.map((part, i) => {
      if (urlRegex.test(part)) {
        return (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer"
            style={{ color: "#E01E5A", textDecoration: "underline", textDecorationColor: "rgba(224,30,90,0.4)", textUnderlineOffset: "3px", wordBreak: "break-all", transition: "color 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.color = "#c8174f"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "#E01E5A"; }}
          >{part}</a>
        );
      }
      const lines = part.split("\n");
      return lines.map((line, j, arr) => {
        const boldParts = line.split(boldRegex);
        const renderedLine = boldParts.map((bp, k) =>
          k % 2 === 1
            ? <strong key={k} style={{ fontWeight: 700, color: "var(--text-primary)" }}>{bp}</strong>
            : <span key={k}>{bp}</span>
        );
        return (
          <span key={`${i}-${j}`}>
            {renderedLine}
            {j < arr.length - 1 && <br />}
          </span>
        );
      });
    });
  };

  // ─── Loading screen ───────────────────────────────────────
  if (loading || checking) return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader2 size={28} color="#E01E5A" className="animate-spin" />
    </div>
  );

  const isLobby = activeChannel?.is_default;
  const pinnedMessages = messages.filter(m => m.is_pinned);

  // ─── RENDER ───────────────────────────────────────────────
  return (
    <div
      data-theme={themeMode === "system" ? undefined : themeMode}
      style={{
        display: "flex", height: "100vh",
        backgroundColor: "var(--bg-primary)",
        color: "var(--text-primary)",
        fontFamily: "var(--font-geist-sans), -apple-system, sans-serif",
      }}
    >

      {/* ══════════════════════════════════════════════════════
          SIDEBAR
      ══════════════════════════════════════════════════════ */}
      <div style={{
        width: 240, flexShrink: 0, display: "flex", flexDirection: "column",
        backgroundColor: "var(--bg-sidebar)",
        borderRight: "1px solid var(--border-color)",
        height: "100vh", overflowY: "auto",
      }}>

        {/* Workspace header */}
        <div style={{ padding: "0 14px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, borderBottom: "1px solid var(--border-color)" }}>
          <button
            onClick={() => setShowWorkspaceInfo(true)}
            style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)", fontWeight: 700, fontSize: "0.95rem", padding: "4px 6px", borderRadius: 7, flex: 1, textAlign: "left" }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--bg-hover)"}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
          >
            {workspace?.image_url
              ? <img src={workspace.image_url} style={{ width: 24, height: 24, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} alt="" />
              : <div style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: "#E01E5A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                  {workspace?.name?.[0]?.toUpperCase()}
                </div>
            }
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {workspace?.name}
            </span>
            <ChevronDown size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          </button>

          {/* Leave workspace */}
          <button
            onClick={leaveWorkspace}
            title="Leave workspace"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--icon-color)", padding: "6px", borderRadius: 6, display: "flex", alignItems: "center", flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.backgroundColor = "rgba(248,113,113,0.08)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--icon-color)"; e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            <LogOut size={15} />
          </button>
        </div>

        {/* Channels section */}
        <div style={{ padding: "16px 10px 8px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 6px", marginBottom: 4 }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Channels
            </span>
            <button
              onClick={() => setShowCreateChannel(true)}
              title="New channel"
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--icon-color)", padding: "2px", borderRadius: 4, display: "flex" }}
              onMouseEnter={e => e.currentTarget.style.color = "var(--text-primary)"}
              onMouseLeave={e => e.currentTarget.style.color = "var(--icon-color)"}
            >
              <Plus size={14} />
            </button>
          </div>

          {channels.map(ch => {
            const isActive = view === "channel" && activeChannel?.id === ch.id;
            const unread = unreadCounts[ch.id] || 0;
            return (
              <button
                key={ch.id}
                onClick={() => switchChannel(ch)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 7,
                  padding: "5px 8px", borderRadius: 7, border: "none", cursor: "pointer",
                  backgroundColor: isActive ? "var(--bg-active)" : "transparent",
                  color: isActive ? "var(--text-primary)" : unread > 0 ? "var(--text-primary)" : "var(--text-secondary)",
                  textAlign: "left", transition: "background 0.12s", marginBottom: 1,
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = "var(--bg-hover)"; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                {ch.is_private
                  ? <Lock size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                  : <Globe size={13} style={{ color: isActive ? "#E01E5A" : "var(--text-muted)", flexShrink: 0 }} />
                }
                <span style={{ fontSize: "0.875rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: isActive || unread > 0 ? 600 : 400, flex: 1 }}>
                  {ch.name}
                </span>
                {unread > 0 && (
                  <div style={{ minWidth: 18, height: 18, borderRadius: 999, backgroundColor: "#E01E5A", color: "#fff", fontSize: "0.68rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px", flexShrink: 0 }}>
                    {unread > 99 ? "99+" : unread}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Direct Messages section */}
        <div style={{ padding: "8px 10px" }}>
          <div style={{ padding: "0 6px", marginBottom: 4 }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Direct Messages
            </span>
          </div>

          {members
            .filter(m => m.user_id !== me?.id)
            .map(m => {
              const isActive = view === "dm" && activeDmUserId === m.user_id;
              const dmUnread = dmUnreadCounts[m.user_id] || 0;
              return (
                <button
                  key={m.user_id}
                  onClick={() => openDm(m.user_id, m.profile)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 8,
                    padding: "5px 8px", borderRadius: 7, border: "none", cursor: "pointer",
                    backgroundColor: isActive ? "var(--bg-active)" : "transparent",
                    color: isActive ? "var(--text-primary)" : dmUnread > 0 ? "var(--text-primary)" : "var(--text-secondary)",
                    textAlign: "left", transition: "background 0.12s", marginBottom: 1,
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = "var(--bg-hover)"; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <Avatar profile={m.profile} size={22} />
                    <div style={{ position: "absolute", bottom: -1, right: -1 }}>
                      <PresenceDot userId={m.user_id} size={8} />
                    </div>
                  </div>
                  <span style={{ fontSize: "0.875rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: isActive || dmUnread > 0 ? 600 : 400, flex: 1 }}>
                    {m.profile?.full_name}
                  </span>
                  {dmUnread > 0 ? (
                    <div style={{ minWidth: 18, height: 18, borderRadius: 999, backgroundColor: "#E01E5A", color: "#fff", fontSize: "0.68rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px", flexShrink: 0 }}>
                      {dmUnread > 99 ? "99+" : dmUnread}
                    </div>
                  ) : onlineUsers.has(m.user_id) ? (
                    <span style={{ fontSize: "0.65rem", color: "var(--unread-dot)", marginLeft: "auto", fontWeight: 500, flexShrink: 0 }}>
                      online
                    </span>
                  ) : null}
                </button>
              );
            })}
        </div>

        {/* My profile at bottom */}
        <div style={{ marginTop: "auto", padding: "12px 10px", borderTop: "1px solid var(--border-color)" }}>
          <div
            onClick={() => { setShowProfileModal(true); setEditingProfile(false); }}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 8, cursor: "pointer", transition: "background 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--bg-hover)"}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
          >
            <div style={{ position: "relative" }}>
              {me?.avatar_url
                ? <img src={me.avatar_url} style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover" }} alt="" />
                : <div style={{ width: 30, height: 30, borderRadius: "50%", backgroundColor: "#E01E5A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700, color: "#fff" }}>
                    {me?.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </div>
              }
              <div style={{ position: "absolute", bottom: 0, right: 0 }}>
                <PresenceDot userId={me?.id ?? ""} size={9} />
              </div>
            </div>
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {me?.full_name}
              </div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {me?.job_title}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* ── END SIDEBAR ── */}
            {/* ══════════════════════════════════════════════════════
          MAIN CONTENT AREA
      ══════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* ── CHANNEL HEADER ── */}
        {view === "channel" && activeChannel && (
          <div style={{
            height: 56, borderBottom: "1px solid var(--border-color)",
            display: "flex", alignItems: "center", gap: 12, padding: "0 20px",
            flexShrink: 0, backgroundColor: "var(--bg-topbar)",
          }}>
            {activeChannel.is_private
              ? <Lock size={16} color="var(--icon-color)" />
              : <Globe size={16} color="#E01E5A" />
            }
            <span style={{ fontWeight: 600, fontSize: "0.92rem", color: "var(--text-primary)" }}>
              {activeChannel.name}
            </span>
            <div style={{ flex: 1 }} />

            {/* Pinned messages toggle */}
            {pinnedMessages.length > 0 && (
              <button
                onClick={() => setShowPinnedMessages(p => !p)}
                title="Pinned messages"
                style={{ background: showPinnedMessages ? "var(--bg-hover)" : "none", border: "none", cursor: "pointer", color: showPinnedMessages ? "var(--text-primary)" : "var(--icon-color)", padding: "7px", borderRadius: 8, display: "flex", alignItems: "center", gap: 5, fontSize: "0.8rem", transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.color = "var(--icon-hover)"; e.currentTarget.style.backgroundColor = "var(--bg-hover)"; }}
                onMouseLeave={e => { if (!showPinnedMessages) { e.currentTarget.style.color = "var(--icon-color)"; e.currentTarget.style.backgroundColor = "transparent"; } }}
              >
                <Pin size={15} />
                <span style={{ fontWeight: 500 }}>{pinnedMessages.length}</span>
              </button>
            )}

            {/* Channel settings */}
            <button
              onClick={() => {
                setEditChannelName(activeChannel.name);
                setEditChannelDesc("");
                setEditChannelPrivate(activeChannel.is_private);
                setChannelSettingsTab("about");
                setShowChannelSettings(true);
              }}
              title="Channel settings"
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--icon-color)", padding: "7px", borderRadius: 8, display: "flex", alignItems: "center", transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.color = "var(--icon-hover)"; e.currentTarget.style.backgroundColor = "var(--bg-hover)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--icon-color)"; e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              <Settings size={17} />
            </button>

            {/* Theme picker */}
            <div ref={themePickerRef} style={{ position: "relative" }}>
              <button
                onClick={() => setShowThemePicker(p => !p)}
                title="Switch theme"
                style={{ background: showThemePicker ? "var(--bg-hover)" : "none", border: "none", cursor: "pointer", color: "var(--icon-color)", padding: "7px", borderRadius: 8, display: "flex", alignItems: "center", transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.color = "var(--icon-hover)"; e.currentTarget.style.backgroundColor = "var(--bg-hover)"; }}
                onMouseLeave={e => { if (!showThemePicker) { e.currentTarget.style.color = "var(--icon-color)"; e.currentTarget.style.backgroundColor = "transparent"; } }}
              >
                {themeMode === "light" ? <Sun size={17} /> : themeMode === "dark" ? <Moon size={17} /> : <Monitor size={17} />}
              </button>
              {showThemePicker && (
                <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 10, padding: 4, boxShadow: "0 8px 24px var(--shadow-color)", zIndex: 100, minWidth: 150, animation: "fadeSlideDown 0.15s ease" }}>
                  {(["system", "light", "dark"] as ThemeMode[]).map(mode => (
                    <button key={mode} onClick={() => handleThemeChange(mode)}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", border: "none", cursor: "pointer", borderRadius: 7, fontSize: "0.85rem", fontWeight: themeMode === mode ? 600 : 400, backgroundColor: themeMode === mode ? "rgba(224,30,90,0.1)" : "transparent", color: themeMode === mode ? "#E01E5A" : "var(--text-primary)", transition: "all 0.12s" }}
                      onMouseEnter={e => { if (themeMode !== mode) e.currentTarget.style.backgroundColor = "var(--bg-hover)"; }}
                      onMouseLeave={e => { if (themeMode !== mode) e.currentTarget.style.backgroundColor = "transparent"; }}
                    >
                      {mode === "light" ? <Sun size={14} /> : mode === "dark" ? <Moon size={14} /> : <Monitor size={14} />}
                      <span style={{ textTransform: "capitalize" }}>{mode}</span>
                      {themeMode === mode && <Check size={13} color="#E01E5A" style={{ marginLeft: "auto" }} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── DM HEADER ── */}
        {view === "dm" && activeDmUser && (
          <div style={{
            height: 56, borderBottom: "1px solid var(--border-color)",
            display: "flex", alignItems: "center", gap: 12, padding: "0 20px",
            flexShrink: 0, backgroundColor: "var(--bg-topbar)",
          }}>
            <div style={{ position: "relative" }}>
              <Avatar profile={activeDmUser} size={34} />
              <div style={{ position: "absolute", bottom: 0, right: 0, width: 10, height: 10, borderRadius: "50%", backgroundColor: isOtherOnline ? "#4ade80" : "var(--text-muted)", border: "2px solid var(--bg-topbar)", transition: "background-color 0.4s ease" }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: "0.92rem", color: "var(--text-primary)" }}>{activeDmUser.full_name}</div>
              <div style={{ fontSize: "0.72rem", color: isOtherOnline ? "#4ade80" : "var(--text-muted)" }}>
                {isOtherOnline ? "Online" : "Offline"}
              </div>
            </div>
            <div style={{ flex: 1 }} />

            {/* Theme picker (DM) */}
            <div ref={themePickerRef} style={{ position: "relative" }}>
              <button
                onClick={() => setShowThemePicker(p => !p)}
                title="Switch theme"
                style={{ background: showThemePicker ? "var(--bg-hover)" : "none", border: "none", cursor: "pointer", color: "var(--icon-color)", padding: "7px", borderRadius: 8, display: "flex", alignItems: "center", transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.color = "var(--icon-hover)"; e.currentTarget.style.backgroundColor = "var(--bg-hover)"; }}
                onMouseLeave={e => { if (!showThemePicker) { e.currentTarget.style.color = "var(--icon-color)"; e.currentTarget.style.backgroundColor = "transparent"; } }}
              >
                {themeMode === "light" ? <Sun size={17} /> : themeMode === "dark" ? <Moon size={17} /> : <Monitor size={17} />}
              </button>
              {showThemePicker && (
                <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 10, padding: 4, boxShadow: "0 8px 24px var(--shadow-color)", zIndex: 100, minWidth: 150, animation: "fadeSlideDown 0.15s ease" }}>
                  {(["system", "light", "dark"] as ThemeMode[]).map(mode => (
                    <button key={mode} onClick={() => handleThemeChange(mode)}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", border: "none", cursor: "pointer", borderRadius: 7, fontSize: "0.85rem", fontWeight: themeMode === mode ? 600 : 400, backgroundColor: themeMode === mode ? "rgba(224,30,90,0.1)" : "transparent", color: themeMode === mode ? "#E01E5A" : "var(--text-primary)", transition: "all 0.12s" }}
                      onMouseEnter={e => { if (themeMode !== mode) e.currentTarget.style.backgroundColor = "var(--bg-hover)"; }}
                      onMouseLeave={e => { if (themeMode !== mode) e.currentTarget.style.backgroundColor = "transparent"; }}
                    >
                      {mode === "light" ? <Sun size={14} /> : mode === "dark" ? <Moon size={14} /> : <Monitor size={14} />}
                      <span style={{ textTransform: "capitalize" }}>{mode}</span>
                      {themeMode === mode && <Check size={13} color="#E01E5A" style={{ marginLeft: "auto" }} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            CHANNEL VIEW
        ══════════════════════════════════════════════════════ */}
        {view === "channel" && (
          <>
            {/* Pinned messages bar */}
            {showPinnedMessages && pinnedMessages.length > 0 && (
              <div style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-secondary)", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 20px 4px" }}>
                  <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#E01E5A", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Pinned Messages — {pinnedMessages.length}
                  </span>
                  <button onClick={() => setShowPinnedMessages(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "2px" }}>
                    <X size={14} />
                  </button>
                </div>
                {pinnedMessages.map((msg, i) => (
                  <div key={msg.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 20px", borderTop: i > 0 ? "1px solid var(--border-color)" : "none" }}>
                    <Avatar profile={msg.sender} size={26} />
                    <div style={{ flex: 1, overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginBottom: 2 }}>
                        <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>{msg.sender?.full_name}</span>
                        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{formatTime(msg.created_at)}</span>
                      </div>
                      <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {msg.content}
                      </p>
                    </div>
                    {me?.id === workspace?.owner_id && (
                      <button onClick={() => togglePinMessage(msg)} title="Unpin"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "2px", flexShrink: 0 }}
                        onMouseEnter={e => e.currentTarget.style.color = "#f87171"}
                        onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Channel messages */}
            <div ref={messagesContainerRef} style={{ flex: 1, overflowY: "auto", padding: "20px 20px 0" }}>

              {/* Lobby welcome header */}
              {isLobby && (
                <div style={{ marginBottom: 32, paddingBottom: 24, borderBottom: "1px solid var(--border-color)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: "rgba(224,30,90,0.12)", border: "1px solid rgba(224,30,90,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Globe size={22} color="#E01E5A" />
                    </div>
                    <div>
                      <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--text-primary)" }}>Welcome to #{activeChannel?.name}!</h2>
                      {workspace?.description && <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: 3 }}>{workspace.description}</p>}
                    </div>
                  </div>
                  <div style={{ marginTop: 20 }}>
                    <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {channelMembers.length} Member{channelMembers.length !== 1 ? "s" : ""}
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                      {channelMembers.map(m => (
                        <div key={m.user_id} onClick={() => setShowMemberProfile(m)}
                          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 14px", borderRadius: 12, cursor: "pointer", backgroundColor: "var(--bg-hover)", border: "1px solid var(--border-color)", minWidth: 80, transition: "all 0.15s" }}
                          onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--bg-active)"; e.currentTarget.style.borderColor = "var(--border-strong)"; }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = "var(--bg-hover)"; e.currentTarget.style.borderColor = "var(--border-color)"; }}
                        >
                          <div style={{ position: "relative" }}>
                            <Avatar profile={m.profile} size={40} />
                            <div style={{ position: "absolute", bottom: 1, right: 1 }}>
                              <PresenceDot userId={m.user_id} size={10} borderColor="var(--bg-hover)" />
                            </div>
                          </div>
                          <span style={{ fontSize: "0.78rem", fontWeight: 500, textAlign: "center", color: "var(--text-primary)" }}>
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

              {/* Channel messages list */}
              {messages.map((msg, i) => {
                const isMe = msg.sender_id === me?.id;
                const showDate = i === 0 || new Date(messages[i - 1].created_at).toDateString() !== new Date(msg.created_at).toDateString();
                const showUnreadMarker = unreadFromMessageId === msg.id;

                if (msg.is_system) {
                  return (
                    <div key={msg.id}>
                      {showDate && (
                        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0 16px" }}>
                          <div style={{ flex: 1, height: 1, backgroundColor: "var(--divider)" }} />
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>{formatDate(msg.created_at)}</span>
                          <div style={{ flex: 1, height: 1, backgroundColor: "var(--divider)" }} />
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "center", margin: "10px 0" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, backgroundColor: "var(--bg-hover)", border: "1px solid var(--border-color)", borderRadius: 999, padding: "5px 14px" }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#4ade80" }} />
                          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{formatMessageContent(msg.content)}</span>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={msg.id}>
                    {showDate && (
                      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0 16px" }}>
                        <div style={{ flex: 1, height: 1, backgroundColor: "var(--divider)" }} />
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>{formatDate(msg.created_at)}</span>
                        <div style={{ flex: 1, height: 1, backgroundColor: "var(--divider)" }} />
                      </div>
                    )}
                    {showUnreadMarker && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0 4px" }}>
                        <div style={{ flex: 1, height: 1, backgroundColor: "#E01E5A" }} />
                        <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#E01E5A", textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>New messages</span>
                        <div style={{ flex: 1, height: 1, backgroundColor: "#E01E5A" }} />
                      </div>
                    )}
                    <div
                      style={{ position: "relative", display: "flex", gap: 10, marginBottom: 2, padding: "4px 8px", borderRadius: 8, transition: "background 0.1s", backgroundColor: hoveredMessage === msg.id ? "var(--bg-message-hover)" : "transparent" }}
                      onMouseEnter={() => setHoveredMessage(msg.id)}
                      onMouseLeave={() => setHoveredMessage(null)}
                    >
                      <Avatar profile={msg.sender} size={34} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
                          <span style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--text-primary)", cursor: "pointer" }}
                            onClick={() => { const m = members.find(m => m.user_id === msg.sender_id); if (m) setShowMemberProfile(m); }}
                          >
                            {msg.sender?.full_name || "Unknown"}
                          </span>
                          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{formatTime(msg.created_at)}</span>
                          {msg.is_pinned && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: "0.68rem", color: "#E01E5A", fontWeight: 600 }}>
                              <Pin size={10} /> Pinned
                            </span>
                          )}
                        </div>
                        {editingMessageId === msg.id ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <textarea
                              value={editingContent}
                              onChange={e => setEditingContent(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEditMessage(msg.id); } if (e.key === "Escape") { setEditingMessageId(null); setEditingContent(""); } }}
                              style={{ width: "100%", padding: "8px 10px", backgroundColor: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: 8, color: "var(--text-primary)", fontSize: "0.88rem", outline: "none", resize: "none", fontFamily: "inherit", lineHeight: 1.5 }}
                              autoFocus
                            />
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={() => saveEditMessage(msg.id)} style={{ padding: "4px 12px", borderRadius: 6, border: "none", backgroundColor: "#E01E5A", color: "#fff", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}>Save</button>
                              <button onClick={() => { setEditingMessageId(null); setEditingContent(""); }} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid var(--border-color)", backgroundColor: "transparent", color: "var(--text-muted)", fontSize: "0.8rem", cursor: "pointer" }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.6, wordBreak: "break-word" }}>
                            {formatMessageContent(msg.content)}
                          </p>
                        )}
                      </div>

                      {/* Message action toolbar */}
                      {hoveredMessage === msg.id && editingMessageId !== msg.id && (
                        <div ref={menuRef} style={{ position: "absolute", top: 4, right: 8, display: "flex", gap: 2, backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 8, padding: "2px", boxShadow: "0 4px 12px var(--shadow-color)", zIndex: 10 }}>
                          {isMe && (
                            <button onClick={() => { setEditingMessageId(msg.id); setEditingContent(msg.content); setOpenMenuMessageId(null); }}
                              title="Edit" style={{ background: "none", border: "none", cursor: "pointer", padding: "5px 7px", borderRadius: 6, color: "var(--icon-color)", display: "flex", alignItems: "center" }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--bg-hover)"}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                            ><Pencil size={14} /></button>
                          )}
                          {me?.id === workspace?.owner_id && (
                            <button onClick={() => togglePinMessage(msg)}
                              title={msg.is_pinned ? "Unpin" : "Pin"} style={{ background: "none", border: "none", cursor: "pointer", padding: "5px 7px", borderRadius: 6, color: msg.is_pinned ? "#E01E5A" : "var(--icon-color)", display: "flex", alignItems: "center" }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--bg-hover)"}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                            ><Pin size={14} /></button>
                          )}
                          <button onClick={() => markAsUnread(msg)}
                            title="Mark as unread" style={{ background: "none", border: "none", cursor: "pointer", padding: "5px 7px", borderRadius: 6, color: "var(--icon-color)", display: "flex", alignItems: "center" }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--bg-hover)"}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                          ><MailOpen size={14} /></button>
                          {isMe && (
                            <button onClick={() => deleteMessage(msg.id)}
                              title="Delete" style={{ background: "none", border: "none", cursor: "pointer", padding: "5px 7px", borderRadius: 6, color: "#f87171", display: "flex", alignItems: "center" }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = "rgba(248,113,113,0.08)"}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                            ><Trash2 size={14} /></button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} style={{ height: 20 }} />
            </div>

            {/* Channel input */}
            <div style={{ padding: "12px 20px 16px", flexShrink: 0 }}>
              <div style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: 12, overflow: "hidden" }}>
                <textarea
                  ref={textareaRef}
                  value={newMessage}
                  onChange={e => { setNewMessage(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder={`Message #${activeChannel?.name || "..."}`}
                  style={{ width: "100%", padding: "13px 16px 6px", background: "none", border: "none", color: "var(--text-primary)", fontSize: "0.9rem", outline: "none", resize: "none", fontFamily: "inherit", lineHeight: 1.5, minHeight: 44, maxHeight: 120, display: "block" }}
                />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 10px 8px" }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button type="button" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--icon-color)", padding: 5, borderRadius: 6 }}
                      onMouseEnter={e => e.currentTarget.style.color = "var(--icon-hover)"}
                      onMouseLeave={e => e.currentTarget.style.color = "var(--icon-color)"}
                    ><Paperclip size={17} /></button>
                    <button type="button" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--icon-color)", padding: 5, borderRadius: 6 }}
                      onMouseEnter={e => e.currentTarget.style.color = "var(--icon-hover)"}
                      onMouseLeave={e => e.currentTarget.style.color = "var(--icon-color)"}
                    ><Smile size={17} /></button>
                  </div>
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || sending}
                    style={{ backgroundColor: newMessage.trim() ? "#E01E5A" : "rgba(255,255,255,0.08)", border: "none", borderRadius: 7, padding: "7px 12px", cursor: newMessage.trim() ? "pointer" : "default", color: newMessage.trim() ? "#fff" : "rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
                  >
                    {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  </button>
                </div>
              </div>
              <p style={{ fontSize: "0.72rem", color: "var(--text-faint)", marginTop: 6, textAlign: "center" }}>
                Enter to send · Shift+Enter for new line
              </p>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════
            DM VIEW
        ══════════════════════════════════════════════════════ */}
        {view === "dm" && (
          <>
            {/* DM messages */}
            <div ref={dmMessagesContainerRef} style={{ flex: 1, overflowY: "auto", padding: "24px 20px 0" }}>

              {/* Empty state */}
              {dmMessages.length === 0 && activeDmUser && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "80%", gap: 16 }}>
                  <div style={{ position: "relative" }}>
                    <Avatar profile={activeDmUser} size={72} />
                    <div style={{ position: "absolute", bottom: 3, right: 3, width: 16, height: 16, borderRadius: "50%", backgroundColor: isOtherOnline ? "#4ade80" : "var(--text-muted)", border: "3px solid var(--bg-primary)", transition: "background-color 0.4s ease" }} />
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <h3 style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: 6, color: "var(--text-primary)" }}>{activeDmUser.full_name}</h3>
                    <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{activeDmUser.job_title}</p>
                  </div>
                  <div style={{ padding: "10px 20px", backgroundColor: "var(--bg-hover)", border: "1px solid var(--border-color)", borderRadius: 999 }}>
                    <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                      This is the beginning of your conversation with <strong style={{ color: "var(--text-primary)" }}>{activeDmUser.full_name}</strong>
                    </p>
                  </div>
                </div>
              )}

              {/* DM messages list */}
              {dmMessages.map((msg, i) => {
                const isMe = msg.sender_id === me?.id;
                const senderProfile = isMe ? me : activeDmUser;
                const showDate = i === 0 || new Date(dmMessages[i - 1].created_at).toDateString() !== new Date(msg.created_at).toDateString();
                const showUnreadMarker = dmUnreadFromMessageId === msg.id;

                return (
                  <div key={msg.id}>
                    {showDate && (
                      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0 16px" }}>
                        <div style={{ flex: 1, height: 1, backgroundColor: "var(--divider)" }} />
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>{formatDate(msg.created_at)}</span>
                        <div style={{ flex: 1, height: 1, backgroundColor: "var(--divider)" }} />
                      </div>
                    )}
                    {showUnreadMarker && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0 4px" }}>
                        <div style={{ flex: 1, height: 1, backgroundColor: "#E01E5A" }} />
                        <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#E01E5A", textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>New messages</span>
                        <div style={{ flex: 1, height: 1, backgroundColor: "#E01E5A" }} />
                      </div>
                    )}
                    <div
                      style={{ position: "relative", display: "flex", gap: 10, marginBottom: 2, padding: "4px 8px", borderRadius: 8, transition: "background 0.1s", backgroundColor: dmHoveredMessage === msg.id ? "var(--bg-message-hover)" : "transparent" }}
                      onMouseEnter={() => setDmHoveredMessage(msg.id)}
                      onMouseLeave={() => setDmHoveredMessage(null)}
                    >
                      <Avatar profile={senderProfile} size={34} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
                          <span style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--text-primary)" }}>{senderProfile?.full_name}</span>
                          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{formatTime(msg.created_at)}</span>
                        </div>
                        {dmEditingMessageId === msg.id ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <textarea
                              value={dmEditingContent}
                              onChange={e => setDmEditingContent(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveDmEditMessage(msg.id); } if (e.key === "Escape") { setDmEditingMessageId(null); setDmEditingContent(""); } }}
                              style={{ width: "100%", padding: "8px 10px", backgroundColor: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: 8, color: "var(--text-primary)", fontSize: "0.88rem", outline: "none", resize: "none", fontFamily: "inherit", lineHeight: 1.5 }}
                              autoFocus
                            />
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={() => saveDmEditMessage(msg.id)} style={{ padding: "4px 12px", borderRadius: 6, border: "none", backgroundColor: "#E01E5A", color: "#fff", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}>Save</button>
                              <button onClick={() => { setDmEditingMessageId(null); setDmEditingContent(""); }} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid var(--border-color)", backgroundColor: "transparent", color: "var(--text-muted)", fontSize: "0.8rem", cursor: "pointer" }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.6, wordBreak: "break-word" }}>
                            {formatMessageContent(msg.content)}
                          </p>
                        )}
                      </div>

                      {/* DM message action toolbar */}
                      {dmHoveredMessage === msg.id && dmEditingMessageId !== msg.id && (
                        <div ref={dmMenuRef} style={{ position: "absolute", top: 4, right: 8, display: "flex", gap: 2, backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 8, padding: "2px", boxShadow: "0 4px 12px var(--shadow-color)", zIndex: 10 }}>
                          {isMe && (
                            <button onClick={() => { setDmEditingMessageId(msg.id); setDmEditingContent(msg.content); setDmOpenMenuMessageId(null); }}
                              title="Edit" style={{ background: "none", border: "none", cursor: "pointer", padding: "5px 7px", borderRadius: 6, color: "var(--icon-color)", display: "flex", alignItems: "center" }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--bg-hover)"}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                            ><Pencil size={14} /></button>
                          )}
                          <button onClick={() => markDmAsUnread(msg)}
                            title="Mark as unread" style={{ background: "none", border: "none", cursor: "pointer", padding: "5px 7px", borderRadius: 6, color: "var(--icon-color)", display: "flex", alignItems: "center" }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--bg-hover)"}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                          ><MailOpen size={14} /></button>
                          {isMe && (
                            <button onClick={() => deleteDmMessage(msg.id)}
                              title="Delete" style={{ background: "none", border: "none", cursor: "pointer", padding: "5px 7px", borderRadius: 6, color: "#f87171", display: "flex", alignItems: "center" }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = "rgba(248,113,113,0.08)"}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                            ><Trash2 size={14} /></button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div style={{ height: 20 }} />
            </div>

            {/* DM input */}
            <div style={{ padding: "12px 20px 16px", flexShrink: 0 }}>
              <div style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: 12, overflow: "hidden" }}>
                <textarea
                  ref={dmTextareaRef}
                  value={dmNewMessage}
                  onChange={e => { setDmNewMessage(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendDmMessage(); } }}
                  placeholder={`Message ${activeDmUser?.full_name || "..."}`}
                  style={{ width: "100%", padding: "13px 16px 6px", background: "none", border: "none", color: "var(--text-primary)", fontSize: "0.9rem", outline: "none", resize: "none", fontFamily: "inherit", lineHeight: 1.5, minHeight: 44, maxHeight: 120, display: "block" }}
                />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 10px 8px" }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button type="button" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--icon-color)", padding: 5, borderRadius: 6 }}
                      onMouseEnter={e => e.currentTarget.style.color = "var(--icon-hover)"}
                      onMouseLeave={e => e.currentTarget.style.color = "var(--icon-color)"}
                    ><Paperclip size={17} /></button>
                    <button type="button" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--icon-color)", padding: 5, borderRadius: 6 }}
                      onMouseEnter={e => e.currentTarget.style.color = "var(--icon-hover)"}
                      onMouseLeave={e => e.currentTarget.style.color = "var(--icon-color)"}
                    ><Smile size={17} /></button>
                  </div>
                  <button
                    onClick={sendDmMessage}
                    disabled={!dmNewMessage.trim() || dmSending}
                    style={{ backgroundColor: dmNewMessage.trim() ? "#E01E5A" : "rgba(255,255,255,0.08)", border: "none", borderRadius: 7, padding: "7px 12px", cursor: dmNewMessage.trim() ? "pointer" : "default", color: dmNewMessage.trim() ? "#fff" : "rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
                  >
                    {dmSending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  </button>
                </div>
              </div>
              <p style={{ fontSize: "0.72rem", color: "var(--text-faint)", marginTop: 6, textAlign: "center" }}>
                Enter to send · Shift+Enter for new line
              </p>
            </div>
          </>
        )}

      </div>
      {/* ── END MAIN CONTENT ── */}
            {/* ══════════════════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════════════════ */}

      {/* ── WORKSPACE INFO MODAL ── */}
      {showWorkspaceInfo && workspace && (
        <div
          onClick={e => { if (e.target === e.currentTarget) { setShowWorkspaceInfo(false); setEditingWorkspace(false); } }}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, backdropFilter: "blur(4px)", padding: 20, animation: "fadeIn 0.15s ease" }}
        >
          <div style={{ backgroundColor: "var(--bg-secondary)", borderRadius: 16, width: "100%", maxWidth: 480, boxShadow: "0 24px 64px rgba(0,0,0,0.4)", border: "1px solid var(--border-color)", overflow: "hidden", animation: "slideUp 0.2s ease" }}>

            {/* Banner */}
            <div style={{ height: 80, background: workspace.image_url ? `url(${workspace.image_url}) center/cover` : "var(--banner-gradient)", position: "relative" }}>
              <button
                onClick={() => { setShowWorkspaceInfo(false); setEditingWorkspace(false); }}
                style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.4)", border: "none", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}
              ><X size={14} /></button>
            </div>

            <div style={{ padding: "0 24px 24px" }}>
              {/* Workspace avatar */}
              <div style={{ marginTop: -28, marginBottom: 16, position: "relative", width: "fit-content" }}>
                {workspace.image_url
                  ? <img src={workspace.image_url} style={{ width: 56, height: 56, borderRadius: 14, objectFit: "cover", border: "3px solid var(--bg-secondary)" }} alt="" />
                  : <div style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: "#E01E5A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", fontWeight: 700, color: "#fff", border: "3px solid var(--bg-secondary)" }}>
                      {workspace.name?.[0]?.toUpperCase()}
                    </div>
                }
              </div>

              {!editingWorkspace ? (
                <>
                  <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 4, color: "var(--text-primary)" }}>{workspace.name}</h2>
                  {workspace.description
                    ? <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.6 }}>{workspace.description}</p>
                    : <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 16, fontStyle: "italic" }}>No description</p>
                  }

                  {/* Workspace code */}
                  <div style={{ backgroundColor: "var(--bg-tertiary)", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
                    <p style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Workspace Code</p>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <code style={{ fontSize: "0.95rem", fontFamily: "monospace", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "0.08em" }}>{workspace.workspace_code}</code>
                      <button
                        onClick={copyWorkspaceCode}
                        style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, border: "1px solid var(--border-color)", background: codeCopied ? "rgba(74,222,128,0.1)" : "var(--bg-secondary)", color: codeCopied ? "#4ade80" : "var(--text-secondary)", fontSize: "0.78rem", fontWeight: 500, cursor: "pointer", transition: "all 0.2s" }}
                      >
                        {codeCopied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                      </button>
                    </div>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 8 }}>
                      Share this ID with teammates so they can join your workspace during sign up.
                    </p>
                  </div>

                  {/* Members count */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                    <Users size={14} color="var(--icon-color)" />
                    <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{members.length} member{members.length !== 1 ? "s" : ""}</span>
                  </div>

                  {/* Edit button — owner only */}
                  {me?.id === workspace.owner_id && (
                    <button
                      onClick={() => { setEditingWorkspace(true); setWsEditName(workspace.name); setWsEditDesc(workspace.description || ""); }}
                      style={{ width: "100%", padding: "10px", borderRadius: 9, border: "1px solid var(--border-color)", backgroundColor: "transparent", color: "var(--text-primary)", fontSize: "0.88rem", fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--bg-hover)"}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                    >Edit Workspace</button>
                  )}
                </>
              ) : (
                /* ── Edit workspace form ── */
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Edit Workspace</h3>

                  {/* Image upload */}
                  <div>
                    <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Workspace Image</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {wsEditImagePreview || workspace.image_url
                        ? <img src={wsEditImagePreview || workspace.image_url} style={{ width: 48, height: 48, borderRadius: 12, objectFit: "cover", border: "1px solid var(--border-color)" }} alt="" />
                        : <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: "#E01E5A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", fontWeight: 700, color: "#fff" }}>{workspace.name?.[0]?.toUpperCase()}</div>
                      }
                      <button
                        onClick={() => wsEditImageInputRef.current?.click()}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)", fontSize: "0.82rem", cursor: "pointer" }}
                      ><Upload size={13} /> Upload image</button>
                      <input ref={wsEditImageInputRef} type="file" accept="image/*" style={{ display: "none" }}
                        onChange={e => { const f = e.target.files?.[0]; if (!f) return; setWsEditImageFile(f); setWsEditImagePreview(URL.createObjectURL(f)); }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Name</label>
                    <input
                      value={wsEditName}
                      onChange={e => setWsEditName(e.target.value)}
                      style={{ width: "100%", padding: "9px 12px", backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", borderRadius: 8, color: "var(--text-primary)", fontSize: "0.9rem", outline: "none" }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Description</label>
                    <textarea
                      value={wsEditDesc}
                      onChange={e => setWsEditDesc(e.target.value)}
                      rows={3}
                      style={{ width: "100%", padding: "9px 12px", backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", borderRadius: 8, color: "var(--text-primary)", fontSize: "0.9rem", outline: "none", resize: "none", fontFamily: "inherit" }}
                    />
                  </div>

                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <button
                      onClick={saveWorkspaceEdit}
                      disabled={savingWorkspace || !wsEditName.trim()}
                      style={{ flex: 1, padding: "10px", borderRadius: 9, border: "none", backgroundColor: "#E01E5A", color: "#fff", fontSize: "0.88rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: savingWorkspace ? 0.7 : 1 }}
                    >
                      {savingWorkspace ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : "Save Changes"}
                    </button>
                    <button
                      onClick={() => { setEditingWorkspace(false); setWsEditImageFile(null); setWsEditImagePreview(null); }}
                      style={{ padding: "10px 18px", borderRadius: 9, border: "1px solid var(--border-color)", backgroundColor: "transparent", color: "var(--text-muted)", fontSize: "0.88rem", cursor: "pointer" }}
                    >Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── PROFILE MODAL ── */}
      {showProfileModal && me && (
        <div
          onClick={e => { if (e.target === e.currentTarget) { setShowProfileModal(false); setEditingProfile(false); } }}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, backdropFilter: "blur(4px)", padding: 20, animation: "fadeIn 0.15s ease" }}
        >
          <div style={{ backgroundColor: "var(--bg-secondary)", borderRadius: 16, width: "100%", maxWidth: 420, boxShadow: "0 24px 64px rgba(0,0,0,0.4)", border: "1px solid var(--border-color)", overflow: "hidden", animation: "slideUp 0.2s ease" }}>

            {/* Banner */}
            <div style={{ height: 72, background: "var(--banner-gradient)", position: "relative" }}>
              <button
                onClick={() => { setShowProfileModal(false); setEditingProfile(false); }}
                style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.4)", border: "none", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}
              ><X size={14} /></button>
            </div>

            <div style={{ padding: "0 24px 24px" }}>
              <div style={{ marginTop: -28, marginBottom: 14 }}>
                <div style={{ position: "relative", display: "inline-block" }}>
                  {me.avatar_url
                    ? <img src={me.avatar_url} style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", border: "3px solid var(--bg-secondary)" }} alt="" />
                    : <div style={{ width: 56, height: 56, borderRadius: "50%", backgroundColor: "#E01E5A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", fontWeight: 700, color: "#fff", border: "3px solid var(--bg-secondary)" }}>
                        {getInitials(me.full_name)}
                      </div>
                  }
                  <div style={{ position: "absolute", bottom: 2, right: 2 }}>
                    <PresenceDot userId={me.id} size={12} borderColor="var(--bg-secondary)" />
                  </div>
                </div>
              </div>

              {!editingProfile ? (
                <>
                  <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 4, color: "var(--text-primary)" }}>{me.full_name}</h2>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: 4 }}>{me.job_title || <span style={{ fontStyle: "italic", color: "var(--text-muted)" }}>No role set</span>}</p>
                  <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: 20 }}>{me.email}</p>
                  <button
                    onClick={() => { setEditingProfile(true); setProfileEditName(me.full_name); setProfileEditRole(me.job_title || ""); }}
                    style={{ width: "100%", padding: "10px", borderRadius: 9, border: "1px solid var(--border-color)", backgroundColor: "transparent", color: "var(--text-primary)", fontSize: "0.88rem", fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--bg-hover)"}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                  >Edit Profile</button>
                </>
              ) : (
                /* ── Edit profile form ── */
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>Edit Profile</h3>

                  {/* Avatar upload */}
                  <div>
                    <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Avatar</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {profileEditImagePreview || me.avatar_url
                        ? <img src={profileEditImagePreview || me.avatar_url} style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--border-color)" }} alt="" />
                        : <div style={{ width: 44, height: 44, borderRadius: "50%", backgroundColor: "#E01E5A", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#fff" }}>{getInitials(me.full_name)}</div>
                      }
                      <button
                        onClick={() => profileEditImageInputRef.current?.click()}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)", fontSize: "0.82rem", cursor: "pointer" }}
                      ><Upload size={13} /> Upload photo</button>
                      <input ref={profileEditImageInputRef} type="file" accept="image/*" style={{ display: "none" }}
                        onChange={e => { const f = e.target.files?.[0]; if (!f) return; setProfileEditImageFile(f); setProfileEditImagePreview(URL.createObjectURL(f)); }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Full Name</label>
                    <input
                      value={profileEditName}
                      onChange={e => setProfileEditName(e.target.value)}
                      style={{ width: "100%", padding: "9px 12px", backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", borderRadius: 8, color: "var(--text-primary)", fontSize: "0.9rem", outline: "none" }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Role / Title</label>
                    <input
                      value={profileEditRole}
                      onChange={e => setProfileEditRole(e.target.value)}
                      placeholder="e.g. Software Engineer"
                      style={{ width: "100%", padding: "9px 12px", backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", borderRadius: 8, color: "var(--text-primary)", fontSize: "0.9rem", outline: "none" }}
                    />
                  </div>

                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <button
                      onClick={saveProfileEdit}
                      disabled={savingProfile || !profileEditName.trim()}
                      style={{ flex: 1, padding: "10px", borderRadius: 9, border: "none", backgroundColor: "#E01E5A", color: "#fff", fontSize: "0.88rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: savingProfile ? 0.7 : 1 }}
                    >
                      {savingProfile ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : "Save Changes"}
                    </button>
                    <button
                      onClick={() => { setEditingProfile(false); setProfileEditImageFile(null); setProfileEditImagePreview(null); }}
                      style={{ padding: "10px 18px", borderRadius: 9, border: "1px solid var(--border-color)", backgroundColor: "transparent", color: "var(--text-muted)", fontSize: "0.88rem", cursor: "pointer" }}
                    >Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE CHANNEL MODAL ── */}
      {showCreateChannel && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowCreateChannel(false); }}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, backdropFilter: "blur(4px)", padding: 20, animation: "fadeIn 0.15s ease" }}
        >
          <div style={{ backgroundColor: "var(--bg-secondary)", borderRadius: 16, width: "100%", maxWidth: 440, padding: 28, boxShadow: "0 24px 64px rgba(0,0,0,0.4)", border: "1px solid var(--border-color)", animation: "slideUp 0.2s ease" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)" }}>Create a channel</h2>
              <button onClick={() => setShowCreateChannel(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={18} /></button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Channel Name</label>
                <div style={{ position: "relative" }}>
                  {newChannelPrivate 
                    ? <Lock size={14} color="var(--text-muted)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                    : <Globe size={14} color="#E01E5A" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                  }
                  <input
                    value={newChannelName}
                    onChange={e => setNewChannelName(e.target.value)}
                    placeholder="e.g. design-feedback"
                    autoFocus
                    onKeyDown={e => { if (e.key === "Enter") createChannel(); }}
                    style={{ width: "100%", padding: "9px 12px 9px 34px", backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", borderRadius: 8, color: "var(--text-primary)", fontSize: "0.9rem", outline: "none" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Description <span style={{ fontWeight: 400, textTransform: "none" }}>(optional)</span></label>
                <input
                  value={newChannelDesc}
                  onChange={e => setNewChannelDesc(e.target.value)}
                  placeholder="What's this channel about?"
                  style={{ width: "100%", padding: "9px 12px", backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", borderRadius: 8, color: "var(--text-primary)", fontSize: "0.9rem", outline: "none" }}
                />
              </div>

              {/* Private toggle */}
              <div
                onClick={() => setNewChannelPrivate(p => !p)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", backgroundColor: "var(--bg-tertiary)", borderRadius: 10, cursor: "pointer", border: `1px solid ${newChannelPrivate ? "rgba(224,30,90,0.3)" : "var(--border-color)"}`, transition: "all 0.15s" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Lock size={15} color={newChannelPrivate ? "#E01E5A" : "var(--icon-color)"} />
                  <div>
                    <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text-primary)" }}>Private channel</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Only invited members can see this channel</div>
                  </div>
                </div>
                <div style={{ width: 36, height: 20, borderRadius: 999, backgroundColor: newChannelPrivate ? "#E01E5A" : "var(--bg-active)", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                  <div style={{ position: "absolute", top: 2, left: newChannelPrivate ? 18 : 2, width: 16, height: 16, borderRadius: "50%", backgroundColor: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
                </div>
              </div>

              <button
                onClick={createChannel}
                disabled={!newChannelName.trim() || creatingChannel}
                style={{ padding: "11px", borderRadius: 9, border: "none", backgroundColor: newChannelName.trim() ? "#E01E5A" : "var(--bg-active)", color: newChannelName.trim() ? "#fff" : "var(--text-muted)", fontSize: "0.9rem", fontWeight: 600, cursor: newChannelName.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.15s", marginTop: 4 }}
              >
                {creatingChannel ? <><Loader2 size={15} className="animate-spin" /> Creating…</> : "Create Channel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MEMBER PROFILE MODAL ── */}
      {showMemberProfile && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowMemberProfile(null); }}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, backdropFilter: "blur(4px)", padding: 20, animation: "fadeIn 0.15s ease" }}
        >
          <div style={{ backgroundColor: "var(--bg-secondary)", borderRadius: 16, width: "100%", maxWidth: 360, boxShadow: "0 24px 64px rgba(0,0,0,0.4)", border: "1px solid var(--border-color)", overflow: "hidden", animation: "slideUp 0.2s ease" }}>

            {/* Banner */}
            <div style={{ height: 72, background: "var(--banner-gradient)", position: "relative" }}>
              <button
                onClick={() => setShowMemberProfile(null)}
                style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.4)", border: "none", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}
              ><X size={14} /></button>
            </div>

            <div style={{ padding: "0 20px 24px" }}>
              <div style={{ marginTop: -28, marginBottom: 14 }}>
                <div style={{ position: "relative", display: "inline-block" }}>
                  <Avatar profile={showMemberProfile.profile} size={56} />
                  <div style={{ position: "absolute", bottom: 2, right: 2 }}>
                    <PresenceDot userId={showMemberProfile.user_id} size={13} borderColor="var(--bg-secondary)" />
                  </div>
                </div>
              </div>

              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 4, color: "var(--text-primary)" }}>{showMemberProfile.profile?.full_name}</h2>
              {showMemberProfile.profile?.job_title && (
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: 4 }}>{showMemberProfile.profile.job_title}</p>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: onlineUsers.has(showMemberProfile.user_id) ? "#4ade80" : "var(--text-muted)", transition: "background-color 0.4s ease" }} />
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  {onlineUsers.has(showMemberProfile.user_id) ? "Online now" : "Offline"}
                </span>
                {showMemberProfile.role === "admin" && (
                  <span style={{ marginLeft: 6, fontSize: "0.72rem", fontWeight: 700, color: "#E01E5A", backgroundColor: "rgba(224,30,90,0.1)", padding: "2px 8px", borderRadius: 999 }}>Admin</span>
                )}
              </div>

              {showMemberProfile.user_id !== me?.id && (
                <button
                  onClick={() => { openDm(showMemberProfile.user_id, showMemberProfile.profile); setShowMemberProfile(null); }}
                  style={{ width: "100%", padding: "10px", borderRadius: 9, border: "none", backgroundColor: "#E01E5A", color: "#fff", fontSize: "0.88rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, transition: "opacity 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.opacity = "0.88"}
                  onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                >
                  <MessageSquare size={15} /> Send a message
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── CHANNEL SETTINGS MODAL ── */}
      {showChannelSettings && activeChannel && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowChannelSettings(false); }}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, backdropFilter: "blur(4px)", padding: 20, animation: "fadeIn 0.15s ease" }}
        >
          <div style={{ backgroundColor: "var(--bg-secondary)", borderRadius: 16, width: "100%", maxWidth: 520, boxShadow: "0 24px 64px rgba(0,0,0,0.4)", border: "1px solid var(--border-color)", overflow: "hidden", animation: "slideUp 0.2s ease", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>

            {/* Header */}
            <div style={{ padding: "20px 24px 0", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {activeChannel.is_private ? <Lock size={16} color="var(--icon-color)" /> : <Globe size={16} color="#E01E5A" />}
                  <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)" }}>{activeChannel.name}</h2>
                </div>
                <button onClick={() => setShowChannelSettings(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}><X size={18} /></button>
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", borderBottom: "1px solid var(--border-color)" }}>
                {(["about", "members"] as const).map(tab => (
                  <button key={tab} onClick={() => setChannelSettingsTab(tab)}
                    style={{ padding: "8px 16px", background: "none", border: "none", cursor: "pointer", fontSize: "0.85rem", fontWeight: channelSettingsTab === tab ? 600 : 400, color: channelSettingsTab === tab ? "#E01E5A" : "var(--text-muted)", borderBottom: channelSettingsTab === tab ? "2px solid #E01E5A" : "2px solid transparent", marginBottom: -1, textTransform: "capitalize", transition: "all 0.15s" }}
                  >{tab}</button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div style={{ overflowY: "auto", flex: 1 }}>

              {/* About tab */}
              {channelSettingsTab === "about" && (
                <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Channel Name</label>
                    {isLobby
                      ? <div style={{ padding: "9px 12px", backgroundColor: "var(--bg-tertiary)", borderRadius: 8, color: "var(--text-muted)", fontSize: "0.9rem", border: "1px solid var(--border-color)" }}>{activeChannel.name}</div>
                      : <div style={{ position: "relative" }}>
                          {editChannelPrivate
                            ? <Lock size={13} color="var(--text-muted)" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
                            : <Globe size={13} color="#E01E5A" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
                          }
                          <input
                            value={editChannelName}
                            onChange={e => setEditChannelName(e.target.value)}
                            style={{ width: "100%", padding: "9px 12px 9px 30px", backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", borderRadius: 8, color: "var(--text-primary)", fontSize: "0.9rem", outline: "none" }}
                          />
                        </div>
                    }
                    {isLobby && <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 6 }}>The Lobby channel name cannot be changed.</p>}
                  </div>

                  {!isLobby && (
                    <>
                      <div>
                        <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Description <span style={{ fontWeight: 400, textTransform: "none" }}>(optional)</span></label>
                        <textarea
                          value={editChannelDesc}
                          onChange={e => setEditChannelDesc(e.target.value)}
                          rows={2}
                          placeholder="What's this channel about?"
                          style={{ width: "100%", padding: "9px 12px", backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", borderRadius: 8, color: "var(--text-primary)", fontSize: "0.9rem", outline: "none", resize: "none", fontFamily: "inherit" }}
                        />
                      </div>

                      {/* Private toggle */}
                      <div
                        onClick={() => setEditChannelPrivate(p => !p)}
                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", backgroundColor: "var(--bg-tertiary)", borderRadius: 10, cursor: "pointer", border: `1px solid ${editChannelPrivate ? "rgba(224,30,90,0.3)" : "var(--border-color)"}`, transition: "all 0.15s" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Lock size={15} color={editChannelPrivate ? "#E01E5A" : "var(--icon-color)"} />
                          <div>
                            <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text-primary)" }}>Private channel</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Only invited members can see this channel</div>
                          </div>
                        </div>
                        <div style={{ width: 36, height: 20, borderRadius: 999, backgroundColor: editChannelPrivate ? "#E01E5A" : "var(--bg-active)", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                          <div style={{ position: "absolute", top: 2, left: editChannelPrivate ? 18 : 2, width: 16, height: 16, borderRadius: "50%", backgroundColor: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
                        </div>
                      </div>

                      <button
                        onClick={saveChannelSettings}
                        disabled={savingChannel || !editChannelName.trim()}
                        style={{ padding: "10px", borderRadius: 9, border: "none", backgroundColor: "#E01E5A", color: "#fff", fontSize: "0.88rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: savingChannel ? 0.7 : 1 }}
                      >
                        {savingChannel ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : "Save Changes"}
                      </button>

                      {/* Danger zone */}
                      <div style={{ marginTop: 8, padding: "16px", borderRadius: 10, border: "1px solid rgba(248,113,113,0.2)", backgroundColor: "rgba(248,113,113,0.04)" }}>
                        <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "#f87171", marginBottom: 10 }}>Danger Zone</p>
                        <button
                          onClick={deleteChannel}
                          style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(248,113,113,0.3)", backgroundColor: "transparent", color: "#f87171", fontSize: "0.84rem", fontWeight: 500, cursor: "pointer", transition: "all 0.15s" }}
                          onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(248,113,113,0.08)"; }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}
                        ><Trash2 size={14} /> Delete this channel</button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Members tab */}
              {channelSettingsTab === "members" && (
                <div style={{ padding: "16px 24px 24px" }}>
                  <p style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
                    In this channel · {channelMembers.length}
                  </p>

                  {channelMembers.length === 0 && (
                    <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontStyle: "italic", marginBottom: 16 }}>No members yet.</p>
                  )}

                  {channelMembers.map(m => (
                    <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border-color)" }}>
                      <div style={{ position: "relative" }}>
                        <Avatar profile={m.profile} size={34} />
                        <div style={{ position: "absolute", bottom: 0, right: 0 }}>
                          <PresenceDot userId={m.user_id} size={9} />
                        </div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text-primary)" }}>{m.profile?.full_name}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{m.profile?.job_title}</div>
                      </div>
                      {!isLobby && m.user_id !== me?.id && me?.id === workspace?.owner_id && (
                        <button
                          onClick={() => removeMemberFromChannel(m.user_id)}
                          style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid rgba(248,113,113,0.3)", backgroundColor: "transparent", color: "#f87171", fontSize: "0.78rem", cursor: "pointer", transition: "all 0.15s" }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = "rgba(248,113,113,0.08)"}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                        >Remove</button>
                      )}
                    </div>
                  ))}

                  {/* Add members */}
                  {!isLobby && nonChannelMembers.length > 0 && me?.id === workspace?.owner_id && (
                    <div style={{ marginTop: 20 }}>
                      <p style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Add to channel</p>
                      {nonChannelMembers.map(m => (
                        <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border-color)" }}>
                          <Avatar profile={m.profile} size={34} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text-primary)" }}>{m.profile?.full_name}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{m.profile?.job_title}</div>
                          </div>
                          <button
                            onClick={() => addMemberToChannel(m.user_id)}
                            style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid rgba(224,30,90,0.3)", backgroundColor: "transparent", color: "#E01E5A", fontSize: "0.78rem", cursor: "pointer", transition: "all 0.15s" }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = "rgba(224,30,90,0.08)"}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                          >Add</button>
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

      {/* ── GLOBAL ANIMATION KEYFRAMES ── */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes fadeSlideDown { from { opacity: 0; transform: translateY(-6px) } to { opacity: 1; transform: translateY(0) } }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>

    </div> /* end root flex */
  ); /* end return */
} /* end WorkspacePage */