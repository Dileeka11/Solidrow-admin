import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { LogoMark } from '../components/icons';
import { useIsMobile } from '../lib/useMediaQuery';
import { toastError } from '../lib/alerts';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(username.trim(), password);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const message =
        status === 429
          ? 'Too many attempts. Please wait a moment and try again.'
          : // Laravel validation error shape
            (err as { response?: { data?: { errors?: { username?: string[] }; message?: string } } })
              ?.response?.data?.errors?.username?.[0] ??
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            'Invalid credentials.';
      setError(message);
      toastError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        minHeight: '100vh',
      }}
    >
      {/* Left — brand / art panel (hidden on mobile) */}
      <div
        style={{
          display: isMobile ? 'none' : 'flex',
          background: 'var(--panel)',
          color: 'white',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 80,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -80,
            right: -80,
            width: 300,
            height: 300,
            borderRadius: 999,
            background: 'var(--panel-circle-1)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -120,
            left: -60,
            width: 260,
            height: 260,
            borderRadius: 999,
            background: 'var(--panel-circle-2)',
          }}
        />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'var(--logo)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LogoMark size={22} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>
              Overseas Careers Ltd.
            </div>
          </div>
          <div
            style={{
              fontSize: 40,
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
              maxWidth: 440,
            }}
          >
            Foreign Employment Agency — Admin Panel
          </div>
          <div
            style={{
              fontSize: 16,
              color: 'oklch(0.85 0.02 250)',
              marginTop: 20,
              maxWidth: 400,
              lineHeight: 1.6,
            }}
          >
            Manage staff, applicant placements, and access permissions from a single dashboard.
          </div>
        </div>
      </div>

      {/* Right — login form */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '32px 20px' : 40 }}>
        <form
          className="fade-in"
          style={{ width: '100%', maxWidth: 380 }}
          onSubmit={handleLogin}
        >
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Staff Login</div>
          <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 32 }}>
            Enter your credentials to continue
          </div>

          <div style={{ marginBottom: 18 }}>
            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 6,
                color: 'var(--label)',
              }}
            >
              Username or Email
            </label>
            <input
              className="sr-input"
              type="text"
              placeholder="Username or email"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError('');
              }}
              style={{ padding: '12px 14px' }}
            />
          </div>

          <div style={{ marginBottom: 8 }}>
            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 6,
                color: 'var(--label)',
              }}
            >
              Password
            </label>
            <input
              className="sr-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              style={{ padding: '12px 14px' }}
            />
          </div>

          {error && (
            <div
              style={{
                color: 'var(--danger)',
                fontSize: 13,
                marginBottom: 10,
                marginTop: 10,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ marginBottom: 22 }} />

          <button
            className="sr-btn-primary"
            type="submit"
            disabled={busy}
            style={{ width: '100%', padding: 13, borderRadius: 8, fontSize: 15 }}
          >
            {busy ? 'Signing In…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
