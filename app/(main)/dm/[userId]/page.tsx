"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Send, Smile, Paperclip, Loader2, MessageSquare, Hash, Globe, Lock, Plus, LogOut, Settings, Sun, Moon, Monitor, Users, ChevronDown, Pencil, Trash2, MoreHorizontal, Upload, Check, X, Copy, MailOpen } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Profile = { id: string; full_name: string; job_title: string; avatar_url: string; email: string };
type DM = { id: string; content: string; created_at: string; sender_id: string; receiver_id: string };
type ThemeMode = "system" | "dark" | "light";

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
  const [initialLoad, setInitialLoad] = useState(true);
  const [workspaceId, setWorkspaceId] = useState(fromWorkspace || "");
  const [isOtherOnline, setIsOtherOnline] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [hoveredMessage, setHoveredMessage] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string>("");
  const [openMenuMessageId, setOpenMenuMessageId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const presenceRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const meIdRef = useRef<string | null>(null)
  const initializingRef = useRef(false)

  // Sidebar data
  const [workspace, setWorkspace] = useState<{ id: string; name: string; image_url: string; workspace_code: string } | null>(null)
  const [channels, setChannels] = useState<{ id: string; name: string; is_private: boolean; is_default: boolean }[]>([])
  const [members, setMembers] = useState<{ user_id: string; role: string; profile?: Profile | null }[]>([])
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const presenceSidebarRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // User profile edit state
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileEditName, setProfileEditName] = useState('')
  const [profileEditRole, setProfileEditRole] = useState('')
  const [profileEditImageFile, setProfileEditImageFile] = useState<File | null>(null)
  const [profileEditImagePreview, setProfileEditImagePreview] = useState<string | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const profileEditImageInputRef = useRef<HTMLInputElement | null>(null)

  const [showWorkspaceInfo, setShowWorkspaceInfo] = useState(false)
  const [showThemePicker, setShowThemePicker] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)
  const [dmUnreadFromMessageId, setDmUnreadFromMessageId] = useState<string | null>(null)
  const [dmUnreadCount, setDmUnreadCount] = useState(0)
  const [dmUnreadCounts, setDmUnreadCounts] = useState<Record<string, number>>({})
  const themePickerRef = useRef<HTMLDivElement | null>(null)
  const dmSubRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const allDmSubRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    const saved = (localStorage.getItem("trexaflow_theme") as ThemeMode) || "dark";
    setThemeMode(saved);
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

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (themePickerRef.current && !themePickerRef.current.contains(e.target as Node))
        setShowThemePicker(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const p = init();
    return () => {
      p.then(cleanup => cleanup?.());
    };
  }, [userId]);

  useEffect(() => {
    // Wait until loading is done AND messages exist before scrolling
    if (loading || messages.length === 0) return;
    const timer = setTimeout(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [loading, messages.length]);

  const init = async () => {
    if (initializingRef.current) return;
    initializingRef.current = true;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.replace("/auth");
      meIdRef.current = user.id

      // Load persisted DM unread counts
      if (typeof window !== 'undefined') {
        const stored = JSON.parse(localStorage.getItem('trexaflow:dm:unread') || '{}')
        setDmUnreadCounts(stored)
      }

      // Only show full-screen spinner on very first load
      if (initialLoad) setLoading(true);

      // Resolve workspace ID locally to avoid state stale-reads
      let resolvedWorkspaceId: string | null = fromWorkspace || null;
      if (!resolvedWorkspaceId) {
        const { data: myWs } = await supabase
          .from("workspace_members")
          .select("workspace_id")
          .eq("user_id", user.id)
          .limit(1)
          .single();
        if (myWs) {
          resolvedWorkspaceId = myWs.workspace_id;
          setWorkspaceId(myWs.workspace_id);
        }
      }

      const [
        { data: myProfile },
        { data: otherProfile },
        { data: ws },
        { data: publicChans },
        { data: privateMemberships },
        { data: mems },
      ] = await Promise.all([
        supabase.from("users").select("*").eq("id", user.id).single(),
        supabase.from("users").select("*").eq("id", userId).single(),
        resolvedWorkspaceId
          ? supabase.from("workspaces").select("*").eq("id", resolvedWorkspaceId).single()
          : Promise.resolve({ data: null }),
        resolvedWorkspaceId
          ? supabase.from("channels").select("*").eq("workspace_id", resolvedWorkspaceId).eq("is_private", false).order("is_default", { ascending: false }).order("created_at")
          : Promise.resolve({ data: [] }),
        resolvedWorkspaceId
          ? supabase.from("channel_members").select("channel_id").eq("user_id", user.id)
          : Promise.resolve({ data: [] }),
        resolvedWorkspaceId
          ? supabase.from("workspace_members").select("user_id, role").eq("workspace_id", resolvedWorkspaceId)
          : Promise.resolve({ data: [] }),
      ]);

      setMe(myProfile);
      setOther(otherProfile);
      if (ws) setWorkspace(ws);

      // Private channels
      const privateChannelIds = privateMemberships?.map((m: any) => m.channel_id) ?? []
      let privateChans: any[] = []
      if (privateChannelIds.length > 0) {
        const { data } = await supabase
          .from('channels').select('*')
          .eq('workspace_id', resolvedWorkspaceId!)
          .eq('is_private', true)
          .in('id', privateChannelIds)
          .order('created_at')
        privateChans = data ?? []
      }
      setChannels([...(publicChans ?? []), ...privateChans])

      // Fetch members with profiles (batched)
      if (mems) {
        const profiles = await Promise.all(mems.map(async (m: any) => {
          const { data: p } = await supabase.from('users').select('*').eq('id', m.user_id).single()
          return { ...m, profile: p }
        }))
        setMembers(profiles)
      }

      // Tear down ALL stale channels before setting up new ones
      if (presenceSidebarRef.current) {
        await presenceSidebarRef.current.untrack();
        await supabase.removeChannel(presenceSidebarRef.current);
        presenceSidebarRef.current = null;
      }
      if (dmSubRef.current) {
        await supabase.removeChannel(dmSubRef.current)
        dmSubRef.current = null
      }
      if (allDmSubRef.current) {
        await supabase.removeChannel(allDmSubRef.current)
        allDmSubRef.current = null
      }

      // Load messages in parallel with presence setup
      const loadMsgsPromise = loadMessages(user.id);

      // Unified presence for workspace and DMs
      if (resolvedWorkspaceId) {
        // MUST use the same channel name as workspace page
        const presenceCh = supabase.channel(`presence-workspace-${resolvedWorkspaceId}`, {
          config: { presence: { key: user.id } }
        })

        presenceCh
          .on('presence', { event: 'sync' }, () => {
            const state = presenceCh.presenceState()
            const online = new Set(Object.keys(state))
            setOnlineUsers(online)
            setIsOtherOnline(online.has(userId as string))
          })
          .on('presence', { event: 'join' }, ({ key }) => {
            const state = presenceCh.presenceState()
            const online = new Set(Object.keys(state))
            setOnlineUsers(online)
            if (key === userId || online.has(userId as string)) setIsOtherOnline(true)
          })
          .on('presence', { event: 'leave' }, ({ key }) => {
            const state = presenceCh.presenceState()
            const online = new Set(Object.keys(state))
            setOnlineUsers(online)
            if (key === userId || !online.has(userId as string)) setIsOtherOnline(false)
          })
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              await presenceCh.track({ 
                user_id: user.id,
                full_name: myProfile?.full_name,
                online_at: new Date().toISOString(),
              })
            }
            presenceSidebarRef.current = presenceCh
            setLoading(false)
            setInitialLoad(false)
          })
      } else {
        setLoading(false)
        setInitialLoad(false)
      }

      await loadMsgsPromise;

      // Sub 1: real-time incoming messages for THIS conversation
      const channelKey = [user.id, userId].sort().join("-");
      const sub = supabase.channel(`dm-${channelKey}`)
        .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
        }, (payload) => {
          const msg = payload.new as DM;
          const myId = meIdRef.current || user.id;
          
          // Only handle messages for this specific conversation
          const isRelevant =
            (msg.sender_id === myId && msg.receiver_id === userId) ||
            (msg.sender_id === userId && msg.receiver_id === myId);
          if (!isRelevant) return;

          // Only append incoming messages
          if (msg.sender_id === myId) return;
            
          setMessages(prev => {
            if (prev.find(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        })
        .subscribe();

      // Watch ALL incoming DMs (for sidebar badge updates)
      const allDmSub = supabase.channel(`all-dm-watcher-${user.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `receiver_id=eq.${user.id}`
        }, payload => {
          const msg = payload.new as DM
          if (msg.sender_id === userId) return
          setDmUnreadCounts(prev => {
            const updated = { ...prev, [msg.sender_id]: (prev[msg.sender_id] || 0) + 1 }
            if (typeof window !== 'undefined') {
              localStorage.setItem('trexaflow:dm:unread', JSON.stringify(updated))
            }
            return updated
          })
        })
        .subscribe();

      dmSubRef.current = sub;
      allDmSubRef.current = allDmSub;

    } finally {
      initializingRef.current = false;
    }

    return async () => {
      if (dmSubRef.current) {
        await supabase.removeChannel(dmSubRef.current)
        dmSubRef.current = null
      }
      if (allDmSubRef.current) {
        await supabase.removeChannel(allDmSubRef.current)
        allDmSubRef.current = null
      }
      if (presenceSidebarRef.current) {
        await presenceSidebarRef.current.untrack()
        await supabase.removeChannel(presenceSidebarRef.current)
        presenceSidebarRef.current = null
      }
    };
  };


  const loadMessages = async (myId: string) => {
    const { data } = await supabase
      .from("direct_messages")
      .select("*")
      .or(`and(sender_id.eq.${myId},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${myId})`)
      .order("created_at");
    setMessages(data || []);

    // Clear unread for this conversation when messages are loaded
    setDmUnreadCounts(prev => {
      const updated = { ...prev, [userId as string]: 0 }
      if (typeof window !== 'undefined') {
        localStorage.setItem('trexaflow:dm:unread', JSON.stringify(updated))
      }
      return updated
    })
  };

  const sendMessage = async () => {
    const content = newMessage.trim();
    if (!content || !me || sending) return;
    setNewMessage("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setSending(true);
    
    const { data: sent, error } = await supabase.from("direct_messages").insert({
      sender_id: me.id,
      receiver_id: userId,
      content,
    })
    .select()
    .single();

    if (error) { 
      console.error("DM error:", error); 
      setNewMessage(content); 
      setSending(false);
      textareaRef.current?.focus();
      return; 
    }

    // Immediately append to local state — don't wait for realtime
    if (sent) {
      setMessages(prev => [...prev, sent as DM]);
    }

    setSending(false);
    textareaRef.current?.focus();
    setDmUnreadFromMessageId(null)
    setDmUnreadCount(0)
    setDmUnreadCounts(prev => {
      const updated = { ...prev, [userId as string]: 0 }
      if (typeof window !== 'undefined') {
        localStorage.setItem('trexaflow:dm:unread', JSON.stringify(updated))
      }
      return updated
    })
  };

  const markDMAsUnread = (msg: DM) => {
    setOpenMenuMessageId(null)
    setHoveredMessage(null)
    const justBefore = new Date(new Date(msg.created_at).getTime() - 1).toISOString()
    setDmUnreadFromMessageId(msg.id)
    const count = messages.filter(m => m.created_at >= msg.created_at).length
    setDmUnreadCount(count)
    setDmUnreadCounts(prev => ({ ...prev, [userId as string]: count }))

    // Persist to localStorage
    if (typeof window !== 'undefined') {
      const stored = JSON.parse(localStorage.getItem('trexaflow_dm_lastread') || '{}')
      stored[userId as string] = justBefore
      localStorage.setItem('trexaflow_dm_lastread', JSON.stringify(stored))
    }
  }

  const deleteDMMessage = async (msgId: string) => {
    setOpenMenuMessageId(null);
    await supabase.from("direct_messages").delete().eq("id", msgId);
    setMessages(prev => prev.filter(m => m.id !== msgId));
  };

  const saveEditDMMessage = async (msgId: string) => {
    const trimmed = editingContent.trim();
    if (!trimmed) return;
    await supabase.from("direct_messages").update({ content: trimmed }).eq("id", msgId);
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: trimmed } : m));
    setEditingMessageId(null);
    setEditingContent("");
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
      : <div style={{ width: size, height: size, borderRadius: "50%", backgroundColor: "#E01E5A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontWeight: 700, color: "#ffffff", flexShrink: 0 }}>
          {getInitials(profile?.full_name || "?")}
        </div>
  );

  const goBack = () => {
    if (workspaceId) router.push(`/workspace/${workspaceId}`);
    else router.back();
  };

  const applyTheme = (mode: ThemeMode) => {
    const root = document.documentElement
    if (mode === 'system') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', mode)
    }
  }

  const handleThemeChange = (mode: ThemeMode) => {
    setThemeMode(mode)
    applyTheme(mode)
    localStorage.setItem('trexaflow_theme', mode)
    setShowThemePicker(false)
  }

  const copyWorkspaceCode = () => {
    if (!workspace?.workspace_code) return
    navigator.clipboard.writeText(workspace.workspace_code)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

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

  const PresenceDot = ({ userId, size = 9, borderColor = 'var(--bg-sidebar)' }: { userId: string; size?: number; borderColor?: string }) => {
    const isOnline = onlineUsers.has(userId)
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        backgroundColor: isOnline ? '#4ade80' : 'var(--text-muted)',
        border: `2px solid ${borderColor}`,
        transition: 'background-color 0.4s ease',
        flexShrink: 0,
      }} />
    )
  }

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

  if (loading && initialLoad) return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader2 size={28} color="#E01E5A" className="animate-spin" />
    </div>
  );

  return (
    <div data-theme={themeMode === 'system' ? undefined : themeMode} style={{
      display: 'flex', height: '100vh',
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-geist-sans), -apple-system, sans-serif',
    }}>

      {/* ── SIDEBAR ── */}
      <div style={{
        width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column',
        backgroundColor: 'var(--bg-sidebar)', borderRight: '1px solid var(--border-color)',
        height: '100vh', overflowY: 'auto',
      }}>
        {/* Workspace header */}
        <div style={{ padding: '0 14px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, borderBottom: '1px solid var(--border-color)' }}>
          <button
            onClick={() => setShowWorkspaceInfo(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.95rem', padding: '4px 6px', borderRadius: 7, flex: 1, textAlign: 'left', overflow: 'hidden' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            {workspace?.image_url ? (
              <img src={workspace.image_url} style={{ width: 24, height: 24, borderRadius: 6, objectFit: 'cover' }} alt="" />
            ) : (
              <div style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: '#E01E5A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {workspace?.name?.[0]?.toUpperCase()}
              </div>
            )}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{workspace?.name}</span>
          </button>
        </div>

        {/* Channels */}
        <div style={{ marginTop: 6 }}>
          <div style={{ padding: '6px 16px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Channels
            </span>
          </div>
          {channels.map(ch => (
            <button key={ch.id}
              onClick={() => router.push(`/workspace/${workspaceId}?channel=${ch.id}`)}
              style={{
                width: 'calc(100% - 12px)', display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 10px', border: 'none', cursor: 'pointer',
                backgroundColor: 'transparent', color: 'var(--text-secondary)',
                borderRadius: 6, margin: '1px 6px', textAlign: 'left', transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                e.currentTarget.style.color = 'var(--text-primary)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = 'var(--text-secondary)'
              }}
            >
              {ch.is_private ? <Lock size={13} style={{ flexShrink: 0 }} /> : <Globe size={13} style={{ flexShrink: 0 }} />}
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.875rem' }}>
                {ch.name}
              </span>
            </button>
          ))}
        </div>

        {/* Direct Messages */}
        <div style={{ marginTop: 16 }}>
          <div style={{ padding: '6px 16px 4px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Direct Messages
            </span>
          </div>
          {members.filter(m => m.user_id !== me?.id).map(m => {
            const isActive = m.user_id === userId
            return (
              <button key={m.user_id}
                onClick={() => {
                  setDmUnreadCounts(prev => {
                    const updated = { ...prev, [m.user_id]: 0 }
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('trexaflow:dm:unread', JSON.stringify(updated))
                    }
                    return updated
                  })
                  router.push(`/dm/${m.user_id}?from=${workspaceId}`)
                }}
                style={{
                  width: 'calc(100% - 12px)', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', border: 'none', cursor: 'pointer',
                  backgroundColor: isActive ? 'var(--bg-active)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  borderRadius: 6, margin: '1px 6px', transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                    e.currentTarget.style.color = 'var(--text-primary)'
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color = 'var(--text-secondary)'
                  }
                }}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  {m.profile?.avatar_url ? (
                    <img src={m.profile.avatar_url} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} alt="" />
                  ) : (
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%', backgroundColor: '#E01E5A',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.62rem', fontWeight: 700, color: '#fff',
                    }}>
                      {m.profile?.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                  )}
                  <div style={{ position: 'absolute', bottom: -1, right: -1 }}>
                    <PresenceDot userId={m.user_id} size={9} />
                  </div>
                </div>
                <span style={{
                  fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap', fontWeight: isActive ? 600 : 400,
                }}>
                  {m.profile?.full_name}
                </span>
                {dmUnreadCounts[m.user_id] > 0 ? (
                  <div style={{ minWidth: 18, height: 18, borderRadius: 999, backgroundColor: '#E01E5A', color: '#fff', fontSize: '0.68rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', flexShrink: 0, marginLeft: 'auto' }}>
                    {dmUnreadCounts[m.user_id] > 99 ? '99+' : dmUnreadCounts[m.user_id]}
                  </div>
                ) : onlineUsers.has(m.user_id) ? (
                  <span style={{ fontSize: '0.65rem', color: 'var(--unread-dot)', marginLeft: 'auto', fontWeight: 500, flexShrink: 0 }}>
                    online
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>

        {/* My profile at bottom */}
        <div style={{ marginTop: 'auto', padding: '12px 10px', borderTop: '1px solid var(--border-color)' }}>
          <div
            onClick={() => { setShowProfileModal(true); setEditingProfile(false) }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, cursor: 'pointer', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <div style={{ position: 'relative' }}>
              {me?.avatar_url ? (
                <img src={me.avatar_url} style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }} alt="" />
              ) : (
                <div style={{
                  width: 30, height: 30, borderRadius: '50%', backgroundColor: '#E01E5A',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 700, color: '#fff',
                }}>
                  {me?.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
              )}
              <div style={{ position: 'absolute', bottom: 0, right: 0 }}>
                <PresenceDot userId={me?.id ?? ''} size={9} />
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {me?.full_name}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {me?.job_title}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN DM CONTENT ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header — Sidebar replaces back navigation */}
        <div style={{
          height: 56, borderBottom: '1px solid var(--border-color)',
          display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px',
          flexShrink: 0, backgroundColor: 'var(--bg-topbar)', position: 'relative'
        }}>
          {loading && !initialLoad && (
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0,
              height: 2,
              background: 'linear-gradient(90deg, #E01E5A, #ff6b9d, #E01E5A)',
              backgroundSize: '200% 100%',
              animation: 'shimmerBar 1s linear infinite',
              zIndex: 50,
            }} />
          )}
          <div style={{ position: 'relative' }}>
            {/* Avatar of the other person */}
            {other?.avatar_url ? (
              <img src={other.avatar_url} style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} alt="" />
            ) : (
              <div style={{
                width: 34, height: 34, borderRadius: '50%', backgroundColor: '#E01E5A',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.85rem', fontWeight: 700, color: '#fff',
              }}>
                {other?.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
              </div>
            )}
            <div style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: '50%', backgroundColor: isOtherOnline ? '#4ade80' : 'var(--text-muted)', border: '2px solid var(--bg-topbar)', transition: 'background-color 0.4s ease' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>{other?.full_name}</div>
            <div style={{ fontSize: '0.72rem', color: isOtherOnline ? '#4ade80' : 'var(--text-muted)' }}>
              {isOtherOnline ? 'Online' : 'Offline'}
            </div>
          </div>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Theme picker */}
          <div ref={themePickerRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowThemePicker(p => !p)}
              title="Switch theme"
              style={{ background: showThemePicker ? 'var(--bg-hover)' : 'none', border: 'none', cursor: 'pointer', color: showThemePicker ? 'var(--text-primary)' : 'var(--icon-color)', padding: '7px', borderRadius: 8, display: 'flex', alignItems: 'center', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--icon-hover)'; e.currentTarget.style.backgroundColor = 'var(--bg-hover)' }}
              onMouseLeave={e => { if (!showThemePicker) { e.currentTarget.style.color = 'var(--icon-color)'; e.currentTarget.style.backgroundColor = 'transparent' } }}
            >
              {themeMode === 'light' ? <Sun size={17} /> : themeMode === 'dark' ? <Moon size={17} /> : <Monitor size={17} />}
            </button>

            {showThemePicker && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 10, padding: 4, boxShadow: '0 8px 24px var(--shadow-color)', zIndex: 100, minWidth: 150, animation: 'fadeSlideDown 0.15s ease' }}>
                <div style={{ position: 'absolute', top: -5, right: 10, width: 10, height: 10, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRight: 'none', borderBottom: 'none', transform: 'rotate(45deg)' }} />
                {(['system', 'light', 'dark'] as ThemeMode[]).map(mode => (
                  <button key={mode} onClick={() => handleThemeChange(mode)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: 'none', cursor: 'pointer', borderRadius: 7, textAlign: 'left', fontSize: '0.85rem', fontWeight: themeMode === mode ? 600 : 400, backgroundColor: themeMode === mode ? 'rgba(224,30,90,0.1)' : 'transparent', color: themeMode === mode ? '#E01E5A' : 'var(--text-primary)', transition: 'all 0.12s' }}
                    onMouseEnter={e => { if (themeMode !== mode) e.currentTarget.style.backgroundColor = 'var(--bg-hover)' }}
                    onMouseLeave={e => { if (themeMode !== mode) e.currentTarget.style.backgroundColor = 'transparent' }}
                  >
                    {mode === 'light' ? <Sun size={14} /> : mode === 'dark' ? <Moon size={14} /> : <Monitor size={14} />}
                    <span style={{ textTransform: 'capitalize' }}>{mode}</span>
                    {themeMode === mode && <Check size={13} color="#E01E5A" style={{ marginLeft: 'auto' }} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Messages ── */}
        <div ref={messagesContainerRef} style={{ flex: 1, overflowY: "auto", padding: "24px 20px 0" }}>

          {/* Empty state */}
          {messages.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "80%", gap: "16px" }}>
              <div style={{ position: "relative" }}>
                <Avatar profile={other} size={72} />
                <div style={{
                  position: "absolute", bottom: 3, right: 3,
                  width: 16, height: 16, borderRadius: "50%",
                  backgroundColor: isOtherOnline ? "#4ade80" : "var(--text-muted)",
                  border: "3px solid var(--bg-primary)",
                  transition: "background-color 0.4s ease",
                }} />
              </div>

              <div style={{ textAlign: "center" }}>
                <h3 style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: "6px", color: "var(--text-primary)" }}>{other?.full_name}</h3>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{other?.job_title}</p>
              </div>
              <div style={{ padding: "10px 20px", backgroundColor: "var(--bg-hover)", border: "1px solid var(--border-color)", borderRadius: "999px" }}>
                <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                  This is the beginning of your conversation with <strong style={{ color: "var(--text-primary)" }}>{other?.full_name}</strong>
                </p>
              </div>
            </div>
          )}

          {/* Messages list */}
          {messages.map((msg, i) => {
            const isMe = msg.sender_id === me?.id;
            const senderProfile = isMe ? me : other;
            const showDate = i === 0 || formatDate(messages[i - 1].created_at) !== formatDate(msg.created_at);
            const showUnreadMarker = dmUnreadFromMessageId === msg.id;
            const showAvatar = i === 0 || messages[i - 1].sender_id !== msg.sender_id || showDate;

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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0 4px', padding: '0 8px' }}>
                    <div style={{ flex: 1, height: 1, backgroundColor: '#E01E5A' }} />
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#E01E5A', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>New messages</span>
                    <div style={{ flex: 1, height: 1, backgroundColor: '#E01E5A' }} />
                  </div>
                )}
                <div
                  style={{
                    position: "relative",
                    display: "flex",
                    gap: "10px",
                    marginBottom: "2px",
                    padding: "3px 8px",
                    borderRadius: "8px",
                    transition: "background 0.1s",
                    backgroundColor: hoveredMessage === msg.id ? "var(--bg-message-hover)" : "transparent",
                  }}
                  onMouseEnter={() => setHoveredMessage(msg.id)}
                  onMouseLeave={() => setHoveredMessage(null)}
                >
                  {/* Avatar — only show when sender changes */}
                  <div style={{ width: 34, flexShrink: 0 }}>
                    {showAvatar && <Avatar profile={senderProfile} size={34} />}
                  </div>

                  <div style={{ flex: 1 }}>
                    {showAvatar && (
                      <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "3px" }}>
                        <span style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--text-primary)" }}>{senderProfile?.full_name}</span>
                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{formatTime(msg.created_at)}</span>
                      </div>
                    )}

                    {/* Inline edit mode */}
                    {editingMessageId === msg.id ? (
                      <div style={{ marginTop: 4 }}>
                        <textarea
                          value={editingContent}
                          onChange={e => setEditingContent(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEditDMMessage(msg.id) }
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
                          <button onClick={() => saveEditDMMessage(msg.id)} style={{ padding: "5px 14px", borderRadius: 7, border: "none", backgroundColor: "#E01E5A", color: "#fff", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}>Save</button>
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

                  {/* Hover toolbar */}
                  {hoveredMessage === msg.id && (
                    <div style={{ position: "absolute", top: -14, right: 12, display: "flex", alignItems: "center", gap: 2, backgroundColor: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: 8, padding: "3px 4px", boxShadow: "0 4px 16px rgba(0,0,0,0.3)", zIndex: 10 }}>
                      <div style={{ position: "relative" }} ref={openMenuMessageId === msg.id ? menuRef : null}>
                        <button
                          onClick={() => setOpenMenuMessageId(prev => (prev === msg.id ? null : msg.id))}
                          title="More actions"
                          style={{ background: "none", border: "none", cursor: "pointer", padding: "5px 7px", borderRadius: 6, color: openMenuMessageId === msg.id ? "var(--text-primary)" : "var(--icon-color)", display: "flex", alignItems: "center", backgroundColor: openMenuMessageId === msg.id ? "var(--bg-hover)" : "transparent" }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--bg-hover)"}
                          onMouseLeave={e => { if (openMenuMessageId !== msg.id) e.currentTarget.style.backgroundColor = "transparent" }}>
                          <MoreHorizontal size={14} />
                        </button>

                        {openMenuMessageId === msg.id && (
                          <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 10, padding: "4px", boxShadow: "0 8px 24px var(--shadow-color)", zIndex: 50, minWidth: 160 }}>

                            {/* Edit — only for own messages */}
                            {msg.sender_id === me?.id && (
                              <>
                                <button
                                  onClick={() => { setEditingMessageId(msg.id); setEditingContent(msg.content); setOpenMenuMessageId(null); setHoveredMessage(null); }}
                                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", border: "none", cursor: "pointer", backgroundColor: "transparent", color: "var(--text-primary)", borderRadius: 7, fontSize: "0.875rem", fontWeight: 500, textAlign: "left" }}
                                  onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--bg-hover)"}
                                  onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}>
                                  <Pencil size={14} style={{ color: "var(--icon-color)", flexShrink: 0 }} />
                                  Edit message
                                </button>
                                <div style={{ height: 1, backgroundColor: "var(--border-color)", margin: "3px 0" }} />
                              </>
                            )}

                            {/* Mark as unread — for all messages */}
                            <button
                              onClick={() => markDMAsUnread(msg)}
                              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', border: 'none', cursor: 'pointer', backgroundColor: 'transparent', color: 'var(--text-primary)', borderRadius: 7, fontSize: '0.875rem', fontWeight: 500, textAlign: 'left' }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              <MailOpen size={14} style={{ color: 'var(--icon-color)', flexShrink: 0 }} />
                              Mark as unread
                            </button>

                            {/* Delete — only for own messages */}
                            {msg.sender_id === me?.id && (
                              <>
                                <div style={{ height: 1, backgroundColor: "var(--border-color)", margin: "3px 0" }} />
                                <button
                                  onClick={() => deleteDMMessage(msg.id)}
                                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", border: "none", cursor: "pointer", backgroundColor: "transparent", color: "#f87171", borderRadius: 7, fontSize: "0.875rem", fontWeight: 500, textAlign: "left" }}
                                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(248,113,113,0.08)" }}
                                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent" }}>
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

        {/* ── Input ── */}
        <div style={{ padding: "12px 20px 16px", flexShrink: 0 }}>
          <div style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: "12px", overflow: "hidden" }}>
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
                background: "none", border: "none", color: "var(--text-primary)",
                fontSize: "0.9rem", outline: "none", resize: "none",
                fontFamily: "inherit", lineHeight: 1.5,
                minHeight: "44px", maxHeight: "120px", display: "block",
              }}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 10px 8px" }}>
              <div style={{ display: "flex", gap: "4px" }}>
                <button type="button" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--icon-color)", padding: "5px", borderRadius: "6px" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "var(--icon-hover)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--icon-color)")}
                ><Paperclip size={17} /></button>
                <button type="button" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--icon-color)", padding: "5px", borderRadius: "6px" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "var(--icon-hover)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--icon-color)")}
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
          <p style={{ fontSize: "0.72rem", color: "var(--text-faint)", marginTop: "6px", textAlign: "center" }}>
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>

      {/* WORKSPACE INFO MODAL */}
      {showWorkspaceInfo && workspace && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)', overflowY: 'auto', padding: '24px 16px' }}
          onClick={e => { if (e.target === e.currentTarget) setShowWorkspaceInfo(false) }}
        >
          <div style={{ width: '100%', maxWidth: 440, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 22, boxShadow: '0 24px 80px var(--shadow-color)', flexShrink: 0, alignSelf: 'flex-start' }}>

            {/* Banner */}
            <div style={{ height: 90, position: 'relative', borderRadius: '22px 22px 0 0', background: 'var(--banner-gradient)', overflow: 'hidden' }}>
              <button
                onClick={() => setShowWorkspaceInfo(false)}
                style={{ position: 'absolute', top: 14, right: 14, zIndex: 1, background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', borderRadius: 7, padding: '5px 7px', display: 'flex' }}>
                <X size={15} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '0 24px 28px' }}>
              {/* Avatar */}
              <div style={{ marginTop: -36, marginBottom: 16, position: 'relative', zIndex: 2 }}>
                {workspace.image_url ? (
                  <img src={workspace.image_url} style={{ width: 72, height: 72, borderRadius: 16, objectFit: 'cover', border: '3px solid var(--bg-secondary)', display: 'block' }} alt="" />
                ) : (
                  <div style={{ width: 72, height: 72, borderRadius: 16, backgroundColor: '#E01E5A', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid var(--bg-secondary)', fontSize: '2rem', fontWeight: 700, color: '#fff' }}>
                    {workspace.name?.[0]?.toUpperCase()}
                  </div>
                )}
              </div>

              {/* Name & description */}
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{workspace.name}</h2>
              {(workspace as any).description && <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>{(workspace as any).description}</p>}

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                {[{ label: 'Members', value: members.length }, { label: 'Channels', value: channels.length }].map(stat => (
                  <div key={stat.label} style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{stat.value}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Workspace ID */}
              <div style={{ backgroundColor: 'rgba(224,30,90,0.06)', border: '1px solid rgba(224,30,90,0.15)', borderRadius: 14, padding: '16px 18px', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Users size={13} color="#E01E5A" />
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#E01E5A', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Workspace ID</span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>Share this ID with teammates so they can join your workspace during sign up.</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 9, padding: '10px 14px', fontFamily: 'monospace', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.18em', textAlign: 'center' }}>
                    {workspace.workspace_code}
                  </div>
                  <button
                    onClick={copyWorkspaceCode}
                    style={{ padding: '10px 18px', borderRadius: 9, border: 'none', backgroundColor: codeCopied ? '#16a34a' : '#E01E5A', color: '#fff', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, transition: 'background 0.2s' }}
                  >
                    {codeCopied ? <Check size={14} /> : <Copy size={14} />}
                    {codeCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
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
