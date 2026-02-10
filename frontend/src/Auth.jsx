import { useState } from 'react';
import { supabase } from './supabaseClient';

export default function Auth({ onLogin }) {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
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
            }
        } catch (error) {
            setMessage(error.error_description || error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            maxWidth: '450px',
            margin: '0 auto',
            padding: '2.5rem',
            background: 'white',
            borderRadius: '24px',
            textAlign: 'center'
        }}>
            <div style={{ marginBottom: '2rem' }}>
                <h2 style={{
                    color: '#2E7D32',
                    fontSize: '1.75rem',
                    fontWeight: '800',
                    marginBottom: '0.5rem'
                }}>
                    {isSignUp ? '🌱 Create Account' : '🌾 Welcome Back'}
                </h2>
                <p style={{ color: '#616161', fontSize: '0.95rem' }}>
                    {isSignUp ? 'Join Village Water Accountant' : 'Sign in to your account'}
                </p>
            </div>

            <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                    <input
                        type="email"
                        placeholder="Email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        style={{
                            width: '100%',
                            padding: '0.875rem 1rem',
                            borderRadius: '12px',
                            border: '2px solid #E0E0E0',
                            fontSize: '0.95rem',
                            fontFamily: 'Inter, sans-serif',
                            transition: 'all 0.3s ease'
                        }}
                        onFocus={(e) => {
                            e.target.style.borderColor = '#34A853';
                            e.target.style.boxShadow = '0 0 0 3px rgba(52, 168, 83, 0.1)';
                        }}
                        onBlur={(e) => {
                            e.target.style.borderColor = '#E0E0E0';
                            e.target.style.boxShadow = 'none';
                        }}
                    />
                </div>

                <div>
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        style={{
                            width: '100%',
                            padding: '0.875rem 1rem',
                            borderRadius: '12px',
                            border: '2px solid #E0E0E0',
                            fontSize: '0.95rem',
                            fontFamily: 'Inter, sans-serif',
                            transition: 'all 0.3s ease'
                        }}
                        onFocus={(e) => {
                            e.target.style.borderColor = '#34A853';
                            e.target.style.boxShadow = '0 0 0 3px rgba(52, 168, 83, 0.1)';
                        }}
                        onBlur={(e) => {
                            e.target.style.borderColor = '#E0E0E0';
                            e.target.style.boxShadow = 'none';
                        }}
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    style={{
                        padding: '1rem',
                        borderRadius: '12px',
                        border: 'none',
                        background: isSignUp ? 'linear-gradient(135deg, #34A853 0%, #2E7D32 100%)' : 'linear-gradient(135deg, #1976D2 0%, #1565C0 100%)',
                        color: 'white',
                        fontSize: '1rem',
                        fontWeight: '700',
                        cursor: loading ? 'wait' : 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                    }}
                    onMouseEnter={(e) => {
                        if (!loading) {
                            e.target.style.transform = 'translateY(-2px)';
                            e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                        }
                    }}
                    onMouseLeave={(e) => {
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                    }}
                >
                    {loading ? (
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                            <span className="loading-spinner"></span>
                            Processing...
                        </span>
                    ) : (
                        isSignUp ? 'Create Account' : 'Sign In'
                    )}
                </button>
            </form>

            {message && (
                <div style={{
                    marginTop: '1.5rem',
                    padding: '0.875rem',
                    borderRadius: '8px',
                    background: message.includes('Check') ? '#E8F5E9' : '#FFEBEE',
                    color: message.includes('Check') ? '#2E7D32' : '#D32F2F',
                    fontSize: '0.9rem',
                    fontWeight: '600'
                }}>
                    {message}
                </div>
            )}

            <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #EEEEEE' }}>
                <p style={{ fontSize: '0.9rem', color: '#757575' }}>
                    {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                    <button
                        onClick={() => { setIsSignUp(!isSignUp); setMessage(''); }}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#34A853',
                            textDecoration: 'underline',
                            cursor: 'pointer',
                            fontWeight: '700',
                            marginLeft: '5px',
                            fontSize: '0.9rem'
                        }}
                    >
                        {isSignUp ? 'Sign In' : 'Create Account'}
                    </button>
                </p>
            </div>
        </div>
    );
}
