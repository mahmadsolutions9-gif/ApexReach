import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import socket from '../lib/socket';
import { motion, AnimatePresence } from 'motion/react';
import { Activity as ActivityIcon, Mail, MousePointer2, MessageSquare, Bell, Calendar, Filter, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { safeFormat } from '../lib/dateUtils';
import { cn } from '../lib/utils';
import TimeAgo from '../components/TimeAgo';

interface ActivityItem {
  id: number;
  type: string;
  title: string;
  message: string;
  campaign_id: number;
  campaign_name: string;
  created_at: string;
}

export default function Activity() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCampaigns, setExpandedCampaigns] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const res = await api.get('/api/notifications');
        // In a real app, we might have a dedicated activity endpoint, 
        // but for now we'll use notifications as they represent activities.
        setActivities(res.data);
      } catch (error) {
        console.error('Failed to fetch activities', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchActivities();

    // Socket listeners for real-time activity
    const handleNotification = (notification: any) => {
      setActivities(prev => {
        if (prev.some(a => a.id === notification.id)) return prev;
        return [notification, ...prev];
      });
    };

    socket.on('notification', handleNotification);

    return () => {
      socket.off('notification', handleNotification);
    };
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'open': return <Mail className="text-blue-500" size={18} />;
      case 'click': return <MousePointer2 className="text-green-500" size={18} />;
      case 'reply': return <MessageSquare className="text-purple-500" size={18} />;
      default: return <Bell className="text-gray-500" size={18} />;
    }
  };

  const filteredActivities = activities.filter(activity => 
    activity.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    activity.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
    activity.campaign_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedActivities = filteredActivities.reduce((acc, activity) => {
    const campaignId = activity.campaign_id || 0;
    if (!acc[campaignId]) {
      acc[campaignId] = {
        name: activity.campaign_name || 'General Notifications',
        items: []
      };
    }
    acc[campaignId].items.push(activity);
    return acc;
  }, {} as Record<number, { name: string, items: ActivityItem[] }>);

  const toggleCampaign = (id: number) => {
    setExpandedCampaigns(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-12 pb-24 space-y-12 bg-slate-50 min-h-screen">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
      >
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-white text-slate-900 text-[10px] font-black uppercase tracking-[0.2em] rounded-full border border-slate-200 shadow-sm">Activity Center</span>
            <div className="h-px w-12 bg-slate-200" />
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter font-display mb-4 leading-[0.9] text-slate-900">
            Recent <span className="text-slate-300">Activity.</span>
          </h1>
          <p className="text-slate-500 text-xl max-w-2xl font-medium leading-relaxed">
            Track every interaction across your campaigns in real-time.
          </p>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-80 group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" size={20} />
            <input 
              id="input-search-activity"
              type="text"
              placeholder="Search activity..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-[1.5rem] shadow-xl focus:border-slate-400 outline-none font-bold text-slate-900 transition-all"
            />
          </div>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-white rounded-[3rem] border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : Object.keys(groupedActivities).length === 0 ? (
        <div className="bg-white rounded-[3rem] p-24 text-center border border-slate-200 shadow-xl shadow-slate-200/50">
          <div className="w-24 h-24 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8 border border-slate-200">
            <ActivityIcon size={48} className="text-slate-300" />
          </div>
          <h3 className="text-2xl font-bold font-display tracking-tight mb-2 text-slate-900">No activity found</h3>
          <p className="text-slate-500 font-medium">Try adjusting your search or check back later.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedActivities).map(([campaignId, group], index) => {
            const id = parseInt(campaignId);
            const isExpanded = expandedCampaigns[id] !== false; // Default to expanded
            const g = group as { name: string, items: ActivityItem[] };

            return (
              <motion.div 
                key={campaignId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-[3rem] overflow-hidden border border-slate-200 shadow-xl shadow-slate-200/50"
              >
                <button 
                  id={`btn-toggle-campaign-${campaignId}`}
                  onClick={() => toggleCampaign(id)}
                  className="w-full p-8 flex items-center justify-between bg-white hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-6">
                    <div className="w-14 h-14 bg-slate-50 border border-slate-200 text-slate-900 rounded-2xl flex items-center justify-center shadow-sm">
                      <ActivityIcon size={28} strokeWidth={2.5} />
                    </div>
                    <div className="text-left">
                      <h3 className="text-2xl font-bold font-display tracking-tight text-slate-900">{g.name}</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                        {g.items.length} Activities
                      </p>
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
                    {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 space-y-2 bg-slate-50/50">
                        {g.items.map((item, i) => (
                          <div 
                            key={item.id}
                            className="p-6 bg-white hover:bg-slate-50 rounded-[2rem] border border-slate-100 hover:border-slate-200 shadow-sm transition-all flex flex-col md:flex-row gap-6 items-start md:items-center group"
                          >
                            <div className={cn(
                              "w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm transition-transform group-hover:scale-110",
                              item.type === 'open' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 
                              item.type === 'click' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 
                              item.type === 'reply' ? 'bg-purple-50 text-purple-600 border border-purple-100' : 'bg-slate-100 text-slate-400 border border-slate-200'
                            )}>
                              {getIcon(item.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-1">
                                <h4 className="text-lg font-bold tracking-tight text-slate-900">{item.title}</h4>
                                <span className="px-2 py-0.5 bg-slate-100 text-[9px] font-black uppercase tracking-widest rounded-full text-slate-500">
                                  {item.type}
                                </span>
                              </div>
                              <p className="text-slate-600 font-medium leading-relaxed">{item.message}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <Calendar size={12} />
                                {safeFormat(item.created_at, 'MMM d, yyyy')}
                              </div>
                              <TimeAgo 
                                date={item.created_at} 
                                className="text-[10px] font-bold text-slate-400" 
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
