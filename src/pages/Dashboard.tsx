import { useState, useEffect } from 'react';
import api from '../lib/api';
import socket from '../lib/socket';
import { Link, useNavigate } from 'react-router-dom';
import { 
  BarChart3, 
  Send, 
  Users, 
  ShieldCheck, 
  TrendingUp, 
  AlertCircle,
  ArrowUpRight,
  Clock,
  Mail,
  X,
  Check,
  ChevronRight,
  Sparkles,
  RefreshCw,
  Play,
  Pause,
  Plus,
  Activity,
  MousePointer2,
  Bell,
  MessageSquare,
  MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import toast from 'react-hot-toast';
import { safeLocaleTimeString, safeLocaleDateString } from '../lib/dateUtils';
import { cn } from '../lib/utils';
import TimeAgo from '../components/TimeAgo';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalSent: 0,
    delivered: 0,
    failed: 0,
    opened: 0,
    replied: 0,
    activeCampaigns: 0,
    activeSmtp: 0,
    totalContacts: 0,
    recentActivity: []
  });

  const [recentCampaigns, setRecentCampaigns] = useState<any[]>([]);
  const [smtpAccounts, setSmtpAccounts] = useState<any[]>([]);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [followUpNotifications, setFollowUpNotifications] = useState<any[]>([]);
  const [isQuickSendOpen, setIsQuickSendOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [quickSendData, setQuickSendData] = useState({
    to: '',
    subject: '',
    body: '',
    smtpId: ''
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [campaignsRes, smtpRes, statsRes, followUpsRes, notificationsRes] = await Promise.all([
          api.get('/api/campaigns'),
          api.get('/api/smtp'),
          api.get('/api/dashboard/stats'),
          api.get('/api/dashboard/follow-ups'),
          api.get('/api/notifications/follow-ups')
        ]);

        if (Array.isArray(campaignsRes.data)) {
          setRecentCampaigns(campaignsRes.data.slice(0, 5));
        }
        
        if (Array.isArray(followUpsRes.data)) {
          setFollowUps(followUpsRes.data.slice(0, 5));
        }

        if (Array.isArray(notificationsRes.data)) {
          setFollowUpNotifications(notificationsRes.data);
          if (notificationsRes.data.length > 0) {
            const totalFollowUps = notificationsRes.data.reduce((acc: number, curr: any) => acc + curr.count1d + curr.count3d + curr.count7d, 0);
            toast(`You have ${totalFollowUps} leads needing follow-up across ${notificationsRes.data.length} campaigns.`, {
              icon: '🔔',
              duration: 6000,
            });
          }
        }

        if (Array.isArray(smtpRes.data)) {
          setSmtpAccounts(smtpRes.data);
          if (smtpRes.data.length > 0) {
            setQuickSendData(prev => ({ ...prev, smtpId: smtpRes.data[0].id.toString() }));
          }
        }
        setStats(statsRes.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();

    const handleActivity = (data: any) => {
      setStats(prev => {
        const newActivity = [data, ...prev.recentActivity].slice(0, 5);
        return {
          ...prev,
          opened: (data.type === 'open' && data.isFirst) ? prev.opened + 1 : prev.opened,
          recentActivity: newActivity
        };
      });
    };

    const handleReply = (data: any) => {
      setStats(prev => {
        const replyActivity = {
          type: 'reply',
          contactName: data.contactName,
          contactEmail: data.contactEmail,
          campaignName: data.campaignName,
          timestamp: data.timestamp,
          city: 'Unknown',
          country: 'Unknown'
        };
        const newActivity = [replyActivity, ...prev.recentActivity].slice(0, 5);
        return {
          ...prev,
          replied: prev.replied + 1,
          opened: data.isFirstEngagement ? prev.opened + 1 : prev.opened,
          recentActivity: newActivity
        };
      });
    };

    socket.on('activity', handleActivity);
    socket.on('reply', handleReply);

    return () => {
      socket.off('activity', handleActivity);
      socket.off('reply', handleReply);
    };
  }, []);

  const handleToggleStatus = async (campaignId: number, currentStatus: string) => {
    const newStatus = currentStatus === 'paused' ? 'sending' : 'paused';
    try {
      await api.put(`/api/campaigns/${campaignId}/status`, { status: newStatus });
      setRecentCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, status: newStatus } : c));
      toast.success(`Campaign ${newStatus === 'paused' ? 'paused' : 'resumed'}`);
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleQuickSend = async () => {
    if (!quickSendData.to || !quickSendData.subject || !quickSendData.body || !quickSendData.smtpId) {
      return toast.error('Please fill all fields');
    }

    setIsSending(true);
    try {
      await api.post('/api/quick-send', quickSendData);
      toast.success('Email sent successfully!');
      setIsQuickSendOpen(false);
      setQuickSendData({ to: '', subject: '', body: '', smtpId: smtpAccounts[0]?.id?.toString() || '' });
    } catch (err) {
      toast.error('Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  const cards = [
    { label: 'Total Emails Sent', value: stats.totalSent, icon: Send, color: 'bg-blue-50 text-blue-600 border border-blue-100' },
    { label: 'Reply Rate', value: stats.totalSent > 0 ? `${Math.round((stats.replied / stats.totalSent) * 100)}%` : '0%', icon: Sparkles, color: 'bg-emerald-50 text-emerald-600 border border-emerald-100' },
    { label: 'Not Replied', value: stats.totalSent - stats.replied, icon: Mail, color: 'bg-orange-50 text-orange-600 border border-orange-100' },
    { label: 'Total Contacts', value: stats.totalContacts, icon: Users, color: 'bg-purple-50 text-purple-600 border border-purple-100' },
  ];

  return (
    <div className="relative min-h-screen pb-12 bg-slate-50">
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ x: [0, 15, 0], y: [0, 10, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px]" 
        />
        <motion.div 
          animate={{ x: [0, -10, 0], y: [0, 15, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/5 rounded-full blur-[120px]" 
        />
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 space-y-12 pt-16 md:pt-12">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-10 mb-16">
          <div className="max-w-3xl">
            <div className="flex items-center gap-4 mb-6">
              <span className="px-4 py-1.5 bg-white text-slate-900 text-[10px] font-black uppercase tracking-[0.3em] rounded-full shadow-lg border border-slate-200">Command Center v2</span>
              <div className="h-px w-20 bg-slate-200" />
            </div>
            <h1 className="text-7xl md:text-9xl font-bold tracking-tighter font-display mb-8 leading-[0.8] text-slate-900">
              Growth <span className="text-slate-200">Intelligence.</span>
            </h1>
            <p className="text-slate-500 text-2xl font-medium leading-relaxed max-w-2xl">
              Welcome back to your <span className="text-slate-900 font-bold">ApexReach</span> command center. Monitor performance and scale your outreach.
            </p>
          </div>
          <div className="bg-white px-8 py-5 rounded-[2.5rem] flex items-center gap-5 text-sm font-bold shadow-xl border border-slate-200">
            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">System Live</span>
              <span className="text-slate-900">{safeLocaleDateString(new Date(), undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {cards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.15 }}
              className="bg-white p-10 rounded-[3rem] card-hover relative overflow-hidden group border border-slate-200 shadow-xl"
            >
              <div className={`absolute top-0 right-0 w-32 h-32 ${card.color.split(' ')[0]} opacity-10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:opacity-20 transition-opacity duration-150`} />
              <div className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center mb-8 shadow-sm transition-all duration-150",
                card.label === 'Total Emails Sent' ? "bg-blue-50 text-blue-600 border border-blue-100" :
                card.label === 'Open Rate' ? "bg-purple-50 text-purple-600 border border-purple-100" :
                card.label === 'Reply Rate' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                "bg-orange-50 text-orange-600 border border-orange-100"
              )}>
                <card.icon size={32} strokeWidth={1.5} />
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">{card.label}</p>
              <div className="flex items-baseline gap-4 mt-1">
                <h3 className="text-5xl font-bold font-display tracking-tight text-slate-900">{card.value.toLocaleString()}</h3>
                <span className="text-[10px] font-black text-emerald-600 flex items-center bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 shadow-sm">
                  <ArrowUpRight size={14} strokeWidth={3} className="mr-1" />
                  12%
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 pt-8">
          <div className="lg:col-span-2 space-y-10">
            {followUpNotifications.length > 0 && (
              <div className="bg-white rounded-[3.5rem] shadow-xl overflow-hidden border border-slate-200">
                <div className="p-12 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <div>
                    <h3 className="text-3xl font-bold font-display tracking-tight flex items-center gap-4 text-slate-900">
                      <Bell className="text-orange-500 animate-bounce" size={32} />
                      Follow-up Reminders
                    </h3>
                    <p className="text-sm text-slate-500 font-medium mt-1">Campaigns requiring attention based on reply delays.</p>
                  </div>
                </div>
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {followUpNotifications.map((notif) => (
                    <div key={notif.campaignId} className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-200 hover:border-slate-300 transition-all duration-150 group">
                      <h4 className="text-xl font-bold mb-4 text-slate-900">{notif.campaignName}</h4>
                      <div className="flex flex-wrap gap-3">
                        {notif.count1d > 0 && (
                          <span className="px-4 py-2 bg-amber-50 text-amber-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-amber-100">
                            {notif.count1d} Needs 1d Follow-up
                          </span>
                        )}
                        {notif.count3d > 0 && (
                          <span className="px-4 py-2 bg-orange-50 text-orange-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-orange-100">
                            {notif.count3d} Needs 3d Follow-up
                          </span>
                        )}
                        {notif.count7d > 0 && (
                          <span className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-100">
                            {notif.count7d} Needs 7d Follow-up
                          </span>
                        )}
                      </div>
                      <Link 
                        to={`/campaigns`} 
                        className="mt-6 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-500 transition-colors duration-150"
                      >
                        View Campaign <ChevronRight size={14} />
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-[3.5rem] shadow-xl overflow-hidden border border-slate-200">
              <div className="p-12 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="text-3xl font-bold font-display tracking-tight text-slate-900">Daily Follow-ups</h3>
                  <p className="text-sm text-slate-500 font-medium mt-1">Leads who opened your email but haven't replied yet.</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="px-4 py-2 bg-orange-50 text-orange-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-orange-100">
                    {followUps.length} Shown
                  </div>
            <Link 
              id="link-show-all-followups"
              to="/activity" 
              className="px-6 py-3 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-150 flex items-center gap-2 group border border-slate-200 hover:border-slate-300"
            >
              Show All <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform duration-150" />
            </Link>
                </div>
              </div>
              <div className="p-8">
                {followUps.length === 0 ? (
                  <div className="py-20 text-center">
                    <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-emerald-100">
                      <Check size={32} />
                    </div>
                    <p className="text-slate-900 font-bold text-lg">All caught up!</p>
                    <p className="text-slate-500 text-sm">No pending follow-ups at the moment.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {followUps.map((f) => (
                      <div key={f.logId} className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-200 hover:border-slate-300 transition-all duration-150 group">
                        <div className="flex items-center gap-6">
                          <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform duration-150 border border-orange-100">
                            <Clock size={24} />
                          </div>
                          <div>
                            <p className="font-bold text-lg tracking-tight text-slate-900">{f.contactName || f.contactEmail}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{f.campaignName}</span>
                              <div className="w-1 h-1 bg-slate-300 rounded-full" />
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">Opened</span>
                                <TimeAgo date={f.openedAt} className="text-[10px] font-bold text-orange-600 uppercase tracking-widest" />
                              </div>
                            </div>
                          </div>
                        </div>
                              <button 
                                id={`btn-followup-${f.logId}`}
                                onClick={() => {
                            setQuickSendData({
                              ...quickSendData,
                              to: f.contactEmail,
                              subject: `Re: Follow up on ${f.campaignName}`,
                              body: `<p>Hi ${f.contactName || 'there'},</p><p>I noticed you took a look at my previous email. I'd love to hear your thoughts!</p>`
                            });
                            setIsQuickSendOpen(true);
                          }}
                          className="px-6 py-3 bg-white hover:bg-slate-50 text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 transition-all duration-150"
                        >
                          Follow Up
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-[3.5rem] shadow-xl overflow-hidden border border-slate-200">
              <div className="p-12 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="text-3xl font-bold font-display tracking-tight text-slate-900">Recent Activity</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm text-slate-500 font-medium">Real-time engagement updates.</p>
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[8px] font-black uppercase tracking-widest border border-blue-100">
                      <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse" />
                      Live
                    </div>
                  </div>
                </div>
                <Link 
                  id="link-show-all-activity"
                  to="/activity" 
                  className="px-6 py-3 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-150 flex items-center gap-2 group border border-slate-200 hover:border-slate-300"
                >
                  Show All <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform duration-150" />
                </Link>
              </div>
              <div className="p-8">
                {(!stats.recentActivity || stats.recentActivity.length === 0) ? (
                  <div className="py-20 text-center">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-blue-100">
                      <Activity size={32} />
                    </div>
                    <p className="text-slate-500 font-bold text-lg">No activity yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {stats.recentActivity.map((activity: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-200 hover:border-slate-300 transition-all duration-150 group">
                        <div className="flex items-center gap-6">
                          <div className={cn(
                            "w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform duration-150 border shadow-sm",
                            activity.type === 'open' ? "bg-purple-50 text-purple-600 border-purple-100" : 
                            activity.type === 'reply' ? "bg-orange-50 text-orange-600 border-orange-100" :
                            "bg-blue-50 text-blue-600 border-blue-100"
                          )}>
                            {activity.type === 'open' ? <Mail size={24} /> : 
                             activity.type === 'reply' ? <MessageSquare size={24} /> :
                             <MousePointer2 size={24} />}
                          </div>
                          <div>
                            <p className="font-bold text-lg tracking-tight text-slate-900">{activity.contactName || activity.contactEmail}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{activity.campaignName}</span>
                              <div className="w-1 h-1 bg-slate-200 rounded-full" />
                              <span className={cn(
                                "text-[10px] font-bold uppercase tracking-widest",
                                activity.type === 'open' ? "text-purple-600" : 
                                activity.type === 'reply' ? "text-orange-600" :
                                "text-blue-600"
                              )}>
                                {activity.type === 'open' ? 'Opened' : 
                                 activity.type === 'reply' ? 'Replied' :
                                 'Clicked'} {safeLocaleTimeString(activity.timestamp, [], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right hidden md:block">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{activity.city || 'Unknown'}</p>
                          <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{activity.country || 'Unknown'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-[3.5rem] shadow-xl overflow-hidden border border-slate-200">
              <div className="p-12 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="text-3xl font-bold font-display tracking-tight text-slate-900">Recent Campaigns</h3>
                  <p className="text-sm text-zinc-500 font-medium mt-1">Real-time performance of your latest sequences.</p>
                </div>
                <Link 
                  id="link-view-all-campaigns"
                  to="/campaigns" 
                  className="px-6 py-3 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-150 flex items-center gap-2 group border border-slate-200 hover:border-slate-300"
                >
                  View All <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform duration-150" />
                </Link>
              </div>
              <div className="p-8 overflow-x-auto no-scrollbar">
                {recentCampaigns.length === 0 ? (
                  <div className="p-24 text-center space-y-8">
                    <div className="w-24 h-24 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto text-slate-300 shadow-inner border border-slate-200">
                      <AlertCircle size={48} strokeWidth={1} />
                    </div>
                    <div className="space-y-2">
                      <p className="text-slate-500 text-xl font-bold">No campaigns found.</p>
                      <p className="text-slate-400 text-sm font-medium">Start your first outreach sequence today!</p>
                    </div>
                    <Link 
                      id="btn-create-campaign-empty"
                      to="/campaigns/new" 
                      className="inline-flex items-center gap-3 bg-slate-900 hover:bg-slate-800 text-white px-10 py-5 rounded-[2rem] font-black text-sm uppercase tracking-widest border border-slate-200 transition-all duration-150"
                    >
                      <Plus size={20} strokeWidth={3} />
                      Create Campaign
                    </Link>
                  </div>
                ) : (
                  <table className="w-full border-separate border-spacing-y-4">
                    <thead>
                      <tr className="text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] opacity-60">
                        <th className="px-8 py-2">Campaign</th>
                        <th className="px-8 py-2">Status</th>
                        <th className="px-8 py-2">Sent</th>
                        <th className="px-8 py-2">Success</th>
                        <th className="px-8 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentCampaigns.map((c) => (
                        <tr key={c.id} className="group transition-all duration-150">
                          <td className="px-8 py-6 bg-slate-50 first:rounded-l-[2rem] group-hover:bg-slate-100 transition-all border-y border-l border-transparent group-hover:border-slate-200">
                            <p className="font-bold text-lg tracking-tight mb-1 text-slate-900">{c.name}</p>
                            <p className="text-xs text-slate-500 font-bold truncate max-w-[200px] uppercase tracking-wider">{c.subject}</p>
                          </td>
                          <td className="px-8 py-6 bg-slate-50 group-hover:bg-slate-100 transition-all border-y border-transparent group-hover:border-slate-200">
                            <span className={cn(
                              "px-5 py-2 text-[10px] font-black rounded-full uppercase tracking-[0.2em] inline-flex items-center gap-2 border shadow-sm",
                              c.status === 'completed' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                              c.status === 'sending' ? "bg-blue-50 text-blue-600 border-blue-100" :
                              c.status === 'paused' ? "bg-amber-50 text-amber-600 border-amber-100" :
                              "bg-slate-100 text-slate-500 border-slate-200"
                            )}>
                              {c.status === 'sending' && <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />}
                              {c.status}
                            </span>
                          </td>
                          <td className="px-8 py-6 bg-slate-50 group-hover:bg-slate-100 transition-all border-y border-transparent group-hover:border-slate-200 text-base font-bold tracking-tight text-slate-900">{c.sentCount?.toLocaleString() || 0}</td>
                          <td className="px-8 py-6 bg-slate-50 group-hover:bg-slate-100 transition-all border-y border-transparent group-hover:border-slate-200">
                            <div className="flex items-center gap-4">
                              <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden max-w-[80px] shadow-inner">
                                <div 
                                  className="h-full bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.3)]" 
                                  style={{ width: `${c.totalContacts > 0 ? Math.round(((c.sentCount || 0) / c.totalContacts) * 100) : 0}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                                {c.totalContacts > 0 ? Math.round(((c.sentCount || 0) / c.totalContacts) * 100) : 0}%
                              </span>
                            </div>
                          </td>
                          <td className="px-8 py-6 bg-slate-50 last:rounded-r-[2rem] group-hover:bg-slate-100 transition-all border-y border-r border-transparent group-hover:border-slate-200 text-right">
                            {(c.status === 'sending' || c.status === 'paused') && (
                              <button 
                                id={`btn-toggle-campaign-${c.id}`}
                                onClick={() => handleToggleStatus(c.id, c.status)}
                                className={cn(
                                  "w-12 h-12 flex items-center justify-center rounded-2xl transition-all duration-150 shadow-xl border-2",
                                  c.status === 'paused' ? "text-emerald-600 bg-white border-emerald-100 hover:bg-emerald-600 hover:text-white" : "text-amber-600 bg-white border-amber-100 hover:bg-amber-600 hover:text-white"
                                )}
                                title={c.status === 'paused' ? "Resume" : "Pause"}
                              >
                                {c.status === 'paused' ? <Play size={20} fill="currentColor" /> : <Pause size={20} fill="currentColor" />}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-10">
            <div className="bg-white p-12 rounded-[3.5rem] shadow-xl border border-slate-200 relative overflow-hidden group">
              <div className="relative z-10">
                <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-[2rem] flex items-center justify-center mb-10 shadow-2xl border border-emerald-100">
                  <TrendingUp size={40} strokeWidth={1.5} />
                </div>
                <h3 className="text-4xl font-bold mb-4 font-display tracking-tight text-slate-900">Technical Health</h3>
                <p className="text-slate-500 text-lg leading-relaxed mb-10">
                  Your sending infrastructure is performing at <span className="text-emerald-600 font-bold">Peak Efficiency</span>.
                </p>
                <div className="space-y-6">
                  {['SPF Record Verified', 'DKIM Signature Active', 'DMARC Policy Enforced'].map(item => (
                    <div key={item} className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest group/item">
                      <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.6)] group-hover/item:scale-150 transition-transform duration-150" />
                      <span className="text-slate-500 group-hover/item:text-slate-900 transition-colors duration-150">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute -right-24 -bottom-24 w-80 h-80 bg-emerald-500/5 rounded-full blur-[100px] group-hover:bg-emerald-500/10 transition-all duration-150" />
            </div>

            <div className="bg-white p-12 rounded-[3.5rem] shadow-xl border border-slate-200">
              <h3 className="text-2xl font-bold mb-10 flex items-center gap-4 font-display tracking-tight text-slate-900">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center border border-blue-100">
                  <Bell size={24} strokeWidth={2.5} />
                </div>
                Follow-up Reminders
              </h3>
              <div className="space-y-5">
                {followUpNotifications.length === 0 ? (
                  <div className="p-10 text-center bg-slate-50 rounded-[2.5rem] border border-slate-200">
                    <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">No pending follow-ups</p>
                  </div>
                ) : (
                  followUpNotifications.map((notif: any) => (
                    <div key={notif.campaignId} className="p-6 bg-slate-50 rounded-[2.5rem] border border-slate-200 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <p className="font-black text-[10px] uppercase tracking-widest truncate max-w-[150px] text-slate-900">{notif.campaignName}</p>
                        <div className="flex gap-3">
                          <button 
                            onClick={async () => {
                              try {
                                const res = await api.post(`/api/campaigns/${notif.campaignId}/follow-up-list`, { category: 'follow-up' });
                                navigate('/campaigns/new', { 
                                  state: { 
                                    cloneFromId: notif.campaignId,
                                    newListId: res.data.listId 
                                  } 
                                });
                              } catch (err) {
                                toast.error('Failed to prepare follow-up campaign');
                              }
                            }}
                            className="text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:underline"
                          >
                            Follow-up
                          </button>
                          <Link 
                            to="/campaigns" 
                            className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline"
                          >
                            Analytics
                          </Link>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-white p-3 rounded-2xl text-center border border-slate-200">
                          <p className="text-lg font-black text-slate-900">{notif.count1d}</p>
                          <p className="text-[8px] font-black uppercase tracking-tighter text-slate-400">1 Day</p>
                        </div>
                        <div className="bg-white p-3 rounded-2xl text-center border border-slate-200">
                          <p className="text-lg font-black text-slate-900">{notif.count3d}</p>
                          <p className="text-[8px] font-black uppercase tracking-tighter text-slate-400">3 Days</p>
                        </div>
                        <div className="bg-white p-3 rounded-2xl text-center border border-slate-200">
                          <p className="text-lg font-black text-slate-900">{notif.count7d}</p>
                          <p className="text-[8px] font-black uppercase tracking-tighter text-slate-400">7 Days</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white p-12 rounded-[3.5rem] shadow-xl border border-slate-200">
              <h3 className="text-2xl font-bold mb-10 flex items-center gap-4 font-display tracking-tight text-slate-900">
                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100">
                  <Activity size={24} strokeWidth={2.5} />
                </div>
                Live Activity
              </h3>
              <div className="space-y-6">
                {stats.recentActivity.length === 0 ? (
                  <div className="p-10 text-center bg-slate-50 rounded-[2.5rem] border border-slate-200">
                    <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">No recent activity</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {stats.recentActivity.slice(0, 3).map((activity, i) => (
                      <motion.div 
                        key={i}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200 hover:border-slate-300 transition-all duration-150 group"
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border",
                          activity.type === 'open' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                          activity.type === 'click' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                          'bg-purple-50 text-purple-600 border-purple-100'
                        )}>
                          {activity.type === 'open' ? <Mail size={16} /> : 
                           activity.type === 'click' ? <MousePointer2 size={16} /> : 
                           <MessageSquare size={16} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <p className="text-xs font-black text-slate-900 truncate">
                              {activity.contactName || activity.contactEmail || 'Someone'}
                            </p>
                            <TimeAgo 
                              date={activity.timestamp} 
                              className="text-[9px] font-bold text-slate-400 uppercase whitespace-nowrap ml-2" 
                            />
                          </div>
                          <p className="text-[10px] text-slate-500 font-medium">
                            {activity.type === 'open' ? 'Opened' : 
                             activity.type === 'click' ? 'Clicked link in' : 
                             'Replied to'} <span className="text-slate-900 font-bold">{activity.campaignName}</span>
                          </p>
                          {(activity.city && activity.city !== 'Unknown') && (
                            <p className="text-[9px] text-slate-400 mt-1 flex items-center gap-1">
                              <MapPin size={10} /> {activity.city}, {activity.country}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white p-12 rounded-[3.5rem] shadow-xl border border-slate-200">
              <h3 className="text-2xl font-bold mb-10 flex items-center gap-4 font-display tracking-tight text-slate-900">
                <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center border border-orange-100">
                  <Sparkles size={24} strokeWidth={2.5} />
                </div>
                Quick Actions
              </h3>
              <div className="space-y-5">
                 <button 
                  id="btn-quick-send-action"
                  onClick={() => setIsQuickSendOpen(true)}
                  className="w-full flex items-center justify-between p-6 bg-slate-50 rounded-[2.5rem] hover:bg-slate-100 text-slate-900 transition-all duration-150 group shadow-sm hover:shadow-2xl border border-slate-200 hover:border-slate-300"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-white border border-slate-200 rounded-2xl flex items-center justify-center shadow-lg group-hover:bg-slate-50 group-hover:scale-105 transition-all duration-150">
                      <Mail size={24} className="text-slate-900" />
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] font-black uppercase tracking-widest mb-0.5">Quick Send</p>
                      <p className="text-xs text-slate-500 font-bold">Instant message</p>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center group-hover:bg-slate-50 transition-colors border border-slate-200">
                    <ChevronRight size={20} className="opacity-0 group-hover:opacity-100 transition-all -translate-x-4 group-hover:translate-x-0 duration-150" />
                  </div>
                </button>

                <Link 
                  id="link-import-leads-action"
                  to="/contacts"
                  className="w-full flex items-center justify-between p-6 bg-slate-50 rounded-[2.5rem] hover:bg-slate-100 text-slate-900 transition-all duration-150 group shadow-sm hover:shadow-2xl border border-slate-200 hover:border-slate-300"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-white border border-slate-200 rounded-2xl flex items-center justify-center shadow-lg group-hover:bg-slate-50 group-hover:scale-105 transition-all duration-150">
                      <Users size={24} className="text-slate-900" />
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] font-black uppercase tracking-widest mb-0.5">Import Leads</p>
                      <p className="text-xs text-slate-500 font-bold">Grow your list</p>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center group-hover:bg-slate-50 transition-colors border border-slate-200">
                    <ChevronRight size={20} className="opacity-0 group-hover:opacity-100 transition-all -translate-x-4 group-hover:translate-x-0 duration-150" />
                  </div>
                </Link>

                <Link 
                  id="link-new-campaign-action"
                  to="/campaigns/new"
                  className="w-full flex items-center justify-between p-6 bg-slate-50 rounded-[2.5rem] hover:bg-slate-100 text-slate-900 transition-all duration-150 group shadow-sm hover:shadow-2xl border border-slate-200 hover:border-slate-300"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-white border border-slate-200 rounded-2xl flex items-center justify-center shadow-lg group-hover:bg-slate-50 group-hover:scale-105 transition-all duration-150">
                      <Send size={24} className="text-slate-900" />
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] font-black uppercase tracking-widest mb-0.5">New Campaign</p>
                      <p className="text-xs text-slate-500 font-bold">Launch sequence</p>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center group-hover:bg-slate-50 transition-colors border border-slate-200">
                    <ChevronRight size={20} className="opacity-0 group-hover:opacity-100 transition-all -translate-x-4 group-hover:translate-x-0 duration-150" />
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isQuickSendOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto"
            onClick={() => setIsQuickSendOpen(false)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-3xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col my-auto border border-slate-200"
            >
              <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div>
                  <h2 className="text-3xl font-bold font-display text-slate-900">Quick Send</h2>
                  <p className="text-base text-slate-500 font-medium">Deliver an immediate message with precision.</p>
                </div>
                <button 
                  id="btn-close-quick-send"
                  onClick={() => setIsQuickSendOpen(false)}
                  className="p-3 hover:bg-slate-100 rounded-full transition-all duration-150"
                >
                  <X size={28} className="text-slate-400 hover:text-slate-900" />
                </button>
              </div>

              <div className="flex-1 p-10 overflow-y-auto space-y-8 no-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Recipient Email</label>
                    <input 
                      type="email"
                      value={quickSendData.to}
                      onChange={(e) => setQuickSendData({ ...quickSendData, to: e.target.value })}
                      placeholder="recipient@example.com"
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border border-slate-200 focus:border-slate-400 transition-all outline-none font-bold text-lg text-slate-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Sender Account</label>
                    <select 
                      value={quickSendData.smtpId}
                      onChange={(e) => setQuickSendData({ ...quickSendData, smtpId: e.target.value })}
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border border-slate-200 focus:border-slate-400 transition-all outline-none font-bold text-lg appearance-none cursor-pointer text-slate-900"
                    >
                      {smtpAccounts.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.from_email})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Subject Line</label>
                  <input 
                    type="text"
                    value={quickSendData.subject}
                    onChange={(e) => setQuickSendData({ ...quickSendData, subject: e.target.value })}
                    placeholder="Enter a compelling subject..."
                    className="w-full px-6 py-4 bg-slate-50 rounded-2xl border border-slate-200 focus:border-slate-400 transition-all outline-none font-bold text-lg text-slate-900"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Message Content</label>
                  <div className="bg-slate-50 rounded-[2rem] overflow-hidden border border-slate-200 focus-within:border-slate-400 transition-all quill-custom">
                    <ReactQuill
                      theme="snow"
                      value={quickSendData.body}
                      onChange={(val) => setQuickSendData({ ...quickSendData, body: val })}
                      className="h-80 text-slate-900"
                      modules={{
                        toolbar: [
                          [{ 'header': [1, 2, false] }],
                          ['bold', 'italic', 'underline'],
                          [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                          ['link', 'clean']
                        ],
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="p-10 bg-slate-50 border-t border-slate-100 flex justify-end items-center gap-6">
                <button 
                  id="btn-cancel-quick-send"
                  onClick={() => setIsQuickSendOpen(false)}
                  className="px-8 py-4 rounded-2xl font-bold text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all duration-150"
                >
                  Discard
                </button>
                <button 
                  id="btn-submit-quick-send"
                  onClick={handleQuickSend}
                  disabled={isSending}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-12 py-4 rounded-2xl font-black text-lg uppercase tracking-widest transition-all duration-150 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSending ? (
                    <RefreshCw size={20} className="animate-spin" />
                  ) : (
                    <Send size={20} strokeWidth={2.5} />
                  )}
                  <span>{isSending ? 'Sending...' : 'Send Now'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
