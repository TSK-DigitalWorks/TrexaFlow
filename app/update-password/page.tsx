'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Lock, Eye, EyeOff, ShieldCheck, Loader2, ArrowLeft, ArrowRight 
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

export default function UpdatePasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [logoTheme, setLogoTheme] = useState<'light' | 'dark'>('light');

  // Logo theme sync (same as AuthPage for consistency)
  useEffect(() => {
    const html = document.documentElement;
    const updateLogo = () => {
      const current = html.getAttribute('data-theme') as 'light' | 'dark' | null;
      if (current) setLogoTheme(current);
      else setLogoTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    };
    updateLogo();
    const obs = new MutationObserver(updateLogo);
    obs.observe(html, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (password.length < 8) {
      return setError('Password must be at least 8 characters long.');
    }
    if (password !== confirmPassword) {
      return setError('Passwords do not match.');
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccessMsg('Your password has been updated successfully! Redirecting…');
      setTimeout(() => router.push('/'), 2000);
    }
  };

  // ── Shared styles ─────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 13px 11px 38px',
    backgroundColor: 'var(--bg-input)', border: '1.5px solid var(--border-color)',
    borderRadius: 9, color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none',
    transition: 'border-color 0.15s',
  };

  const primaryBtnStyle: React.CSSProperties = {
    width: '100%', padding: '13px', borderRadius: 10,
    backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)',
    border: 'none', fontSize: '0.95rem', fontWeight: 600,
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.7 : 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    transition: 'all 0.15s',
  };

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: 'var(--bg-primary)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      {/* Top logo bar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 60,
        display: 'flex', alignItems: 'center', padding: '0 32px',
      }}>
        <button
          onClick={() => router.push('/')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500 }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'}
        >
          <img
            src={logoTheme === 'light' ? '/LogoStandarddarktransp.png' : '/LogoStandardlighttransp.png'}
            alt="TrexaFlow"
            style={{ height: 26, width: 'auto', objectFit: 'contain', userSelect: 'none' }}
          />
        </button>
      </div>

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 420,
        backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
        borderRadius: 20, padding: '40px 36px',
        boxShadow: '0 24px 80px var(--shadow-color)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            backgroundColor: 'var(--accent-alpha-12)', border: '1px solid var(--accent-alpha-20)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
          }}>
            <ShieldCheck size={22} color="var(--accent)" />
          </div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
            Set new password
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Choose a strong password to secure your account.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* New password */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 7 }}>
              New password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--icon-color)' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Min. 8 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--icon-color)', padding: 0 }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirm password */}
          <div style={{ marginBottom: 22 }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 7 }}>
              Confirm password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--icon-color)' }} />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(p => !p)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--icon-color)', padding: 0 }}
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {/* Password match feedback */}
            {confirmPassword && (
              <p style={{ fontSize: '0.78rem', marginTop: 6, color: password === confirmPassword ? 'var(--success)' : 'var(--error)' }}>
                {password === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
              </p>
            )}
          </div>

          {error && (
            <p style={{ color: 'var(--error)', fontSize: '0.82rem', marginBottom: 16, padding: '10px 14px', backgroundColor: 'var(--error-bg)', borderRadius: 8 }}>
              {error}
            </p>
          )}

          {successMsg && (
            <div style={{ marginBottom: 16, padding: '12px 14px', backgroundColor: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
              <ShieldCheck size={15} style={{ color: 'var(--success)', flexShrink: 0 }} />
              <p style={{ color: 'var(--success)', fontSize: '0.82rem' }}>{successMsg}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !!successMsg}
            style={primaryBtnStyle}
            onMouseEnter={e => { if (!loading && !successMsg) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent-hover)'; }}
            onMouseLeave={e => { if (!loading && !successMsg) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent)'; }}
          >
            {loading ? <Loader2 size={17} className="animate-spin" /> : <ShieldCheck size={16} />}
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.83rem', color: 'var(--text-muted)' }}>
          <button
            onClick={() => router.push('/auth')}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.83rem', display: 'inline-flex', alignItems: 'center', gap: 5 }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'}
          >
            <ArrowLeft size={13} /> Return to sign in
          </button>
        </p>
      </div>
    </div>
  );
}
