import { useState } from 'react';
import { supabase } from './supabaseClient';

export default function Auth({ onLogin }) {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState(''); // Only used for password login
    const [isSignUp, setIsSignUp] = useState(false);
    const [message, setMessage] = useState('');

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                setMessage('Check your email for the login link!');
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                // onLogin is handled by onAuthStateChange in App.jsx
            }
        } catch (error) {
            setMessage(error.error_description || error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container" style={{
            maxWidth: '400px',
            margin: '2rem auto',
            padding: '2rem',
            background: 'white',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            textAlign: 'center'
        }}>
            <h2 style={{ color: '#2e7d32', marginBottom: '1.5rem' }}>
                {isSignUp ? '🌱 Farmer Sign Up' : '🌾 Farmer Login'}
            </h2>

            <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <input
                    type="email"
                    placeholder="Your Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
                />

                <button
                    type="submit"
                    disabled={loading}
                    style={{
                        padding: '12px',
                        borderRadius: '6px',
                        border: 'none',
                        background: isSignUp ? '#2e7d32' : '#1565c0',
                        color: 'white',
                        fontWeight: 'bold',
                        cursor: loading ? 'wait' : 'pointer'
                    }}
                >
                    {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Log In')}
                </button>
            </form>

            {message && <div style={{ marginTop: '1rem', color: isSignUp ? 'green' : 'red' }}>{message}</div>}

            <p style={{ marginTop: '1.5rem', fontSize: '0.9rem', color: '#666' }}>
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                <button
                    onClick={() => { setIsSignUp(!isSignUp); setMessage(''); }}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: '#1565c0',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        marginLeft: '5px'
                    }}
                >
                    {isSignUp ? 'Log In' : 'Sign Up'}
                </button>
            </p>
        </div>
    );
}
