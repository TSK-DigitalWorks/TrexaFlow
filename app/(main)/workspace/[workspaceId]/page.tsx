"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  MessageSquare, Hash, Globe, Plus, ChevronDown, LogOut,
  Send, Paperclip, Search, Settings,
  Users, Lock, X, Check, Loader2, MoreHorizontal,
  Pin, User, Copy, Sun, Moon, Monitor, Pencil, Trash2, Upload, MailOpen
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useRequireAuth } from "@/lib/useAuth";

type Profile = { id: string; full_name: string; job_title: string; avatar_url: string; email: string };
type Workspace = { id: string; name: string; description: string; image_url: string; workspace_code: string; owner_id: string };
type Channel = { id: string; name: string; is_private: boolean; is_default: boolean };
type Message = { id: string; channel_id: string; content: string; created_at: string; sender_id: string; is_pinned: boolean; is_system?: boolean; sender?: Profile };
type Member = { user_id: string; role: string; profile?: Profile; is_online?: boolean };
type ThemeMode = "system" | "dark" | "light";


export default function WorkspacePage() {
  const { checking } = useRequireAuth();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialChannelId = searchParams.get('channel');

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

  // Workspace edit state
  const [editingWorkspace, setEditingWorkspace] = useState(false);
  const [wsEditName, setWsEditName] = useState("");
  const [wsEditDesc, setWsEditDesc] = useState("");
  const [wsEditImageFile, setWsEditImageFile] = useState<File | null>(null);
  const [wsEditImagePreview, setWsEditImagePreview] = useState<string | null>(null);
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const wsEditImageInputRef = useRef<HTMLInputElement | null>(null);

  // User profile edit state
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileEditName, setProfileEditName] = useState('')
  const [profileEditRole, setProfileEditRole] = useState('')
  const [profileEditImageFile, setProfileEditImageFile] = useState<File | null>(null)
  const [profileEditImagePreview, setProfileEditImagePreview] = useState<string | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const profileEditImageInputRef = useRef<HTMLInputElement | null>(null)

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
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [lastReadMap, setLastReadMap] = useState<Record<string, string>>({});
  const [dmUnreadCounts, setDmUnreadCounts] = useState<Record<string, number>>({});
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string>("");
  const [unreadFromMessageId, setUnreadFromMessageId] = useState<string | null>(null);
  const [openMenuMessageId, setOpenMenuMessageId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);




  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeChannelRef = useRef<Channel | null>(null);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const themePickerRef = useRef<HTMLDivElement>(null);
  const dmSubRef = useRef<ReturnType<typeof supabase.channel> | null>(null);




  useEffect(() => {
    let cleanup: (() => void) | undefined;
    init().then(fn => { cleanup = (fn as (() => void) | undefined); });
    return () => {
      cleanup?.();
      if (dmSubRef.current) {
        supabase.removeChannel(dmSubRef.current);
        dmSubRef.current = null;
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

  // ── Theme init ──
  useEffect(() => {
    const saved = (localStorage.getItem("trexaflow_theme") as ThemeMode) || "dark";
    setThemeMode(saved);
    applyTheme(saved);
  }, []);

  // ── Close picker on outside click ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (themePickerRef.current && !themePickerRef.current.contains(e.target as Node)) {
        setShowThemePicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuMessageId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);





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

    // Fetch all public channels + private channels where user is a member
    const { data: publicChans } = await supabase
      .from("channels")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("is_private", false)
      .order("is_default", { ascending: false })
      .order("created_at");

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
    setChannels(chans || []);
    await fetchUnreadCounts(chans || []);

    await loadMembers();

    // If a specific channel was requested via ?channel=, use it; else fall back to lobby
    const targetChannel = initialChannelId
      ? chans?.find(c => c.id === initialChannelId) || chans?.find(c => c.is_default) || chans?.[0]
      : chans?.find(c => c.is_default) || chans?.[0];

    if (targetChannel) {
      setActiveChannel(targetChannel);
      markChannelAsRead(targetChannel.id);
    }

    // Load persisted DM unread counts from localStorage
    if (typeof window !== 'undefined') {
      const stored = JSON.parse(localStorage.getItem('trexaflow:dm:unread') || '{}')
      setDmUnreadCounts(stored)
    }

    setLoading(false);

    // ── Realtime Presence ──
    const presenceChannel = supabase.channel(`presence-workspace-${workspaceId}`, {
      config: { presence: { key: user.id } },
    });

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        const online = new Set(Object.keys(state));
        setOnlineUsers(online);
      })
      .on("presence", { event: "join" }, ({ key }) => {
        setOnlineUsers(prev => new Set([...prev, key]));
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        setOnlineUsers(prev => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({
            user_id: user.id,
            full_name: profile?.full_name,
            online_at: new Date().toISOString(),
          });
        }
      });

    // Store ref so we can untrack on unmount
    presenceChannelRef.current = presenceChannel;

    // ── Listen for incoming DMs while on workspace page ──
    if (dmSubRef.current) {
      supabase.removeChannel(dmSubRef.current);
      dmSubRef.current = null;
    }

    const dmSub = supabase.channel(`workspace-dm-watcher-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
        filter: `receiver_id=eq.${user.id}`
      }, payload => {
        const msg = payload.new as { id: string; sender_id: string; receiver_id: string; content: string; created_at: string };
        setDmUnreadCounts(prev => {
          const updated = { ...prev, [msg.sender_id]: (prev[msg.sender_id] || 0) + 1 };
          if (typeof window !== 'undefined') {
            localStorage.setItem('trexaflow:dm:unread', JSON.stringify(updated));
          }
          return updated;
        });
      })
      .subscribe();

    dmSubRef.current = dmSub;
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

  const saveWorkspaceEdit = async () => {
    if (!workspace || !wsEditName.trim()) return;
    setSavingWorkspace(true);

    // Get fresh user id directly from auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingWorkspace(false); return; }

    let imageUrl = workspace.image_url;

    if (wsEditImageFile) {
      const filePath = `${user.id}/ws-image`;
      const { error: uploadError } = await supabase.storage
        .from("workspace-images")
        .upload(filePath, wsEditImageFile, { upsert: true, contentType: wsEditImageFile.type });

      if (uploadError) {
        console.error("Image upload error:", uploadError);
      } else {
        const { data } = supabase.storage
          .from("workspace-images")
          .getPublicUrl(filePath);
        // Bust cache so browser fetches the new image
        imageUrl = `${data.publicUrl}?t=${Date.now()}`;
      }
    }

    const { data: updated } = await supabase
      .from("workspaces")
      .update({ name: wsEditName.trim(), description: wsEditDesc.trim() || null, image_url: imageUrl })
      .eq("id", workspace.id)
      .select()
      .single();

    if (updated) setWorkspace(updated);
    setSavingWorkspace(false);
    setEditingWorkspace(false);
    setWsEditImageFile(null);
    setWsEditImagePreview(null);
  };

  const saveProfileEdit = async () => {
    if (!me || !profileEditName.trim()) return
    setSavingProfile(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSavingProfile(false); return }

    let avatarUrl = me.avatar_url

    if (profileEditImageFile) {
      const filePath = `${user.id}/avatar`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, profileEditImageFile, { upsert: true, contentType: profileEditImageFile.type })
      if (!uploadError) {
        const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
        avatarUrl = `${data.publicUrl}?t=${Date.now()}`
      }
    }

    const { data: updated } = await supabase
      .from('users')
      .update({ full_name: profileEditName.trim(), job_title: profileEditRole.trim() || null, avatar_url: avatarUrl })
      .eq('id', user.id)
      .select()
      .single()

    if (updated) setMe(updated)
    setSavingProfile(false)
    setEditingProfile(false)
    setProfileEditImageFile(null)
    setProfileEditImagePreview(null)
  }

  // ── Load messages when channel changes ──
  useEffect(() => {
    if (!activeChannel) return;
    loadMessages(activeChannel.id);

    const sub = supabase.channel(`messages-realtime`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const msg = payload.new as Message;
          if (msg.channel_id === activeChannelRef.current?.id) {
            // Currently viewing this channel — just append and mark read
            const { data: sender } = await supabase.from("users").select("*").eq("id", msg.sender_id).single();
            setMessages(prev => [...prev, { ...msg, sender }]);
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
            markChannelAsRead(msg.channel_id);
          } else {
            // Different channel — increment unread badge
            if (!msg.is_system) {
              setUnreadCounts(prev => ({
                ...prev,
                [msg.channel_id]: (prev[msg.channel_id] || 0) + 1,
              }));
            }
          }
        })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
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

    const { data: newChannel, error } = await supabase
      .from("channels")
      .insert({
        workspace_id: workspaceId,
        name: newChannelName.trim(),
        description: newChannelDesc.trim() || null,
        is_private: newChannelPrivate,
        is_default: false,
        created_by: me.id,
      })
      .select()
      .single();

    if (error || !newChannel) {
      setCreatingChannel(false);
      return;
    }

    if (newChannelPrivate) {
      // Private channel — only add the creator
      await supabase.from("channel_members").insert({
        channel_id: newChannel.id,
        user_id: me.id,
      });
    } else {
      // Public channel — auto-add ALL workspace members
      const insertAll = members.map(m => ({
        channel_id: newChannel.id,
        user_id: m.user_id,
      }));
      await supabase.from("channel_members").insert(insertAll);
    }

    setChannels(prev => [...prev, newChannel]);
    setActiveChannel(newChannel);
    setNewChannelName("");
    setNewChannelDesc("");
    setNewChannelPrivate(false);
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
      name: editChannelName.trim(),
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

  const deleteMessage = async (msgId: string) => {
    setOpenMenuMessageId(null);
    await supabase.from("messages").delete().eq("id", msgId);
    setMessages(prev => prev.filter(m => m.id !== msgId));
  };

  const saveEditMessage = async (msgId: string) => {
    const trimmed = editingContent.trim();
    if (!trimmed) return;
    await supabase.from("messages").update({ content: trimmed }).eq("id", msgId);
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: trimmed } : m));
    setEditingMessageId(null);
    setEditingContent("");
  };

  const formatTime = (ts: string) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const formatDate = (ts: string) => new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });

  const getInitials = (name: string) => name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";

  const applyTheme = (mode: ThemeMode) => {
    // Set on <html> for global CSS (body background, scrollbar, etc.)
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

  const markAsUnread = (msg: Message) => {
    if (!activeChannel) return
    setOpenMenuMessageId(null)
    setHoveredMessage(null)

    // Roll back lastRead to just before this message
    const justBefore = new Date(new Date(msg.created_at).getTime() - 1).toISOString()

    setLastReadMap(prev => ({ ...prev, [activeChannel.id]: justBefore }))
    setUnreadFromMessageId(msg.id)

    // Recount unread from this point
    const msgsAfter = messages.filter(m => m.created_at >= msg.created_at)
    setUnreadCounts(prev => ({ ...prev, [activeChannel.id]: msgsAfter.length }))

    // Persist to localStorage
    if (typeof window !== 'undefined') {
      const stored = JSON.parse(localStorage.getItem('trexaflow_lastread') || '{}')
      stored[activeChannel.id] = justBefore
      localStorage.setItem('trexaflow_lastread', JSON.stringify(stored))
    }
  }

  // ── Mark channel as read ──
  const markChannelAsRead = (channelId: string) => {
    const now = new Date().toISOString();
    setLastReadMap(prev => ({ ...prev, [channelId]: now }));
    setUnreadCounts(prev => ({ ...prev, [channelId]: 0 }));
    setUnreadFromMessageId(null)
    // Persist in localStorage so it survives refresh
    if (typeof window !== "undefined") {
      const stored = JSON.parse(localStorage.getItem("trexaflow_lastread") || "{}");
      stored[channelId] = now;
      localStorage.setItem("trexaflow_lastread", JSON.stringify(stored));
    }
  };

  // ── Load last-read timestamps from localStorage ──
  const loadLastReadMap = (): Record<string, string> => {
    if (typeof window === "undefined") return {};
    return JSON.parse(localStorage.getItem("trexaflow_lastread") || "{}");
  };

  // ── Fetch unread counts for all visible channels ──
  const fetchUnreadCounts = async (channelList: Channel[]) => {
    const stored = loadLastReadMap();
    setLastReadMap(stored);

    const counts: Record<string, number> = {};

    await Promise.all(
      channelList.map(async (ch) => {
        const lastRead = stored[ch.id];
        if (!lastRead) {
          // Never opened — count all messages
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


  const Avatar = ({ profile, size = 32 }: { profile?: Profile | null; size?: number }) => (
    profile?.avatar_url
      ? <img src={profile.avatar_url} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} alt="" />
      : <div style={{ width: size, height: size, borderRadius: "50%", backgroundColor: "#E01E5A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontWeight: 700, color: "#ffffff", flexShrink: 0 }}>
          {getInitials(profile?.full_name || "?")}
        </div>
  );

  const PresenceDot = ({
    userId,
    size = 9,
    borderColor = "#13161a",
  }: {
    userId: string;
    size?: number;
    borderColor?: string;
  }) => {
    const isOnline = onlineUsers.has(userId);
    return (
      <div style={{
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: isOnline ? "#4ade80" : "var(--text-muted)",
        border: `2px solid ${borderColor}`,
        transition: "background-color 0.4s ease",
        flexShrink: 0,
      }} />
    );
  };


  if (loading || checking) return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader2 size={28} color="#E01E5A" className="animate-spin" />
    </div>
  );

  const isLobby = activeChannel?.is_default;
  const pinnedMessages = messages.filter(m => m.is_pinned);

  const formatMessageContent = (content: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const boldRegex = /\*\*(.+?)\*\*/g;

    const urlParts = content.split(urlRegex);

    return urlParts.map((part, i) => {
      if (urlRegex.test(part)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#E01E5A",
              textDecoration: "underline",
              textDecorationColor: "rgba(224, 30, 90, 0.4)",
              textUnderlineOffset: "3px",
              wordBreak: "break-all",
              transition: "color 0.15s, text-decoration-color 0.15s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = "#c8174f";
              e.currentTarget.style.textDecorationColor = "rgba(200, 23, 79, 0.7)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = "#E01E5A";
              e.currentTarget.style.textDecorationColor = "rgba(224, 30, 90, 0.4)";
            }}
          >
            {part}
          </a>
        );
      }

      // Process bold + line breaks for plain text parts
      const lines = part.split("\n");
      return lines.map((line, j, arr) => {
        const boldParts = line.split(boldRegex);
        const renderedLine = boldParts.map((bp, k) => {
          if (k % 2 === 1) {
            return (
              <strong key={k} style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                {bp}
              </strong>
            );
          }
          return <span key={k}>{bp}</span>;
        });
        return (
          <span key={`${i}-${j}`}>
            {renderedLine}
            {j < arr.length - 1 && <br />}
          </span>
        );
      });
    });
  };

  // ─────────────────────────────────────────
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



      {/* ── Sidebar ── */}
      <div style={{
        width: 240, flexShrink: 0, display: "flex", flexDirection: "column",
        backgroundColor: "var(--bg-sidebar)",
        borderRight: "1px solid var(--border-color)",
        height: "100vh", overflowY: "auto",
      }}>
        {/* Workspace header */}
        <div style={{
          padding: "0 14px", height: 56, display: "flex", alignItems: "center",
          justifyContent: "space-between", flexShrink: 0,
          borderBottom: "1px solid var(--border-color)",
        }}>
          <button onClick={() => setShowWorkspaceInfo(true)} style={{
            background: "none", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", gap: "8px",
            color: "var(--text-primary)", fontWeight: 700, fontSize: "0.95rem",
            padding: "4px 6px", borderRadius: "7px", flex: 1, textAlign: "left",
          }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--bg-hover)"}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
          >
            {workspace?.image_url
              ? <img src={workspace.image_url} style={{ width: 24, height: 24, borderRadius: 6, objectFit: "cover" }} alt="" />
              : <div style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: "#E01E5A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                  {workspace?.name?.[0]?.toUpperCase()}
                </div>
            }
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {workspace?.name}
            </span>
          </button>
          <button onClick={signOut} title="Sign out" style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--icon-color)", padding: "6px", borderRadius: "6px",
          }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--icon-hover)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--icon-color)")}
          >
            <LogOut size={15} />
          </button>
        </div>

        {/* Channels section */}
        <div style={{ marginTop: "6px" }}>
          <div style={{ padding: "6px 16px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Channels
            </span>
            <button onClick={() => setShowCreateChannel(true)} title="New channel" style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--icon-color)", padding: "2px", borderRadius: "4px",
            }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--icon-hover)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--icon-color)")}
            >
              <Plus size={15} />
            </button>
          </div>

          {channels.map(ch => (
            <button key={ch.id}
              onClick={() => { setActiveChannel(ch); markChannelAsRead(ch.id); }}
              style={{
                width: "calc(100% - 12px)", display: "flex", alignItems: "center", gap: "6px",
                padding: "6px 10px", border: "none", cursor: "pointer",
                backgroundColor: activeChannel?.id === ch.id ? "var(--bg-active)" : "transparent",
                color: activeChannel?.id === ch.id ? "var(--text-primary)" : "var(--text-secondary)",
                borderRadius: "6px", margin: "1px 6px", textAlign: "left", transition: "all 0.15s",
              }}
              onMouseEnter={e => {
                if (activeChannel?.id !== ch.id) {
                  e.currentTarget.style.backgroundColor = "var(--bg-hover)";
                  e.currentTarget.style.color = "var(--text-primary)";
                }
              }}
              onMouseLeave={e => {
                if (activeChannel?.id !== ch.id) {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }
              }}
            >
              {ch.is_private
                ? <Lock size={13} style={{ flexShrink: 0 }} />
                : <Globe size={13} style={{ flexShrink: 0 }} />
              }
              <span style={{
                flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                fontSize: "0.875rem",
                fontWeight: unreadCounts[ch.id] > 0 ? 700 : 400,
              }}>
                {ch.name}
              </span>
              {unreadCounts[ch.id] > 0 && activeChannel?.id !== ch.id && (
                <div style={{
                  minWidth: 18, height: 18, borderRadius: 999,
                  backgroundColor: "#E01E5A", color: "#fff",
                  fontSize: "0.68rem", fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "0 5px", flexShrink: 0,
                }}>
                  {unreadCounts[ch.id] > 99 ? "99+" : unreadCounts[ch.id]}
                </div>
              )}
            </button>
          ))}
        </div>

        {/* DMs section */}
        <div style={{ marginTop: "16px" }}>
          <div style={{ padding: "6px 16px 4px" }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Direct Messages
            </span>
          </div>
          {members.filter(m => m.user_id !== me?.id).map(m => (
            <button key={m.user_id}
              onClick={() => {
                setDmUnreadCounts(prev => {
                  const updated = { ...prev, [m.user_id]: 0 };
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('trexaflow:dm:unread', JSON.stringify(updated));
                  }
                  return updated;
                });
                router.push(`/dm/${m.user_id}?from=${workspaceId}`);
              }}
              style={{
                width: "calc(100% - 12px)", display: "flex", alignItems: "center", gap: "8px",
                padding: "6px 10px", border: "none", cursor: "pointer",
                backgroundColor: "transparent", color: "var(--text-secondary)",
                borderRadius: "6px", margin: "1px 6px", transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--bg-hover)"; e.currentTarget.style.color = "var(--text-primary)"; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}
            >
              <div style={{ position: "relative", flexShrink: 0 }}>
                <Avatar profile={m.profile} size={24} />
                <div style={{ position: "absolute", bottom: -1, right: -1 }}>
                  <PresenceDot userId={m.user_id} size={9} borderColor="var(--bg-sidebar)" />
                </div>
              </div>
              <span style={{
                fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                fontWeight: dmUnreadCounts[m.user_id] > 0 || onlineUsers.has(m.user_id) ? 600 : 400,
              }}>
                {m.profile?.full_name}
              </span>
              {dmUnreadCounts[m.user_id] > 0 ? (
                <div style={{ minWidth: 18, height: 18, borderRadius: 999, backgroundColor: '#E01E5A', color: '#fff', fontSize: '0.68rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', flexShrink: 0, marginLeft: 'auto' }}>
                  {dmUnreadCounts[m.user_id] > 99 ? '99+' : dmUnreadCounts[m.user_id]}
                </div>
              ) : onlineUsers.has(m.user_id) ? (
                <span style={{ fontSize: "0.65rem", color: "var(--unread-dot)", marginLeft: "auto", fontWeight: 500, flexShrink: 0 }}>
                  online
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Bottom — My profile */}
        <div style={{ marginTop: "auto", padding: "12px 10px", borderTop: "1px solid var(--border-color)" }}>
          <div
            onClick={() => { setShowProfileModal(true); setEditingProfile(false) }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, cursor: 'pointer', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <div style={{ position: "relative" }}>
              <Avatar profile={me} size={30} />
              <div style={{ position: "absolute", bottom: 0, right: 0 }}>
                <PresenceDot userId={me?.id || ""} size={9} borderColor="var(--bg-sidebar)" />
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


      {/* ══════════════════ MAIN AREA ══════════════════ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Channel top bar */}
        <div style={{
          height: 56, borderBottom: "1px solid var(--border-color)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 20px", flexShrink: 0,
          backgroundColor: "var(--bg-topbar)",
        }}>
          {/* Left side */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {activeChannel?.is_private
              ? <Lock size={16} color="var(--icon-color)" />
              : <Globe size={16} color="var(--icon-color)" />
            }
            <button onClick={openChannelSettings} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-primary)", fontWeight: 600, fontSize: "0.95rem",
              padding: "4px 6px", borderRadius: "6px",
            }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--bg-hover)"}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
            >
              {activeChannel?.name}
            </button>
            <div style={{ width: 1, height: 16, backgroundColor: "var(--border-strong)", margin: "0 4px" }} />
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              {channelMembers.length} member{channelMembers.length !== 1 ? "s" : ""}
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
                  cursor: "pointer", color: showPinnedMessages ? "#E01E5A" : "var(--text-secondary)",
                  padding: "5px 10px", borderRadius: "7px", fontSize: "0.78rem", fontWeight: 500,
                  transition: "all 0.15s",
                }}
              >
                <Pin size={13} />
                {pinnedMessages.length} pinned
              </button>
            )}

            {/* ── Theme Picker ── */}
            <div ref={themePickerRef} style={{ position: "relative" }}>
              <button
                onClick={() => setShowThemePicker(p => !p)}
                title="Switch theme"
                style={{
                  background: showThemePicker ? "var(--bg-hover)" : "none",
                  border: "none", cursor: "pointer",
                  color: showThemePicker ? "var(--text-primary)" : "var(--text-secondary)",
                  padding: "6px", borderRadius: "6px", display: "flex", alignItems: "center",
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.backgroundColor = "var(--bg-hover)"; }}
                onMouseLeave={e => {
                  if (!showThemePicker) {
                    e.currentTarget.style.color = "var(--text-secondary)";
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
              >
                {themeMode === "light"
                  ? <Sun size={16} />
                  : themeMode === "dark"
                  ? <Moon size={16} />
                  : <Monitor size={16} />
                }
              </button>

              {/* Dropdown */}
              {showThemePicker && (
                <div style={{
                  position: "absolute", top: "calc(100% + 8px)", right: 0,
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "10px", padding: "4px",
                  boxShadow: "0 8px 24px var(--shadow-color)",
                  zIndex: 100, minWidth: "150px",
                  animation: "fadeSlideDown 0.15s ease",
                }}>
                  {/* Arrow */}
                  <div style={{
                    position: "absolute", top: -5, right: 10,
                    width: 10, height: 10,
                    backgroundColor: "var(--bg-secondary)",
                    border: "1px solid var(--border-color)",
                    borderRight: "none", borderBottom: "none",
                    transform: "rotate(45deg)",
                  }} />

                  {(["system", "light", "dark"] as ThemeMode[]).map(mode => (
                    <button
                      key={mode}
                      onClick={() => handleThemeChange(mode)}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: "10px",
                        padding: "8px 12px", border: "none", cursor: "pointer",
                        borderRadius: "7px", textAlign: "left", fontSize: "0.85rem",
                        fontWeight: themeMode === mode ? 600 : 400,
                        backgroundColor: themeMode === mode ? "rgba(224,30,90,0.1)" : "transparent",
                        color: themeMode === mode ? "#E01E5A" : "var(--text-primary)",
                        transition: "all 0.12s",
                      }}
                      onMouseEnter={e => {
                        if (themeMode !== mode) e.currentTarget.style.backgroundColor = "var(--bg-hover)";
                      }}
                      onMouseLeave={e => {
                        if (themeMode !== mode) e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      {mode === "light" && <Sun size={14} />}
                      {mode === "dark" && <Moon size={14} />}
                      {mode === "system" && <Monitor size={14} />}
                      <span style={{ textTransform: "capitalize" }}>{mode}</span>
                      {themeMode === mode && (
                        <div style={{ marginLeft: "auto" }}>
                          <Check size={13} color="#E01E5A" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Settings */}
            <button
              onClick={openChannelSettings}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", padding: "6px", borderRadius: "6px" }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--text-primary)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--text-secondary)")}
            >
              <Settings size={16} />
            </button>


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
              <button onClick={() => setShowPinnedMessages(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "2px" }}>
                <X size={14} />
              </button>
            </div>
            {pinnedMessages.map((msg, i) => (
              <div key={msg.id} style={{
                display: "flex", alignItems: "flex-start", gap: "10px",
                padding: "8px 20px",
                borderTop: i > 0 ? "1px solid var(--border-color)" : "none",
              }}>
                <Avatar profile={msg.sender} size={26} />
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "7px", marginBottom: "2px" }}>
                    <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>{msg.sender?.full_name}</span>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{formatTime(msg.created_at)}</span>
                  </div>
                  <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {msg.content}
                  </p>
                </div>
                {me?.id === workspace?.owner_id && (
                  <button
                    onClick={() => togglePinMessage(msg)}
                    title="Unpin"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "2px", flexShrink: 0 }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#f87171")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
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
            <div style={{ marginBottom: "32px", paddingBottom: "24px", borderBottom: "1px solid var(--border-color)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: "rgba(224,30,90,0.12)", border: "1px solid rgba(224,30,90,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Globe size={22} color="#E01E5A" />
                </div>
                <div>
                  <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--text-primary)" }}>Welcome to #{activeChannel?.name}!</h2>
                  {workspace?.description && <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "3px" }}>{workspace.description}</p>}
                </div>
              </div>

              {/* Members grid */}
              <div style={{ marginTop: "20px" }}>
                <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {channelMembers.length} Member{channelMembers.length !== 1 ? "s" : ""}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                  {channelMembers.map(m => (

                    <div key={m.user_id} onClick={() => setShowMemberProfile(m)} style={{
                      display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
                      padding: "12px 14px", borderRadius: "12px", cursor: "pointer",
                      backgroundColor: "var(--bg-hover)", border: "1px solid var(--border-color)",
                      minWidth: "80px", transition: "all 0.15s",
                    }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--bg-active)"; e.currentTarget.style.borderColor = "var(--border-strong)"; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = "var(--bg-hover)"; e.currentTarget.style.borderColor = "var(--border-color)"; }}
                    >
                      <div style={{ position: "relative" }}>
                        <Avatar profile={m.profile} size={40} />
                        <div style={{ position: "absolute", bottom: 1, right: 1 }}>
                          <PresenceDot userId={m.user_id} size={10} borderColor="#0f1114" />
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

          {/* Messages */}
          {messages.map((msg, i) => {
            const isMe = msg.sender_id === me?.id;
            const showDate = i === 0 || formatDate(messages[i - 1].created_at) !== formatDate(msg.created_at);
            const showUnreadMarker = unreadFromMessageId === msg.id;

            // ── System message ──
            if ((msg as any).is_system) {
              return (
                <div key={msg.id}>
                  {showDate && (
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "20px 0 16px" }}>
                      <div style={{ flex: 1, height: 1, backgroundColor: "var(--divider)" }} />
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>{formatDate(msg.created_at)}</span>
                      <div style={{ flex: 1, height: 1, backgroundColor: "var(--divider)" }} />
                    </div>
                  )}
                  {showUnreadMarker && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0 4px", padding: "0 8px" }}>
                      <div style={{ flex: 1, height: 1, backgroundColor: "#E01E5A" }} />
                      <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#E01E5A", textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>New messages</span>
                      <div style={{ flex: 1, height: 1, backgroundColor: "#E01E5A" }} />
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "center", margin: "10px 0" }}>
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: "7px",
                      backgroundColor: "var(--bg-hover)", border: "1px solid var(--border-color)",
                      borderRadius: "999px", padding: "5px 14px",
                    }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#4ade80" }} />
                      <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
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
                    <div style={{ flex: 1, height: 1, backgroundColor: "var(--divider)" }} />
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>{formatDate(msg.created_at)}</span>
                    <div style={{ flex: 1, height: 1, backgroundColor: "var(--divider)" }} />
                  </div>
                )}
                {showUnreadMarker && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0 4px", padding: "0 8px" }}>
                    <div style={{ flex: 1, height: 1, backgroundColor: "#E01E5A" }} />
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#E01E5A", textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>New messages</span>
                    <div style={{ flex: 1, height: 1, backgroundColor: "#E01E5A" }} />
                  </div>
                )}
                <div
                  style={{ position: "relative", display: "flex", gap: "10px", marginBottom: "2px", padding: "4px 8px", borderRadius: "8px", transition: "background 0.1s", backgroundColor: hoveredMessage === msg.id ? "var(--bg-message-hover)" : "transparent" }}
                  onMouseEnter={() => setHoveredMessage(msg.id)}
                  onMouseLeave={() => setHoveredMessage(null)}
                >
                  <Avatar profile={msg.sender} size={34} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "3px" }}>
                      <span style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--text-primary)" }}>{msg.sender?.full_name || "Unknown"}</span>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{formatTime(msg.created_at)}</span>
                      {msg.is_pinned && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "0.7rem", color: "#E01E5A" }}>
                          <Pin size={10} /> pinned
                        </span>
                      )}
                    </div>
                    {editingMessageId === msg.id ? (
                      <div style={{ marginTop: 4 }}>
                        <textarea
                          value={editingContent}
                          onChange={e => setEditingContent(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEditMessage(msg.id); }
                            if (e.key === "Escape") { setEditingMessageId(null); setEditingContent(""); }
                          }}
                          autoFocus
                          style={{
                            width: "100%", padding: "8px 12px",
                            backgroundColor: "var(--bg-input)",
                            border: "1.5px solid #E01E5A",
                            borderRadius: 8, color: "var(--text-primary)",
                            fontSize: "0.9rem", lineHeight: 1.55,
                            outline: "none", resize: "none",
                            fontFamily: "inherit", minHeight: 64,
                          }}
                        />
                        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                          <button onClick={() => saveEditMessage(msg.id)} style={{ padding: "5px 14px", borderRadius: 7, border: "none", backgroundColor: "#E01E5A", color: "#fff", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}>Save</button>
                          <button onClick={() => { setEditingMessageId(null); setEditingContent(""); }} style={{ padding: "5px 14px", borderRadius: 7, border: "1px solid var(--border-color)", backgroundColor: "transparent", color: "var(--text-muted)", fontSize: "0.8rem", cursor: "pointer" }}>Cancel</button>
                          <span style={{ fontSize: "0.72rem", color: "var(--text-faint)", alignSelf: "center" }}>Enter to save · Esc to cancel</span>
                        </div>
                      </div>
                    ) : (
                      <p style={{ fontSize: "0.9rem", color: "var(--text-primary)", lineHeight: 1.55, margin: 0, wordBreak: "break-word" }}>
                        {formatMessageContent(msg.content)}
                      </p>
                    )}
                  </div>

                  {/* Hover action toolbar */}
                  {hoveredMessage === msg.id && (
                    <div style={{ position: "absolute", top: -14, right: 12, display: "flex", alignItems: "center", gap: "2px", backgroundColor: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: "8px", padding: "3px 4px", boxShadow: "0 4px 16px rgba(0,0,0,0.3)", zIndex: 10 }}>
                      <button
                        onClick={() => togglePinMessage(msg)}
                        title={msg.is_pinned ? "Unpin message" : "Pin message"}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: "5px 7px", borderRadius: "6px", color: msg.is_pinned ? "#E01E5A" : "var(--icon-color)", display: "flex", alignItems: "center" }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-hover)")}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        <Pin size={14} />
                      </button>

                      <div style={{ position: "relative" }} ref={openMenuMessageId === msg.id ? menuRef : null}>
                        <button
                          onClick={() => setOpenMenuMessageId(prev => (prev === msg.id ? null : msg.id))}
                          title="More actions"
                          style={{
                            background: "none", border: "none", cursor: "pointer", padding: "5px 7px", borderRadius: "6px",
                            color: openMenuMessageId === msg.id ? "var(--text-primary)" : "var(--icon-color)",
                            display: "flex", alignItems: "center",
                            backgroundColor: openMenuMessageId === msg.id ? "var(--bg-hover)" : "transparent",
                          }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-hover)")}
                          onMouseLeave={e => { if (openMenuMessageId !== msg.id) e.currentTarget.style.backgroundColor = "transparent"; }}
                        >
                          <MoreHorizontal size={14} />
                        </button>

                        {openMenuMessageId === msg.id && (
                          <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 10, padding: "4px", boxShadow: "0 8px 24px var(--shadow-color)", zIndex: 50, minWidth: 160 }}>
                            {/* Mark as unread */}
                            <button
                              onClick={() => markAsUnread(msg)}
                              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', border: 'none', cursor: 'pointer', backgroundColor: 'transparent', color: 'var(--text-primary)', borderRadius: 7, fontSize: '0.875rem', fontWeight: 500, textAlign: 'left' }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              <MailOpen size={14} style={{ color: 'var(--icon-color)', flexShrink: 0 }} />
                              Mark as unread
                            </button>
                            {isMe && (
                              <>
                                <div style={{ height: 1, backgroundColor: "var(--border-color)", margin: "3px 0" }} />
                                <button
                                  onClick={() => { setEditingMessageId(msg.id); setEditingContent(msg.content); setOpenMenuMessageId(null); setHoveredMessage(null); }}
                                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", border: "none", cursor: "pointer", backgroundColor: "transparent", color: "var(--text-primary)", borderRadius: 7, fontSize: "0.875rem", fontWeight: 500, textAlign: "left" }}
                                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-hover)")}
                                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                                >
                                  <Pencil size={14} style={{ color: "var(--icon-color)", flexShrink: 0 }} />
                                  Edit message
                                </button>
                                <div style={{ height: 1, backgroundColor: "var(--border-color)", margin: "3px 0" }} />
                                <button
                                  onClick={() => deleteMessage(msg.id)}
                                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", border: "none", cursor: "pointer", backgroundColor: "transparent", color: "#f87171", borderRadius: 7, fontSize: "0.875rem", fontWeight: 500, textAlign: "left" }}
                                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(248,113,113,0.08)"; }}
                                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                                >
                                  <Trash2 size={14} style={{ color: "#f87171", flexShrink: 0 }} />
                                  Delete message
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
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
          <div style={{
            backgroundColor: "var(--bg-input)",
            border: "1px solid var(--border-color)",
            borderRadius: "12px", overflow: "hidden",
          }}>
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
              style={{
                width: "100%", padding: "13px 16px 6px",
                background: "none", border: "none",
                color: "var(--text-primary)",
                fontSize: "0.9rem", outline: "none", resize: "none",
                fontFamily: "inherit", lineHeight: 1.5,
                minHeight: "44px", maxHeight: "120px", display: "block",
              }}
              placeholder={`Message #${activeChannel?.name || "..."}`}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 10px 8px" }}>
              <div style={{ display: "flex", gap: "4px" }}>
                <button type="button" style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--icon-color)", padding: "5px", borderRadius: "6px",
                }}
                  onMouseEnter={e => (e.currentTarget.style.color = "var(--icon-hover)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--icon-color)")}
                ><Paperclip size={17} /></button>

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
                  backgroundColor: newMessage.trim() ? "#E01E5A" : "var(--bg-tertiary)",
                  border: "none", borderRadius: "7px", padding: "7px 12px",
                  cursor: newMessage.trim() ? "pointer" : "default",
                  color: newMessage.trim() ? "#fff" : "var(--text-muted)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.15s",
                }}
              >
                {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              </button>
            </div>
          </div>
          <p style={{ fontSize: "0.72rem", color: "var(--text-faint)", marginTop: "6px", textAlign: "center" }}>
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>

      {/* ══════════════ CREATE CHANNEL MODAL ══════════════ */}
      {showCreateChannel && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setShowCreateChannel(false); }}
        >
          <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "20px", padding: "32px", width: "100%", maxWidth: "420px", boxShadow: "0 24px 80px var(--shadow-color)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>Create a channel</h2>
              <button onClick={() => setShowCreateChannel(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--icon-color)", padding: "4px" }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "6px" }}>Channel name <span style={{ color: "#E01E5A" }}>*</span></label>
              <div style={{ position: "relative" }}>
                <Hash size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                <input type="text" placeholder="e.g. Marketing, Design, General" value={newChannelName}
                  onChange={e => setNewChannelName(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px 10px 30px", backgroundColor: "var(--bg-input)", border: "1.5px solid var(--border-color)", borderRadius: "8px", color: "var(--text-primary)", fontSize: "0.88rem", outline: "none" }}
                  onFocus={e => (e.target.style.borderColor = "#E01E5A")}
                  onBlur={e => (e.target.style.borderColor = "var(--border-color)")}
                />
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "6px" }}>Description <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>optional</span></label>
              <input type="text" placeholder="What's this channel about?" value={newChannelDesc}
                onChange={e => setNewChannelDesc(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", backgroundColor: "var(--bg-input)", border: "1.5px solid var(--border-color)", borderRadius: "8px", color: "var(--text-primary)", fontSize: "0.88rem", outline: "none" }}
                onFocus={e => (e.target.style.borderColor = "#E01E5A")}
                onBlur={e => (e.target.style.borderColor = "var(--border-color)")}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", borderRadius: "10px", marginBottom: "24px", cursor: "pointer" }}
              onClick={() => setNewChannelPrivate(p => !p)}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Lock size={15} color="var(--icon-color)" />
                <div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text-primary)" }}>Private channel</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Only invited members can see it</div>
                </div>
              </div>
              <div style={{ width: 36, height: 20, borderRadius: 999, backgroundColor: newChannelPrivate ? "#E01E5A" : "var(--border-strong)", position: "relative", transition: "background 0.2s" }}>
                <div style={{ position: "absolute", top: 2, left: newChannelPrivate ? 18 : 2, width: 16, height: 16, borderRadius: "50%", backgroundColor: "#fff", transition: "left 0.2s" }} />
              </div>
            </div>

            <button onClick={createChannel} disabled={!newChannelName.trim() || creatingChannel} style={{
              width: "100%", padding: "12px", borderRadius: "10px",
              backgroundColor: newChannelName.trim() ? "#E01E5A" : "var(--bg-tertiary)",
              color: newChannelName.trim() ? "#fff" : "var(--text-muted)",
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
          <div style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "20px", width: "100%", maxWidth: "320px", overflow: "hidden", boxShadow: "0 24px 80px var(--shadow-color)" }}>
            {/* Banner */}
            <div style={{ height: 80, background: 'var(--banner-gradient)', position: 'relative' }}>
              <button onClick={() => setShowMemberProfile(null)} style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.3)", border: "none", cursor: "pointer", color: "var(--text-inverse)", borderRadius: "6px", padding: "4px 6px" }}>
                <X size={14} />
              </button>
            </div>
            <div style={{ padding: "0 20px 24px" }}>
              <div style={{ marginTop: -36, marginBottom: 12, position: 'relative', zIndex: 2 }}>
                {showMemberProfile.profile?.avatar_url ? (
                  <img
                    src={showMemberProfile.profile.avatar_url}
                    style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--bg-secondary)', display: 'block' }}
                    alt=""
                  />
                ) : (
                  <div style={{ width: 72, height: 72, borderRadius: '50%', backgroundColor: '#E01E5A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', fontWeight: 700, color: '#fff', border: '3px solid var(--bg-secondary)' }}>
                    {getInitials(showMemberProfile.profile?.full_name || "?")}
                  </div>
                )}
              </div>
              <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 3 }}>
                {showMemberProfile.profile?.full_name}
              </div>
              {showMemberProfile.profile?.job_title && (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 10 }}>
                  {showMemberProfile.profile.job_title}
                </div>
              )}

              {/* Email row */}
              {showMemberProfile.profile?.email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {showMemberProfile.profile.email}
                  </span>
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(showMemberProfile!.profile!.email!)
                      // brief visual flash on the button
                      const btn = document.getElementById('copy-email-btn')
                      if (btn) { btn.style.color = '#4ade80'; setTimeout(() => { btn.style.color = 'var(--icon-color)' }, 1500) }
                    }}
                    id="copy-email-btn"
                    title="Copy email"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--icon-color)', padding: '2px 4px', borderRadius: 4, display: 'flex', alignItems: 'center', flexShrink: 0, transition: 'color 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--icon-hover)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--icon-color)'}
                  >
                    <Copy size={13} />
                  </button>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 9, border: '1px solid var(--border-color)', marginBottom: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: onlineUsers.has(showMemberProfile.user_id) ? '#4ade80' : 'var(--text-faint)' }} />
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  {onlineUsers.has(showMemberProfile.user_id) ? 'Online' : 'Offline'}
                </span>
              </div>

              {/* Message button — hide for own profile */}
              {showMemberProfile.user_id !== me?.id && (
                <button
                  onClick={() => {
                    setShowMemberProfile(null)
                    router.push(`/dm/${showMemberProfile.user_id}?from=${workspaceId}`)
                  }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, border: 'none', backgroundColor: '#E01E5A', color: '#fff', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#c8174f'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = '#E01E5A'}
                >
                  <MessageSquare size={15} />
                  Message {showMemberProfile.profile?.full_name?.split(' ')[0]}
                </button>
              )}
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
            backgroundColor: "var(--bg-secondary)",
            borderLeft: "1px solid var(--border-color)",
            display: "flex", flexDirection: "column", overflowY: "auto",
            boxShadow: "-16px 0 48px var(--shadow-color)",
          }}>
            {/* Panel header */}
            <div style={{ padding: "20px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {activeChannel.is_private ? <Lock size={16} color="var(--icon-color)" /> : <Globe size={16} color="var(--icon-color)" />}
                <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)" }}>{activeChannel.name}</span>
              </div>
              <button onClick={() => setShowChannelSettings(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--icon-color)", padding: "4px", borderRadius: 6 }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--text-primary)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--icon-color)")}>
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: "4px", padding: "16px 20px 0", borderBottom: "1px solid var(--border-color)", flexShrink: 0 }}>
              {(["about", "members"] as const).map(tab => (
                <button key={tab} onClick={() => setChannelSettingsTab(tab)} style={{
                  padding: "8px 16px", border: "none", cursor: "pointer", background: "none",
                  fontSize: "0.85rem", fontWeight: 500, textTransform: "capitalize",
                  color: channelSettingsTab === tab ? "var(--text-primary)" : "var(--text-muted)",
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
                    <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
                      Channel Name
                    </label>
                    <div style={{ position: "relative" }}>
                      <Hash size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                      <input
                        id="edit-channel-name"
                        name="edit-channel-name"
                        type="text"
                        value={editChannelName}
                        onChange={e => setEditChannelName(e.target.value)}
                        disabled={activeChannel.is_default}
                        style={{
                          width: "100%", padding: "10px 12px 10px 30px",
                          backgroundColor: "var(--bg-input)", border: "1.5px solid var(--border-color)",
                          borderRadius: "8px", color: activeChannel.is_default ? "var(--text-muted)" : "var(--text-primary)",
                          fontSize: "0.88rem", outline: "none",
                        }}
                        onFocus={e => { if (!activeChannel.is_default) e.target.style.borderColor = "#E01E5A"; }}
                        onBlur={e => (e.target.style.borderColor = "var(--border-color)")}
                      />
                    </div>
                    {activeChannel.is_default && (
                      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "5px" }}>The Lobby channel name cannot be changed.</p>
                    )}
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
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
                        backgroundColor: "var(--bg-input)", border: "1.5px solid var(--border-color)",
                        borderRadius: "8px", color: "var(--text-primary)", fontSize: "0.88rem", outline: "none",
                        fontFamily: "inherit",
                      }}
                      onFocus={e => (e.target.style.borderColor = "#E01E5A")}
                      onBlur={e => (e.target.style.borderColor = "var(--border-color)")}
                    />
                  </div>

                  {/* Private toggle */}
                  {!activeChannel.is_default && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", borderRadius: "10px", cursor: "pointer" }}
                      onClick={() => setEditChannelPrivate(p => !p)}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <Lock size={15} color="var(--icon-color)" />
                        <div>
                          <div style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text-primary)" }}>Private channel</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Only invited members can see it</div>
                        </div>
                      </div>
                      <div style={{ width: 36, height: 20, borderRadius: 999, backgroundColor: editChannelPrivate ? "#E01E5A" : "var(--border-strong)", position: "relative", transition: "background 0.2s" }}>
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
                    <p style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "10px" }}>
                      In this channel · {channelMembers.length}
                    </p>
                    {channelMembers.length === 0 && (
                      <p style={{ fontSize: "0.83rem", color: "var(--text-faint)" }}>No members yet.</p>
                    )}
                    {channelMembers.map(m => (
                      <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", borderBottom: "1px solid var(--border-color)" }}>
                        <Avatar profile={m.profile} size={32} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "0.87rem", fontWeight: 500, color: "var(--text-primary)" }}>{m.profile?.full_name}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{m.profile?.job_title}</div>
                        </div>
                        {m.user_id !== me?.id && !activeChannel.is_default && (
                          <button onClick={() => removeMemberFromChannel(m.user_id)} style={{
                            background: "none", border: "1px solid rgba(248,113,113,0.25)", borderRadius: "6px",
                            color: "#f87171", fontSize: "0.75rem", padding: "3px 10px", cursor: "pointer",
                          }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(248,113,113,0.08)")}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Add members */}
                  {nonChannelMembers.length > 0 && (
                    <div>
                      <p style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "10px" }}>
                        Add to channel
                      </p>
                      {nonChannelMembers.map(m => (
                        <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", borderBottom: "1px solid var(--border-color)" }}>
                          <Avatar profile={m.profile} size={32} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: "0.87rem", fontWeight: 500, color: "var(--text-primary)" }}>{m.profile?.full_name}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{m.profile?.job_title}</div>
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
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)', overflowY: 'auto', padding: '24px 16px' }}
          onClick={e => { if (e.target === e.currentTarget) { setShowWorkspaceInfo(false); setEditingWorkspace(false); setWsEditImageFile(null); setWsEditImagePreview(null) } }}
        >
          <div style={{ width: '100%', maxWidth: 440, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 22, boxShadow: '0 24px 80px var(--shadow-color)', flexShrink: 0, alignSelf: 'flex-start' }}>
            
            {/* Banner */}
            <div style={{ height: 90, position: 'relative', borderRadius: '22px 22px 0 0', background: 'var(--banner-gradient)', overflow: 'hidden' }}>
              <button
                onClick={() => { setShowWorkspaceInfo(false); setEditingWorkspace(false); setWsEditImageFile(null); setWsEditImagePreview(null) }}
                style={{ position: 'absolute', top: 14, right: 14, zIndex: 1, background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', borderRadius: 7, padding: '5px 7px', display: 'flex' }}>
                <X size={15} />
              </button>
            </div>

            <div style={{ padding: '0 24px 28px' }}>
              
              {/* Avatar */}
              <div style={{ marginTop: -36, marginBottom: 16, position: 'relative', zIndex: 2 }}>
                {editingWorkspace ? (
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <div
                      onClick={() => wsEditImageInputRef.current?.click()}
                      style={{ width: 64, height: 64, borderRadius: 14, cursor: 'pointer', border: '3px solid var(--bg-secondary)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-input)', flexShrink: 0 }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                      {wsEditImagePreview || workspace.image_url ? (
                        <img src={wsEditImagePreview || workspace.image_url!} alt="ws" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fff' }}>{workspace.name?.[0]?.toUpperCase()}</span>
                      )}
                    </div>
                    <div style={{ position: 'absolute', bottom: -4, right: -4, width: 22, height: 22, borderRadius: '50%', backgroundColor: '#E01E5A', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '2px solid var(--bg-secondary)' }}
                      onClick={() => wsEditImageInputRef.current?.click()}>
                      <Upload size={11} color="#fff" />
                    </div>
                    <input ref={wsEditImageInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        setWsEditImageFile(file)
                        setWsEditImagePreview(URL.createObjectURL(file))
                      }} />
                  </div>
                ) : (
                  workspace.image_url ? (
                    <img src={workspace.image_url} style={{ width: 64, height: 64, borderRadius: 14, objectFit: 'cover', border: '3px solid var(--bg-secondary)', display: 'block' }} alt="" />
                  ) : (
                    <div style={{ width: 64, height: 64, borderRadius: 14, backgroundColor: '#E01E5A', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid var(--bg-secondary)', fontSize: '1.6rem', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                      {workspace.name?.[0]?.toUpperCase()}
                    </div>
                  )
                )}
              </div>

              {/* Name & Description — view or edit */}
              {editingWorkspace ? (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Workspace Name</label>
                    <input
                      type="text"
                      value={wsEditName}
                      onChange={e => setWsEditName(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', backgroundColor: 'var(--bg-input)', border: '1.5px solid var(--border-strong)', borderRadius: 9, color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none' }}
                      onFocus={e => e.target.style.borderColor = '#E01E5A'}
                      onBlur={e => e.target.style.borderColor = 'var(--border-strong)'}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description <span style={{ color: 'var(--text-faint)', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                    <textarea
                      value={wsEditDesc}
                      onChange={e => setWsEditDesc(e.target.value)}
                      rows={3}
                      placeholder="What is this workspace for?"
                      style={{ width: '100%', padding: '9px 12px', backgroundColor: 'var(--bg-input)', border: '1.5px solid var(--border-strong)', borderRadius: 9, color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none', resize: 'none', fontFamily: 'inherit' }}
                      onFocus={e => e.target.style.borderColor = '#E01E5A'}
                      onBlur={e => e.target.style.borderColor = 'var(--border-strong)'}
                    />
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: 20 }}>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{workspace.name}</h2>
                  {workspace.description && (
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{workspace.description}</p>
                  )}
                </div>
              )}

              {/* Stats row — no role shown */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
                <div style={{ flex: 1, backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{members.length}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>Members</div>
                </div>
                <div style={{ flex: 1, backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{channels.length}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>Channels</div>
                </div>
              </div>

              {/* Workspace ID */}
              <div style={{ backgroundColor: 'rgba(224,30,90,0.06)', border: '1px solid rgba(224,30,90,0.15)', borderRadius: 14, padding: 18, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Users size={14} color="#E01E5A" />
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#E01E5A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Workspace ID</span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
                  Share this ID with teammates so they can join your workspace during sign up.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, backgroundColor: 'var(--bg-input)', border: '1.5px solid var(--border-color)', borderRadius: 10, padding: '12px 16px', fontFamily: 'monospace', fontSize: '1.3rem', fontWeight: 700, letterSpacing: '0.18em', color: 'var(--text-primary)', textAlign: 'center' }}>
                    {workspace.workspace_code}
                  </div>
                  <button onClick={copyWorkspaceCode} style={{ padding: '12px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', backgroundColor: codeCopied ? 'rgba(74,222,128,0.15)' : '#E01E5A', color: codeCopied ? '#4ade80' : '#fff', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {codeCopied ? <><Check size={15} /> Copied!</> : <><Copy size={15} /> Copy</>}
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              {workspace.owner_id === me?.id && (
                editingWorkspace ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={saveWorkspaceEdit}
                      disabled={savingWorkspace || !wsEditName.trim()}
                      style={{ flex: 1, padding: '10px', borderRadius: 9, border: 'none', backgroundColor: '#E01E5A', color: '#fff', fontSize: '0.875rem', fontWeight: 600, cursor: savingWorkspace ? 'not-allowed' : 'pointer', opacity: savingWorkspace ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      {savingWorkspace ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                      Save Changes
                    </button>
                    <button
                      onClick={() => { setEditingWorkspace(false); setWsEditImageFile(null); setWsEditImagePreview(null) }}
                      style={{ padding: '10px 16px', borderRadius: 9, border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-muted)', fontSize: '0.875rem', cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setWsEditName(workspace.name); setWsEditDesc(workspace.description || ''); setEditingWorkspace(true) }}
                    style={{ width: '100%', padding: '10px', borderRadius: 9, border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}>
                    <Pencil size={14} /> Edit Workspace
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* USER PROFILE MODAL */}
      {showProfileModal && me && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)', overflowY: 'auto', padding: '24px 16px' }}
          onClick={e => { if (e.target === e.currentTarget) { setShowProfileModal(false); setEditingProfile(false); setProfileEditImageFile(null); setProfileEditImagePreview(null) } }}
        >
          <div style={{ width: '100%', maxWidth: 440, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 22, boxShadow: '0 24px 80px var(--shadow-color)', flexShrink: 0, alignSelf: 'flex-start' }}>

            {/* Banner */}
            <div style={{ height: 90, position: 'relative', borderRadius: '22px 22px 0 0', background: 'var(--banner-gradient)', overflow: 'hidden' }}>
              <button
                onClick={() => { setShowProfileModal(false); setEditingProfile(false); setProfileEditImageFile(null); setProfileEditImagePreview(null) }}
                style={{ position: 'absolute', top: 14, right: 14, zIndex: 1, background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', borderRadius: 7, padding: '5px 7px', display: 'flex' }}>
                <X size={15} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '0 24px 28px' }}>

              {/* Avatar */}
              <div style={{ marginTop: -36, marginBottom: 16, position: 'relative', zIndex: 2 }}>
                {editingProfile ? (
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <div
                      onClick={() => profileEditImageInputRef.current?.click()}
                      style={{ width: 72, height: 72, borderRadius: '50%', cursor: 'pointer', border: '3px solid var(--bg-secondary)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-tertiary)', flexShrink: 0 }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                      {profileEditImagePreview || me.avatar_url ? (
                        <img src={profileEditImagePreview || me.avatar_url!} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: '1.8rem', fontWeight: 700, color: '#fff' }}>{me.full_name?.[0]?.toUpperCase()}</span>
                      )}
                    </div>
                    <div
                      style={{ position: 'absolute', bottom: -4, right: -4, width: 24, height: 24, borderRadius: '50%', backgroundColor: '#E01E5A', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '2px solid var(--bg-secondary)' }}
                      onClick={() => profileEditImageInputRef.current?.click()}
                    >
                      <Upload size={11} color="#fff" />
                    </div>
                    <input ref={profileEditImageInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        setProfileEditImageFile(file)
                        setProfileEditImagePreview(URL.createObjectURL(file))
                      }}
                    />
                  </div>
                ) : (
                  me.avatar_url ? (
                    <img src={me.avatar_url} style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--bg-secondary)', display: 'block' }} alt="" />
                  ) : (
                    <div style={{ width: 72, height: 72, borderRadius: '50%', backgroundColor: '#E01E5A', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid var(--bg-secondary)', fontSize: '1.8rem', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                      {me.full_name?.[0]?.toUpperCase()}
                    </div>
                  )
                )}
              </div>

              {/* Name + Role — view or edit */}
              {editingProfile ? (
                <div style={{ marginBottom: 20 }}>
                  {/* Name field */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Full Name</label>
                    <input
                      type="text"
                      value={profileEditName}
                      onChange={e => setProfileEditName(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', backgroundColor: 'var(--bg-input)', border: '1.5px solid var(--border-strong)', borderRadius: 9, color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none' }}
                      onFocus={e => e.target.style.borderColor = '#E01E5A'}
                      onBlur={e => e.target.style.borderColor = 'var(--border-strong)'}
                    />
                  </div>
                  {/* Role field */}
                  <div style={{ marginBottom: 4 }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Job Title / Role <span style={{ color: 'var(--text-faint)', fontWeight: 400, textTransform: 'none' }}>optional</span>
                    </label>
                    <input
                      type="text"
                      value={profileEditRole}
                      onChange={e => setProfileEditRole(e.target.value)}
                      placeholder="e.g. Product Designer"
                      style={{ width: '100%', padding: '9px 12px', backgroundColor: 'var(--bg-input)', border: '1.5px solid var(--border-strong)', borderRadius: 9, color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none' }}
                      onFocus={e => e.target.style.borderColor = '#E01E5A'}
                      onBlur={e => e.target.style.borderColor = 'var(--border-strong)'}
                    />
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: 20 }}>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{me.full_name}</h2>
                  {me.job_title && <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{me.job_title}</p>}
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>{me.email}</p>
                </div>
              )}

              {/* Online status badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 10, marginBottom: 20 }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: '#4ade80', flexShrink: 0 }} />
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Active now</span>
              </div>

              {/* Action buttons */}
              {editingProfile ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={saveProfileEdit}
                    disabled={savingProfile || !profileEditName.trim()}
                    style={{ flex: 1, padding: '10px', borderRadius: 9, border: 'none', backgroundColor: '#E01E5A', color: '#fff', fontSize: '0.875rem', fontWeight: 600, cursor: savingProfile ? 'not-allowed' : 'pointer', opacity: savingProfile ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    {savingProfile ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                    Save Changes
                  </button>
                  <button
                    onClick={() => { setEditingProfile(false); setProfileEditImageFile(null); setProfileEditImagePreview(null) }}
                    style={{ padding: '10px 16px', borderRadius: 9, border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-muted)', fontSize: '0.875rem', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setProfileEditName(me.full_name || ''); setProfileEditRole(me.job_title || ''); setEditingProfile(true) }}
                  style={{ width: '100%', padding: '10px', borderRadius: 9, border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                >
                  <Pencil size={14} /> Edit Profile
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}