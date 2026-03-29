"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare, Users, Lock, Zap,
  Bell, Search, Hash, ChevronRight, CheckCircle2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const features = [
  { icon: Hash, title: "Organized Channels", desc: "Create public or private channels for teams, projects, or topics. Keep every conversation in its right place." },
  { icon: MessageSquare, title: "Direct Messages", desc: "Reach any teammate instantly with 1:1 direct messages. Fast, focused, and always in context." },
  { icon: Users, title: "Workspaces", desc: "Each business gets its own workspace. Invite your team with a unique workspace ID — simple and secure." },
  { icon: Lock, title: "Private Channels", desc: "Sensitive discussions stay private. Control who sees what with channel-level privacy settings." },
  { icon: Zap, title: "Real-Time Messaging", desc: "Messages appear instantly across all devices. No refresh needed — TrexaFlow is always live." },
  { icon: Bell, title: "Smart Notifications", desc: "Get notified only when it matters. Unread badges keep you updated without the noise." },
  { icon: Search, title: "Member Directory", desc: "See who's online, browse workspace members, and view profiles with roles and status at a glance." },
  { icon: CheckCircle2, title: "Pinned Messages", desc: "Pin important announcements to any channel so critical info is never buried in the scroll." },
];

const steps = [
  { n: "01", title: "Create your account", desc: "Sign up with your email in seconds." },
  { n: "02", title: "Set up your workspace", desc: "Name your workspace and invite your team." },
  { n: "03", title: "Start communicating", desc: "Jump into channels or send a direct message." },
];

export default function LandingPage() {
  const router = useRouter();
  const featuresRef = useRef<HTMLElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: membership } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();
      if (membership) router.push(`/workspace/${membership.workspace_id}`);
      else router.push("/onboarding");
    });
  }, []);

  return (
    <div style={{ backgroundColor: "#0f1114", color: "#fff", minHeight: "100vh" }}>

      {/* ── Navbar ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        height: "64px", borderBottom: "1px solid rgba(255,255,255,0.07)",
        backgroundColor: "rgba(15,17,20,0.85)", backdropFilter: "blur(12px)",
        display: "flex", alignItems: "center",
      }}>
        <div style={{ maxWidth: "1140px", width: "100%", margin: "0 auto", padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: "#E01E5A", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MessageSquare size={17} color="#fff" />
            </div>
            <span style={{ fontWeight: 700, fontSize: "1.1rem", letterSpacing: "-0.02em" }}>TrexaFlow</span>
          </div>
          {/* Buttons */}
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => router.push("/auth")} style={{
              background: "transparent", border: "none", color: "rgba(255,255,255,0.55)",
              fontSize: "0.9rem", fontWeight: 500, cursor: "pointer", padding: "8px 16px", borderRadius: "8px",
            }}
              onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.55)")}
            >
              Sign in
            </button>
            <button onClick={() => router.push("/auth")} style={{
              backgroundColor: "#E01E5A", color: "#fff", border: "none",
              fontSize: "0.9rem", fontWeight: 600, cursor: "pointer",
              padding: "8px 20px", borderRadius: "8px",
            }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#c8174f")}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#E01E5A")}
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ paddingTop: "160px", paddingBottom: "120px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        {/* Glow */}
        <div style={{
          position: "absolute", top: "60px", left: "50%", transform: "translateX(-50%)",
          width: "680px", height: "480px", borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(224,30,90,0.13) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{ position: "relative", maxWidth: "860px", margin: "0 auto", padding: "0 24px" }}>
          {/* Pill badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            padding: "5px 16px", borderRadius: "999px", marginBottom: "28px",
            backgroundColor: "rgba(224,30,90,0.1)", border: "1px solid rgba(224,30,90,0.22)",
            color: "#E01E5A", fontSize: "0.82rem", fontWeight: 500,
          }}>
            ✦ Built for modern teams
          </div>

          <h1 style={{
            fontSize: "clamp(2.6rem, 5.5vw, 4.2rem)", fontWeight: 800,
            lineHeight: 1.1, letterSpacing: "-0.03em", marginBottom: "24px",
          }}>
            Where your team{" "}
            <span style={{
              background: "linear-gradient(90deg, #E01E5A 0%, #c084fc 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>flows</span>
            {" "}together
          </h1>

          <p style={{
            fontSize: "1.1rem", lineHeight: 1.75, color: "rgba(255,255,255,0.48)",
            maxWidth: "560px", margin: "0 auto 40px",
          }}>
            TrexaFlow brings all your business communication into one place — channels,
            direct messages, and workspaces designed for the way your team actually works.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", justifyContent: "center" }}>
            <button onClick={() => router.push("/auth")} style={{
              display: "flex", alignItems: "center", gap: "6px",
              backgroundColor: "#E01E5A", color: "#fff", border: "none",
              fontSize: "1rem", fontWeight: 600, cursor: "pointer",
              padding: "14px 32px", borderRadius: "12px",
              boxShadow: "0 0 40px rgba(224,30,90,0.3)",
            }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#c8174f")}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#E01E5A")}
            >
              Get Started Free <ChevronRight size={17} />
            </button>
            <button onClick={() => featuresRef.current?.scrollIntoView({ behavior: "smooth" })} style={{
              display: "flex", alignItems: "center", gap: "6px",
              backgroundColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)",
              border: "1px solid rgba(255,255,255,0.1)",
              fontSize: "1rem", fontWeight: 500, cursor: "pointer",
              padding: "14px 32px", borderRadius: "12px",
            }}
              onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}
            >
              See how it works
            </button>
          </div>
          <p style={{ marginTop: "18px", fontSize: "0.82rem", color: "rgba(255,255,255,0.22)" }}>
            Free forever · No credit card required
          </p>
        </div>
      </section>

      {/* ── Features ── */}
      <section ref={featuresRef} style={{ backgroundColor: "#13161a", padding: "100px 0" }}>
        <div style={{ maxWidth: "1140px", margin: "0 auto", padding: "0 32px" }}>
          <div style={{ textAlign: "center", marginBottom: "56px" }}>
            <h2 style={{ fontSize: "clamp(1.7rem, 2.8vw, 2.2rem)", fontWeight: 700, marginBottom: "12px" }}>
              Everything your team needs
            </h2>
            <p style={{ color: "rgba(255,255,255,0.38)", fontSize: "1rem", maxWidth: "440px", margin: "0 auto" }}>
              Powerful features built for professional communication — without the clutter.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "16px" }}>
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <div key={i} style={{
                  backgroundColor: "#0f1114", border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "16px", padding: "24px",
                  transition: "border-color 0.2s, transform 0.2s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.13)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    backgroundColor: "rgba(224,30,90,0.1)", color: "#E01E5A",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    marginBottom: "16px",
                  }}>
                    <Icon size={18} />
                  </div>
                  <div style={{ fontWeight: 600, fontSize: "0.93rem", marginBottom: "8px" }}>{f.title}</div>
                  <div style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.38)", lineHeight: 1.65 }}>{f.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ backgroundColor: "#0f1114", padding: "100px 0" }}>
        <div style={{ maxWidth: "860px", margin: "0 auto", padding: "0 32px", textAlign: "center" }}>
          <h2 style={{ fontSize: "clamp(1.7rem, 2.8vw, 2.2rem)", fontWeight: 700, marginBottom: "12px" }}>
            Up and running in minutes
          </h2>
          <p style={{ color: "rgba(255,255,255,0.38)", fontSize: "1rem", marginBottom: "64px" }}>
            No complicated setup. No IT team required.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "40px" }}>
            {steps.map((s, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 14,
                  backgroundColor: "rgba(224,30,90,0.1)", border: "1px solid rgba(224,30,90,0.22)",
                  color: "#E01E5A", fontWeight: 700, fontSize: "1.1rem",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: "18px",
                }}>
                  {s.n}
                </div>
                <div style={{ fontWeight: 600, marginBottom: "8px" }}>{s.title}</div>
                <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.38)" }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ backgroundColor: "#13161a", padding: "100px 0" }}>
        <div style={{ maxWidth: "740px", margin: "0 auto", padding: "0 32px", textAlign: "center" }}>
          <div style={{
            borderRadius: "24px", padding: "72px 48px",
            background: "linear-gradient(135deg, rgba(224,30,90,0.13) 0%, rgba(192,132,252,0.08) 100%)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}>
            <h2 style={{ fontSize: "clamp(1.6rem, 2.5vw, 2rem)", fontWeight: 700, marginBottom: "14px" }}>
              Ready to bring your team together?
            </h2>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "1rem", marginBottom: "36px", lineHeight: 1.7 }}>
              Create your free TrexaFlow workspace today and start communicating the way your team deserves.
            </p>
            <button onClick={() => router.push("/auth")} style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              backgroundColor: "#E01E5A", color: "#fff", border: "none",
              fontSize: "1rem", fontWeight: 600, cursor: "pointer",
              padding: "14px 36px", borderRadius: "12px",
              boxShadow: "0 0 40px rgba(224,30,90,0.25)",
            }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#c8174f")}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#E01E5A")}
            >
              Create your workspace — it's free <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "28px 32px" }}>
        <div style={{ maxWidth: "1140px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: "#E01E5A", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MessageSquare size={13} color="#fff" />
            </div>
            <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>TrexaFlow</span>
          </div>
          <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.18)" }}>© 2026 TrexaFlow. All rights reserved.</span>
        </div>
      </footer>

    </div>
  );
}