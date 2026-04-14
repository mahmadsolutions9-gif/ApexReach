/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import SMTPManagement from './pages/SMTPManagement';
import CampaignCreator from './pages/CampaignCreator';
import ContactLists from './pages/ContactLists';
import CampaignsList from './pages/CampaignsList';
import Activity from './pages/Activity';
import Sidebar from './components/Sidebar';
import { Toaster } from 'react-hot-toast';
import socket from './lib/socket';
import toast from 'react-hot-toast';
import { Eye, MousePointer2, MessageSquare, Bell } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (savedUser && savedUser !== 'undefined' && token) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
      } catch (e) {
        console.error('Failed to parse user from localStorage', e);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) {
      socket.connect();
      socket.emit('join', user.id);
    } else {
      socket.disconnect();
    }

    return () => {
      socket.disconnect();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const handleActivity = (data: any) => {
      const icon = data.type === 'open' ? <Eye className="w-4 h-4 text-blue-500" /> : <MousePointer2 className="w-4 h-4 text-green-500" />;
      const action = data.type === 'open' ? 'opened' : 'clicked a link in';
      
      toast.custom((t) => (
        <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-brand-surface shadow-2xl rounded-2xl pointer-events-auto flex border border-brand-border backdrop-blur-xl`}>
          <div className="flex-1 w-0 p-5">
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-1">
                {icon}
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-bold text-brand-text">
                  {data.contactName || data.contactEmail}
                </p>
                <p className="mt-1 text-sm text-brand-muted font-medium">
                  Just {action} your campaign: <span className="text-brand-text font-bold">{data.campaignName}</span>
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-brand-muted font-black uppercase tracking-widest">
                  <span>{data.device}</span>
                  <span>•</span>
                  <span>{data.browser}</span>
                  <span>•</span>
                  <span>{data.os}</span>
                  {(data.city && data.city !== 'Unknown') && (
                    <>
                      <span>•</span>
                      <span>{data.city}, {data.country}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex border-l border-brand-border">
            <button
              onClick={() => toast.dismiss(t.id)}
              className="w-full border border-transparent rounded-none rounded-r-2xl p-4 flex items-center justify-center text-xs font-black uppercase tracking-widest text-brand-muted hover:text-brand-text hover:bg-brand-bg transition-all outline-none"
            >
              Dismiss
            </button>
          </div>
        </div>
      ), { duration: 5000 });
    };

    socket.on('activity', handleActivity);

    const handleNotification = (data: any) => {
      // Only show general toast if it's not handled by activity or reply
      if (data.type !== 'open' && data.type !== 'click' && data.type !== 'reply') {
        toast.custom((t) => (
          <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-brand-surface shadow-2xl rounded-2xl pointer-events-auto flex border border-brand-border backdrop-blur-xl`}>
            <div className="flex-1 w-0 p-5">
              <div className="flex items-start">
                <div className="flex-shrink-0 pt-1">
                  <Bell className="w-4 h-4 text-orange-500" />
                </div>
                <div className="ml-4 flex-1">
                  <p className="text-sm font-bold text-brand-text">
                    {data.title}
                  </p>
                  <p className="mt-1 text-sm text-brand-muted font-medium">
                    {data.message}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex border-l border-brand-border">
              <button
                onClick={() => toast.dismiss(t.id)}
                className="w-full border border-transparent rounded-none rounded-r-2xl p-4 flex items-center justify-center text-xs font-black uppercase tracking-widest text-brand-muted hover:text-brand-text hover:bg-brand-bg transition-all outline-none"
              >
                Dismiss
              </button>
            </div>
          </div>
        ), { duration: 5000 });
      }
    };

    socket.on('notification', handleNotification);

    const handleReply = (data: any) => {
      toast.custom((t) => (
        <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-brand-surface shadow-2xl rounded-2xl pointer-events-auto flex border border-brand-border backdrop-blur-xl`}>
          <div className="flex-1 w-0 p-5">
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-1">
                <MessageSquare className="w-4 h-4 text-brand-purple" />
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-bold text-brand-text">
                  New Reply from {data.contactName || data.contactEmail}
                </p>
                <p className="mt-1 text-sm text-brand-muted font-medium">
                  Campaign: <span className="text-brand-text font-bold">{data.campaignName}</span>
                </p>
                <p className="mt-2 text-xs text-brand-muted italic truncate">
                  "{data.subject}"
                </p>
              </div>
            </div>
          </div>
          <div className="flex border-l border-brand-border">
            <button
              onClick={() => toast.dismiss(t.id)}
              className="w-full border border-transparent rounded-none rounded-r-2xl p-4 flex items-center justify-center text-xs font-black uppercase tracking-widest text-brand-muted hover:text-brand-text hover:bg-brand-bg transition-all outline-none"
            >
              Dismiss
            </button>
          </div>
        </div>
      ), { duration: 8000 });
    };

    socket.on('reply', handleReply);

    return () => {
      socket.off('activity', handleActivity);
      socket.off('notification', handleNotification);
      socket.off('reply', handleReply);
    };
  }, [user]);

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  return (
    <Router>
      <Toaster position="top-center" />
      <div className="min-h-screen bg-brand-bg text-brand-text font-sans">
        {user ? (
          <div className="flex h-screen overflow-hidden">
            <Sidebar user={user} onLogout={() => {
              localStorage.removeItem('user');
              localStorage.removeItem('token');
              setUser(null);
            }} />
            <main className="flex-1 overflow-y-auto p-4 md:p-8">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/activity" element={<Activity />} />
                <Route path="/smtp" element={<SMTPManagement />} />
                <Route path="/campaigns" element={<CampaignsList />} />
                <Route path="/campaigns/new" element={<CampaignCreator />} />
                <Route path="/campaigns/edit/:id" element={<CampaignCreator />} />
                <Route path="/contacts" element={<ContactLists />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </main>
          </div>
        ) : (
          <Routes>
            <Route path="/login" element={<Login onLogin={(u: any) => setUser(u)} />} />
            <Route path="/signup" element={<Signup onLogin={(u: any) => setUser(u)} />} />
            <Route path="*" element={<Navigate to="/login" />} />
          </Routes>
        )}
      </div>
    </Router>
  );
}

