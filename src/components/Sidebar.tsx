import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Mail, Users, Settings, LogOut, Send, Menu, X, Activity } from 'lucide-react';
import { cn } from '../lib/utils';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import NotificationCenter from './NotificationCenter';

export default function Sidebar({ user, onLogout }: { user: any, onLogout: () => void }) {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Activity, label: 'Activity', path: '/activity' },
    { icon: Send, label: 'Campaigns', path: '/campaigns' },
    { icon: Users, label: 'Contacts', path: '/contacts' },
    { icon: Settings, label: 'SMTP Settings', path: '/smtp' },
  ];

  const NavContent = () => (
    <div className="flex flex-col h-full bg-brand-surface border-r border-brand-border">
      <div className="p-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-brand-bg border border-brand-border rounded-2xl flex items-center justify-center shadow-2xl shadow-brand-accent/5 group cursor-pointer hover:scale-105 transition-transform duration-150">
            <Send className="text-brand-accent group-hover:rotate-12 transition-transform duration-150" size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter font-display leading-none text-brand-text">ApexReach</h1>
            <p className="text-[10px] font-black text-brand-muted uppercase tracking-[0.3em] mt-1">Enterprise</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden md:block">
            <NotificationCenter />
          </div>
          <button className="md:hidden p-3 bg-brand-bg hover:bg-brand-surface rounded-2xl text-brand-muted hover:text-brand-text transition-all duration-150" onClick={() => setIsOpen(false)}>
            <X size={24} />
          </button>
        </div>
      </div>
      
      <nav className="flex-1 px-6 space-y-2 mt-4">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              id={`nav-link-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              key={item.path}
              to={item.path}
              onClick={() => setIsOpen(false)}
              className={cn(
                "flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-150 group relative overflow-hidden",
                isActive
                  ? "bg-brand-bg text-brand-accent shadow-sm border border-brand-border"
                  : "text-brand-muted hover:bg-brand-bg/50 hover:text-brand-text"
              )}
            >
              <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} className={cn(isActive ? "text-brand-accent" : "text-brand-muted group-hover:text-brand-text transition-colors duration-150")} />
              <span className="font-bold text-sm tracking-tight">{item.label}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-accent" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-8 mt-auto">
        <div className="bg-brand-bg rounded-[2.5rem] p-6 border border-brand-border shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-brand-accent/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-brand-accent/10 transition-colors duration-150" />
          
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-brand-surface text-brand-text shadow-sm flex items-center justify-center font-black text-lg border-2 border-brand-border">
              {user.name?.[0] || user.email[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black truncate text-brand-text">{user.name || 'User'}</p>
              <p className="text-[10px] text-brand-muted font-black uppercase tracking-widest truncate mt-0.5">{user.email}</p>
            </div>
          </div>
          
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 text-red-400 bg-red-950/30 hover:bg-red-600 hover:text-white rounded-2xl transition-all duration-150 font-black text-xs uppercase tracking-widest shadow-sm border border-red-900/50"
          >
            <LogOut size={18} strokeWidth={3} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Trigger */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-20 bg-brand-surface/80 backdrop-blur-md border-b border-brand-border px-6 flex items-center justify-between z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-bg text-brand-accent rounded-xl flex items-center justify-center shadow-sm border border-brand-border">
            <Send className="text-brand-accent" size={16} strokeWidth={2.5} />
          </div>
          <h1 className="text-lg font-bold tracking-tight font-display text-brand-text">ApexReach</h1>
        </div>
        <div className="flex items-center gap-3">
          <NotificationCenter />
          <button 
            onClick={() => setIsOpen(true)}
            className="p-2.5 bg-brand-bg hover:bg-brand-surface rounded-xl transition-all duration-150 text-brand-muted hover:text-brand-text"
          >
            <Menu size={20} />
          </button>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside className="w-80 bg-brand-surface border-r border-brand-border flex flex-col hidden md:flex h-screen sticky top-0 z-30">
        <NavContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-brand-bg/60 backdrop-blur-sm z-50 md:hidden"
          onClick={() => setIsOpen(false)}
        >
          <aside 
            className="w-80 h-full bg-brand-surface flex flex-col shadow-2xl border-r border-brand-border"
            onClick={e => e.stopPropagation()}
          >
            <NavContent />
          </aside>
        </div>
      )}
    </>
  );
}
