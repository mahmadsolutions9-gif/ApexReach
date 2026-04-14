import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

export default function Login({ onLogin }: { onLogin: (user: any) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/api/auth/login', { email, password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      onLogin(res.data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-slate-200/50 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-slate-200/50 rounded-full blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white p-8 md:p-12 rounded-[2.5rem] shadow-2xl relative z-10 border border-slate-200"
      >
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-900 text-white rounded-2xl mb-6 shadow-xl border border-slate-200">
            <Mail size={32} />
          </div>
          <h2 className="text-4xl font-bold tracking-tight text-slate-900 font-display">Welcome back</h2>
          <p className="mt-3 text-slate-500 font-medium">Sign in to your ApexReach account</p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm font-semibold border border-red-100"
            >
              {error}
            </motion.div>
          )}
          <div className="space-y-4">
            <div className="relative group">
              <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" size={20} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-slate-200 focus:bg-white transition-all outline-none font-medium text-slate-900 placeholder:text-slate-300"
                placeholder="Email address"
              />
            </div>
            <div className="relative group">
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" size={20} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-slate-200 focus:bg-white transition-all outline-none font-medium text-slate-900 placeholder:text-slate-300"
                placeholder="Password"
              />
            </div>
          </div>

          <button
            type="submit"
            className="group relative w-full flex items-center justify-center py-4 px-4 border border-slate-200 text-base font-bold rounded-2xl text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-200 transition-all shadow-xl hover:shadow-2xl active:scale-[0.98]"
          >
            Sign in
            <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={20} />
          </button>
        </form>

        <p className="mt-10 text-center text-sm text-slate-500 font-medium">
          Don't have an account?{' '}
          <Link to="/signup" className="font-bold text-slate-900 hover:underline underline-offset-4">
            Sign up for free
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
