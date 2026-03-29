"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Mode = "login" | "signup" | "otp";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", "", "", ""]);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const clearMessages = () => { setError(""); setSuccessMsg(""); };

  const handleOtpChange = (val: string, idx: number) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp];
    next[idx] = val.slice(-1);
    setOtp(next);
    if (val && idx < 7) document.getElementById(`otp-${idx + 1}`)?.focus();
  };

  const handleOtpKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "Backspace" && !otp[idx] && idx > 0)
      document.getElementById(`otp-${idx - 1}`)?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent, idx: number) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 8);
    if (!pasted) return;
    const next = [...otp];
    for (let i = 0; i < pasted.length; i++) {
      if (idx + i < 8) next[idx + i] = pasted[i];
    }
    setOtp(next);
    const lastFilled = Math.min(idx + pasted.length, 7);
    document.getElementById(`otp-${lastFilled}`)?.focus();
  };

  // ── Sign Up: create account then send OTP ──
  const handleSignUp = async () => {
    clearMessages();
    if (!email || !password) return setError("Please enter your email and password.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    setLoading(true);
    // First create the account
    const { error: signUpError } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (signUpError) return setError(signUpError.message);
    setMode("otp");
    setSuccessMsg(`An 8-digit code was sent to ${email}`);
  };

  // ── Verify OTP after signup ──
  const handleVerifyOtp = async () => {
    clearMessages();
    const code = otp.join("");
    if (code.length < 8) return setError("Please enter the full 8-digit code.");
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "signup",
    });
    setLoading(false);
    if (error) return setError("Invalid or expired code. Please try again.");
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await redirectAfterAuth(user.id);
  };

  // ── Resend OTP ──
  const handleResend = async () => {
    clearMessages();
    setLoading(true);
    const { error } = await supabase.auth.resend({ type: "signup", email });
    setLoading(false);
    if (error) return setError(error.message);
    setSuccessMsg("A new code has been sent to your email.");
    setOtp(["", "", "", "", "", "", "", ""]);
  };

  // ── Login ──
  const handleLogin = async () => {
    clearMessages();
    if (!email || !password) return setError("Please enter your email and password.");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setError("Incorrect email or password.");
    const { data: { user: loggedInUser } } = await supabase.auth.getUser();
    if (loggedInUser) await redirectAfterAuth(loggedInUser.id);
  };

  const switchMode = (m: Mode) => { clearMessages(); setOtp(["","","","","","","",""]); setMode(m); };

  const redirectAfterAuth = async (userId: string) => {
    // Check if user already completed onboarding
    const { data: profile } = await supabase.from("users").select("id").eq("id", userId).single();
    if (!profile) return router.push("/onboarding");

    // Check if user already has a workspace
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (membership) {
      router.push(`/workspace/${membership.workspace_id}`);
    } else {
      router.push("/onboarding");
    }
  };

  return (
    <div style={{
      minHeight: "100vh", backgroundColor: "#0f1114",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "24px", fontFamily: "var(--font-geist-sans), -apple-system, sans-serif",
    }}>

      {/* Top logo bar */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: "60px", display: "flex", alignItems: "center", padding: "0 32px" }}>
        <button onClick={() => router.push("/")} style={{
          display: "flex", alignItems: "center", gap: "8px",
          background: "none", border: "none", color: "rgba(255,255,255,0.4)",
          cursor: "pointer", fontSize: "0.9rem", fontWeight: 500,
        }}
          onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
        >
          <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "#E01E5A", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MessageSquare size={14} color="#fff" />
          </div>
          TrexaFlow
        </button>
      </div>

      {/* Card */}
      <div style={{
        width: "100%", maxWidth: "420px",
        backgroundColor: "#13161a", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "20px", padding: "40px 36px",
        boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
      }}>

        {/* ── OTP Screen ── */}
        {mode === "otp" ? (
          <>
            <div style={{ textAlign: "center", marginBottom: "32px" }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                backgroundColor: "rgba(224,30,90,0.12)", border: "1px solid rgba(224,30,90,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px",
              }}>
                <Mail size={22} color="#E01E5A" />
              </div>
              <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#fff", marginBottom: "8px" }}>Check your email</h1>
              <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
                We sent an 8-digit code to<br />
                <span style={{ color: "rgba(255,255,255,0.75)", fontWeight: 500 }}>{email}</span>
              </p>
            </div>

            {/* 6-box OTP input */}
            <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginBottom: "24px" }}>
              {otp.map((digit, idx) => (
                <input key={idx} id={`otp-${idx}`}
                  type="text" inputMode="numeric" maxLength={1} value={digit}
                  onChange={e => handleOtpChange(e.target.value, idx)}
                  onKeyDown={e => handleOtpKeyDown(e, idx)}
                  onPaste={e => handleOtpPaste(e, idx)}
                  style={{
                    width: "40px", height: "50px", textAlign: "center",
                    fontSize: "1.3rem", fontWeight: 700, color: "#fff",
                    backgroundColor: "#0f1114",
                    border: `1.5px solid ${digit ? "#E01E5A" : "rgba(255,255,255,0.1)"}`,
                    borderRadius: "10px", outline: "none", transition: "border-color 0.15s",
                  }}
                  onFocus={e => (e.target.style.borderColor = "#E01E5A")}
                  onBlur={e => (e.target.style.borderColor = digit ? "#E01E5A" : "rgba(255,255,255,0.1)")}
                />
              ))}
            </div>

            {error && (
              <p style={{ color: "#f87171", fontSize: "0.82rem", textAlign: "center", marginBottom: "16px", padding: "10px", backgroundColor: "rgba(248,113,113,0.08)", borderRadius: "8px" }}>
                {error}
              </p>
            )}
            {successMsg && (
              <p style={{ color: "#4ade80", fontSize: "0.82rem", textAlign: "center", marginBottom: "16px" }}>
                {successMsg}
              </p>
            )}

            <button onClick={handleVerifyOtp} disabled={loading} style={{
              width: "100%", padding: "13px", borderRadius: "10px",
              backgroundColor: "#E01E5A", color: "#fff", border: "none",
              fontSize: "0.95rem", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            }}>
              {loading && <Loader2 size={17} className="animate-spin" />}
              Verify & Continue
            </button>

            <p style={{ textAlign: "center", marginTop: "20px", fontSize: "0.83rem", color: "rgba(255,255,255,0.35)" }}>
              Didn't receive it?{" "}
              <button onClick={handleResend} disabled={loading} style={{
                background: "none", border: "none", color: "#E01E5A",
                cursor: "pointer", fontWeight: 500, fontSize: "0.83rem",
              }}>
                Resend code
              </button>
            </p>
            <p style={{ textAlign: "center", marginTop: "10px" }}>
              <button onClick={() => switchMode("signup")} style={{
                background: "none", border: "none", color: "rgba(255,255,255,0.3)",
                cursor: "pointer", fontSize: "0.83rem",
              }}>
                ← Back to sign up
              </button>
            </p>
          </>

        ) : (
          <>
            {/* ── Login / Signup ── */}
            <div style={{ textAlign: "center", marginBottom: "32px" }}>
              <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#fff", marginBottom: "8px" }}>
                {mode === "login" ? "Welcome back" : "Create your account"}
              </h1>
              <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.4)" }}>
                {mode === "login" ? "Sign in to your TrexaFlow account" : "Start communicating with your team"}
              </p>
            </div>

            {/* Tab switcher */}
            <div style={{
              display: "flex", backgroundColor: "#0f1114", borderRadius: "10px",
              padding: "4px", marginBottom: "28px", border: "1px solid rgba(255,255,255,0.06)",
            }}>
              {(["login", "signup"] as Mode[]).map(m => (
                <button key={m} onClick={() => switchMode(m)} style={{
                  flex: 1, padding: "8px", borderRadius: "7px", border: "none",
                  fontSize: "0.88rem", fontWeight: 500, cursor: "pointer", transition: "all 0.15s",
                  backgroundColor: mode === m ? "#E01E5A" : "transparent",
                  color: mode === m ? "#fff" : "rgba(255,255,255,0.4)",
                }}>
                  {m === "login" ? "Sign in" : "Sign up"}
                </button>
              ))}
            </div>

            {/* Email */}
            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 500, color: "rgba(255,255,255,0.55)", marginBottom: "7px" }}>
                Email address
              </label>
              <div style={{ position: "relative" }}>
                <Mail size={16} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.25)" }} />
                <input type="email" placeholder="you@company.com" value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (mode === "login" ? handleLogin() : handleSignUp())}
                  style={{
                    width: "100%", padding: "11px 13px 11px 38px",
                    backgroundColor: "#0f1114", border: "1.5px solid rgba(255,255,255,0.08)",
                    borderRadius: "9px", color: "#fff", fontSize: "0.9rem", outline: "none",
                  }}
                  onFocus={e => (e.target.style.borderColor = "#E01E5A")}
                  onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: "22px" }}>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 500, color: "rgba(255,255,255,0.55)", marginBottom: "7px" }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <Lock size={16} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.25)" }} />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder={mode === "signup" ? "Min. 8 characters" : "Enter your password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (mode === "login" ? handleLogin() : handleSignUp())}
                  style={{
                    width: "100%", padding: "11px 40px 11px 38px",
                    backgroundColor: "#0f1114", border: "1.5px solid rgba(255,255,255,0.08)",
                    borderRadius: "9px", color: "#fff", fontSize: "0.9rem", outline: "none",
                  }}
                  onFocus={e => (e.target.style.borderColor = "#E01E5A")}
                  onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
                />
                <button onClick={() => setShowPassword(p => !p)} style={{
                  position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: 0,
                }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <p style={{ color: "#f87171", fontSize: "0.82rem", marginBottom: "16px", padding: "10px 14px", backgroundColor: "rgba(248,113,113,0.08)", borderRadius: "8px" }}>
                {error}
              </p>
            )}

            <button onClick={mode === "login" ? handleLogin : handleSignUp} disabled={loading} style={{
              width: "100%", padding: "13px", borderRadius: "10px",
              backgroundColor: "#E01E5A", color: "#fff", border: "none",
              fontSize: "0.95rem", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.backgroundColor = "#c8174f"; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#E01E5A"; }}
            >
              {loading && <Loader2 size={17} className="animate-spin" />}
              {mode === "login" ? "Sign in" : "Create account"}
              {!loading && <ArrowRight size={16} />}
            </button>

            <p style={{ textAlign: "center", marginTop: "20px", fontSize: "0.82rem", color: "rgba(255,255,255,0.3)" }}>
              {mode === "login" ? "Don't have an account? " : "Already have an account? "}
              <button onClick={() => switchMode(mode === "login" ? "signup" : "login")} style={{
                background: "none", border: "none", color: "#E01E5A",
                cursor: "pointer", fontWeight: 500, fontSize: "0.82rem",
              }}>
                {mode === "login" ? "Sign up free" : "Sign in"}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  )
}