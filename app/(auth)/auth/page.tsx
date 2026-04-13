'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageSquare, Mail, Lock, Eye, EyeOff, ArrowRight, Loader2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Mode = 'login' | 'signup' | 'otp';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '', '', '']);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const clearMessages = () => { setError(''); setSuccessMsg(''); };

  const handleOtpChange = (val: string, idx: number) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp]; next[idx] = val.slice(-1); setOtp(next);
    if (val && idx < 7) (document.getElementById(`otp-${idx + 1}`) as HTMLInputElement)?.focus();
  };

  const handleOtpKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0)
      (document.getElementById(`otp-${idx - 1}`) as HTMLInputElement)?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent, idx: number) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 8);
    if (!pasted) return;
    const next = [...otp];
    for (let i = 0; i < pasted.length; i++) { if (idx + i < 8) next[idx + i] = pasted[i]; }
    setOtp(next);
    const lastFilled = Math.min(idx + pasted.length, 7);
    (document.getElementById(`otp-${lastFilled}`) as HTMLInputElement)?.focus();
  };

  const handleSignUp = async () => {
    clearMessages();
    if (!email || !password) return setError('Please enter your email and password.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    setLoading(true);
    const { error: signUpError } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (signUpError) return setError(signUpError.message);
    setMode('otp');
    setSuccessMsg(`An 8-digit code was sent to ${email}`);
  };

  const handleVerifyOtp = async () => {
    clearMessages();
    const code = otp.join('');
    if (code.length < 8) return setError('Please enter the full 8-digit code.');
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' });
    setLoading(false);
    if (error) return setError('Invalid or expired code. Please try again.');
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await redirectAfterAuth(user.id);
  };

  const handleResend = async () => {
    clearMessages();
    setLoading(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    setLoading(false);
    if (error) return setError(error.message);
    setSuccessMsg('A new code has been sent to your email.');
    setOtp(['', '', '', '', '', '', '', '']);
  };

  const handleLogin = async () => {
    clearMessages();
    if (!email || !password) return setError('Please enter your email and password.');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setError('Incorrect email or password.');
    const { data: { user: loggedInUser } } = await supabase.auth.getUser();
    if (loggedInUser) await redirectAfterAuth(loggedInUser.id);
  };

  const switchMode = (m: Mode) => { clearMessages(); setOtp(['','','','','','','','']); setMode(m); };

  const redirectAfterAuth = async (userId: string) => {
    const { data: profile } = await supabase.from('users').select('id').eq('id', userId).single();
    if (!profile) return router.push('/onboarding');
    const { data: membership } = await supabase
      .from('workspace_members').select('workspace_id').eq('user_id', userId).limit(1).single();
    if (membership) router.push(`/workspace/${membership.workspace_id}`);
    else router.push('/onboarding');
  };

  // ── Shared input style (uses CSS vars) ──────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '11px 13px 11px 38px',
    backgroundColor: 'var(--bg-input)',
    border: '1.5px solid var(--border-color)',
    borderRadius: 9,
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    outline: 'none',
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      {/* Top logo bar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 60,
        display: 'flex', alignItems: 'center', padding: '0 32px',
      }}>
        <button
          onClick={() => router.push('/')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'none', border: 'none',
            color: 'var(--text-secondary)', cursor: 'pointer',
            fontSize: '0.9rem', fontWeight: 500,
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'}
        >
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            backgroundColor: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <MessageSquare size={14} color="var(--accent-foreground)" />
          </div>
          TrexaFlow
        </button>
      </div>

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 420,
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 20,
        padding: '40px 36px',
        boxShadow: '0 24px 80px var(--shadow-color)',
      }}>

        {/* ── OTP Screen ── */}
        {mode === 'otp' ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                backgroundColor: 'var(--accent-alpha-12)',
                border: '1px solid var(--accent-alpha-20)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px',
              }}>
                <Mail size={22} color="var(--accent)" />
              </div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                Check your email
              </h1>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                We sent an 8-digit code to<br />
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{email}</span>
              </p>
            </div>

            {/* OTP boxes */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 24 }}>
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  id={`otp-${idx}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleOtpChange(e.target.value, idx)}
                  onKeyDown={e => handleOtpKeyDown(e, idx)}
                  onPaste={e => handleOtpPaste(e, idx)}
                  style={{
                    width: 40, height: 50, textAlign: 'center',
                    fontSize: '1.3rem', fontWeight: 700,
                    color: 'var(--text-primary)',
                    backgroundColor: 'var(--bg-input)',
                    border: `1.5px solid ${digit ? 'var(--accent)' : 'var(--border-color)'}`,
                    borderRadius: 10, outline: 'none',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.target.style.borderColor = digit ? 'var(--accent)' : 'var(--border-color)'}
                />
              ))}
            </div>

            {error && (
              <p style={{ color: 'var(--error)', fontSize: '0.82rem', textAlign: 'center', marginBottom: 16, padding: 10, backgroundColor: 'var(--error-bg)', borderRadius: 8 }}>
                {error}
              </p>
            )}
            {successMsg && (
              <p style={{ color: 'var(--success)', fontSize: '0.82rem', textAlign: 'center', marginBottom: 16 }}>
                {successMsg}
              </p>
            )}

            <button
              onClick={handleVerifyOtp}
              disabled={loading}
              style={{
                width: '100%', padding: 13, borderRadius: 10,
                backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)', border: 'none',
                fontSize: '0.95rem', fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {loading && <Loader2 size={17} className="animate-spin" />}
              Verify & Continue
            </button>

            <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.83rem', color: 'var(--text-muted)' }}>
              Didn't receive it?{' '}
              <button
                onClick={handleResend}
                disabled={loading}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 500, fontSize: '0.83rem' }}
              >
                Resend code
              </button>
            </p>
            <p style={{ textAlign: 'center', marginTop: 10 }}>
              <button
                onClick={() => switchMode('signup')}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.83rem' }}
              >
                ← Back to sign up
              </button>
            </p>
          </>
        ) : (
          <>
            {/* ── Login / Signup ── */}
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                {mode === 'login' ? 'Welcome back' : 'Create your account'}
              </h1>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                {mode === 'login' ? 'Sign in to your TrexaFlow account' : 'Start communicating with your team'}
              </p>
            </div>

            {/* Tab switcher */}
            <div style={{
              display: 'flex',
              backgroundColor: 'var(--bg-primary)',
              borderRadius: 10, padding: 4, marginBottom: 28,
              border: '1px solid var(--border-color)',
            }}>
              {(['login', 'signup'] as Mode[]).map(m => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  style={{
                    flex: 1, padding: 8, borderRadius: 7, border: 'none',
                    fontSize: '0.88rem', fontWeight: 500, cursor: 'pointer',
                    transition: 'all 0.15s',
                    backgroundColor: mode === m ? 'var(--accent)' : 'transparent',
                    color: mode === m ? 'var(--accent-foreground)' : 'var(--text-secondary)',
                  }}
                >
                  {m === 'login' ? 'Sign in' : 'Sign up'}
                </button>
              ))}
            </div>

            {/* Email */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 7 }}>
                Email address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--icon-color)' }} />
                <input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (mode === 'login' ? handleLogin() : handleSignUp())}
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 22 }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 7 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--icon-color)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={mode === 'signup' ? 'Min. 8 characters' : 'Enter your password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (mode === 'login' ? handleLogin() : handleSignUp())}
                  style={{ ...inputStyle, paddingRight: 40 }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                />
                <button
                  onClick={() => setShowPassword(p => !p)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--icon-color)', padding: 0,
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <p style={{ color: 'var(--error)', fontSize: '0.82rem', marginBottom: 16, padding: '10px 14px', backgroundColor: 'var(--error-bg)', borderRadius: 8 }}>
                {error}
              </p>
            )}

            <button
              onClick={mode === 'login' ? handleLogin : handleSignUp}
              disabled={loading}
              style={{
                width: '100%', padding: 13, borderRadius: 10,
                backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)', border: 'none',
                fontSize: '0.95rem', fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent-hover)'; }}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent)'}
            >
              {loading && <Loader2 size={17} className="animate-spin" />}
              {mode === 'login' ? 'Sign in' : 'Create account'}
              {!loading && <ArrowRight size={16} />}
            </button>

            <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 500, fontSize: '0.82rem' }}
              >
                {mode === 'login' ? 'Sign up free' : 'Sign in'}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}