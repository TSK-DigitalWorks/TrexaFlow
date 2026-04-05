"use client";

import { useEffect, useState, useRef, useMemo, type ReactNode } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import ReactDOM from "react-dom";
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
  description: string | null;
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
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_type?: string | null;
  parent_message_id?: string | null;
  parent_snapshot?: { senderName: string; content: string } | null;
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
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_type?: string | null;
  parent_message_id?: string | null;
  parent_snapshot?: { senderName: string; content: string } | null;
};
type ThemeMode = "system" | "dark" | "light";
type View = "channel" | "dm";

const cleanPastedHtml = (node: HTMLElement): string => {
  const processNode = (n: Node): string => {
    if (n.nodeType === Node.TEXT_NODE) return n.textContent ?? '';
    if (n.nodeType !== Node.ELEMENT_NODE) return '';

    const el = n as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const cs = window.getComputedStyle(el);
    const inner = Array.from(el.childNodes).map(processNode).join('');

    const isBold = tag === 'b' || tag === 'strong' || el.style.fontWeight === 'bold' || el.style.fontWeight === '700' || Number(el.style.fontWeight) >= 600 || cs.fontWeight === 'bold' || Number(cs.fontWeight) >= 600;
    const isItalic = tag === 'i' || tag === 'em' || el.style.fontStyle === 'italic' || cs.fontStyle === 'italic';
    const isUnderline = tag === 'u' || el.style.textDecoration?.includes('underline') || cs.textDecoration?.includes('underline');
    const isStrike = tag === 's' || tag === 'strike' || tag === 'del' || el.style.textDecoration?.includes('line-through') || cs.textDecoration?.includes('line-through');
    const isBlock = ['p', 'div', 'br', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'tr', 'td', 'th', 'section', 'article', 'header', 'footer'].includes(tag);

    if (tag === 'br') return '<br>';

    let wrapped = inner;
    if (isStrike) wrapped = `<s>${wrapped}</s>`;
    if (isUnderline) wrapped = `<u>${wrapped}</u>`;
    if (isItalic) wrapped = `<em>${wrapped}</em>`;
    if (isBold) wrapped = `<strong>${wrapped}</strong>`;

    if (isBlock && wrapped) return `<div>${wrapped}</div>`;
    return wrapped;
  };

  return Array.from(node.childNodes).map(processNode).join('');
};

const sanitizeHtml = (html: string): string => {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;

  const clean = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const inner = Array.from(el.childNodes).map(clean).join('');

    if (tag === 'strong' || tag === 'b') return `<strong>${inner}</strong>`;
    if (tag === 'em' || tag === 'i') return `<em>${inner}</em>`;
    if (tag === 'u') return `<u>${inner}</u>`;
    if (tag === 's' || tag === 'strike' || tag === 'del') return `<s>${inner}</s>`;
    if (tag === 'a') {
      const href = (el as HTMLAnchorElement).href;
      return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:#E01E5A;text-decoration:underline">${inner}</a>`;
    }
    if (tag === 'br') return '<br>';
    if (tag === 'div' || tag === 'p') {
      if (!inner) return '<br>';
      return `${inner}<br>`;
    }
    if (tag === 'span' && el.getAttribute('data-mention-id')) {
      const id = el.getAttribute('data-mention-id');
      const name = el.getAttribute('data-mention-name');
      return `<span data-mention-id="${id}" data-mention-name="${name}" style="color:#E01E5A;background:rgba(224,30,90,0.15);border-radius:4px;padding:1px 5px;font-weight:600;font-size:0.88em;">@${name}</span>`;
    }
    return inner;
  };

  const result = Array.from(tmp.childNodes).map(clean).join('');
  return result.replace(/(<br\s*\/?>)+$/, ''); // trim trailing <br>
};

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!;
const MAX_FILE_SIZE = 7.5 * 1024 * 1024; // base64 overhead ~33%, so 7.5MB file ≈ 10MB base64 string

async function uploadToCloudinary(
  file: File,
  bytes: ArrayBuffer,
  onError: (msg: string) => void
): Promise<{ url: string; name: string; type: 'image' | 'file' } | null> {
  if (file.size > MAX_FILE_SIZE) {
    onError('File exceeds the 7.5 MB size limit. Please choose a smaller file.');
    return null;
  }

  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  let resourceType = 'raw';
  if (isImage) resourceType = 'image';
  else if (isVideo) resourceType = 'video';

  try {
    // Convert ArrayBuffer → base64 string
    const uint8 = new Uint8Array(bytes);
    let binary = '';
    for (let i = 0; i < uint8.byteLength; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    const base64 = btoa(binary);
    const dataUri = `data:${file.type || 'application/octet-stream'};base64,${base64}`;

    const fd = new FormData();
    fd.append('file', dataUri);           // ← send as data URI, not File object
    fd.append('upload_preset', UPLOAD_PRESET);
    fd.append('resource_type', resourceType);
    fd.append('public_id', `${Date.now()}_${file.name.replace(/\s+/g, '_')}`);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
      { method: 'POST', body: fd }
    );

    if (!res.ok) {
      const errData = await res.json();
      const msg = errData?.error?.message ?? '';
      if (msg.toLowerCase().includes('empty file')) {
        onError('Cannot send an empty file. Make sure the file has content before sending.');
      } else if (msg.toLowerCase().includes('invalid')) {
        onError('Invalid file. Please check the file and try again.');
      } else if (msg.toLowerCase().includes('format')) {
        onError('Unsupported file format. Please try a different file.');
      } else {
        onError(`File upload failed: ${msg || 'Unknown error. Please try again.'}`);
      }

      console.error('Cloudinary error full:', JSON.stringify(errData, null, 2));
      return null;
    }

    const data = await res.json();
    return { url: data.secure_url, name: file.name, type: isImage ? 'image' : 'file' };
  } catch (err) {
    console.error('Upload error:', err);
    return null;
  }
}

async function handleAttachPick(
  file: File,
  setFile: (f: File | null) => void,
  setBytes: (b: ArrayBuffer | null) => void,
  setPreview: (s: string | null) => void,
  onError: (msg: string) => void
) {
  if (file.size > MAX_FILE_SIZE) {
    onError('File exceeds the 7.5 MB size limit. Please choose a smaller file.');
    return;
  }
  // Read bytes immediately while File object is still valid
  const bytes = await file.arrayBuffer();
  setFile(file);
  setBytes(bytes);
  setPreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : null);
}

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
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentBytes, setAttachmentBytes] = useState<ArrayBuffer | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const channelFileInputRef = useRef<HTMLInputElement>(null);
  const [dmAttachmentFile, setDmAttachmentFile] = useState<File | null>(null);
  const [dmAttachmentBytes, setDmAttachmentBytes] = useState<ArrayBuffer | null>(null);
  const [dmAttachmentPreview, setDmAttachmentPreview] = useState<string | null>(null);
  const [dmUploading, setDmUploading] = useState(false);
  const dmFileInputRef = useRef<HTMLInputElement>(null);
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
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

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
  const [showDeleteChannelConfirm, setShowDeleteChannelConfirm] = useState(false);

  // ── Mention autocomplete ──
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionDropdownFor, setMentionDropdownFor] = useState<"channel" | "dm" | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const mentionDropdownRef = useRef<HTMLDivElement>(null);
  const mentionAnchorRef = useRef<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });

  // ── Unread / theme / misc ──
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [lastReadMap, setLastReadMap] = useState<Record<string, string>>({});
  const [dmUnreadCounts, setDmUnreadCounts] = useState<Record<string, number>>({});
  const [mentionCounts, setMentionCounts] = useState<Record<string, number>>({});
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [unreadFromMessageId, setUnreadFromMessageId] = useState<string | null>(null);
  const [openMenuMessageId, setOpenMenuMessageId] = useState<string | null>(null);
  const [refreshingChannels, setRefreshingChannels] = useState(false);
  const [refreshingMembers, setRefreshingMembers] = useState(false);
  const [channelListStale, setChannelListStale] = useState(false);
  const [memberListStale, setMemberListStale] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkModalText, setLinkModalText] = useState("");
  const [linkModalUrl, setLinkModalUrl] = useState("");
  const [linkModalTarget, setLinkModalTarget] = useState<"channel" | "dm">("channel");

  // ── Refs ──
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const dmMessagesContainerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const dmEditorRef = useRef<HTMLDivElement>(null);
  const activeChannelRef = useRef<Channel | null>(null);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const themePickerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const dmMenuRef = useRef<HTMLDivElement | null>(null);
  const dmSubRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const allDmSubRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const meIdRef = useRef<string | null>(null);

  // ── Typing optimization ──
  const newMessageRef = useRef<string>('');
  const [isNewMessageEmpty, setIsNewMessageEmpty] = useState(true);
  const dmNewMessageRef = useRef<string>('');
  const [isDmNewMessageEmpty, setIsDmNewMessageEmpty] = useState(true);

  // ── Toast state ──
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Reply state ──
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [dmReplyingTo, setDmReplyingTo] = useState<DM & { senderName?: string } | null>(null);

  const showToast = (message: string, type: 'error' | 'success' | 'info' = 'error') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  };

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
          (msg.sender_id === activeDmUserId && msg.receiver_id === me.id) ||
          (msg.sender_id === me.id && msg.receiver_id === me.id); // self-DM for request receipts

        if (isRelevant) {
          setDmMessages(prev => {
            if (prev.find(m => m.id === msg.id)) return prev; // dedup guard
            return [...prev, msg];
          });
          setTimeout(() => {
            if (dmMessagesContainerRef.current) {
              dmMessagesContainerRef.current.scrollTop = dmMessagesContainerRef.current.scrollHeight;
            }
          }, 50);
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "direct_messages" }, payload => {
        const updated = payload.new as DM;
        setDmMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
      })
      .subscribe();
    dmSubRef.current = sub;
    return () => {
      supabase.removeChannel(sub);
      dmSubRef.current = null;
    };
  }, [me?.id, activeDmUserId]);
  // Refresh only the channels list
  const refreshChannels = async () => {
    if (!me || refreshingChannels) return;
    setRefreshingChannels(true);
    setChannelListStale(false);

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
      .eq("user_id", me.id);

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

    const merged = [
      ...(publicChans || []).sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0)),
      ...privateChans,
    ];
    setChannels(merged);
    setRefreshingChannels(false);
  };

  // Refresh only the members/DM list
  const refreshMembers = async () => {
    if (refreshingMembers) return;
    setRefreshingMembers(true);
    setMemberListStale(false);
    await loadMembers();
    setRefreshingMembers(false);
  };

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
      await loadChannelMessages(targetChannel.id);
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

    // ── Realtime: channels table (create / rename / delete) ──
    const chanRealtime = supabase
      .channel(`channels-realtime-${workspaceId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "channels",
        filter: `workspace_id=eq.${workspaceId}`,
      }, async (payload) => {
        const newChan = payload.new as any;
        // Only add to sidebar if this user is a member (public) or was just added
        if (!newChan.is_private) {
          setChannels(prev => {
            if (prev.find(c => c.id === newChan.id)) return prev;
            return [...prev, newChan];
          });
          // Auto-join public channels
          await supabase.from("channel_members").upsert({
            channel_id: newChan.id,
            user_id: user.id,
          }, { onConflict: "channel_id,user_id" });
        } else {
          // For private channels, only show if user is already a member
          const { data: membership } = await supabase
            .from("channel_members")
            .select("channel_id")
            .eq("channel_id", newChan.id)
            .eq("user_id", user.id)
            .single();
          if (membership) {
            setChannels(prev => {
              if (prev.find(c => c.id === newChan.id)) return prev;
              return [...prev, newChan];
            });
          } else {
            // This user was not auto-joined — mark list as stale so they see the hint
            setChannelListStale(true);
          }
        }
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "channels",
        filter: `workspace_id=eq.${workspaceId}`,
      }, (payload) => {
        const updated = payload.new as any;
        setChannels(prev =>
          prev.map(c => c.id === updated.id ? { ...c, ...updated } : c)
        );
        // If the active channel was renamed, update its name in the header too
        setActiveChannel(prev =>
          prev?.id === updated.id ? { ...prev, ...updated } : prev
        );
      })
      .on("postgres_changes", {
        event: "DELETE",
        schema: "public",
        table: "channels",
      }, (payload) => {
        const deletedId = payload.old?.id;
        if (!deletedId) return;
        setChannels(prev => prev.filter(c => c.id !== deletedId));
        // If user is currently viewing the deleted channel, bounce to lobby
        setActiveChannel(prev => {
          if (prev?.id === deletedId) {
            const lobby = channels.find(c => c.is_default);
            if (lobby) switchChannel(lobby);
            return null;
          }
          return prev;
        });
      })
      .subscribe();

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
              setUnreadCounts(prev => ({
                ...prev,
                [msg.channel_id]: (prev[msg.channel_id] || 0) + 1,
              }));

              if (messageHasMentionForMe(msg)) {
                setMentionCounts(prev => ({
                  ...prev,
                  [msg.channel_id]: (prev[msg.channel_id] || 0) + 1,
                }));
              }
              return;
            }
            if (msg.sender_id === meIdRef.current && meIdRef.current !== null) return;
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

    // Realtime: new workspace member joined → mark DM list stale
    const memberJoinSub = supabase
      .channel(`workspace-members-${workspaceId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "workspace_members",
        filter: `workspace_id=eq.${workspaceId}`,
      }, (payload) => {
        const newMember = payload.new as any;
        // Don't mark stale for yourself
        if (newMember.user_id !== user.id) {
          setMemberListStale(true);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(msgSub);
      supabase.removeChannel(chanRealtime);
      supabase.removeChannel(memberJoinSub);
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
    let query = supabase
      .from("direct_messages")
      .select("*")
      .order("created_at");

    if (myId === otherId) {
      // Self-DM (request receipts)
      query = query.eq("sender_id", myId).eq("receiver_id", myId);
    } else {
      query = query.or(
        `and(sender_id.eq.${myId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${myId})`
      );
    }

    const { data } = await query;
    setDmMessages(data ?? []);

    // Clear unread badge
    setDmUnreadCounts(prev => {
      const updated = { ...prev, [otherId]: 0 };
      if (typeof window !== "undefined") {
        localStorage.setItem("trexaflow:dm:unread", JSON.stringify(updated));
      }
      return updated;
    });
  };

  const isAdmin = me?.id === workspace?.owner_id ||
    members.find(m => m.user_id === me?.id)?.role === "admin";

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
    const editorEl = editorRef.current;
    if (!editorEl || !me || !activeChannel || sending || uploading) return;

    const html = editorEl.innerHTML;
    const content = sanitizeHtml(html);
    if (!content.trim() && !attachmentFile) return;

    editorEl.innerHTML = "";
    setNewMessage("");
    setSending(true);

    let attachData: { url: string; name: string; type: 'image' | 'file' } | null = null;
    if (attachmentFile && attachmentBytes) {
      setUploading(true);
      attachData = await uploadToCloudinary(attachmentFile, attachmentBytes, showToast);
      setUploading(false);
      if (!attachData) {
        editorEl.innerHTML = html;
        setNewMessage(html);
        setSending(false);
        setAttachmentFile(null);
        setAttachmentBytes(null);
        setAttachmentPreview(null);
        return;
      }
      setAttachmentFile(null);
      setAttachmentBytes(null);
      setAttachmentPreview(null);
    }

    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      channel_id: activeChannel.id,
      content,
      created_at: new Date().toISOString(),
      sender_id: me.id,
      is_pinned: false,
      is_system: false,
      sender: me,
      attachment_url: attachData?.url ?? null,
      attachment_name: attachData?.name ?? null,
      attachment_type: attachData?.type ?? null,
      parent_message_id: replyingTo?.id ?? null,
      parent_snapshot: replyingTo ? {
        senderName: replyingTo.sender?.full_name ?? 'Unknown',
        content: replyingTo.content,
      } : null,
    };
    setMessages(prev => [...prev, optimisticMsg]);

    const { data: sent, error } = await supabase
      .from("messages")
      .insert({
        channel_id: activeChannel.id,
        sender_id: me.id,
        content,
        is_pinned: false,
        attachment_url: attachData?.url ?? null,
        attachment_name: attachData?.name ?? null,
        attachment_type: attachData?.type ?? null,
        parent_message_id: replyingTo?.id ?? null,
        parent_snapshot: replyingTo ? {
          senderName: replyingTo.sender?.full_name ?? 'Unknown',
          content: replyingTo.content,
        } : null,
      })
      .select("*, sender:users(*)")
      .single();

    if (error) {
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      editorEl.innerHTML = html;
      setNewMessage(html);
    } else if (sent) {
      setMessages(prev => {
        const withoutDupe = prev.filter(m => m.id !== sent.id);
        return withoutDupe.map(m => m.id === optimisticMsg.id ? sent : m);
      });
    }

    setSending(false);
    setReplyingTo(null);
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.focus();
        const range = document.createRange();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }, 0);
  };

  // ─── Send DM ──────────────────────────────────────────────
  const sendDmMessage = async () => {
    const editorEl = dmEditorRef.current;
    if (!editorEl || !me || !activeDmUserId || dmSending || dmUploading) return;

    const html = editorEl.innerHTML;
    const content = sanitizeHtml(html);
    if (!content.trim() && !dmAttachmentFile) return;

    editorEl.innerHTML = "";
    setDmNewMessage("");
    setDmSending(true);

    let attachData: { url: string; name: string; type: 'image' | 'file' } | null = null;
    if (dmAttachmentFile && dmAttachmentBytes) {
      setDmUploading(true);
      attachData = await uploadToCloudinary(dmAttachmentFile, dmAttachmentBytes, showToast);
      setDmUploading(false);
      if (!attachData) {
        editorEl.innerHTML = html;
        setDmNewMessage(html);
        setDmSending(false);
        setDmAttachmentFile(null);
        setDmAttachmentBytes(null);
        setDmAttachmentPreview(null);
        return;
      }
      setDmAttachmentFile(null);
      setDmAttachmentBytes(null);
      setDmAttachmentPreview(null);
    }

    const optimisticMsg: DM = {
      id: `temp-${Date.now()}`,
      sender_id: me.id,
      receiver_id: activeDmUserId,
      content,
      created_at: new Date().toISOString(),
      attachment_url: attachData?.url ?? null,
      attachment_name: attachData?.name ?? null,
      attachment_type: attachData?.type ?? null,
      parent_message_id: dmReplyingTo?.id ?? null,
      parent_snapshot: dmReplyingTo ? {
        senderName: dmReplyingTo.senderName ?? 'Unknown',
        content: dmReplyingTo.content,
      } : null,
    };
    setDmMessages(prev => [...prev, optimisticMsg]);

    const { data: sent, error } = await supabase
      .from("direct_messages")
      .insert({
        sender_id: me.id,
        receiver_id: activeDmUserId,
        content,
        attachment_url: attachData?.url ?? null,
        attachment_name: attachData?.name ?? null,
        attachment_type: attachData?.type ?? null,
        parent_message_id: dmReplyingTo?.id ?? null,
        parent_snapshot: dmReplyingTo ? {
          senderName: dmReplyingTo.senderName ?? 'Unknown',
          content: dmReplyingTo.content,
        } : null,
      })
      .select()
      .single();

    if (error) {
      console.error("DM error:", error);
      setDmMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      editorEl.innerHTML = html;
      setDmNewMessage(html);
      setDmSending(false);
      editorEl.focus();
      return;
    }

    if (sent) {
      setDmMessages(prev => {
        const withoutDupe = prev.filter(m => m.id !== sent.id);
        return withoutDupe.map(m => m.id === optimisticMsg.id ? sent : m);
      });
    }

    setDmSending(false);
    setDmReplyingTo(null);
    setTimeout(() => {
      if (dmMessagesContainerRef.current) {
        dmMessagesContainerRef.current.scrollTop = dmMessagesContainerRef.current.scrollHeight;
      }
      if (dmEditorRef.current) {
        dmEditorRef.current.focus();
        const range = document.createRange();
        range.selectNodeContents(dmEditorRef.current);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }, 0);


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

  const messageHasMentionForMe = (msg: Message) => {
    if (!me || !msg.content || !msg.content.includes('data-mention-id')) return false;
    return msg.content.includes(`data-mention-id="${me.id}"`);
  };

  // ─── Mark channel as read ─────────────────────────────────
  const markChannelAsRead = (channelId: string) => {
    const now = new Date().toISOString();
    setLastReadMap(prev => ({ ...prev, [channelId]: now }));
    setUnreadCounts(prev => ({ ...prev, [channelId]: 0 }));
    setMentionCounts(prev => ({ ...prev, [channelId]: 0 }));
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

  // ─── Mentions ─────────────────────────────────────────────
  const mentionMembers = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    const pool = mentionDropdownFor === "dm"
      ? members.filter(m => m.user_id !== me?.id)
      : members;
    return pool
      .filter(m => m.profile?.full_name?.toLowerCase().includes(q))
      .slice(0, 6);
  }, [mentionQuery, mentionDropdownFor, members, me]);

  const insertMention = (member: Member, editorEl: HTMLDivElement) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    let node = range.startContainer;
    let offset = range.startOffset;

    // Find the @query text to replace
    const text = node.nodeType === Node.TEXT_NODE ? (node.textContent ?? "") : "";
    const atIndex = text.lastIndexOf("@", offset);
    if (atIndex === -1) return;

    // Delete the @query text
    const textRange = document.createRange();
    textRange.setStart(node, atIndex);
    textRange.setEnd(node, offset);
    textRange.deleteContents();

    // Create mention pill
    const span = document.createElement("span");
    span.setAttribute("data-mention-id", member.user_id);
    span.setAttribute("data-mention-name", member.profile?.full_name ?? "");
    span.contentEditable = "false";
    span.style.cssText = `
      color: #E01E5A;
      background: rgba(224,30,90,0.15);
      border-radius: 4px;
      padding: 1px 5px;
      font-weight: 600;
      font-size: 0.88em;
      cursor: default;
      user-select: none;
    `;
    span.textContent = `@${member.profile?.full_name}`;

    // Insert span then a space
    const space = document.createTextNode("\u00A0");
    range.insertNode(space);
    range.insertNode(span);

    // Move cursor after the space
    const newRange = document.createRange();
    newRange.setStartAfter(space);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);

    // Close dropdown
    setMentionQuery(null);
    setMentionDropdownFor(null);
    setMentionIndex(0);

    editorEl.focus();
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

  const doCreateChannel = async (creatorId: string) => {
    setCreatingChannel(true);
    const { data: chan, error } = await supabase
      .from("channels")
      .insert({
        workspace_id: workspaceId,
        name: newChannelName.trim(),
        description: newChannelDesc.trim() || null,
        is_private: newChannelPrivate,
        is_default: false,
        created_by: creatorId,
      })
      .select()
      .single();

    if (error) { setCreatingChannel(false); return; }

    if (chan) {
      if (!newChannelPrivate) {
        // Public channel — auto-add ALL workspace members
        const allMemberIds = members.map(m => m.user_id);
        const inserts = allMemberIds.map(uid => ({
          channel_id: chan.id,
          user_id: uid,
        }));
        await supabase.from("channel_members").insert(inserts);
      } else {
        // Private channel — only add the creator
        await supabase.from("channel_members").insert({
          channel_id: chan.id,
          user_id: creatorId,
        });
      }

      // System message
      await supabase.from("messages").insert({
        channel_id: chan.id,
        sender_id: creatorId,
        content: `${me?.full_name} created this channel.`,
        is_pinned: false,
        is_system: true,
      });

      setChannels(prev => [...prev, chan]);
      await switchChannel(chan);
    }
    setCreatingChannel(false);
    setShowCreateChannel(false);
    setNewChannelName(""); setNewChannelDesc(""); setNewChannelPrivate(false);
  };

  // ─── Create channel ───────────────────────────────────────
  const createChannel = async () => {
    if (!newChannelName.trim() || creatingChannel || !me || !workspace) return;
    await doCreateChannel(me.id);
  };



  const leaveChannel = async () => {
    if (!activeChannel || !me || activeChannel.is_default) return;

    await supabase
      .from("channel_members")
      .delete()
      .eq("channel_id", activeChannel.id)
      .eq("user_id", me.id);

    // Remove from this user's sidebar only
    setChannels(prev => prev.filter(c => c.id !== activeChannel.id));
    setShowChannelSettings(false);

    // Silently switch to Lobby — no system message
    const lobby = channels.find(c => c.is_default);
    if (lobby) await switchChannel(lobby);
  };

  // ─── Save channel settings ────────────────────────────────
  const saveChannelSettings = async () => {
    if (!activeChannel || !editChannelName.trim()) return;
    setSavingChannel(true);

    const { data: updated } = await supabase
      .from("channels")
      .update({
        name: editChannelName.trim(),
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

  const ChannelIcon = ({ channel, size = 14 }: { channel: Channel; size?: number }) => {
    if (channel.is_default) {
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
          <polyline points="9 21 9 12 15 12 15 21" />
        </svg>
      );
    }
    if (channel.is_private) {
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      );
    }
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    );
  };

  const execFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value ?? undefined);
  };

  const applyRichFormat = (
    type: string,
    editorEl: HTMLDivElement | null,
    setter: (v: string) => void
  ) => {
    if (!editorEl) return;
    editorEl.focus();

    switch (type) {
      case 'bold': execFormat('bold'); break;
      case 'italic': execFormat('italic'); break;
      case 'underline': execFormat('underline'); break;
      case 'strike': execFormat('strikeThrough'); break;
      case 'ul': execFormat('insertUnorderedList'); break;
      case 'ol': execFormat('insertOrderedList'); break;
      case 'blockquote': {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) break;
        const range = sel.getRangeAt(0);
        const selected = range.toString() || 'Quote';
        const bq = document.createElement('blockquote');
        bq.style.cssText = 'border-left:3px solid #E01E5A;padding-left:10px;margin:4px 0;color:var(--text-muted);font-style:italic;';
        bq.textContent = selected;
        range.deleteContents();
        range.insertNode(bq);
        sel.removeAllRanges();
        break;
      }
      case 'code': {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) break;
        const range = sel.getRangeAt(0);
        const selected = range.toString() || 'code';
        const code = document.createElement('code');
        code.style.cssText = 'background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.12);border-radius:4px;padding:1px 6px;font-family:monospace;font-size:0.87em;color:#e06c75;';
        code.textContent = selected;
        range.deleteContents();
        range.insertNode(code);
        const newRange = document.createRange();
        newRange.setStartAfter(code);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
        break;
      }
    }
    setTimeout(() => setter(editorEl.innerHTML), 0);
  };

  const confirmLinkInsert = () => {
    if (!linkModalUrl.trim()) return;
    const isChannel = linkModalTarget === 'channel';
    const editorEl = isChannel ? editorRef.current : dmEditorRef.current;
    const setter = isChannel ? setNewMessage : setDmNewMessage;
    if (!editorEl) return;

    editorEl.focus();
    const url = linkModalUrl.trim().startsWith('http') ? linkModalUrl.trim() : `https://${linkModalUrl.trim()}`;
    const displayText = linkModalText.trim() || url;
    execFormat('createLink', url);

    setTimeout(() => {
      const links = editorEl.querySelectorAll('a');
      links.forEach(a => {
        a.style.color = '#E01E5A';
        a.style.textDecoration = 'underline';
        a.target = '_blank';
        if (!a.textContent || a.textContent === url) a.textContent = displayText;
      });
      setter(editorEl.innerHTML);
    }, 0);

    setShowLinkModal(false);
    setLinkModalText('');
    setLinkModalUrl('');
  };

  const AttachmentBlock = ({ url, name, type }: { url: string; name: string; type: 'image' | 'file' }) => {
    const handleDownload = async (e: React.MouseEvent) => {
      e.preventDefault();
      try {
        const res = await fetch(url, { mode: 'cors' });
        const blob = await res.blob();
        const fixedBlob = new Blob([blob], { type: blob.type });
        const blobUrl = URL.createObjectURL(fixedBlob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = name;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          if (document.body.contains(a)) document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
        }, 150);
      } catch {
        window.open(url, '_blank');
      }
    };

    if (type === 'image') return (
      <div style={{ marginTop: 8 }}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <img
              src={url}
              alt={name}
              style={{ maxWidth: 320, maxHeight: 240, borderRadius: 10, display: 'block', border: '1px solid var(--border-color)', cursor: 'pointer', objectFit: 'cover' }}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          </a>
          <button
            onClick={handleDownload}
            title="Download"
            style={{ position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: 7, padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, color: '#fff', fontSize: '0.72rem', fontWeight: 600, backdropFilter: 'blur(4px)' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download
          </button>
        </div>
      </div>
    );

    const ext = name.split('.').pop()?.toUpperCase() ?? 'FILE';
    return (
      <div
        onClick={handleDownload}
        style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 10, backgroundColor: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '8px 14px', cursor: 'pointer', maxWidth: 280 }}
      >
        <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(224,30,90,0.12)', border: '1px solid rgba(224,30,90,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E01E5A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" />
          </svg>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{ext} · Click to download</div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </div>
    );
  };

  const FormattingToolbar = ({
    textareaEl,
    setter,
  }: {
    textareaEl: HTMLDivElement | null;
    setter: (v: string) => void;
  }) => {
    const [activeFormats, setActiveFormats] = useState({
      bold: false,
      italic: false,
      underline: false,
      strike: false,
    });

    // Poll document.queryCommandState to sync active format indicators
    useEffect(() => {
      const update = () => {
        try {
          setActiveFormats({
            bold: document.queryCommandState('bold'),
            italic: document.queryCommandState('italic'),
            underline: document.queryCommandState('underline'),
            strike: document.queryCommandState('strikeThrough'),
          });
        } catch { }
      };

      document.addEventListener('selectionchange', update);
      return () => document.removeEventListener('selectionchange', update);
    }, []);

    const btn = (
      label: ReactNode,
      title: string,
      format: 'bold' | 'italic' | 'underline' | 'strike',
      extraStyle?: React.CSSProperties
    ) => {
      const isActive = activeFormats[format];
      return (
        <button
          title={title}
          onMouseDown={(e) => {
            e.preventDefault(); // prevent editor losing focus
            applyRichFormat(format, textareaEl, setter);
            // Toggle local state immediately for snappy feedback
            setActiveFormats(prev => ({ ...prev, [format]: !prev[format] }));
          }}
          style={{
            background: isActive ? 'rgba(224,30,90,0.15)' : 'none',
            border: isActive ? '1px solid rgba(224,30,90,0.35)' : '1px solid transparent',
            color: isActive ? '#E01E5A' : 'var(--text-muted)',
            cursor: 'pointer',
            padding: '3px 7px',
            borderRadius: 5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.78rem',
            fontWeight: 700,
            transition: 'all 0.15s',
            minWidth: 26,
            height: 26,
            ...extraStyle,
          }}
        >
          {label}
        </button>
      );
    };

    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '4px 8px',
        borderBottom: '1px solid var(--border-color)',
      }}>
        {btn(<strong>B</strong>, 'Bold (Ctrl+B)', 'bold')}
        {btn(<em>I</em>, 'Italic (Ctrl+I)', 'italic', { fontStyle: 'italic' })}
        {btn(<span style={{ textDecoration: 'underline', textUnderlineOffset: 2 }}>U</span>, 'Underline (Ctrl+U)', 'underline')}
        {btn(<span style={{ textDecoration: 'line-through' }}>S</span>, 'Strikethrough', 'strike')}
      </div>
    );
  };


  const renderInline = (text: string): React.ReactNode => {
    if (!text) return null;

    const nodes: React.ReactNode[] = [];
    let i = 0;
    const len = text.length;

    while (i < len) {
      if (text[i] === '`') {
        const end = text.indexOf('`', i + 1);
        if (end !== -1) {
          nodes.push(
            <code key={i} style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 4,
              padding: '1px 6px',
              fontFamily: 'monospace',
              fontSize: '0.87em',
              color: '#e06c75',
            }}>{text.slice(i + 1, end)}</code>
          );
          i = end + 1;
          continue;
        }
      }

      if (text.slice(i, i + 3) === '***') {
        const end = text.indexOf('***', i + 3);
        if (end !== -1) {
          nodes.push(<strong key={i}><em>{text.slice(i + 3, end)}</em></strong>);
          i = end + 3;
          continue;
        }
      }

      // __underline__
      if (text.slice(i, i + 2) === '__') {
        const end = text.indexOf('__', i + 2);
        if (end !== -1) {
          nodes.push(
            <span key={i} style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>
              {text.slice(i + 2, end)}
            </span>
          );
          i = end + 2;
          continue;
        }
      }

      if (text.slice(i, i + 2) === '**') {
        const end = text.indexOf('**', i + 2);
        if (end !== -1) {
          nodes.push(<strong key={i} style={{ fontWeight: 700 }}>{text.slice(i + 2, end)}</strong>);
          i = end + 2;
          continue;
        }
      }

      if (text.slice(i, i + 2) === '~~') {
        const end = text.indexOf('~~', i + 2);
        if (end !== -1) {
          nodes.push(
            <span key={i} style={{ textDecoration: 'line-through', opacity: 0.6 }}>
              {text.slice(i + 2, end)}
            </span>
          );
          i = end + 2;
          continue;
        }
      }

      if (text.slice(i, i + 3) === '<u>') {
        const end = text.indexOf('</u>', i + 3);
        if (end !== -1) {
          nodes.push(
            <span key={i} style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>
              {text.slice(i + 3, end)}
            </span>
          );
          i = end + 4;
          continue;
        }
      }

      if (text[i] === '_' && i + 1 < len) {
        const end = text.indexOf('_', i + 1);
        if (end !== -1 && end > i + 1) {
          nodes.push(<em key={i}>{text.slice(i + 1, end)}</em>);
          i = end + 1;
          continue;
        }
      }

      if (text[i] === '[') {
        const closeBracket = text.indexOf(']', i + 1);
        if (closeBracket !== -1 && text[closeBracket + 1] === '(') {
          const closeParen = text.indexOf(')', closeBracket + 2);
          if (closeParen !== -1) {
            const linkText = text.slice(i + 1, closeBracket);
            const linkUrl = text.slice(closeBracket + 2, closeParen);
            nodes.push(
              <a key={i} href={linkUrl} target="_blank" rel="noopener noreferrer"
                style={{ color: '#E01E5A', textDecoration: 'underline', textUnderlineOffset: 2 }}>
                {linkText}
              </a>
            );
            i = closeParen + 1;
            continue;
          }
        }
      }

      if (text.slice(i, i + 8) === 'https://' || text.slice(i, i + 7) === 'http://') {
        let end = i;
        while (end < len && !/[\s<>"')\]]/.test(text[end])) end++;
        const url = text.slice(i, end);
        nodes.push(
          <a key={i} href={url} target="_blank" rel="noopener noreferrer"
            style={{ color: '#E01E5A', textDecoration: 'underline', textUnderlineOffset: 2 }}>
            {url}
          </a>
        );
        i = end;
        continue;
      }

      let j = i + 1;
      while (j < len) {
        const c = text[j];
        if (c === '`' || c === '*' || c === '_' || c === '~' || c === '<' || c === '[' || c === 'h') break;
        j++;
      }
      nodes.push(text.slice(i, j));
      i = j;
    }

    return nodes.length > 0 ? <>{nodes}</> : text;
  };

  const formatMessageContent = (content: string, msgId?: string): React.ReactNode => {
    if (!content) return null;

    // HTML content (from sanitizeHtml) — render directly
    if (/<[a-z][\s\S]*>/i.test(content)) {
      return (
        <span
          style={{ wordBreak: 'break-word', lineHeight: 1.6 }}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      );
    }

    // Legacy plain text — render with line breaks
    const lines = content.split('\n');
    return (
      <span style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
        {lines.map((line, i) => (
          <span key={i}>
            {renderInline(line)}
            {i < lines.length - 1 && <br />}
          </span>
        ))}
      </span>
    );
  };

  // Everyone can manage a channel if it's active
  const canManageChannel = !!activeChannel;

  // ─── Loading screen ───────────────────────────────────────
  if (loading || checking) return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader2 size={28} color="#E01E5A" className="animate-spin" />
    </div>
  );

  const isLobby = activeChannel?.is_default;
  const pinnedMessages = messages.filter(m => m.is_pinned);

  const scrollToMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Flash highlight
    const originalBg = el.style.backgroundColor;
    el.style.transition = 'background 0.3s';
    el.style.backgroundColor = 'rgba(224,30,90,0.15)';
    setTimeout(() => {
      el.style.backgroundColor = originalBg;
    }, 1200);
  };

  const ReplyPreviewBar = ({
    senderName,
    content,
    onCancel,
  }: {
    senderName: string;
    content: string;
    onCancel: () => void;
  }) => {
    const plain = content.replace(/<[^>]+>/g, '').slice(0, 80);
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 14px',
        backgroundColor: 'var(--bg-hover)',
        borderTop: '1px solid var(--border-color)',
        borderLeft: '3px solid #E01E5A',
        borderRadius: '6px 6px 0 0',
        margin: '0 12px',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E01E5A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <polyline points="9 14 4 9 9 4" /><path d="M20 20v-7a4 4 0 0 0-4-4H4" />
        </svg>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#E01E5A', marginBottom: 1 }}>{senderName}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{plain || 'Attachment'}</div>
        </div>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex', alignItems: 'center', borderRadius: 4 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    );
  };

  const QuotedBlock = ({
    snapshot,
    originalId,
    onScrollTo,
  }: {
    snapshot: { senderName: string; content: string };
    originalId?: string | null;
    onScrollTo?: (id: string) => void;
  }) => {
    const plain = snapshot.content.replace(/<[^>]+>/g, '').slice(0, 100);
    return (
      <div
        onClick={() => originalId && onScrollTo?.(originalId)}
        style={{
          display: 'flex', gap: 0, marginBottom: 5,
          cursor: originalId ? 'pointer' : 'default',
          borderRadius: 6, overflow: 'hidden', maxWidth: 380, opacity: 0.9,
        }}
      >
        <div style={{ width: 3, backgroundColor: '#E01E5A', borderRadius: '3px 0 0 3px', flexShrink: 0 }} />
        <div style={{ flex: 1, backgroundColor: 'var(--bg-hover)', padding: '5px 10px', borderRadius: '0 6px 6px 0', border: '1px solid var(--border-color)', borderLeft: 'none' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#E01E5A', marginBottom: 2 }}>{snapshot.senderName}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{plain || 'Attachment'}</div>
        </div>
      </div>
    );
  };

  const ToastNotification = () => {
    if (!toast) return null;
    const colors = {
      error: { bg: 'rgba(224,30,90,0.12)', border: 'rgba(224,30,90,0.35)', icon: '#E01E5A', text: '#ff6b9d' },
      success: { bg: 'rgba(74,222,128,0.10)', border: 'rgba(74,222,128,0.30)', icon: '#4ade80', text: '#4ade80' },
      info: { bg: 'rgba(99,179,237,0.10)', border: 'rgba(99,179,237,0.30)', icon: '#63b3ed', text: '#63b3ed' },
    };
    const c = colors[toast.type];
    const icons = {
      error: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c.icon} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      ),
      success: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c.icon} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><polyline points="9 12 11 14 15 10" />
        </svg>
      ),
      info: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c.icon} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      ),
    };
    return (
      <div style={{
        position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
        zIndex: 99999, display: 'flex', alignItems: 'center', gap: 10,
        backgroundColor: c.bg,
        border: `1px solid ${c.border}`,
        backdropFilter: 'blur(12px)',
        borderRadius: 12, padding: '12px 18px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        maxWidth: 420, minWidth: 260,
        animation: 'toastIn 0.25s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <div style={{ flexShrink: 0 }}>{icons[toast.type]}</div>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.45, flex: 1 }}>
          {toast.message}
        </span>
        <button
          onClick={() => setToast(null)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', flexShrink: 0, display: 'flex', alignItems: 'center', marginLeft: 4 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>
    );
  };

  const MentionDropdown = ({
    editorRef,
    type,
  }: {
    editorRef: React.RefObject<HTMLDivElement | null>;
    type: "channel" | "dm";
  }) => {
    if (mentionQuery === null || mentionDropdownFor !== type || mentionMembers.length === 0) return null;

    const anchor = mentionAnchorRef.current;

    return ReactDOM.createPortal(
      <div
        ref={mentionDropdownRef}
        style={{
          position: "fixed",
          bottom: typeof window !== "undefined" ? window.innerHeight - anchor.top + 8 : 0,
          left: anchor.left,
          width: anchor.width,
          backgroundColor: "var(--bg-primary)",
          border: "1px solid var(--border-color)",
          borderRadius: 10,
          boxShadow: "0 -8px 32px rgba(0,0,0,0.4)",
          overflow: "hidden",
          zIndex: 99999,
          maxHeight: 320,
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "7px 12px 5px",
          fontSize: "0.7rem",
          fontWeight: 700,
          color: "var(--text-muted)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          borderBottom: "1px solid var(--border-color)",
          position: "sticky",
          top: 0,
          backgroundColor: "var(--bg-primary)",
          zIndex: 1,
        }}>
          Members — @{mentionQuery || "..."}
        </div>

        {mentionMembers.map((m, i) => (
          <div
            key={m.user_id}
            onMouseDown={e => {
              e.preventDefault();
              if (editorRef.current) insertMention(m, editorRef.current);
            }}
            onMouseEnter={() => setMentionIndex(i)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 12px",
              cursor: "pointer",
              backgroundColor: i === mentionIndex ? "rgba(224,30,90,0.1)" : "transparent",
              borderLeft: i === mentionIndex ? "2px solid #E01E5A" : "2px solid transparent",
              transition: "background 0.12s",
            }}
          >
            {m.profile?.avatar_url
              ? <img src={m.profile.avatar_url} style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} alt="" />
              : <div style={{ width: 28, height: 28, borderRadius: "50%", backgroundColor: "#E01E5A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.72rem", fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                {m.profile?.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) ?? "?"}
              </div>
            }
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {m.profile?.full_name}
              </div>
              {m.profile?.job_title && (
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.profile.job_title}</div>
              )}
            </div>
            {/* Online dot */}
            <div style={{ marginLeft: "auto" }}>
              <PresenceDot userId={m.user_id} size={8} borderColor="var(--bg-primary)" />
            </div>
          </div>
        ))}
      </div>,
      document.body
    );
  };

  // ─── RENDER ───────────────────────────────────────────────
  const resolvedLogoTheme = themeMode === 'system'
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : themeMode;

  return (
    <div
      data-theme={themeMode === "system" ? undefined : themeMode}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        backgroundColor: "var(--bg-primary)",
        color: "var(--text-primary)",
        fontFamily: "var(--font-geist-sans), -apple-system, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* ── TOP HEADER BAR ── */}
      <div style={{
        flexShrink: 0,
        height: 48,
        backgroundColor: "var(--bg-sidebar)",
        borderBottom: "1px solid var(--border-color)",
        display: "flex",
        alignItems: "center",
        paddingLeft: 16,
        paddingRight: 16,
        zIndex: 100,
      }}>
        <img
          src={resolvedLogoTheme === 'light'
            ? '/Logo_Standard_dark_transp.png'
            : '/Logo_Standard_light_transp.png'
          }
          alt="TrexaFlow"
          style={{
            height: 28,
            width: 'auto',
            objectFit: 'contain',
            userSelect: 'none',
          }}
        />
      </div>

      {/* ── MAIN AREA (sidebar + chat side by side) ── */}
      <div style={{
        flex: 1,
        display: "flex",
        overflow: "hidden",
        minHeight: 0,
      }}>

        {/* ══════════════════════════════════════════════════════
          SIDEBAR
      ══════════════════════════════════════════════════════ */}
        {/* ── SIDEBAR ROOT ── */}
        <div style={{
          width: 260, flexShrink: 0, display: "flex", flexDirection: "column",
          backgroundColor: "var(--bg-sidebar)",
          borderRight: "1px solid var(--border-color)",
          height: "100%", overflow: "hidden",
        }}>

          {/* 1. WORKSPACE HEADER — fixed top */}
          <div style={{ flexShrink: 0, padding: "0 14px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)" }}>
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
          </div>

          {/* 2. MIDDLE SECTION — split scrollable areas */}
          <div style={{
            flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0
          }}>

            {/* CHANNELS SECTION */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
              {/* Header row */}
              <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 12px 4px 18px" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Channels
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                  {/* Refresh */}
                  <div style={{ position: "relative" }}>
                    <button
                      onClick={refreshChannels}
                      disabled={refreshingChannels}
                      title="Refresh channel list"
                      style={{ background: "none", border: "none", cursor: refreshingChannels ? "not-allowed" : "pointer", color: channelListStale ? "#facc15" : "var(--text-muted)", padding: "2px 4px", borderRadius: 4, display: "flex", alignItems: "center", transition: "color 0.2s" }}
                      onMouseEnter={e => { if (!channelListStale) e.currentTarget.style.color = "var(--text-primary)"; }}
                      onMouseLeave={e => { if (!channelListStale) e.currentTarget.style.color = "var(--text-muted)"; }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: refreshingChannels ? "spin 0.7s linear infinite" : "none" }}>
                        <path d="M23 4v6h-6" /><path d="M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                      </svg>
                    </button>
                    {channelListStale && !refreshingChannels && <span style={{ position: "absolute", top: 1, right: 1, width: 6, height: 6, borderRadius: "50%", backgroundColor: "#facc15", border: "1.5px solid var(--bg-sidebar)", pointerEvents: "none" }} />}
                  </div>
                  {/* Plus */}
                  <button
                    onClick={() => setShowCreateChannel(true)}
                    title="Create channel"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "2px 4px", borderRadius: 4, display: "flex", alignItems: "center" }}
                    onMouseEnter={e => e.currentTarget.style.color = "var(--text-primary)"}
                    onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}
                  >
                    <Plus size={14} strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              {/* Scrollable list */}
              <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "4px 10px" }}>
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
                      <div style={{ color: isActive ? "#E01E5A" : "var(--text-muted)", display: "flex", alignItems: "center", flexShrink: 0 }}>
                        <ChannelIcon channel={ch} size={13} />
                      </div>
                      <span style={{ fontSize: "0.875rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: isActive || unread > 0 ? 600 : 400, flex: 1 }}>
                        {ch.name}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {mentionCounts[ch.id] > 0 && (
                          <div style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: '#E01E5A', color: '#fff', fontSize: '0.65rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            @
                          </div>
                        )}
                        {unread > 0 && (
                          <div style={{ minWidth: 18, height: 18, borderRadius: 999, backgroundColor: "#E01E5A", color: "#fff", fontSize: "0.68rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px", flexShrink: 0 }}>
                            {unread > 99 ? "99+" : unread}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* DIVIDER */}
            <div style={{ flexShrink: 0, height: 1, backgroundColor: 'var(--border-color)', margin: '4px 12px' }} />

            {/* DM SECTION */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
              {/* Header row */}
              <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 12px 4px 18px" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Direct Messages
                </span>
                {/* Refresh icon */}
                <div style={{ position: "relative" }}>
                  <button
                    onClick={refreshMembers}
                    disabled={refreshingMembers}
                    title="Refresh member list"
                    style={{ background: "none", border: "none", cursor: refreshingMembers ? "not-allowed" : "pointer", color: memberListStale ? "#facc15" : "var(--text-muted)", padding: "2px 4px", borderRadius: 4, display: "flex", alignItems: "center", transition: "color 0.2s" }}
                    onMouseEnter={e => { if (!memberListStale) e.currentTarget.style.color = "var(--text-primary)"; }}
                    onMouseLeave={e => { if (!memberListStale) e.currentTarget.style.color = "var(--text-muted)"; }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: refreshingMembers ? "spin 0.7s linear infinite" : "none" }}>
                      <path d="M23 4v6h-6" /><path d="M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                  </button>
                  {memberListStale && !refreshingMembers && <span style={{ position: "absolute", top: 1, right: 1, width: 6, height: 6, borderRadius: "50%", backgroundColor: "#facc15", border: "1.5px solid var(--bg-sidebar)", pointerEvents: "none" }} />}
                </div>
              </div>

              {/* Scrollable list */}
              <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "4px 10px" }}>
                {members.filter(m => m.user_id !== me?.id).map(m => {
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
            </div>
          </div>

          {/* 3. PROFILE INFO — fixed bottom */}
          <div style={{ flexShrink: 0, padding: "12px 10px", borderTop: "1px solid var(--border-color)" }}>
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
              <div style={{ color: activeChannel.is_private ? "var(--icon-color)" : "#E01E5A", display: "flex", alignItems: "center" }}>
                <ChannelIcon channel={activeChannel} size={15} />
              </div>
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
                  setEditChannelDesc(activeChannel.description ?? "");
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
                        <div style={{ color: "#E01E5A", display: "flex", alignItems: "center" }}>
                          <ChannelIcon channel={activeChannel} size={22} />
                        </div>
                      </div>
                      <div>
                        <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--text-primary)" }}>Welcome to {activeChannel?.name}!</h2>
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
                            {(() => {
                              const isOwner = m.user_id === workspace?.owner_id;
                              const roleLabel = isOwner ? "Owner" : m.role === "admin" ? "Admin" : null;
                              if (!roleLabel) return null;
                              return (
                                <span style={{ fontSize: "0.65rem", color: isOwner ? "#f59e0b" : "#E01E5A", fontWeight: 600 }}>
                                  {roleLabel}
                                </span>
                              );
                            })()}
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
                            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{formatMessageContent(msg.content, msg.id)}</span>
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
                        id={`msg-${msg.id}`}
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
                                id="edit-message-input"
                                name="edit-message"
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
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {msg.parent_snapshot && (
                                <QuotedBlock
                                  snapshot={msg.parent_snapshot}
                                  originalId={msg.parent_message_id}
                                  onScrollTo={scrollToMessage}
                                />
                              )}
                              {msg.content && (
                                <div style={{ fontSize: "0.88rem", color: "var(--text-primary)", margin: 0, lineHeight: 1.6, wordBreak: "break-word" }}>
                                  {formatMessageContent(msg.content, msg.id)}
                                </div>
                              )}
                              {msg.attachment_url && msg.attachment_name && msg.attachment_type && (
                                <AttachmentBlock
                                  url={msg.attachment_url}
                                  name={msg.attachment_name}
                                  type={msg.attachment_type as 'image' | 'file'}
                                />
                              )}
                            </div>
                          )}
                        </div>

                        {/* Message action toolbar */}
                        {hoveredMessage === msg.id && editingMessageId !== msg.id && (
                          <div ref={menuRef} style={{ position: "absolute", top: 4, right: 8, display: "flex", gap: 2, backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 8, padding: "2px", boxShadow: "0 4px 12px var(--shadow-color)", zIndex: 10 }}>
                            <button
                              title="Reply"
                              onClick={() => setReplyingTo(msg)}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-primary)", padding: "4px 6px", borderRadius: 6, display: "flex", alignItems: "center" }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--bg-hover)"}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="9 14 4 9 9 4" /><path d="M20 20v-7a4 4 0 0 0-4-4H4" />
                              </svg>
                            </button>
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
              <div style={{ padding: "0 20px 20px" }}>
                <div style={{ border: '1px solid var(--border-color)', borderRadius: 12, backgroundColor: 'var(--bg-input)', overflow: 'hidden' }}>

                  {/* Formatting toolbar — always visible */}
                  <FormattingToolbar
                    textareaEl={editorRef.current}
                    setter={setNewMessage}
                  />

                  {/* Reply preview */}
                  {replyingTo && (
                    <ReplyPreviewBar
                      senderName={replyingTo.sender?.full_name ?? 'Unknown'}
                      content={replyingTo.content}
                      onCancel={() => setReplyingTo(null)}
                    />
                  )}

                  {/* Editor + send button row */}
                  <div style={{ display: 'flex', alignItems: 'flex-end', padding: '4px 8px 8px', position: 'relative' }}>
                    <MentionDropdown editorRef={editorRef} type="channel" />

                    {/* Attachment preview */}
                    {attachmentFile && (
                      <div style={{ padding: '6px 12px 0', display: 'flex', alignItems: 'center', gap: 8, width: '100%', position: 'absolute', bottom: '100%', left: 0, backgroundColor: 'var(--bg-input)', borderTop: '1px solid var(--border-color)', zIndex: 5 }}>
                        {attachmentPreview
                          ? <img src={attachmentPreview} alt="preview" style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border-color)' }} />
                          : <div style={{ display: 'flex', alignItems: 'center', gap: 7, backgroundColor: 'var(--bg-hover)', borderRadius: 7, padding: '5px 10px', border: '1px solid var(--border-color)' }}>
                            <Paperclip size={13} color="#E01E5A" />
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachmentFile.name}</span>
                          </div>
                        }
                        <button onClick={() => { setAttachmentFile(null); setAttachmentBytes(null); setAttachmentPreview(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', alignItems: 'center' }}><X size={13} /></button>
                      </div>
                    )}
                    <input ref={channelFileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleAttachPick(f, setAttachmentFile, setAttachmentBytes, setAttachmentPreview, showToast); e.target.value = ''; }} />

                    <button
                      onClick={() => channelFileInputRef.current?.click()}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: attachmentFile ? "#E01E5A" : "var(--text-muted)", padding: '7px 10px', display: 'flex', alignItems: 'center', transition: 'all 0.15s', flexShrink: 0, marginRight: 4 }}
                      onMouseEnter={e => e.currentTarget.style.color = "var(--text-primary)"}
                      onMouseLeave={e => e.currentTarget.style.color = attachmentFile ? "#E01E5A" : "var(--text-muted)"}
                    >
                      <Paperclip size={18} />
                    </button>

                    <div
                      ref={editorRef}
                      contentEditable
                      suppressContentEditableWarning
                      onInput={() => {
                        const html = editorRef.current?.innerHTML ?? '';
                        newMessageRef.current = html;
                        const isEmpty = !html || html === '<br>';
                        if (isEmpty !== isNewMessageEmpty) setIsNewMessageEmpty(isEmpty);

                        // Mention detection
                        const sel = window.getSelection();
                        if (sel && sel.rangeCount > 0) {
                          const range = sel.getRangeAt(0);
                          const node = range.startContainer;
                          if (node.nodeType === Node.TEXT_NODE) {
                            const text = node.textContent ?? '';
                            const offset = range.startOffset;
                            const atIndex = text.lastIndexOf('@', offset);
                            if (atIndex !== -1 && (atIndex === 0 || /\s/.test(text[atIndex - 1]))) {
                              const query = text.slice(atIndex + 1, offset);
                              if (!query.includes(' ')) {
                                setMentionQuery(query);
                                setMentionDropdownFor('channel');
                                setMentionIndex(0);

                                const editorEl = editorRef.current;
                                if (editorEl) {
                                  const rect = editorEl.getBoundingClientRect();
                                  mentionAnchorRef.current = {
                                    top: rect.top,
                                    left: rect.left,
                                    width: rect.width,
                                  };
                                }
                                return;
                              }
                            }
                          }
                        }
                        setMentionQuery(null);
                        setMentionDropdownFor(null);
                      }}
                      onKeyDown={(e) => {
                        // Mention dropdown keyboard nav
                        if (mentionQuery !== null && mentionDropdownFor === 'channel' && mentionMembers.length > 0) {
                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setMentionIndex(i => Math.min(i + 1, mentionMembers.length - 1));
                            return;
                          }
                          if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setMentionIndex(i => Math.max(i - 1, 0));
                            return;
                          }
                          if (e.key === 'Enter' || e.key === 'Tab') {
                            e.preventDefault();
                            if (editorRef.current) insertMention(mentionMembers[mentionIndex], editorRef.current);
                            return;
                          }
                          if (e.key === 'Escape') {
                            setMentionQuery(null);
                            setMentionDropdownFor(null);
                            return;
                          }
                        }

                        if (e.ctrlKey || e.metaKey) {
                          if (e.key === 'b') { e.preventDefault(); applyRichFormat('bold', editorRef.current, setNewMessage); return; }
                          if (e.key === 'i') { e.preventDefault(); applyRichFormat('italic', editorRef.current, setNewMessage); return; }
                          if (e.key === 'u') { e.preventDefault(); applyRichFormat('underline', editorRef.current, setNewMessage); return; }
                        }
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      onPaste={(e) => {
                        e.preventDefault();
                        const html = e.clipboardData.getData('text/html');
                        const plain = e.clipboardData.getData('text/plain');
                        let cleaned = '';
                        if (html) {
                          const tmp = document.createElement('div');
                          tmp.innerHTML = html;
                          cleaned = cleanPastedHtml(tmp);
                        } else {
                          cleaned = plain.split('\n').map(line => `<div>${line || '<br>'}</div>`).join('');
                        }
                        document.execCommand('insertHTML', false, cleaned);
                        setNewMessage((e.currentTarget as HTMLDivElement).innerHTML);
                      }}
                      data-placeholder={`Message ${activeChannel?.name ?? ''}...`}
                      style={{
                        flex: 1,
                        minHeight: 36,
                        maxHeight: 160,
                        overflowY: 'auto',
                        outline: 'none',
                        color: 'var(--text-primary)',
                        fontSize: '0.92rem',
                        lineHeight: 1.6,
                        wordBreak: 'break-word',
                        paddingTop: 6,
                        paddingRight: 6,
                      }}
                    />
                    <button
                      onClick={sendMessage}
                      disabled={(!attachmentFile && isNewMessageEmpty) || sending || uploading}
                      style={{
                        background: (!isNewMessageEmpty || attachmentFile) ? '#E01E5A' : 'rgba(255,255,255,0.06)',
                        border: 'none',
                        borderRadius: 7,
                        color: (!isNewMessageEmpty || attachmentFile) ? '#fff' : 'var(--text-muted)',
                        cursor: (!isNewMessageEmpty || attachmentFile) ? 'pointer' : 'not-allowed',
                        padding: '7px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        transition: 'all 0.15s',
                        flexShrink: 0,
                        marginLeft: 6,
                      }}
                    >
                      {sending ? <Loader2 size={16} className="animate-spin" /> : (
                        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                          <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                      )}
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
                        id={`msg-${msg.id}`}
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
                                id="dm-edit-message-input"
                                name="dm-edit-message"
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
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {msg.parent_snapshot && (
                                <QuotedBlock
                                  snapshot={msg.parent_snapshot}
                                  originalId={msg.parent_message_id}
                                  onScrollTo={scrollToMessage}
                                />
                              )}
                              {msg.content && (
                                <div style={{ fontSize: "0.88rem", color: "var(--text-primary)", margin: 0, lineHeight: 1.6, wordBreak: "break-word" }}>
                                  {formatMessageContent(msg.content, msg.id)}
                                </div>
                              )}
                              {msg.attachment_url && msg.attachment_name && msg.attachment_type && (
                                <AttachmentBlock
                                  url={msg.attachment_url}
                                  name={msg.attachment_name}
                                  type={msg.attachment_type as 'image' | 'file'}
                                />
                              )}
                            </div>
                          )}
                        </div>

                        {/* DM message action toolbar */}
                        {dmHoveredMessage === msg.id && dmEditingMessageId !== msg.id && (
                          <div ref={dmMenuRef} style={{ position: "absolute", top: 4, right: 8, display: "flex", gap: 2, backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 8, padding: "2px", boxShadow: "0 4px 12px var(--shadow-color)", zIndex: 10 }}>
                            <button
                              title="Reply"
                              onClick={() => setDmReplyingTo({ ...msg, senderName: msg.sender_id === me?.id ? (me?.full_name ?? 'You') : (activeDmUser?.full_name ?? 'User') })}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px 6px", borderRadius: 6, display: "flex", alignItems: "center" }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--bg-hover)"}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="9 14 4 9 9 4" /><path d="M20 20v-7a4 4 0 0 0-4-4H4" />
                              </svg>
                            </button>
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
              <div style={{ padding: "0 20px 20px" }}>
                <div style={{ border: '1px solid var(--border-color)', borderRadius: 12, backgroundColor: 'var(--bg-input)', overflow: 'hidden' }}>

                  <FormattingToolbar
                    textareaEl={dmEditorRef.current}
                    setter={setDmNewMessage}
                  />

                  {/* DM Reply preview */}
                  {dmReplyingTo && (
                    <ReplyPreviewBar
                      senderName={dmReplyingTo.senderName ?? 'Unknown'}
                      content={dmReplyingTo.content}
                      onCancel={() => setDmReplyingTo(null)}
                    />
                  )}

                  <div style={{ display: 'flex', alignItems: 'flex-end', padding: '4px 8px 8px', position: 'relative' }}>
                    <MentionDropdown editorRef={dmEditorRef} type="dm" />

                    {/* Attachment preview (DM) */}
                    {dmAttachmentFile && (
                      <div style={{ padding: '6px 12px 0', display: 'flex', alignItems: 'center', gap: 8, width: '100%', position: 'absolute', bottom: '100%', left: 0, backgroundColor: 'var(--bg-input)', borderTop: '1px solid var(--border-color)', zIndex: 5 }}>
                        {dmAttachmentPreview
                          ? <img src={dmAttachmentPreview} alt="preview" style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border-color)' }} />
                          : <div style={{ display: 'flex', alignItems: 'center', gap: 7, backgroundColor: 'var(--bg-hover)', borderRadius: 7, padding: '5px 10px', border: '1px solid var(--border-color)' }}>
                            <Paperclip size={13} color="#E01E5A" />
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dmAttachmentFile.name}</span>
                          </div>
                        }
                        <button onClick={() => { setDmAttachmentFile(null); setDmAttachmentBytes(null); setDmAttachmentPreview(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', alignItems: 'center' }}><X size={13} /></button>
                      </div>
                    )}
                    <input ref={dmFileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleAttachPick(f, setDmAttachmentFile, setDmAttachmentBytes, setDmAttachmentPreview, showToast); e.target.value = ''; }} />

                    <button
                      onClick={() => dmFileInputRef.current?.click()}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: dmAttachmentFile ? "#E01E5A" : "var(--text-muted)", padding: '7px 10px', display: 'flex', alignItems: 'center', transition: 'all 0.15s', flexShrink: 0, marginRight: 4 }}
                      onMouseEnter={e => e.currentTarget.style.color = "var(--text-primary)"}
                      onMouseLeave={e => e.currentTarget.style.color = dmAttachmentFile ? "#E01E5A" : "var(--text-muted)"}
                    >
                      <Paperclip size={18} />
                    </button>
                    <div
                      ref={dmEditorRef}
                      contentEditable
                      suppressContentEditableWarning
                      onInput={() => {
                        const html = dmEditorRef.current?.innerHTML ?? '';
                        dmNewMessageRef.current = html;
                        const isEmpty = !html || html === '<br>';
                        if (isEmpty !== isDmNewMessageEmpty) setIsDmNewMessageEmpty(isEmpty);

                        // Mention detection
                        const sel = window.getSelection();
                        if (sel && sel.rangeCount > 0) {
                          const range = sel.getRangeAt(0);
                          const node = range.startContainer;
                          if (node.nodeType === Node.TEXT_NODE) {
                            const text = node.textContent ?? '';
                            const offset = range.startOffset;
                            const atIndex = text.lastIndexOf('@', offset);
                            if (atIndex !== -1 && (atIndex === 0 || /\s/.test(text[atIndex - 1]))) {
                              const query = text.slice(atIndex + 1, offset);
                              setMentionQuery(query);
                              setMentionDropdownFor('dm');
                              setMentionIndex(0);

                              const editorEl = dmEditorRef.current;
                              if (editorEl) {
                                const rect = editorEl.getBoundingClientRect();
                                mentionAnchorRef.current = {
                                  top: rect.top,
                                  left: rect.left,
                                  width: rect.width,
                                };
                              }
                              return;
                            }
                          }
                        }
                        setMentionQuery(null);
                        setMentionDropdownFor(null);
                      }}
                      onKeyDown={(e) => {
                        // Mention dropdown keyboard nav
                        if (mentionQuery !== null && mentionDropdownFor === 'dm' && mentionMembers.length > 0) {
                          if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setMentionIndex(i => Math.min(i + 1, mentionMembers.length - 1));
                            return;
                          }
                          if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setMentionIndex(i => Math.max(i - 1, 0));
                            return;
                          }
                          if (e.key === 'Enter' || e.key === 'Tab') {
                            e.preventDefault();
                            if (dmEditorRef.current) insertMention(mentionMembers[mentionIndex], dmEditorRef.current);
                            return;
                          }
                          if (e.key === 'Escape') {
                            setMentionQuery(null);
                            setMentionDropdownFor(null);
                            return;
                          }
                        }

                        if (e.ctrlKey || e.metaKey) {
                          if (e.key === 'b') { e.preventDefault(); applyRichFormat('bold', dmEditorRef.current, setDmNewMessage); return; }
                          if (e.key === 'i') { e.preventDefault(); applyRichFormat('italic', dmEditorRef.current, setDmNewMessage); return; }
                          if (e.key === 'u') { e.preventDefault(); applyRichFormat('underline', dmEditorRef.current, setDmNewMessage); return; }
                        }
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendDmMessage();
                        }
                      }}
                      onPaste={(e) => {
                        e.preventDefault();
                        const html = e.clipboardData.getData('text/html');
                        const plain = e.clipboardData.getData('text/plain');
                        let cleaned = '';
                        if (html) {
                          const tmp = document.createElement('div');
                          tmp.innerHTML = html;
                          cleaned = cleanPastedHtml(tmp);
                        } else {
                          cleaned = plain.split('\n').map(line => `<div>${line || '<br>'}</div>`).join('');
                        }
                        document.execCommand('insertHTML', false, cleaned);
                        setDmNewMessage((e.currentTarget as HTMLDivElement).innerHTML);
                      }}
                      data-placeholder={`Message ${activeDmUser?.full_name ?? ''}...`}
                      style={{
                        flex: 1,
                        minHeight: 36,
                        maxHeight: 160,
                        overflowY: 'auto',
                        outline: 'none',
                        color: 'var(--text-primary)',
                        fontSize: '0.92rem',
                        lineHeight: 1.6,
                        wordBreak: 'break-word',
                        paddingTop: 6,
                        paddingRight: 6,
                      }}
                    />
                    <button
                      onClick={sendDmMessage}
                      disabled={(!dmAttachmentFile && isDmNewMessageEmpty) || dmSending || dmUploading}
                      style={{
                        background: (!isDmNewMessageEmpty || dmAttachmentFile) ? "#E01E5A" : "rgba(255,255,255,0.06)",
                        border: "none",
                        borderRadius: 7,
                        color: (!isDmNewMessageEmpty || dmAttachmentFile) ? "#fff" : "var(--text-muted)",
                        cursor: (!isDmNewMessageEmpty || dmAttachmentFile) ? "pointer" : "not-allowed",
                        padding: "7px 10px",
                        display: "flex",
                        alignItems: "center",
                        transition: "all 0.15s",
                        flexShrink: 0,
                        marginLeft: 6,
                      }}
                    >
                      {dmSending ? <Loader2 size={16} className="animate-spin" /> : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                      )}
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
            onClick={e => { if (e.target === e.currentTarget) { setShowWorkspaceInfo(false); setEditingWorkspace(false); setShowLeaveConfirm(false); } }}
            style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, backdropFilter: "blur(4px)", padding: 20, animation: "fadeIn 0.15s ease" }}
          >
            <div style={{ backgroundColor: "var(--bg-secondary)", borderRadius: 16, width: "100%", maxWidth: 480, boxShadow: "0 24px 64px rgba(0,0,0,0.4)", border: "1px solid var(--border-color)", overflow: "hidden", animation: "slideUp 0.2s ease" }}>

              {/* Banner */}
              <div style={{ height: 80, background: "var(--banner-gradient)", position: "relative" }}>
                <button
                  onClick={() => { setShowWorkspaceInfo(false); setEditingWorkspace(false); setShowLeaveConfirm(false); }}
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

                    {/* Leave workspace */}
                    {!showLeaveConfirm ? (
                      <button
                        onClick={() => setShowLeaveConfirm(true)}
                        style={{ width: "100%", padding: "10px", borderRadius: 9, border: "1px solid rgba(248,113,113,0.25)", backgroundColor: "transparent", color: "#f87171", fontSize: "0.88rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, transition: "all 0.15s", marginTop: 4 }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = "rgba(248,113,113,0.08)"}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                      >
                        <LogOut size={15} /> Leave Workspace
                      </button>
                    ) : (
                      <div style={{ marginTop: 4, padding: "14px", borderRadius: 10, border: "1px solid rgba(248,113,113,0.25)", backgroundColor: "rgba(248,113,113,0.05)" }}>
                        <p style={{ fontSize: "0.85rem", color: "var(--text-primary)", fontWeight: 600, marginBottom: 4 }}>
                          Leave this workspace?
                        </p>
                        <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.5 }}>
                          You'll lose access to all channels and messages. You can only rejoin with the workspace code.
                        </p>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={leaveWorkspace}
                            style={{ flex: 1, padding: "9px", borderRadius: 8, border: "none", backgroundColor: "#f87171", color: "#fff", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "opacity 0.15s" }}
                            onMouseEnter={e => e.currentTarget.style.opacity = "0.88"}
                            onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                          >
                            <LogOut size={14} /> Yes, leave
                          </button>
                          <button
                            onClick={() => setShowLeaveConfirm(false)}
                            style={{ flex: 1, padding: "9px", borderRadius: 8, border: "1px solid var(--border-color)", backgroundColor: "transparent", color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--bg-hover)"}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
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
                        <input
                          ref={wsEditImageInputRef}
                          id="workspace-image-upload"
                          name="workspace-image"
                          type="file"
                          accept="image/*"
                          style={{ display: "none" }}
                          onChange={e => { const f = e.target.files?.[0]; if (!f) return; setWsEditImageFile(f); setWsEditImagePreview(URL.createObjectURL(f)); }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Name</label>
                      <input
                        id="workspace-name"
                        name="workspace-name"
                        value={wsEditName}
                        onChange={e => setWsEditName(e.target.value)}
                        style={{ width: "100%", padding: "9px 12px", backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", borderRadius: 8, color: "var(--text-primary)", fontSize: "0.9rem", outline: "none" }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Description</label>
                      <textarea
                        id="workspace-description"
                        name="workspace-description"
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
                        <input
                          ref={profileEditImageInputRef}
                          id="profile-avatar-upload"
                          name="avatar-image"
                          type="file"
                          accept="image/*"
                          style={{ display: "none" }}
                          onChange={e => { const f = e.target.files?.[0]; if (!f) return; setProfileEditImageFile(f); setProfileEditImagePreview(URL.createObjectURL(f)); }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Full Name</label>
                      <input
                        id="profile-fullname"
                        name="fullname"
                        value={profileEditName}
                        onChange={e => setProfileEditName(e.target.value)}
                        style={{ width: "100%", padding: "9px 12px", backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", borderRadius: 8, color: "var(--text-primary)", fontSize: "0.9rem", outline: "none" }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Role / Title</label>
                      <input
                        id="profile-jobtitle"
                        name="jobtitle"
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
                      id="channel-name"
                      name="channel-name"
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
                    id="channel-desc-new"
                    name="channel-desc"
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
                  {(() => {
                    const isOwner = showMemberProfile.user_id === workspace?.owner_id;
                    const roleLabel = isOwner ? "Owner" : showMemberProfile.role === "admin" ? "Admin" : "Member";
                    const roleColor = isOwner ? "#f59e0b" : showMemberProfile.role === "admin" ? "#E01E5A" : "var(--text-muted)";
                    const roleBg = isOwner ? "rgba(245,158,11,0.1)" : showMemberProfile.role === "admin" ? "rgba(224,30,90,0.1)" : "var(--bg-hover)";
                    return (
                      <span style={{ marginLeft: 6, fontSize: "0.72rem", fontWeight: 700, color: roleColor, backgroundColor: roleBg, padding: "2px 8px", borderRadius: 999 }}>
                        {roleLabel}
                      </span>
                    );
                  })()}
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
                    {/* Channel name — read-only for non-managers */}
                    <div>
                      <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Channel Name</label>
                      <input
                        id="channel-name-edit"
                        name="channel-name"
                        value={editChannelName}
                        onChange={e => setEditChannelName(e.target.value)}
                        placeholder="e.g. design-feedback"
                        onKeyDown={e => { if (e.key === 'Enter') saveChannelSettings() }}
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          backgroundColor: 'var(--bg-tertiary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 8,
                          color: 'var(--text-primary)',
                          fontSize: '0.9rem',
                          outline: 'none',
                        }}
                        onFocus={e => e.currentTarget.style.borderColor = '#E01E5A'}
                        onBlur={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                      />
                    </div>

                    {!isLobby && (
                      <>
                        <div>
                          <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Description <span style={{ fontWeight: 400, textTransform: "none" }}>(optional)</span></label>
                          <textarea
                            id="channel-desc-edit"
                            name="channel-desc"
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
                          <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "#f87171", marginBottom: 10 }}>Deleting this channel will removes all members and messages on it. Cant be restored again.</p>
                          <button
                            onClick={() => setShowDeleteChannelConfirm(true)}
                            style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(248,113,113,0.3)", backgroundColor: "transparent", color: "#f87171", fontSize: "0.84rem", fontWeight: 500, cursor: "pointer", transition: "all 0.15s" }}
                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(248,113,113,0.08)"; }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}
                          ><Trash2 size={14} /> Delete this channel</button>
                        </div>
                      </>
                    )}

                    {/* Leave channel — ALWAYS visible to all, except Lobby */}
                    {!isLobby && (
                      <button
                        onClick={leaveChannel}
                        style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 14px", borderRadius: 8, border: "1px solid var(--border-color)", backgroundColor: "transparent", color: "var(--text-muted)", fontSize: "0.84rem", fontWeight: 500, cursor: "pointer", transition: "all 0.15s", width: "100%" }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--bg-hover)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}
                      >
                        <LogOut size={14} /> Leave Channel
                      </button>
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
                        {!isLobby && m.user_id !== me?.id && (
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
                    {!isLobby && nonChannelMembers.length > 0 && (
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


        {/* Link Insert Modal */}
        {showLinkModal && (
          <div
            onClick={() => setShowLinkModal(false)}
            style={{
              position: "fixed", inset: 0, zIndex: 1000,
              backgroundColor: "rgba(0,0,0,0.5)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: "var(--bg-primary, #1a1d21)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12,
                padding: "24px 28px",
                width: 380,
                boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
              }}
            >
              <h3 style={{ margin: "0 0 18px", fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                Insert Link
              </h3>

              {/* Link text */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 6, fontWeight: 500 }}>
                  Display Text
                </label>
                <input
                  type="text"
                  placeholder="Link label"
                  value={linkModalText}
                  onChange={(e) => setLinkModalText(e.target.value)}
                  autoFocus
                  style={{
                    width: "100%", padding: "9px 12px",
                    backgroundColor: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8, color: "var(--text-primary)",
                    fontSize: "0.9rem", outline: "none", boxSizing: "border-box",
                  }}
                  onFocus={(e) => e.target.style.borderColor = "#E01E5A"}
                  onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
                />
              </div>

              {/* URL */}
              <div style={{ marginBottom: 22 }}>
                <label style={{ display: "block", fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 6, fontWeight: 500 }}>
                  URL
                </label>
                <input
                  type="url"
                  placeholder="https://example.com"
                  value={linkModalUrl}
                  onChange={(e) => setLinkModalUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmLinkInsert();
                    if (e.key === "Escape") setShowLinkModal(false);
                  }}
                  style={{
                    width: "100%", padding: "9px 12px",
                    backgroundColor: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8, color: "var(--text-primary)",
                    fontSize: "0.9rem", outline: "none", boxSizing: "border-box",
                  }}
                  onFocus={(e) => e.target.style.borderColor = "#E01E5A"}
                  onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
                />
              </div>

              {/* Buttons */}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  onClick={() => setShowLinkModal(false)}
                  style={{
                    padding: "8px 18px", borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "none", color: "var(--text-muted)",
                    fontSize: "0.88rem", cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmLinkInsert}
                  disabled={!linkModalUrl.trim()}
                  style={{
                    padding: "8px 20px", borderRadius: 8,
                    backgroundColor: linkModalUrl.trim() ? "#E01E5A" : "rgba(255,255,255,0.06)",
                    border: "none",
                    color: linkModalUrl.trim() ? "#fff" : "var(--text-muted)",
                    fontSize: "0.88rem", fontWeight: 600,
                    cursor: linkModalUrl.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  Insert
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── GLOBAL ANIMATION KEYFRAMES ── */}
        <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes fadeSlideDown { from { opacity: 0; transform: translateY(-6px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(12px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        [contenteditable][data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: var(--text-faint, rgba(255,255,255,0.25));
          pointer-events: none;
          position: absolute;
        }
        [contenteditable][data-placeholder]:empty {
          position: relative;
        }
        [contenteditable] {
          font-family: var(--font-geist-sans), -apple-system, sans-serif !important;
          font-size: 0.92rem !important;
          color: var(--text-primary) !important;
          line-height: 1.6 !important;
          background: transparent !important;
        }
        [contenteditable] span,
        [contenteditable] p,
        [contenteditable] div,
        [contenteditable] li,
        [contenteditable] h1,
        [contenteditable] h2,
        [contenteditable] h3,
        [contenteditable] blockquote,
        [contenteditable] pre {
          font-family: inherit !important;
          font-size: inherit !important;
          color: inherit !important;
          background: transparent !important;
          line-height: inherit !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        [contenteditable] strong,
        [contenteditable] b { font-weight: 700; }
        [contenteditable] em,
        [contenteditable] i { font-style: italic; }
        [contenteditable] u { text-decoration: underline; text-underline-offset: 3px; }
        [contenteditable] s,
        [contenteditable] strike { text-decoration: line-through; opacity: 0.65; }
      `}</style>

        {showDeleteChannelConfirm && (
          <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, backdropFilter: 'blur(4px)',
          }}>
            <div style={{
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 14,
              padding: '28px 28px 24px',
              width: 380,
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}>
              {/* Icon */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: 'rgba(224,30,90,0.12)', border: '1px solid rgba(224,30,90,0.25)', display: 'flex', alignItems: 'center', justifyContent: "center" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E01E5A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                </div>
              </div>

              {/* Title */}
              <h3 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center' }}>
                Delete #{activeChannel?.name}?
              </h3>

              {/* Description */}
              <p style={{ margin: '0 0 24px', fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
                This will permanently delete the channel and <strong style={{ color: 'var(--text-primary)' }}>all its messages</strong>. This action cannot be undone.
              </p>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setShowDeleteChannelConfirm(false)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--border-color)',
                    backgroundColor: 'transparent', color: 'var(--text-primary)',
                    fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setShowDeleteChannelConfirm(false);
                    setShowChannelSettings(false);
                    await deleteChannel();
                  }}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 8, border: 'none',
                    backgroundColor: '#E01E5A', color: '#fff',
                    fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Delete Channel
                </button>
              </div>
            </div>
          </div>
        )}

      </div> {/* end main area */}

      <ToastNotification />
    </div> /* end root column wrapper */
  ); /* end return */
} /* end WorkspacePage */