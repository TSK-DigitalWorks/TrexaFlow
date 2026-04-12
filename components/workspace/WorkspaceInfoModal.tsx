'use client';

import React, { useState } from 'react';
import {
  Info,
  X,
  Hash,
  MessageCircle,
  FolderKanban,
  CheckSquare2,
  Milestone,
  Shield,
  Crown,
  User,
  Lock,
  Globe,
  Plus,
  Pencil,
  Trash2,
  UserPlus,
  UserMinus,
  Pin,
  Bell,
  ChevronRight,
  Check,
} from 'lucide-react';

type Tab = 'overview' | 'channels' | 'dms' | 'projects' | 'roles';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview',  label: 'Overview',  icon: <Info size={15} /> },
  { id: 'channels',  label: 'Channels',  icon: <Hash size={15} /> },
  { id: 'dms',       label: 'Direct Messages', icon: <MessageCircle size={15} /> },
  { id: 'projects',  label: 'Projects',  icon: <FolderKanban size={15} /> },
  { id: 'roles',     label: 'Roles & Permissions', icon: <Shield size={15} /> },
];

// Permission matrix data
const PERMISSIONS = {
  channels: [
    { action: 'Create public channel',  admin: true,  member: false },
    { action: 'Create private channel', admin: true,  member: false },
    { action: 'Edit channel info',      admin: true,  member: false },
    { action: 'Delete channel',         admin: true,  member: false },
    { action: 'Add members to private', admin: true,  member: false },
    { action: 'Remove members',         admin: true,  member: false },
    { action: 'Send messages',          admin: true,  member: true  },
    { action: 'Pin messages',           admin: true,  member: false },
    { action: 'Edit own messages',      admin: true,  member: true  },
    { action: 'Delete own messages',    admin: true,  member: true  },
    { action: 'Delete any message',     admin: true,  member: false },
  ],
  dms: [
    { action: 'Start a DM with anyone', admin: true,  member: true  },
    { action: 'Send messages',          admin: true,  member: true  },
    { action: 'Edit own messages',      admin: true,  member: true  },
    { action: 'Delete own messages',    admin: true,  member: true  },
    { action: 'Mark as unread',         admin: true,  member: true  },
    { action: 'Reply in thread',        admin: true,  member: true  },
    { action: 'Attach files',           admin: true,  member: true  },
  ],
  projects: [
    { action: 'Create project',         admin: true,  member: false },
    { action: 'Edit project settings',  admin: true,  member: false },
    { action: 'Delete project',         admin: true,  member: false },
    { action: 'Add project members',    admin: true,  member: false },
    { action: 'Remove project members', admin: true,  member: false },
    { action: 'Create tasks',           admin: true,  member: true  },
    { action: 'Edit any task',          admin: true,  member: false },
    { action: 'Edit own tasks',         admin: true,  member: true  },
    { action: 'Delete any task',        admin: true,  member: false },
    { action: 'Create milestones',      admin: true,  member: false },
    { action: 'Submit milestone work',  admin: true,  member: true  },
    { action: 'Review & approve work',  admin: true,  member: false },
    { action: 'Request changes',        admin: true,  member: false },
    { action: 'Send project messages',  admin: true,  member: true  },
  ],
};

function PermCheck({ allowed }: { allowed: boolean }) {
  return allowed ? (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 22, height: 22, borderRadius: '50%',
      background: 'rgba(34,197,94,0.12)', color: '#22c55e',
    }}>
      <Check size={13} strokeWidth={2.5} />
    </span>
  ) : (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 22, height: 22, borderRadius: '50%',
      background: 'rgba(239,68,68,0.1)', color: '#ef4444',
    }}>
      <X size={13} strokeWidth={2.5} />
    </span>
  );
}

function PermTable({ rows }: { rows: { action: string; admin: boolean; member: boolean }[] }) {
  return (
    <div style={{
      border: '1px solid var(--border-color)',
      borderRadius: 10,
      overflow: 'hidden',
      marginTop: 12,
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--bg-secondary)' }}>
            <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', width: '60%' }}>
              Action
            </th>
            <th style={{ padding: '9px 10px', textAlign: 'center', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#E01E5A', width: '20%' }}>
              Admin
            </th>
            <th style={{ padding: '9px 10px', textAlign: 'center', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', width: '20%' }}>
              Member
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{
              borderTop: '1px solid var(--border-color)',
              background: i % 2 === 0 ? 'transparent' : 'var(--bg-secondary)',
            }}>
              <td style={{ padding: '8px 14px', fontSize: 13, color: 'var(--text-primary)' }}>
                {row.action}
              </td>
              <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                <PermCheck allowed={row.admin} />
              </td>
              <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                <PermCheck allowed={row.member} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Tab content panels ──────────────────────────────────────────────────────

function OverviewTab() {
  const features = [
    {
      icon: <Hash size={18} />,
      color: '#3b82f6',
      bg: 'rgba(59,130,246,0.1)',
      title: 'Channels',
      desc: 'Organised topic-based spaces for team conversations. Public channels are open to all workspace members; private channels are invite-only.',
    },
    {
      icon: <MessageCircle size={18} />,
      color: '#8b5cf6',
      bg: 'rgba(139,92,246,0.1)',
      title: 'Direct Messages',
      desc: 'Private 1-on-1 conversations between any two workspace members with full realtime messaging, file attachments, and reply threads.',
    },
    {
      icon: <FolderKanban size={18} />,
      color: '#E01E5A',
      bg: 'rgba(224,30,90,0.1)',
      title: 'Projects',
      desc: 'Dedicated workspaces for initiatives. Each project has its own task board, milestone tracker, dedicated chat, and member roster.',
    },
    {
      icon: <CheckSquare2 size={18} />,
      color: '#22c55e',
      bg: 'rgba(34,197,94,0.1)',
      title: 'Tasks',
      desc: 'Work items within a project with status, priority, assignee, due date, and a full submission & review workflow.',
    },
    {
      icon: <Milestone size={18} />,
      color: '#7c3aed',
      bg: 'rgba(124,58,237,0.1)',
      title: 'Milestones',
      desc: 'Key deliverables that require work submission and admin approval before being marked complete. Full revision cycle included.',
    },
  ];

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 20 }}>
        TrexaFlow is a unified team communication and project management workspace. Here's a quick overview of every major feature.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {features.map((f, i) => (
          <div key={i} style={{
            display: 'flex', gap: 14, alignItems: 'flex-start',
            padding: '14px 16px',
            background: 'var(--bg-secondary)',
            borderRadius: 10,
            border: '1px solid var(--border-color)',
          }}>
            <span style={{
              width: 36, height: 36, borderRadius: 9, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: f.bg, color: f.color,
            }}>
              {f.icon}
            </span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)', marginBottom: 3 }}>
                {f.title}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {f.desc}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChannelsTab() {
  return (
    <div>
      {/* Visual diagram */}
      <div style={{
        background: 'var(--bg-secondary)', borderRadius: 10,
        border: '1px solid var(--border-color)', padding: '16px 18px', marginBottom: 16,
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>
          Channel Types
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { icon: <Globe size={15} />, label: 'Public Channel', color: '#3b82f6', badge: 'Open to all', desc: 'Any workspace member can join, read, and post.' },
            { icon: <Lock size={15} />, label: 'Private Channel', color: '#E01E5A', badge: 'Invite only', desc: 'Only invited members can see and participate.' },
          ].map((t, i) => (
            <div key={i} style={{
              padding: '12px 14px', borderRadius: 8,
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                <span style={{ color: t.color }}>{t.icon}</span>
                <span style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--text-primary)' }}>{t.label}</span>
              </div>
              <span style={{
                fontSize: 10.5, fontWeight: 600, padding: '2px 7px',
                borderRadius: 99, background: `${t.color}18`, color: t.color,
                display: 'inline-block', marginBottom: 6,
              }}>{t.badge}</span>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{t.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Feature chips */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
          Features
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {[
            { icon: <Pin size={12} />, label: 'Pin messages' },
            { icon: <Bell size={12} />, label: 'Unread badges' },
            { icon: <UserPlus size={12} />, label: 'Member management' },
            { icon: <Pencil size={12} />, label: 'Edit messages' },
            { icon: <Trash2 size={12} />, label: 'Delete messages' },
            { icon: <MessageCircle size={12} />, label: 'Reply threads' },
          ].map((c, i) => (
            <span key={i} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '5px 10px', borderRadius: 99,
              background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
              fontSize: 12, color: 'var(--text-secondary)',
            }}>
              {c.icon} {c.label}
            </span>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
        Permissions
      </div>
      <PermTable rows={PERMISSIONS.channels} />
    </div>
  );
}

function DMsTab() {
  return (
    <div>
      <div style={{
        background: 'var(--bg-secondary)', borderRadius: 10,
        border: '1px solid var(--border-color)', padding: '16px 18px', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <span style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(139,92,246,0.1)', color: '#8b5cf6',
          }}>
            <MessageCircle size={20} />
          </span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)', marginBottom: 4 }}>
              Direct Messages
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Private 1-on-1 real-time conversations between workspace members. DMs are only visible to the two participants and are completely separate from channels and projects.
            </p>
          </div>
        </div>
      </div>

      {/* DM flow illustration */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '14px 0', marginBottom: 14 }}>
        <div style={{
          padding: '8px 16px', borderRadius: 99,
          background: 'rgba(139,92,246,0.1)', color: '#8b5cf6',
          fontSize: 12.5, fontWeight: 600,
          border: '1px solid rgba(139,92,246,0.2)',
        }}>
          You
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Realtime</span>
        </div>
        <div style={{
          padding: '8px 16px', borderRadius: 99,
          background: 'rgba(139,92,246,0.1)', color: '#8b5cf6',
          fontSize: 12.5, fontWeight: 600,
          border: '1px solid rgba(139,92,246,0.2)',
        }}>
          Teammate
        </div>
      </div>

      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
        Capabilities
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
        {[
          'Real-time message delivery with Supabase Realtime',
          'File & image attachments (via Cloudinary, max 7.5 MB)',
          'Reply to specific messages in thread',
          'Edit and delete your own messages',
          'Mark conversation as unread to revisit later',
          'Unread count badge in sidebar',
          'Online/offline presence indicators',
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: 'var(--text-secondary)' }}>
            <Check size={13} style={{ color: '#22c55e', flexShrink: 0, marginTop: 2 }} />
            {item}
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
        Permissions
      </div>
      <PermTable rows={PERMISSIONS.dms} />
    </div>
  );
}

function ProjectsTab() {
  const taskStatuses = [
    { label: 'Open',               color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
    { label: 'Active',             color: '#3b82f6', bg: 'rgba(59,130,246,0.1)'  },
    { label: 'In Review',          color: '#f59e0b', bg: 'rgba(245,158,11,0.1)'  },
    { label: 'Changes Requested',  color: '#ef4444', bg: 'rgba(239,68,68,0.1)'   },
    { label: 'Complete',           color: '#22c55e', bg: 'rgba(34,197,94,0.1)'   },
  ];
  const priorities = [
    { label: 'Low',    color: '#6b7280' },
    { label: 'Medium', color: '#3b82f6' },
    { label: 'High',   color: '#f59e0b' },
    { label: 'Urgent', color: '#ef4444' },
  ];

  return (
    <div>
      {/* Project types */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {[
          { icon: <Globe size={15} />, label: 'Public Project', color: '#E01E5A', desc: 'Visible to all workspace members.' },
          { icon: <Lock size={15} />, label: 'Private Project', color: '#7c3aed', desc: 'Only added members can see it.' },
        ].map((t, i) => (
          <div key={i} style={{
            padding: '12px 14px', borderRadius: 9,
            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
              <span style={{ color: t.color }}>{t.icon}</span>
              <span style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--text-primary)' }}>{t.label}</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t.desc}</p>
          </div>
        ))}
      </div>

      {/* Task types */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 9 }}>
          Work Item Types
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{
            flex: 1, padding: '11px 13px', borderRadius: 8,
            background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.18)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
              <CheckSquare2 size={15} style={{ color: '#3b82f6' }} />
              <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>Task</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Standard work item. Can be assigned, tracked, and completed directly.
            </p>
          </div>
          <div style={{
            flex: 1, padding: '11px 13px', borderRadius: 8,
            background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.18)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
              <Milestone size={15} style={{ color: '#7c3aed' }} />
              <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>Milestone</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Key deliverable requiring work submission + admin approval to complete.
            </p>
          </div>
        </div>
      </div>

      {/* Status flow */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 9 }}>
          Status Flow
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          {taskStatuses.map((s, i) => (
            <React.Fragment key={i}>
              <span style={{
                padding: '4px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600,
                background: s.bg, color: s.color, whiteSpace: 'nowrap',
              }}>
                {s.label}
              </span>
              {i < taskStatuses.length - 1 && (
                <ChevronRight size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Priority */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 9 }}>
          Priority Levels
        </div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {priorities.map((p, i) => (
            <span key={i} style={{
              padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600,
              background: `${p.color}15`, color: p.color,
              border: `1px solid ${p.color}30`,
            }}>
              {p.label}
            </span>
          ))}
        </div>
      </div>

      {/* Milestone review flow */}
      <div style={{
        background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.15)',
        borderRadius: 9, padding: '12px 14px', marginBottom: 14,
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#7c3aed', marginBottom: 8 }}>
          Milestone Review Workflow
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { step: '1', label: 'Assignee submits work', sub: 'Text description + optional file attachment' },
            { step: '2', label: 'Admin reviews submission', sub: 'Approve or request changes with revision note' },
            { step: '3', label: 'If changes requested', sub: 'Assignee revises and resubmits (revision count tracked)' },
            { step: '4', label: 'Admin approves', sub: 'Status automatically set to Complete' },
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(124,58,237,0.15)', color: '#7c3aed',
                fontSize: 11, fontWeight: 700,
              }}>{s.step}</span>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>{s.label}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{s.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
        Permissions
      </div>
      <PermTable rows={PERMISSIONS.projects} />
    </div>
  );
}

function RolesTab() {
  return (
    <div>
      {/* Role cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
        {/* Admin */}
        <div style={{
          borderRadius: 10, overflow: 'hidden',
          border: '1px solid rgba(224,30,90,0.25)',
        }}>
          <div style={{
            padding: '12px 16px',
            background: 'rgba(224,30,90,0.07)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{
              width: 32, height: 32, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(224,30,90,0.12)', color: '#E01E5A',
            }}>
              <Crown size={16} />
            </span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)' }}>Admin</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Workspace owner or assigned administrator</div>
            </div>
            <span style={{
              marginLeft: 'auto', padding: '3px 10px', borderRadius: 99,
              fontSize: 11, fontWeight: 600,
              background: 'rgba(224,30,90,0.1)', color: '#E01E5A',
            }}>Full Access</span>
          </div>
          <div style={{ padding: '12px 16px', background: 'var(--bg-secondary)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {[
                'Create/edit/delete channels',
                'Manage channel members',
                'Create/delete projects',
                'Manage project members',
                'Create milestones',
                'Review & approve submissions',
                'Request changes',
                'Delete any message',
                'Pin messages',
                'Edit project settings',
                'Leave workspace',
              ].map((cap, i) => (
                <span key={i} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '3px 9px', borderRadius: 99,
                  background: 'rgba(224,30,90,0.07)', color: '#E01E5A',
                  fontSize: 11.5, border: '1px solid rgba(224,30,90,0.15)',
                }}>
                  <Check size={10} strokeWidth={3} />
                  {cap}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Member */}
        <div style={{
          borderRadius: 10, overflow: 'hidden',
          border: '1px solid var(--border-color)',
        }}>
          <div style={{
            padding: '12px 16px',
            background: 'var(--bg-secondary)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{
              width: 32, height: 32, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(99,102,241,0.1)', color: '#6366f1',
            }}>
              <User size={16} />
            </span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)' }}>Member</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Standard workspace participant</div>
            </div>
            <span style={{
              marginLeft: 'auto', padding: '3px 10px', borderRadius: 99,
              fontSize: 11, fontWeight: 600,
              background: 'rgba(99,102,241,0.1)', color: '#6366f1',
            }}>Standard Access</span>
          </div>
          <div style={{ padding: '12px 16px', background: 'var(--bg-primary)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {[
                'Send messages in channels',
                'Send direct messages',
                'Create tasks (in joined projects)',
                'Edit own messages',
                'Delete own messages',
                'Submit milestone work',
                'Reply in threads',
                'Attach files',
                'Leave workspace',
              ].map((cap, i) => (
                <span key={i} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '3px 9px', borderRadius: 99,
                  background: 'rgba(99,102,241,0.07)', color: '#6366f1',
                  fontSize: 11.5, border: '1px solid rgba(99,102,241,0.15)',
                }}>
                  <Check size={10} strokeWidth={3} />
                  {cap}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quick reference note */}
      <div style={{
        padding: '12px 14px', borderRadius: 9,
        background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)',
      }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
          <strong style={{ color: 'var(--text-primary)' }}>Note:</strong> Within a project, the <strong style={{ color: 'var(--text-primary)' }}>project creator</strong> always has admin-level control over that project regardless of their workspace role. Regular members can be granted project-level access but cannot manage the project itself.
        </div>
      </div>
    </div>
  );
}

// ─── Main modal ──────────────────────────────────────────────────────────────

export function WorkspaceInfoModal() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const renderTab = () => {
    switch (activeTab) {
      case 'overview':  return <OverviewTab />;
      case 'channels':  return <ChannelsTab />;
      case 'dms':       return <DMsTab />;
      case 'projects':  return <ProjectsTab />;
      case 'roles':     return <RolesTab />;
    }
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open TrexaFlow guide"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 8,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          color: 'var(--text-secondary)',
          fontSize: 12.5, fontWeight: 500,
          cursor: 'pointer',
          transition: 'all 150ms ease',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
          (e.currentTarget as HTMLElement).style.borderColor = '#E01E5A44';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)';
        }}
      >
        <Info size={14} style={{ color: '#E01E5A' }} />
        How TrexaFlow works
      </button>

      {/* Backdrop + modal */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 680,
              maxHeight: '88vh',
              display: 'flex', flexDirection: 'column',
              background: 'var(--bg-primary)',
              borderRadius: 14,
              border: '1px solid var(--border-color)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '18px 22px 0',
              borderBottom: '1px solid var(--border-color)',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    width: 34, height: 34, borderRadius: 9,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(224,30,90,0.1)', color: '#E01E5A',
                    flexShrink: 0,
                  }}>
                    <Info size={17} />
                  </span>
                  <div>
                    <h2 style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
                      TrexaFlow Guide
                    </h2>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                      Features, roles & permissions at a glance
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  style={{
                    width: 30, height: 30, borderRadius: 7,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)', cursor: 'pointer',
                    transition: 'all 150ms',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'}
                >
                  <X size={15} />
                </button>
              </div>

              {/* Tab bar */}
              <div style={{ display: 'flex', gap: 2, overflowX: 'auto', paddingBottom: 0 }}>
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '8px 12px',
                      borderRadius: '7px 7px 0 0',
                      fontSize: 12.5, fontWeight: activeTab === tab.id ? 600 : 500,
                      color: activeTab === tab.id ? '#E01E5A' : 'var(--text-secondary)',
                      background: activeTab === tab.id ? 'var(--bg-secondary)' : 'transparent',
                      borderBottom: activeTab === tab.id ? '2px solid #E01E5A' : '2px solid transparent',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 150ms',
                    }}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable body */}
            <div style={{
              flex: 1, overflowY: 'auto',
              padding: '20px 22px 24px',
            }}>
              {renderTab()}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
