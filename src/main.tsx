import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider, useAuth, useClerk } from '@clerk/clerk-react';
import App from './App';
import LandingPage from './components/LandingPage';
import './index.css';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env');
}

// ── Clerk dark theme to match the industrial dashboard aesthetic ──────────────
const clerkAppearance = {
  variables: {
    colorBackground:      '#0c0c10',
    colorText:            '#f4f4f5',
    colorPrimary:         '#22c55e',
    colorInputBackground: '#141418',
    colorInputText:       '#f4f4f5',
    colorTextSecondary:   '#71717a',
    colorNeutral:         '#3f3f46',
    borderRadius:         '0.5rem',
    fontFamily:           'DM Sans, sans-serif',
  },
  elements: {
    card:                  'shadow-2xl',
    formButtonPrimary:     'bg-emerald-500 hover:bg-emerald-600 text-white',
    footerActionLink:      'text-emerald-400 hover:text-emerald-300',
    identityPreviewText:   'text-zinc-300',
    formFieldInput:        'border-zinc-700 bg-zinc-900 text-zinc-100',
  },
} as const;

// ── Root: owns the show/hide dashboard state + auth coordination ──────────────
function Root() {
  const [showDashboard,   setShowDashboard]   = useState(false);
  const pendingEnterRef = useRef(false);

  const { isSignedIn, isLoaded } = useAuth();
  const { openSignIn }           = useClerk();

  // After Clerk resolves auth, act on any pending enter request
  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn && pendingEnterRef.current) {
      pendingEnterRef.current = false;
      setShowDashboard(true);
    }
  }, [isSignedIn, isLoaded]);

  // Return to landing page if user signs out while on dashboard
  useEffect(() => {
    if (isLoaded && !isSignedIn && showDashboard) {
      setShowDashboard(false);
    }
  }, [isSignedIn, isLoaded, showDashboard]);

  const handleEnter = () => {
    if (!isLoaded) return;
    if (isSignedIn) {
      setShowDashboard(true);
    } else {
      pendingEnterRef.current = true;
      openSignIn();
    }
  };

  // Loading state while Clerk initialises
  if (!isLoaded) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#080810',
        fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
        color: '#22c55e', letterSpacing: '0.14em',
      }}>
        INITIALISING…
      </div>
    );
  }

  if (showDashboard) return <App />;
  return <LandingPage onEnter={handleEnter} />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} appearance={clerkAppearance}>
      <Root />
    </ClerkProvider>
  </React.StrictMode>,
);
