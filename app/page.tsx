'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageSquare,
  Hash,
  FolderKanban,
  CheckSquare2,
  Milestone,
  Shield,
  ArrowRight,
  ChevronRight,
  Users,
  Zap,
  Lock,
  Globe,
  Send,
  FileText,
  GitPullRequest,
  CheckCircle2,
  RefreshCw,
  Layers,
  BarChart3,
  Workflow,
  BotMessageSquare,
  Plug,
  MonitorSmartphone,
  Moon,
  Sun,
  Play,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

// ─── Scroll reveal hook ───────────────────────────────────────────────────────
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; obs.disconnect(); } },
      { threshold: 0.12 }
    );
    el.style.opacity = '0';
    el.style.transform = 'translateY(28px)';
    el.style.transition = 'opacity 0.55s cubic-bezier(0.16,1,0.3,1), transform 0.55s cubic-bezier(0.16,1,0.3,1)';
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

function RevealDiv({ children, style, delay = 0 }: { children: React.ReactNode; style?: React.CSSProperties; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            if (el) { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; }
          }, delay);
          obs.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = `opacity 0.55s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.55s cubic-bezier(0.16,1,0.3,1) ${delay}ms`;
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);
  return <div ref={ref} style={style}>{children}</div>;
}


// ─── Pain point item ──────────────────────────────────────────────────────────
function PainItem({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 18px', borderBottom: '1px solid var(--border-color)' }}>
      <span style={{
        width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(239,68,68,0.1)', color: '#ef4444',
      }}>
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </span>
      <span style={{ fontSize: 14.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{text}</span>
    </div>
  );
}

// ─── Feature card ─────────────────────────────────────────────────────────────
function FeatureCard({ icon, title, points, delay = 0 }: {
  icon: React.ReactNode; title: string; points: string[]; delay?: number;
}) {
  const [hov, setHov] = useState(false);
  return (
    <RevealDiv delay={delay}>
      <div
        style={{
          padding: '22px 22px 24px',
          borderRadius: 14,
          height: '100%',
          border: `1px solid ${hov ? 'rgba(224,30,90,0.22)' : 'var(--border-color)'}`,
          background: hov ? 'var(--bg-secondary)' : 'var(--bg-primary)',
          transition: 'border-color 0.2s, background 0.2s, transform 0.2s, box-shadow 0.2s',
          transform: hov ? 'translateY(-3px)' : 'translateY(0)',
          boxShadow: hov ? '0 12px 40px var(--shadow-color)' : 'none',
          cursor: 'default',
          boxSizing: 'border-box',
        }}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
      >
        <div style={{
          width: 40, height: 40, borderRadius: 10, marginBottom: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(224,30,90,0.08)', color: '#E01E5A',
        }}>{icon}</div>
        <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text-primary)', marginBottom: 12 }}>{title}</div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
          {points.map((p, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <CheckCircle2 size={13} style={{ color: '#22c55e', flexShrink: 0, marginTop: 2 }} />
              {p}
            </li>
          ))}
        </ul>
      </div>
    </RevealDiv>
  );
}

// ─── Workflow step ────────────────────────────────────────────────────────────
function WorkflowStep({ n, icon, label, sub, last = false }: {
  n: number; icon: React.ReactNode; label: string; sub: string; last?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', flex: 1, minWidth: 120 }}>
      <div style={{
        width: 52, height: 52, borderRadius: 14, marginBottom: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(224,30,90,0.09)', border: '1px solid rgba(224,30,90,0.2)',
        color: '#E01E5A', position: 'relative', zIndex: 1,
      }}>
        {icon}
        <span style={{
          position: 'absolute', top: -6, right: -6,
          width: 18, height: 18, borderRadius: '50%',
          background: '#E01E5A', color: '#fff',
          fontSize: 10, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid var(--bg-secondary)',
        }}>{n}</span>
      </div>
      {!last && (
        <div style={{
          position: 'absolute', top: 26, left: 'calc(50% + 26px)',
          right: 'calc(-50% + 26px)', height: 1,
          background: 'linear-gradient(90deg, rgba(224,30,90,0.3), rgba(224,30,90,0.1))',
          zIndex: 0,
        }} />
      )}
      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', textAlign: 'center', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.5 }}>{sub}</div>
    </div>
  );
}

// ─── Use case card ────────────────────────────────────────────────────────────
function UseCaseCard({ icon, title, desc, delay = 0 }: { icon: React.ReactNode; title: string; desc: string; delay?: number }) {
  return (
    <RevealDiv delay={delay} style={{
      padding: '18px 20px', borderRadius: 12,
      border: '1px solid var(--border-color)',
      background: 'var(--bg-secondary)',
      display: 'flex', alignItems: 'flex-start', gap: 14,
    }}>
      <span style={{ color: '#E01E5A', flexShrink: 0, marginTop: 2 }}>{icon}</span>
      <div>
        <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{desc}</div>
      </div>
    </RevealDiv>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────
function SectionHeading({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  const ref = useReveal();
  return (
    <div ref={ref} style={{ textAlign: 'center', marginBottom: 52 }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 14px', borderRadius: 999, marginBottom: 16,
        background: 'rgba(224,30,90,0.08)', border: '1px solid rgba(224,30,90,0.18)',
        color: '#E01E5A', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>
        {eyebrow}
      </div>
      <h2 style={{
        fontSize: 'clamp(1.6rem, 2.8vw, 2.1rem)', fontWeight: 800,
        color: 'var(--text-primary)', letterSpacing: '-0.025em',
        lineHeight: 1.15, margin: '0 auto', maxWidth: 640,
      }}>{title}</h2>
      {sub && (
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', maxWidth: 520, margin: '14px auto 0', lineHeight: 1.7 }}>{sub}</p>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter();
  const [navScrolled, setNavScrolled] = useState(false);
  const [logoTheme, setLogoTheme] = useState<'light' | 'dark'>('dark');
  const [isMobile, setIsMobile] = useState(false);
  const howRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const handler = () => setNavScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);

    const getTheme = () => {
      const saved = document.documentElement.getAttribute('data-theme');
      if (saved === 'light' || saved === 'dark') {
        setLogoTheme(saved);
      } else {
        setLogoTheme(
          window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
        );
      }
    };
    getTheme();
    const observer = new MutationObserver(getTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // Listen for system theme changes if no override is set
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      const saved = localStorage.getItem('trexaflow_theme');
      if (!saved || (saved !== 'light' && saved !== 'dark')) {
        document.documentElement.setAttribute('data-theme', mediaQuery.matches ? 'dark' : 'light');
      }
    };
    mediaQuery.addEventListener('change', handleSystemChange);

    return () => {
      window.removeEventListener('scroll', handler);
      observer.disconnect();
      mediaQuery.removeEventListener('change', handleSystemChange);
    };
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: membership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();
      if (membership) router.push(`/workspace/${membership.workspace_id}`);
      else router.push('/onboarding');
    });
  }, [router]);

  const toggleTheme = () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('trexaflow_theme', next);
  };

  const featureSections = [
    {
      icon: <MessageSquare size={18} />, title: 'Smart Team Communication',
      points: ['Organised public & private channels', 'Direct 1-on-1 messaging', 'Threaded replies & rich text', 'File sharing & pinned messages'],
    },
    {
      icon: <FolderKanban size={18} />, title: 'Structured Project Execution',
      points: ['Create public or private projects', 'Assign tasks with deadlines & priorities', 'Track progress with real-time updates', 'Manage team roles per project'],
    },
    {
      icon: <CheckSquare2 size={18} />, title: 'Built for Accountability',
      points: ['Full task lifecycle: Create → Review → Done', 'Submission & approval system', 'Change request & rework tracking', 'Milestone-based execution flow'],
    },
    {
      icon: <Shield size={18} />, title: 'Secure & Controlled Access',
      points: ['Role-based workspace permissions', 'Admin & member controls', 'Private projects & channels', 'Workspace-level management'],
    },
  ];

  const useCases = [
    { icon: <Zap size={16} />, title: 'Startups & SaaS teams', desc: 'Move fast without losing context. Ship faster with structured execution.' },
    { icon: <Layers size={16} />, title: 'Agencies & service businesses', desc: 'Manage client deliverables with clear accountability and approval flows.' },
    { icon: <Globe size={16} />, title: 'Remote & distributed teams', desc: 'Stay aligned across time zones with async-first communication.' },
    { icon: <TrendingUp size={16} />, title: 'Product development teams', desc: 'Turn roadmap discussions directly into tracked, reviewable tasks.' },
  ];

  const whyPoints = [
    { icon: <RefreshCw size={15} />, text: 'No more context switching between tools' },
    { icon: <Zap size={15} />, text: 'Real-time collaboration built-in by default' },
    { icon: <GitPullRequest size={15} />, text: 'Native approval & revision workflows' },
    { icon: <FileText size={15} />, text: 'Every task has full conversation context' },
    { icon: <TrendingUp size={15} />, text: 'Scales gracefully from 2 to 200 members' },
  ];

  const upcoming = [
    { icon: <BotMessageSquare size={16} />, title: 'AI-powered insights', desc: 'Summarise threads, detect blockers, and surface what matters.' },
    { icon: <BarChart3 size={16} />, title: 'Advanced analytics', desc: 'Team velocity, project burndown, and milestone completion rates.' },
    { icon: <Plug size={16} />, title: 'Third-party integrations', desc: 'Connect your existing tools — GitHub, Slack, Notion, and more.' },
    { icon: <Workflow size={16} />, title: 'Workflow automation', desc: 'Auto-assign, auto-escalate, and trigger actions on task events.' },
  ];

  return (
    <div style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Navbar ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        height: 60,
        borderBottom: navScrolled ? '1px solid var(--border-color)' : '1px solid transparent',
        backgroundColor: navScrolled ? 'var(--bg-primary)' : 'transparent',
        backdropFilter: navScrolled ? 'blur(16px)' : 'none',
        transition: 'background 0.3s, border-color 0.3s, backdrop-filter 0.3s',
        display: 'flex', alignItems: 'center',
      }}>
        <div style={{ maxWidth: 1120, width: '100%', margin: '0 auto', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img
              src={logoTheme === 'light' ? '/LogoStandarddarktransp.png' : '/LogoStandardlighttransp.png'}
              alt="TrexaFlow"
              style={{ height: 28, width: 'auto', objectFit: 'contain', userSelect: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', gap: isMobile ? 4 : 8, alignItems: 'center' }}>
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                width: 34, height: 34, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-secondary)', transition: 'background 0.2s, color 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
              title="Toggle theme"
            >
              {logoTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {!isMobile && (
              <button
                onClick={() => router.push('/auth')}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', padding: '7px 16px', borderRadius: 8, transition: 'color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
              >
                Sign in
              </button>
            )}
            
            <button
              onClick={() => router.push('/auth')}
              style={{ 
                backgroundColor: '#E01E5A', color: '#fff', border: 'none', 
                fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', 
                padding: isMobile ? '7px 14px' : '7px 18px', 
                borderRadius: 8, transition: 'background 0.15s', 
                display: 'flex', alignItems: 'center', gap: 6 
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.backgroundColor = '#c8174f')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.backgroundColor = '#E01E5A')}
            >
              {isMobile ? 'Join' : 'Get Started'} {!isMobile && <ArrowRight size={14} />}
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ paddingTop: 140, paddingBottom: 110, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 720, height: 520, background: 'radial-gradient(ellipse at center, rgba(224,30,90,0.11) 0%, transparent 68%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', maxWidth: 860, margin: '0 auto', padding: '0 24px' }}>
          {/* Pill badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 16px',
            borderRadius: 999, marginBottom: 28,
            backgroundColor: 'rgba(224,30,90,0.08)', border: '1px solid rgba(224,30,90,0.2)',
            color: '#E01E5A', fontSize: 12, fontWeight: 600, letterSpacing: '0.04em',
          }}>
            <Sparkles size={12} />
            Built for teams that get things done
          </div>

          {/* Logo instead of text */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
            <img
              src={logoTheme === 'light' ? '/LogoStandarddarktransp.png' : '/LogoStandardlighttransp.png'}
              alt="TrexaFlow"
              style={{ height: 64, width: 'auto', objectFit: 'contain', userSelect: 'none' }}
            />
          </div>

          <h1 style={{
            fontSize: 'clamp(1.7rem, 3.2vw, 2.6rem)', fontWeight: 800,
            lineHeight: 1.15, letterSpacing: '-0.025em', marginBottom: 22,
            color: 'var(--text-primary)',
          }}>
            Where Conversations Turn Into Execution
          </h1>

          <p style={{ fontSize: 'clamp(1rem, 1.4vw, 1.1rem)', lineHeight: 1.75, color: 'var(--text-secondary)', maxWidth: 540, margin: '0 auto 36px' }}>
            TrexaFlow brings your team&apos;s chats, projects, and tasks into one unified system - so nothing gets lost, and everything gets done.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginBottom: 20 }}>
            <button
              onClick={() => router.push('/auth')}
              style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#E01E5A', color: '#fff', border: 'none', fontSize: '0.97rem', fontWeight: 700, cursor: 'pointer', padding: '13px 30px', borderRadius: 11, boxShadow: '0 0 36px rgba(224,30,90,0.28)', transition: 'background 0.15s, transform 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#c8174f'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#E01E5A'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
            >
              Get Started Free <ArrowRight size={16} />
            </button>
            <button
              onClick={() => howRef.current?.scrollIntoView({ behavior: 'smooth' })}
              style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.97rem', fontWeight: 500, cursor: 'pointer', padding: '13px 28px', borderRadius: 11, transition: 'all 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)'; }}
            >
              <Play size={14} style={{ color: '#E01E5A' }} /> See How It Works
            </button>
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            Free to get started · No credit card required
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginTop: 44 }}>
            {[
              { icon: <Hash size={13} />, label: 'Channels' },
              { icon: <MessageSquare size={13} />, label: 'Direct Messages' },
              { icon: <FolderKanban size={13} />, label: 'Projects' },
              { icon: <CheckSquare2 size={13} />, label: 'Tasks' },
              { icon: <Milestone size={13} />, label: 'Milestones' },
            ].map((b, i) => (
              <span key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 13px', borderRadius: 999,
                background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 500,
              }}>
                <span style={{ color: '#E01E5A' }}>{b.icon}</span>
                {b.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Problem ── */}
      <section style={{ padding: '90px 0', backgroundColor: 'var(--bg-secondary)' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto', padding: '0 28px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 52, alignItems: 'center' }}>
            <RevealDiv>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 13px',
                borderRadius: 999, marginBottom: 18,
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)',
                color: '#ef4444', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>
                The Problem
              </div>
              <h2 style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2rem)', fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.2, marginBottom: 14, color: 'var(--text-primary)' }}>
                Work is broken across too many tools
              </h2>
              <p style={{ fontSize: 14.5, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 400, marginBottom: 24 }}>
                Your team chats in one place, tracks tasks in another, and manages progress somewhere else. Important context gets lost. Deadlines slip.
              </p>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 8, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', fontSize: 13, color: '#ef4444', fontWeight: 600 }}>
                Sound familiar?
              </div>
            </RevealDiv>
            <RevealDiv delay={120}>
              <div style={{ borderRadius: 14, border: '1px solid var(--border-color)', background: 'var(--bg-primary)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#facc15' }} />
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} />
                  <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>Team Reality</span>
                </div>
                <div>
                  <PainItem text="Conversations don't translate into action" />
                  <PainItem text="Tasks lack context from the original discussion" />
                  <PainItem text="Constant switching between tools breaks focus" />
                  <PainItem text="No clear visibility on what's actually in progress" />
                </div>
              </div>
            </RevealDiv>
          </div>
        </div>
      </section>

      {/* ── Solution ── */}
      <section style={{ padding: '90px 0', backgroundColor: 'var(--bg-primary)' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto', padding: '0 28px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 52, alignItems: 'center' }}>
            <RevealDiv delay={100}>
              <div style={{ borderRadius: 14, border: '1px solid rgba(224,30,90,0.2)', background: 'rgba(224,30,90,0.04)', overflow: 'hidden' }}>
                {[
                  { icon: <MessageSquare size={15} />, text: 'Chat and tasks in one unified place' },
                  { icon: <Zap size={15} />, text: 'Real-time updates across the whole team' },
                  { icon: <CheckSquare2 size={15} />, text: 'Structured workflows with clear ownership' },
                  { icon: <GitPullRequest size={15} />, text: 'Everything connected — nothing lost' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 20px', borderBottom: i < 3 ? '1px solid rgba(224,30,90,0.1)' : 'none' }}>
                    <span style={{ color: '#E01E5A', flexShrink: 0 }}>{item.icon}</span>
                    <span style={{ fontSize: 13.5, color: 'var(--text-primary)', fontWeight: 500 }}>{item.text}</span>
                    <CheckCircle2 size={14} style={{ color: '#22c55e', marginLeft: 'auto', flexShrink: 0 }} />
                  </div>
                ))}
              </div>
            </RevealDiv>
            <RevealDiv>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 13px',
                borderRadius: 999, marginBottom: 18,
                background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)',
                color: '#22c55e', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>
                The Solution
              </div>
              <h2 style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2rem)', fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.2, marginBottom: 14, color: 'var(--text-primary)' }}>
                One platform. Complete workflow.
              </h2>
              <p style={{ fontSize: 14.5, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 400 }}>
                TrexaFlow connects communication and execution - so your team can move from discussion to delivery without friction.
              </p>
            </RevealDiv>
          </div>
        </div>
      </section>

      {/* ── Chat drives work (USP) ── */}
      <section style={{ padding: '90px 0', backgroundColor: 'var(--bg-secondary)' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 28px' }}>
          <SectionHeading
            eyebrow="Core USP"
            title="Chat that actually drives work"
            sub="TrexaFlow isn't just messaging - it's a live activity system where every conversation moves work forward."
          />
          <RevealDiv>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              {[
                { icon: <Users size={17} />, text: 'Task assignments appear instantly in the project chat' },
                { icon: <Send size={17} />, text: 'Submissions and updates are automatically logged' },
                { icon: <GitPullRequest size={17} />, text: 'Review requests and approvals happen in real time' },
                { icon: <ArrowRight size={17} />, text: 'Click any event message to jump directly to the task' },
              ].map((item, i) => (
                <div key={i} style={{
                  padding: '18px 18px 20px', borderRadius: 12,
                  background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                  display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                  <span style={{ color: '#E01E5A' }}>{item.icon}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{item.text}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 28, textAlign: 'center', fontSize: 14, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Your conversations become your workflow.
            </div>
          </RevealDiv>
        </div>
      </section>

      {/* ── Feature grid ── */}
      <section style={{ padding: '90px 0', backgroundColor: 'var(--bg-primary)' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto', padding: '0 28px' }}>
          <SectionHeading
            eyebrow="Features"
            title="Everything your team needs"
            sub="Communication, project management, and workflow tracking - tightly integrated, not bolted together."
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {featureSections.map((f, i) => (
              <FeatureCard key={i} icon={f.icon} title={f.title} points={f.points} delay={i * 70} />
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section ref={howRef} style={{ padding: '90px 0', backgroundColor: 'var(--bg-secondary)' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto', padding: '0 28px' }}>
          <SectionHeading
            eyebrow="Workflow"
            title="How work flows in TrexaFlow"
            sub="Simple. Structured. Transparent."
          />
          <RevealDiv>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center' }}>
              <WorkflowStep n={1} icon={<MessageSquare size={20} />} label="Start a conversation" sub="Discuss in a channel or DM" />
              <WorkflowStep n={2} icon={<CheckSquare2 size={20} />} label="Create a task" sub="Assign, set priority & due date" />
              <WorkflowStep n={3} icon={<Send size={20} />} label="Submit work" sub="Assignee submits for review" />
              <WorkflowStep n={4} icon={<GitPullRequest size={20} />} label="Review & iterate" sub="Approve or request changes" />
              <WorkflowStep n={5} icon={<CheckCircle2 size={20} />} label="Mark complete" sub="Logged in project chat" last />
            </div>
          </RevealDiv>
        </div>
      </section>

      {/* ── Use cases ── */}
      <section style={{ padding: '90px 0', backgroundColor: 'var(--bg-primary)' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 28px' }}>
          <SectionHeading
            eyebrow="Use Cases"
            title="Built for modern teams"
            sub="Whether you're building products or delivering services, TrexaFlow adapts to your workflow."
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {useCases.map((u, i) => (
              <UseCaseCard key={i} icon={u.icon} title={u.title} desc={u.desc} delay={i * 60} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Why TrexaFlow ── */}
      <section style={{ padding: '90px 0', backgroundColor: 'var(--bg-secondary)' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto', padding: '0 28px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 52, alignItems: 'center' }}>
            <RevealDiv>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 13px',
                borderRadius: 999, marginBottom: 18,
                background: 'rgba(224,30,90,0.08)', border: '1px solid rgba(224,30,90,0.2)',
                color: '#E01E5A', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>
                Differentiation
              </div>
              <h2 style={{ fontSize: 'clamp(1.5rem, 2.6vw, 2rem)', fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.2, marginBottom: 14, color: 'var(--text-primary)' }}>
                Why teams choose TrexaFlow
              </h2>
              <p style={{ fontSize: 14.5, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                Not another Slack clone. Not another project manager. A unified system built around how teams actually work.
              </p>
            </RevealDiv>
            <RevealDiv delay={100}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {whyPoints.map((w, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 13,
                    padding: '13px 16px', borderRadius: 10,
                    background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                  }}>
                    <span style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(224,30,90,0.08)', color: '#E01E5A',
                    }}>{w.icon}</span>
                    <span style={{ fontSize: 13.5, color: 'var(--text-primary)', fontWeight: 500 }}>{w.text}</span>
                  </div>
                ))}
              </div>
            </RevealDiv>
          </div>
        </div>
      </section>

      {/* ── UI/UX callout ──
      <section style={{ padding: '80px 0', backgroundColor: 'var(--bg-primary)' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 28px' }}>
          <RevealDiv>
            <div style={{
              borderRadius: 16, padding: '40px 44px',
              background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 28, alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#E01E5A', marginBottom: 10 }}>Designed for simplicity</div>
                <h3 style={{ fontSize: 'clamp(1.2rem, 2vw, 1.5rem)', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>Clean interface. Minimal learning curve.</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {[
                  { icon: <Moon size={14} />, text: 'Dark & light mode — synced to system preference' },
                  { icon: <MonitorSmartphone size={14} />, text: 'Fast, responsive, works on any screen' },
                  { icon: <Layers size={14} />, text: 'Intuitive sidebar layout with unread indicators' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-secondary)' }}>
                    <span style={{ color: '#E01E5A', flexShrink: 0 }}>{item.icon}</span>
                    {item.text}
                  </div>
                ))}
              </div>
            </div>
          </RevealDiv>
        </div>
      </section> */}

      {/* ── Future Vision ──
      <section style={{ padding: '90px 0', backgroundColor: 'var(--bg-secondary)' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto', padding: '0 28px' }}>
          <SectionHeading
            eyebrow="Roadmap"
            title="Built for what's next"
            sub="TrexaFlow is evolving. Here's what's coming."
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            {upcoming.map((u, i) => (
              <RevealDiv key={i} delay={i * 60} style={{
                padding: '18px 20px', borderRadius: 12,
                background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
                  <span style={{ color: '#E01E5A' }}>{u.icon}</span>
                  <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)' }}>{u.title}</span>
                  <span style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: 99, fontSize: 10.5, fontWeight: 700, background: 'rgba(224,30,90,0.08)', color: '#E01E5A', whiteSpace: 'nowrap' }}>Coming soon</span>
                </div>
                <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>{u.desc}</p>
              </RevealDiv>
            ))}
          </div>
        </div>
      </section> */}

      {/* ── Final CTA ── */}
      <section style={{ padding: '100px 0', backgroundColor: 'var(--bg-primary)' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 28px', textAlign: 'center' }}>
          <RevealDiv>
            <div style={{
              borderRadius: 20, padding: '64px 44px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)', width: 400, height: 300, background: 'radial-gradient(ellipse, rgba(224,30,90,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
              <div style={{ position: 'relative' }}>
                <h2 style={{ fontSize: 'clamp(1.6rem, 2.8vw, 2.1rem)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 14, lineHeight: 1.15, color: 'var(--text-primary)' }}>
                  Ready to simplify your workflow?
                </h2>
                <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 440, margin: '0 auto 32px' }}>
                  Join teams that are moving faster with clarity and control. Stop switching tools - start getting work done.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
                  <button
                    onClick={() => router.push('/auth')}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#E01E5A', color: '#fff', border: 'none', fontSize: '0.97rem', fontWeight: 700, cursor: 'pointer', padding: '13px 30px', borderRadius: 11, boxShadow: '0 0 40px rgba(224,30,90,0.3)', transition: 'background 0.15s, transform 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#c8174f'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#E01E5A'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
                  >
                    Get Started Free <ArrowRight size={16} />
                  </button>
                  <button
                    onClick={() => router.push('/auth')}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.97rem', fontWeight: 600, cursor: 'pointer', padding: '13px 26px', borderRadius: 11, transition: 'all 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
                  >
                    Create Your Workspace <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            </div>
          </RevealDiv>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid var(--border-color)', padding: '28px 28px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img
              src={logoTheme === 'light' ? '/LogoStandarddarktransp.png' : '/LogoStandardlighttransp.png'}
              alt="TrexaFlow"
              style={{ height: 22, width: 'auto', objectFit: 'contain', userSelect: 'none' }}
            />
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-faint)' }}>© 2026 TrexaFlow. All rights reserved.</span>
        </div>
      </footer>

    </div>
  );
}