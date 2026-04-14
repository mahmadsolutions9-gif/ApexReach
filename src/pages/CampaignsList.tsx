import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import socket from '../lib/socket';
import { 
  Send, 
  Trash2, 
  Copy, 
  Play, 
  Pause, 
  Square,
  BarChart3, 
  Plus,
  Edit2,
  X,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { parseSafeDate } from '../lib/dateUtils';
import TimeAgo from '../components/TimeAgo';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function CampaignsList() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<'replied' | 'follow-up' | 'not-opened' | 'opened' | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [highlightedId, setHighlightedId] = useState<number | null>(null);

  useEffect(() => {
    if (location.state?.highlightCampaignId) {
      const id = location.state.highlightCampaignId;
      setHighlightedId(id);
      
      // Scroll to the element
      setTimeout(() => {
        const element = document.getElementById(`campaign-${id}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);

      // Clear the highlight after some time
      const timer = setTimeout(() => {
        setHighlightedId(null);
        // Clear location state to prevent re-highlighting on refresh
        window.history.replaceState({}, document.title);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [location.state]);

  useEffect(() => {
    fetchCampaigns();

    const handleActivity = (data: any) => {
      if (data.type === 'open' && data.isFirst) {
        setCampaigns(prev => prev.map(c => {
          if (c.id === parseInt(data.campaignId)) {
            return { ...c, openedCount: (c.openedCount || 0) + 1 };
          }
          return c;
        }));
      } else if (data.type === 'click' && data.isFirst) {
        setCampaigns(prev => prev.map(c => {
          if (c.id === parseInt(data.campaignId)) {
            return { ...c, clickedCount: (c.clickedCount || 0) + 1 };
          }
          return c;
        }));
      }
    };

    const handleReply = (data: any) => {
      setCampaigns(prev => prev.map(c => {
        if (c.id === parseInt(data.campaignId)) {
          return { 
            ...c, 
            repliedCount: (c.repliedCount || 0) + 1,
            openedCount: data.isFirstEngagement ? (c.openedCount || 0) + 1 : (c.openedCount || 0),
            openedNotRepliedCount: data.isFirstEngagement ? (c.openedNotRepliedCount || 0) : Math.max(0, (c.openedNotRepliedCount || 0) - 1)
          };
        }
        return c;
      }));
    };

    socket.on('activity', handleActivity);
    socket.on('reply', handleReply);

    const interval = setInterval(fetchCampaigns, 10000); // Increase interval since we have real-time updates
    return () => {
      clearInterval(interval);
      socket.off('activity', handleActivity);
      socket.off('reply', handleReply);
    };
  }, []);

  const fetchCampaigns = async () => {
    try {
      const res = await api.get('/api/campaigns');
      if (Array.isArray(res.data)) {
        setCampaigns(res.data);
      } else {
        setCampaigns([]);
      }
    } catch (err) {
      toast.error('Failed to fetch campaigns');
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (campaignId: number, currentStatus: string) => {
    const newStatus = currentStatus === 'paused' ? 'sending' : 'paused';
    try {
      await api.put(`/api/campaigns/${campaignId}/status`, { status: newStatus });
      setCampaigns(prev => Array.isArray(prev) ? prev.map(c => c.id === campaignId ? { ...c, status: newStatus } : c) : []);
      toast.success(`Campaign ${newStatus === 'paused' ? 'paused' : 'resumed'}`);
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleStop = async (campaignId: number) => {
    try {
      await api.put(`/api/campaigns/${campaignId}/status`, { status: 'completed' });
      setCampaigns(prev => Array.isArray(prev) ? prev.map(c => c.id === campaignId ? { ...c, status: 'completed' } : c) : []);
      toast.success('Campaign stopped');
    } catch (err) {
      toast.error('Failed to stop campaign');
    }
  };

  const handleShowAnalytics = async (id: number) => {
    try {
      const res = await api.get(`/api/campaigns/${id}/analytics`);
      setAnalyticsData({ ...res.data, id });
    } catch (err) {
      toast.error('Failed to fetch analytics');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/campaigns/${deleteConfirmId}`);
      toast.success('Campaign deleted');
      setDeleteConfirmId(null);
      fetchCampaigns();
    } catch (err) {
      toast.error('Delete failed');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClone = async (id: number) => {
    try {
      await api.post(`/api/campaigns/${id}/clone`, {});
      toast.success('Campaign cloned');
      fetchCampaigns();
    } catch (err) {
      toast.error('Clone failed');
    }
  };

  const handleResend = async (id: number) => {
    try {
      await api.post(`/api/campaigns/${id}/resend`, {});
      toast.success('Campaign resending');
      fetchCampaigns();
    } catch (err) {
      toast.error('Resend failed');
    }
  };

  const handleStart = async (id: number) => {
    try {
      await api.post(`/api/campaigns/${id}/start`, {});
      toast.success('Campaign started');
      fetchCampaigns();
    } catch (err) {
      toast.error('Failed to start campaign');
    }
  };

  const handleMarkReplied = async (campaignId: number, contactId: number) => {
    try {
      await api.post(`/api/campaigns/${campaignId}/mark-replied`, { contactId });
      toast.success('Contact marked as replied');
      // Update local state
      setAnalyticsData((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          replied: prev.replied + 1,
          recentLogs: prev.recentLogs.map((log: any) => 
            log.contact_id === contactId ? { ...log, replied_at: new Date().toISOString() } : log
          )
        };
      });
      // Also update the main campaigns list
      setCampaigns(prev => prev.map(c => 
        c.id === campaignId ? { ...c, repliedCount: (c.repliedCount || 0) + 1 } : c
      ));
    } catch (err) {
      toast.error('Failed to mark as replied');
    }
  };

  const [bulkEmails, setBulkEmails] = useState('');
  const [showBulkModal, setShowBulkModal] = useState(false);

  const handleBulkMarkReplied = async () => {
    if (!analyticsData) return;
    const emails = bulkEmails.split(/[\n,]+/).map(e => e.trim()).filter(e => e.includes('@'));
    if (emails.length === 0) {
      toast.error('No valid emails found');
      return;
    }

    try {
      await api.post(`/api/campaigns/${analyticsData.id}/bulk-mark-replied`, { emails });
      toast.success(`Marked ${emails.length} emails as replied`);
      setShowBulkModal(false);
      setBulkEmails('');
      handleShowAnalytics(analyticsData.id); // Refresh analytics
      fetchCampaigns(); // Refresh main list
    } catch (err) {
      toast.error('Bulk update failed');
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 space-y-4">
      <RefreshCw size={32} className="animate-spin text-zinc-700" />
      <p className="text-zinc-500 font-medium">Loading campaigns...</p>
    </div>
  );

  return (
    <div className="relative min-h-screen pb-12">
      {/* Background Blobs */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ x: [0, -50, 0], y: [0, 25, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-400/10 rounded-full blur-[120px]" 
        />
        <motion.div 
          animate={{ x: [0, 25, 0], y: [0, -50, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-400/10 rounded-full blur-[120px]" 
        />
      </div>

      <div className="max-w-6xl mx-auto space-y-6 md:space-y-12 pt-16 md:pt-0">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 mb-12">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-4">
              <span className="px-3 py-1 bg-slate-100 text-slate-900 text-[10px] font-black uppercase tracking-[0.2em] rounded-full border border-slate-200">Campaigns</span>
              <div className="h-px w-12 bg-slate-200" />
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter font-display mb-4 leading-[0.9] text-slate-900">
              Outreach <span className="text-slate-400">Sequences.</span>
            </h1>
            <p className="text-slate-500 text-xl max-w-2xl font-medium leading-relaxed mb-8">
              Manage and monitor your automated email campaigns. Track performance and optimize your results.
            </p>

            <div className="relative max-w-md group">
              <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
              </div>
            <input
                id="input-search-campaigns"
                type="text"
                placeholder="Search campaigns..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-3xl text-sm font-bold placeholder:text-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-100 focus:border-slate-300 transition-all shadow-sm hover:shadow-md"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 pr-6 flex items-center text-slate-400 hover:text-slate-900 transition-colors"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>
          <Link 
            id="link-new-campaign"
            to="/campaigns/new"
            className="w-full lg:w-auto flex items-center justify-center group relative px-10 py-5 bg-slate-900 hover:bg-slate-800 text-white rounded-[2.5rem] font-black text-sm uppercase tracking-widest overflow-hidden transition-all border border-slate-900 hover:shadow-2xl hover:shadow-slate-200/50 hover:-translate-y-1 active:translate-y-0 whitespace-nowrap"
          >
            <span className="relative z-10 flex items-center gap-3">
              <Plus size={20} strokeWidth={3} />
              New Campaign
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 opacity-0 group-hover:opacity-10 transition-opacity duration-500" />
          </Link>
        </div>

        {!Array.isArray(campaigns) || campaigns.length === 0 ? (
          <div className="bg-white p-24 text-center space-y-8 rounded-[4rem] border border-slate-200 shadow-2xl shadow-slate-200/50 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-slate-100 transition-colors duration-700" />
            <div className="w-24 h-24 bg-slate-50 border border-slate-200 text-slate-900 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-sm group-hover:scale-110 transition-transform duration-500">
              <Send size={48} strokeWidth={1.5} className="group-hover:rotate-12 transition-transform" />
            </div>
            <div className="space-y-2">
              <h3 className="text-3xl font-black mb-4 font-display tracking-tight text-slate-900">No campaigns yet</h3>
              <p className="text-slate-500 max-w-sm mx-auto mb-12 text-lg leading-relaxed font-medium">Create your first campaign to start reaching out to your leads and growing your business.</p>
            </div>
            <Link
              to="/campaigns/new"
              className="inline-flex items-center gap-4 bg-slate-900 hover:bg-slate-800 text-white px-12 py-5 rounded-[2rem] font-black text-lg hover:shadow-2xl hover:-translate-y-1 active:translate-y-0 transition-all border border-slate-900 shadow-xl"
            >
              Get started <Plus size={24} strokeWidth={3} />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {campaigns
              .filter(c => 
                c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                c.subject.toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map((c, idx) => {
              const progress = c.totalContacts > 0 ? Math.round((c.processedCount / c.totalContacts) * 100) : 0;
              
              return (
                <motion.div
                  id={`campaign-${c.id}`}
                  key={c.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ 
                    opacity: 1, 
                    y: 0,
                    scale: highlightedId === c.id ? 1.05 : 1,
                    boxShadow: highlightedId === c.id ? '0 0 0 4px rgba(59, 130, 246, 0.5), 0 20px 40px rgba(0,0,0,0.1)' : '0 10px 30px rgba(0,0,0,0.05)'
                  }}
                  transition={{ 
                    delay: idx * 0.05, 
                    duration: highlightedId === c.id ? 0.5 : 0.2,
                    type: highlightedId === c.id ? "spring" : "tween"
                  }}
                  className={cn(
                    "bg-white rounded-[2.5rem] md:rounded-[3.5rem] p-6 md:p-10 flex flex-col border border-slate-200 shadow-sm card-hover group relative overflow-hidden transition-colors duration-500",
                    highlightedId === c.id ? "border-blue-500/50 bg-blue-50/50" : ""
                  )}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-slate-100 transition-colors" />
                  
                  <div className="flex justify-between items-start mb-8 relative z-10">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          "px-4 py-1.5 text-[10px] font-black rounded-full uppercase tracking-[0.2em] border shadow-sm",
                          c.status === 'completed' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                          c.status === 'sending' ? "bg-blue-50 text-blue-600 border-blue-100" :
                          c.status === 'paused' ? "bg-amber-50 text-amber-600 border-amber-100" :
                          "bg-slate-100 text-slate-500 border-slate-200"
                        )}>
                          {c.status}
                        </span>
                        {c.status === 'sending' && (
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100">
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                            Live
                          </div>
                        )}
                      </div>
                      <h3 className="text-3xl font-bold font-display tracking-tight group-hover:text-blue-600 transition-colors leading-tight text-slate-900">{c.name}</h3>
                      <p className="text-sm text-slate-500 font-medium line-clamp-1 italic opacity-60">"{c.subject}"</p>
                    </div>
                    
                    <div className="flex gap-2">
                      <button 
                        id={`btn-clone-campaign-${c.id}`}
                        onClick={() => handleClone(c.id)}
                        className="w-12 h-12 flex items-center justify-center bg-slate-50 hover:bg-slate-900 hover:text-white rounded-2xl transition-all shadow-sm hover:shadow-xl border border-slate-200 text-slate-500"
                        title="Clone"
                      >
                        <Copy size={18} strokeWidth={2} />
                      </button>
                      <button 
                        id={`btn-delete-campaign-${c.id}`}
                        onClick={() => {
                          setDeleteConfirmId(c.id);
                        }}
                        className="w-12 h-12 flex items-center justify-center bg-slate-50 hover:bg-red-500 hover:text-white rounded-2xl transition-all shadow-sm hover:shadow-xl border border-slate-200 text-slate-500"
                        title="Delete"
                      >
                        <Trash2 size={18} strokeWidth={2} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-10 relative z-10">
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 shadow-sm text-center">
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Sent</p>
                      <p className="text-lg font-bold font-display tracking-tight text-slate-900">{c.processedCount?.toLocaleString() || 0}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 shadow-sm text-center">
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Replied</p>
                      <p className="text-lg font-bold font-display tracking-tight text-orange-600">{c.repliedCount?.toLocaleString() || 0}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 shadow-sm text-center">
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Not Replied</p>
                      <p className="text-lg font-bold font-display tracking-tight text-slate-500">{(c.processedCount - c.repliedCount)?.toLocaleString() || 0}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 shadow-sm text-center">
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Total</p>
                      <p className="text-lg font-bold font-display tracking-tight text-slate-900">{c.totalContacts?.toLocaleString() || 0}</p>
                    </div>
                  </div>

                  <div className="space-y-4 mb-10 relative z-10">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                      <span>Campaign Progress</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        className={cn(
                          "h-full rounded-full shadow-[0_0_15px_rgba(59,130,246,0.2)]",
                          c.status === 'completed' ? "bg-emerald-500" : "bg-gradient-to-r from-blue-500 to-purple-500"
                        )}
                      />
                    </div>
                  </div>

                  <div className="mt-auto pt-8 border-t border-slate-100 flex flex-wrap gap-4 relative z-10">
                    {c.status === 'draft' ? (
                        <button 
                          id={`btn-launch-campaign-${c.id}`}
                          onClick={() => handleStart(c.id)}
                          className="flex-1 flex items-center justify-center gap-3 bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest border border-slate-900 hover:shadow-2xl hover:-translate-y-1 transition-all"
                        >
                        <Play size={16} fill="currentColor" strokeWidth={3} />
                        Launch
                      </button>
                    ) : (c.status === 'sending' || c.status === 'paused') ? (
                      <>
                        <button 
                          id={`btn-toggle-status-${c.id}`}
                          onClick={() => handleToggleStatus(c.id, c.status)}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg hover:-translate-y-1",
                            c.status === 'paused' 
                              ? "bg-emerald-500 text-white hover:shadow-emerald-500/20" 
                              : "bg-amber-500 text-white hover:shadow-amber-500/20"
                          )}
                        >
                          {c.status === 'paused' ? (
                            <><Play size={16} fill="currentColor" strokeWidth={3} /> Resume</>
                          ) : (
                            <><Pause size={16} fill="currentColor" strokeWidth={3} /> Pause</>
                          )}
                        </button>
                        <button 
                          id={`btn-stop-campaign-${c.id}`}
                          onClick={() => handleStop(c.id)}
                          className="flex-1 flex items-center justify-center gap-3 bg-slate-50 text-slate-600 border border-slate-200 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all shadow-sm"
                        >
                          <Square size={16} fill="currentColor" />
                          Stop
                        </button>
                      </>
                    ) : null}
                    
                    <button 
                      id={`btn-edit-campaign-${c.id}`}
                      onClick={() => navigate(`/campaigns/edit/${c.id}`)}
                      className="flex-1 flex items-center justify-center gap-3 bg-slate-50 text-slate-600 border border-slate-200 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all shadow-sm"
                    >
                      <Edit2 size={16} strokeWidth={3} />
                      Edit
                    </button>

                    <button 
                      id={`btn-analytics-campaign-${c.id}`}
                      onClick={() => handleShowAnalytics(c.id)}
                      className="flex-1 flex items-center justify-center gap-3 bg-blue-50 text-blue-600 border border-blue-100 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-100 transition-all shadow-sm"
                    >
                      <BarChart3 size={16} strokeWidth={3} />
                      Analytics
                    </button>

                    {c.status === 'completed' && (
                      <button 
                        onClick={() => handleResend(c.id)}
                        className="w-full flex items-center justify-center gap-3 bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest border border-slate-900 hover:shadow-2xl hover:-translate-y-1 transition-all"
                      >
                        <RefreshCw size={16} strokeWidth={3} />
                        Resend to Not Replied
                      </button>
                    )}
                  </div>

                  {/* Decorative Elements */}
                  <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-all duration-700" />
                  <div className="absolute -left-12 -top-12 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-all duration-700" />
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {analyticsData && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl flex items-center justify-center p-6 z-50 overflow-y-auto"
          onClick={() => {
            setAnalyticsData(null);
            setSelectedCategory(null);
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-2xl rounded-[3.5rem] p-12 shadow-2xl relative border border-slate-200 my-auto"
          >
            <div className="absolute top-0 right-0 w-48 h-48 bg-slate-50 rounded-full -mr-24 -mt-24 blur-3xl" />
            
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setAnalyticsData(null);
                setSelectedCategory(null);
              }}
              className="absolute top-8 right-8 p-4 bg-slate-50 hover:bg-slate-900 hover:text-white rounded-2xl transition-all z-50 group/close text-slate-500"
              title="Close"
            >
              <X size={24} className="group-hover/close:rotate-90 transition-transform duration-300" />
            </button>
            
            <div className="flex items-center justify-between mb-12 relative z-10">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-slate-50 border border-slate-200 text-slate-900 rounded-[2rem] flex items-center justify-center shadow-sm">
                  <BarChart3 size={40} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="text-4xl font-black font-display tracking-tight text-slate-900">Analytics</h2>
                  <p className="text-slate-500 font-black uppercase tracking-[0.2em] text-[10px] mt-1">Performance insights</p>
                </div>
              </div>
              <button 
                onClick={() => setShowBulkModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-orange-50 text-orange-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-100 transition-all border border-orange-100"
              >
                <CheckCircle2 size={16} strokeWidth={3} />
                Bulk Mark Replied
              </button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 relative z-10">
              <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 transition-all hover:shadow-2xl hover:-translate-y-1 group">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-3">Total</p>
                <p className="text-5xl font-black font-display text-slate-900">{analyticsData.totalContacts}</p>
              </div>
              <div className="p-8 bg-emerald-50 rounded-[2.5rem] border border-emerald-100 transition-all hover:shadow-2xl hover:-translate-y-1 group">
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.25em] mb-3">Sent</p>
                <p className="text-5xl font-black font-display text-emerald-600">{analyticsData.sent}</p>
              </div>
              
              <button 
                onClick={() => setSelectedCategory(selectedCategory === 'replied' ? null : 'replied')}
                className={cn(
                  "p-8 rounded-[2.5rem] border transition-all hover:shadow-2xl hover:-translate-y-1 group text-left",
                  selectedCategory === 'replied' ? "bg-orange-600 text-white border-orange-700" : "bg-orange-50 border-orange-100 text-orange-600"
                )}
              >
                <p className={cn("text-[10px] font-black uppercase tracking-[0.25em] mb-3", selectedCategory === 'replied' ? "text-white/70" : "text-orange-600")}>Replied</p>
                <p className="text-5xl font-black font-display">{analyticsData.replied}</p>
              </button>
              
              <button 
                onClick={() => setSelectedCategory(selectedCategory === 'not-replied' ? null : 'not-replied')}
                className={cn(
                  "p-8 rounded-[2.5rem] border transition-all hover:shadow-2xl hover:-translate-y-1 group text-left",
                  selectedCategory === 'not-replied' ? "bg-slate-900 text-white border-slate-900" : "bg-slate-50 border-slate-200 text-slate-500"
                )}
              >
                <p className={cn("text-[10px] font-black uppercase tracking-[0.25em] mb-3", selectedCategory === 'not-replied' ? "text-white/70" : "text-slate-500")}>Not Replied</p>
                <p className="text-5xl font-black font-display">{analyticsData.sent - analyticsData.replied}</p>
              </button>
            </div>

            {selectedCategory && (
              <div className="mt-10 relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold font-display capitalize text-slate-900">
                    {selectedCategory === 'replied' ? 'Replied Contacts' : 'Not Replied Contacts'}
                  </h3>
                  {selectedCategory === 'not-replied' && (
                    <button 
                      onClick={async () => {
                        try {
                          const res = await api.post(`/api/campaigns/${analyticsData.id}/follow-up-list`, { category: 'not-replied' });
                          navigate('/campaigns/new', { 
                            state: { 
                              cloneFromId: analyticsData.id,
                              newListId: res.data.listId 
                            } 
                          });
                        } catch (err) {
                          toast.error('Failed to create follow-up list');
                        }
                      }}
                      className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20"
                    >
                      <Plus size={16} strokeWidth={3} />
                      Create Follow-up List
                    </button>
                  )}
                </div>
                <div className="space-y-3 max-h-80 overflow-y-auto pr-2 no-scrollbar border-t border-slate-100 pt-6">
                  {analyticsData.recentLogs && (
                    analyticsData.recentLogs
                      .filter((log: any) => {
                        if (selectedCategory === 'replied') return !!log.replied_at;
                        if (selectedCategory === 'not-replied') return !log.replied_at;
                        return true;
                      })
                      .map((log: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-slate-200 hover:bg-white transition-all">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 font-bold group-hover:border-slate-300 transition-all">
                              {log.name ? log.name.charAt(0) : log.email.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{log.name || 'Unknown'}</p>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{log.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="flex gap-2">
                                {log.replied_at && (
                                  <div className="flex flex-col items-end">
                                    <span className="px-3 py-1 bg-orange-50 text-orange-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-orange-100">Replied</span>
                                    <TimeAgo date={log.replied_at} className="text-[8px] text-slate-400 mt-1" />
                                  </div>
                                )}
                                {!log.replied_at && log.sent_at && (
                                  <div className="flex flex-col items-end gap-2">
                                    <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-widest border border-slate-200">Not Replied</span>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleMarkReplied(analyticsData.id, log.contact_id);
                                      }}
                                      className="text-[8px] font-black text-orange-600 uppercase tracking-widest hover:underline"
                                    >
                                      Mark as Replied
                                    </button>
                                    <TimeAgo date={log.sent_at} className="text-[8px] text-slate-400" />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            )}

            {!selectedCategory && analyticsData.recentLogs && analyticsData.recentLogs.length > 0 && (
              <div className="mt-10 relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold font-display text-slate-900">Recent Activity</h3>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Showing last {analyticsData.recentLogs.length}</span>
                </div>
                <div className="space-y-3 max-h-60 overflow-y-auto pr-2 no-scrollbar border-t border-slate-100 pt-4">
                  {analyticsData.recentLogs.slice(0, 50).map((log: any, i: number) => (
                    <div key={i} className="flex flex-col p-4 bg-slate-50 rounded-2xl text-sm gap-2 border border-slate-100">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">{log.name || log.email}</span>
                          <span className="text-[10px] text-slate-500 uppercase tracking-widest">{log.email}</span>
                        </div>
                        <div className="flex gap-2 flex-wrap justify-end">
                          {log.replied_at && (
                            <div className="flex flex-col items-end">
                              <span className="px-2 py-1 bg-orange-50 text-orange-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-orange-100">Replied</span>
                              <TimeAgo date={log.replied_at} className="text-[8px] text-slate-400 mt-0.5" />
                            </div>
                          )}
                          {log.opened_at && !log.replied_at && (
                            <div className="flex flex-col items-end">
                              <span className="px-2 py-1 bg-purple-50 text-purple-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-purple-100">Opened</span>
                              <TimeAgo date={log.opened_at} className="text-[8px] text-slate-400 mt-0.5" />
                            </div>
                          )}
                          {log.clicked_at && !log.replied_at && (
                            <div className="flex flex-col items-end">
                              <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-blue-100">Clicked</span>
                              <TimeAgo date={log.clicked_at} className="text-[8px] text-slate-400 mt-0.5" />
                            </div>
                          )}
                          {!log.opened_at && !log.replied_at && !log.clicked_at && log.sent_at && (
                            <div className="flex flex-col items-end gap-1">
                              <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200">Sent</span>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkReplied(analyticsData.id, log.contact_id);
                                }}
                                className="text-[8px] font-black text-orange-600 uppercase tracking-widest hover:underline"
                              >
                                Mark Replied
                              </button>
                              <TimeAgo date={log.sent_at} className="text-[8px] text-slate-400" />
                            </div>
                          )}
                        </div>
                      </div>
                      {(log.ip || log.user_agent) && (
                        <div className="pt-2 border-t border-slate-100 flex flex-col gap-1">
                          {log.ip && <span className="text-[9px] text-slate-400 font-mono">IP: {log.ip}</span>}
                          {log.user_agent && <span className="text-[9px] text-slate-400 font-mono truncate" title={log.user_agent}>UA: {log.user_agent}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-12 p-8 bg-slate-50 border border-slate-200 text-slate-900 rounded-[2.5rem] flex items-center gap-6 shadow-sm relative z-10 overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-slate-100 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-slate-200 transition-colors" />
              <div className="w-14 h-14 bg-white border border-slate-200 rounded-2xl flex items-center justify-center shrink-0">
                <Mail size={28} className="text-slate-900" />
              </div>
              <div className="flex-1">
                <p className="font-black text-lg tracking-tight">Real-time tracking</p>
                <p className="text-slate-500 text-xs font-bold leading-relaxed">Stats update automatically as emails are processed.</p>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-sm rounded-[3rem] p-10 shadow-2xl text-center border border-slate-200"
            >
              <div className="w-24 h-24 bg-red-50 text-red-500 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner border border-red-100">
                <Trash2 size={48} strokeWidth={2.5} />
              </div>
              <h2 className="text-3xl font-black mb-3 font-display tracking-tight text-slate-900">Delete Campaign?</h2>
              <p className="text-slate-500 mb-10 font-bold leading-relaxed">This action cannot be undone. All logs and settings will be permanently removed.</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 py-5 bg-slate-50 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-100 transition-all border border-slate-200"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 py-5 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl shadow-red-500/20"
                >
                  {isDeleting ? <RefreshCw size={20} className="animate-spin" /> : <Trash2 size={20} />}
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBulkModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl flex items-center justify-center p-4 z-[60]">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[3rem] p-10 shadow-2xl border border-slate-200"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-black font-display tracking-tight text-slate-900">Bulk Mark Replied</h2>
                <button onClick={() => setShowBulkModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                  <X size={24} />
                </button>
              </div>
              <p className="text-slate-500 mb-6 font-bold leading-relaxed">
                Paste a list of email addresses (separated by commas or new lines) that have replied. 
                This will stop all future follow-up emails for these contacts in this campaign.
              </p>
              <textarea
                value={bulkEmails}
                onChange={(e) => setBulkEmails(e.target.value)}
                placeholder="email1@example.com&#10;email2@example.com"
                className="w-full h-48 p-6 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-100 transition-all mb-8"
              />
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowBulkModal(false)}
                  className="flex-1 py-5 bg-slate-50 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-100 transition-all border border-slate-200"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleBulkMarkReplied}
                  className="flex-1 py-5 bg-orange-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-orange-700 transition-all shadow-xl shadow-orange-500/20"
                >
                  Update Status
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
