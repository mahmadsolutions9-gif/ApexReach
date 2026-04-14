import { useState, useEffect, useRef } from 'react';
import { Bell, Check, Mail, MousePointer2, MessageSquare, X, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import api from '../lib/api';
import socket from '../lib/socket';
import { useNavigate } from 'react-router-dom';
import TimeAgo from './TimeAgo';

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/api/notifications');
      setNotifications(res.data);
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    }
  };

  useEffect(() => {
    fetchNotifications();

    const handleNewNotification = (notification: any) => {
      setNotifications(prev => {
        // Avoid duplicates if we already have this ID
        if (prev.some(n => n.id === notification.id)) return prev;
        return [notification, ...prev];
      });
    };

    socket.on('notification', handleNewNotification);

    return () => {
      socket.off('notification', handleNewNotification);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const markAsRead = async (id: number) => {
    try {
      await api.post(`/api/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    } catch (error) {
      console.error('Failed to mark notification as read', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.post('/api/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (error) {
      console.error('Failed to mark all as read', error);
    }
  };

  const handleNotificationClick = (notification: any) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    
    if (notification.campaign_id) {
      // Redirect to campaigns list with a hash or state to highlight the card
      navigate('/campaigns', { state: { highlightCampaignId: notification.campaign_id } });
    }
    setIsOpen(false);
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const filteredNotifications = (filter === 'all' ? notifications : notifications.filter(n => !n.is_read)).slice(0, 6);

  const getIcon = (type: string) => {
    switch (type) {
      case 'open': return <Mail className="text-blue-500" size={16} />;
      case 'click': return <MousePointer2 className="text-green-500" size={16} />;
      case 'reply': return <MessageSquare className="text-purple-500" size={16} />;
      default: return <Bell className="text-gray-500" size={16} />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-3 bg-slate-100 border border-slate-200 rounded-2xl hover:bg-slate-200 transition-all group"
      >
        <Bell size={20} className={unreadCount > 0 ? "animate-bounce text-slate-900" : "text-slate-500"} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-slate-900 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white shadow-lg">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Mobile Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[60] sm:hidden"
            />
            
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="fixed inset-x-4 top-24 sm:absolute sm:inset-x-auto sm:left-0 sm:top-full sm:mt-4 w-auto sm:w-96 bg-white rounded-[2rem] shadow-2xl border border-slate-200 z-[70] overflow-hidden"
            >
            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-lg font-black tracking-tight text-slate-900">Notifications</h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                  {unreadCount} Unread
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={markAllAsRead}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500 hover:text-slate-900"
                  title="Mark all as read"
                >
                  <Check size={18} />
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500 hover:text-slate-900"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-2 flex gap-1 bg-white border-b border-slate-200">
              <button 
                onClick={() => setFilter('all')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${filter === 'all' ? 'bg-slate-100 text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                All
              </button>
              <button 
                onClick={() => setFilter('unread')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${filter === 'unread' ? 'bg-slate-100 text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                Unread
              </button>
            </div>

            <div className="max-h-[calc(100vh-16rem)] sm:max-h-[400px] overflow-y-auto no-scrollbar">
              {filteredNotifications.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-slate-200">
                    <Bell size={24} className="text-slate-300" />
                  </div>
                  <p className="text-sm font-bold text-slate-500">No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  <AnimatePresence initial={false}>
                    {filteredNotifications.map((n) => (
                      <motion.div 
                        key={n.id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        onClick={() => handleNotificationClick(n)}
                        className={`p-4 hover:bg-slate-50 cursor-pointer transition-colors flex gap-4 relative group ${!n.is_read ? 'bg-blue-50' : ''}`}
                      >
                        {!n.is_read && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
                        )}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          n.type === 'open' ? 'bg-blue-100' : 
                          n.type === 'click' ? 'bg-green-100' : 
                          n.type === 'reply' ? 'bg-purple-100' : 'bg-slate-100'
                        }`}>
                          {getIcon(n.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <p className="text-xs font-black text-slate-900 truncate">{n.title}</p>
                            <TimeAgo 
                              date={n.created_at} 
                              className="text-[9px] font-bold text-slate-500 uppercase" 
                            />
                          </div>
                          <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                            {n.message}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 text-center">
              <button 
                onClick={() => {
                  setIsOpen(false);
                  navigate('/activity');
                }}
                className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-colors"
              >
                Show All Activity
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </div>
  );
}
