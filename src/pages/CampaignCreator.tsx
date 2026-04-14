import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { cn } from '../lib/utils';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { Send, Sparkles, Smartphone, Eye, CheckCircle2, Plus, Trash2, Clock, Users, RefreshCw, Paperclip, X, Layout, Save, Book, Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { generateEmailContent, analyzeEmailSpam } from '../services/gemini';

export default function CampaignCreator() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { cloneFromId, newListId } = (location.state as any) || {};
  const [smtpAccounts, setSmtpAccounts] = useState<any[]>([]);
  const [lists, setLists] = useState<any[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [isTestSendOpen, setIsTestSendOpen] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [isSaveTemplateModalOpen, setIsSaveTemplateModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSpamCheckOpen, setIsSpamCheckOpen] = useState(false);
  const [isAnalyzingSpam, setIsAnalyzingSpam] = useState(false);
  const [spamResult, setSpamResult] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    subjects: [] as string[],
    body: '',
    smtpIds: [] as number[],
    listId: '',
  });

  const addSubject = () => {
    if (formData.subject && Array.isArray(formData.subjects) && !formData.subjects.includes(formData.subject)) {
      setFormData({ ...formData, subjects: [...formData.subjects, formData.subject], subject: '' });
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [smtpRes, listsRes] = await Promise.all([
          api.get('/api/smtp'),
          api.get('/api/lists')
        ]);
        setSmtpAccounts(smtpRes.data);
        setLists(listsRes.data);
        fetchTemplates();

        const targetId = id || cloneFromId;
        if (targetId) {
          const campaignRes = await api.get(`/api/campaigns/${targetId}`);
          const c = campaignRes.data;
          let parsedSubjects = [];
          try {
            parsedSubjects = typeof c.subjects === 'string' ? JSON.parse(c.subjects || '[]') : (Array.isArray(c.subjects) ? c.subjects : []);
          } catch (e) {
            console.error('Failed to parse subjects', e);
          }

          setFormData({
            name: cloneFromId ? `Follow-up: ${c.name}` : c.name,
            subject: c.subject,
            subjects: Array.isArray(parsedSubjects) ? parsedSubjects : [],
            body: c.body,
            smtpIds: c.smtpIds || [],
            listId: newListId || c.list_id || '',
          });
          try {
            setExistingAttachments(JSON.parse(c.attachments || '[]'));
          } catch (e) {
            console.error('Failed to parse attachments', e);
            setExistingAttachments([]);
          }
        }
      } catch (err) {
        toast.error('Failed to load data');
      }
    };
    fetchData();
  }, [id, cloneFromId, newListId]);

  const fetchTemplates = async () => {
    try {
      const res = await api.get('/api/templates');
      setTemplates(res.data);
    } catch (err) {
      console.error('Failed to fetch templates');
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName) return toast.error('Please enter a template name');
    if (!formData.subject && !formData.body) return toast.error('Subject and body are required');
    
    setIsSavingTemplate(true);
    try {
      await api.post('/api/templates', {
        name: templateName,
        subject: formData.subject || (formData.subjects.length > 0 ? formData.subjects[0] : ''),
        body: formData.body
      });
      toast.success('Template saved successfully');
      setIsSaveTemplateModalOpen(false);
      setTemplateName('');
      fetchTemplates();
    } catch (err) {
      toast.error('Failed to save template');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleSelectTemplate = (template: any) => {
    setFormData({
      ...formData,
      subject: template.subject,
      body: template.body
    });
    setIsTemplateModalOpen(false);
    toast.success('Template applied');
  };

  const handleDeleteTemplate = async (templateId: number) => {
    try {
      await api.delete(`/api/templates/${templateId}`);
      toast.success('Template deleted');
      fetchTemplates();
    } catch (err) {
      toast.error('Failed to delete template');
    }
  };

  const handleGenerate = async () => {
    if (!prompt) return toast.error('Please enter a prompt');
    setIsGenerating(true);
    try {
      const content = await generateEmailContent(prompt);
      setFormData({ ...formData, subject: content.subject, body: content.body });
      toast.success('Content generated!');
    } catch (err) {
      toast.error('Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTestSend = async () => {
    if (!testEmail) return toast.error('Enter a test email address');
    if (formData.smtpIds.length === 0) return toast.error('Select at least one SMTP account');
    
    setIsSendingTest(true);
    try {
      const data = new FormData();
      data.append('subject', formData.subject || (Array.isArray(formData.subjects) ? formData.subjects[0] : ''));
      data.append('body', formData.body);
      data.append('smtpId', formData.smtpIds[0]);
      data.append('toEmail', testEmail);
      data.append('existingAttachments', JSON.stringify(existingAttachments));
      
      attachments.forEach(file => {
        data.append('attachments', file);
      });

      await api.post('/api/campaigns/test-send', data, {
        headers: { 
          'Content-Type': 'multipart/form-data'
        }
      });
      toast.success('Test email sent!');
      setIsTestSendOpen(false);
    } catch (err) {
      toast.error('Test send failed');
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleSpamCheck = async () => {
    if (!formData.subject && formData.subjects.length === 0) return toast.error('Subject is required');
    if (!formData.body) return toast.error('Body is required');
    
    setIsAnalyzingSpam(true);
    setIsSpamCheckOpen(true);
    try {
      const result = await analyzeEmailSpam(
        formData.subject || formData.subjects[0],
        formData.body
      );
      setSpamResult(result);
    } catch (err) {
      toast.error('Spam analysis failed');
      setIsSpamCheckOpen(false);
    } finally {
      setIsAnalyzingSpam(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/campaigns/${id}`);
      toast.success('Campaign deleted');
      navigate('/campaigns');
    } catch (err) {
      toast.error('Delete failed');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (formData.smtpIds.length === 0) return toast.error('Select at least one SMTP account');
    if (!formData.listId) return toast.error('Select a contact list');

    setIsSaving(true);
    const data = new FormData();
    data.append('name', formData.name);
    data.append('subject', formData.subject);
    data.append('subjects', JSON.stringify(formData.subjects));
    data.append('body', formData.body);
    data.append('smtpIds', JSON.stringify(formData.smtpIds));
    data.append('listId', formData.listId);
    data.append('existingAttachments', JSON.stringify(existingAttachments));
    
    attachments.forEach(file => {
      data.append('attachments', file);
    });

    try {
      if (id) {
        await api.put(`/api/campaigns/${id}`, data, {
          headers: { 
            'Content-Type': 'multipart/form-data'
          }
        });
        toast.success('Campaign updated successfully');
      } else {
        await api.post('/api/campaigns', data, {
          headers: { 
            'Content-Type': 'multipart/form-data'
          }
        });
        toast.success('Campaign created successfully');
      }
      navigate('/campaigns');
    } catch (err) {
      toast.error('Failed to save campaign');
    } finally {
      setIsSaving(false);
    }
  };

  const [activeTab, setActiveTab] = useState<'content' | 'audience' | 'settings'>('content');

  return (
    <div className="relative min-h-screen pb-32 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-12 space-y-12">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-10 mb-16"
        >
          <div className="max-w-3xl">
            <div className="flex items-center gap-4 mb-6">
              <span className="px-4 py-1.5 bg-slate-100 text-slate-900 text-[10px] font-black uppercase tracking-[0.3em] rounded-full border border-slate-200 shadow-sm">Campaign Engine v2</span>
              <div className="h-px w-20 bg-slate-200" />
            </div>
            <h1 className="text-7xl md:text-9xl font-bold tracking-tighter font-display mb-8 leading-[0.8] text-slate-900">
              Design <span className="text-slate-300">Impact.</span>
            </h1>
            <p className="text-slate-500 text-2xl font-medium leading-relaxed max-w-2xl">
              Engineered for <span className="text-slate-900 font-bold">high-conversion</span> sequences with AI intelligence and <span className="text-slate-900 font-bold">smart rotation</span>.
            </p>
          </div>
          
          <div className="flex flex-col gap-4 w-full lg:w-auto">
            <div className="grid grid-cols-2 gap-4">
              <button
                id="btn-open-templates"
                onClick={() => setIsTemplateModalOpen(true)}
                className="button-secondary flex items-center justify-center gap-2 py-4"
              >
                <Book size={18} strokeWidth={3} className="text-blue-600" />
                <span className="text-xs font-black uppercase tracking-widest">Templates</span>
              </button>
              <button
                id="btn-spam-check"
                onClick={handleSpamCheck}
                className="button-secondary flex items-center justify-center gap-2 py-4"
              >
                <Shield size={18} strokeWidth={3} className="text-amber-600" />
                <span className="text-xs font-black uppercase tracking-widest">Spam Check</span>
              </button>
              <button
                id="btn-test-send"
                onClick={() => setIsTestSendOpen(true)}
                className="button-secondary flex items-center justify-center gap-2 py-4"
              >
                <Send size={18} strokeWidth={3} className="text-emerald-600" />
                <span className="text-xs font-black uppercase tracking-widest">Test Send</span>
              </button>
              <button
                id="btn-live-preview"
                onClick={() => {
                  setPreviewMode('desktop');
                  setIsPreviewOpen(true);
                }}
                className="button-primary flex items-center justify-center gap-2 py-4 shadow-sm"
              >
                <Eye size={18} strokeWidth={3} />
                <span className="text-xs font-black uppercase tracking-widest">Live Preview</span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 p-1 bg-slate-100 border border-slate-200 rounded-2xl w-fit mb-8">
          {[
            { id: 'content', label: 'Content', icon: Layout },
            { id: 'audience', label: 'Audience', icon: Users },
            { id: 'settings', label: 'Settings', icon: RefreshCw },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-150",
                activeTab === tab.id 
                  ? "bg-white text-slate-900 shadow-sm border border-slate-200" 
                  : "text-slate-500 hover:text-slate-900 hover:bg-white"
              )}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-12">
          <AnimatePresence mode="wait">
            {activeTab === 'content' && (
              <motion.div 
                key="content"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.15 }}
                className="space-y-12"
              >
                <div className="bg-white border border-slate-200 shadow-sm p-10 rounded-[2.5rem] space-y-8">
                  <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                    <div className="flex-1 w-full">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3 ml-1">Campaign Identity</label>
                      <input
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full text-4xl md:text-5xl font-bold border-none focus:ring-0 p-0 placeholder:text-slate-300 bg-transparent font-display tracking-tight text-slate-900"
                        placeholder="Untitled Campaign"
                      />
                    </div>
                  </div>
                  
                  <div className="h-px bg-slate-100" />
                  
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">Subject Strategy</label>
                    </div>
                    <div className="flex gap-4 mb-6">
                      <input
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        className="flex-1 text-2xl font-semibold border-none focus:ring-0 p-0 placeholder:text-slate-300 bg-transparent tracking-tight text-slate-900"
                        placeholder="Enter a compelling subject..."
                        onKeyPress={(e) => e.key === 'Enter' && addSubject()}
                      />
                      <button 
                        id="btn-add-subject"
                        onClick={addSubject} 
                        className="w-14 h-14 bg-slate-100 text-slate-900 rounded-xl flex items-center justify-center hover:bg-slate-200 transition-all border border-slate-200 shadow-sm"
                      >
                        <Plus size={24} strokeWidth={3} />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <AnimatePresence>
                        {Array.isArray(formData.subjects) && formData.subjects.map((s, i) => (
                          <motion.span 
                            key={i}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="bg-slate-50 border border-slate-200 px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-3 group hover:border-slate-300 transition-all shadow-sm text-slate-900"
                          >
                            {s}
                            <button onClick={() => setFormData({...formData, subjects: formData.subjects.filter((_, idx) => idx !== i)})} className="text-slate-400 group-hover:text-slate-900 transition-colors">
                              <X size={16} strokeWidth={3} />
                            </button>
                          </motion.span>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 shadow-sm rounded-[2.5rem] overflow-hidden">
                  <div className="p-8 bg-slate-50 border-b border-slate-100 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="w-12 h-12 bg-slate-100 text-slate-900 rounded-xl flex items-center justify-center border border-slate-200">
                        <Layout size={24} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold font-display tracking-tight text-slate-900">Email Content</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <button 
                            id="btn-toggle-html-mode"
                            onClick={() => setIsHtmlMode(!isHtmlMode)}
                            className="text-[9px] font-black uppercase tracking-widest px-3 py-1 bg-slate-100 border border-slate-200 rounded-full hover:bg-slate-200 hover:text-slate-900 transition-all duration-150"
                          >
                            {isHtmlMode ? 'Rich Text' : 'HTML Code'}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl shadow-sm overflow-hidden w-full xl:w-96 focus-within:border-slate-400 transition-all">
                      <input 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Ask Gemini to craft your message..."
                        className="flex-1 text-sm px-6 py-4 border-none focus:ring-0 bg-transparent font-medium text-slate-900"
                      />
                      <button 
                        id="btn-ai-generate"
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="bg-slate-100 text-slate-900 px-6 py-4 hover:bg-slate-200 border-l border-slate-200 disabled:opacity-50 transition-colors flex items-center gap-2 font-bold text-xs uppercase tracking-widest"
                      >
                        {isGenerating ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} strokeWidth={2.5} />}
                        AI
                      </button>
                    </div>
                  </div>
                  <div className="min-h-[500px] bg-transparent relative">
                    <div className="absolute top-4 right-4 z-10">
                      <button 
                        id="btn-save-as-template"
                        onClick={() => setIsSaveTemplateModalOpen(true)}
                        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-2 bg-emerald-600 text-white rounded-lg shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 transition-all duration-150"
                      >
                        <Save size={14} strokeWidth={3} />
                        Save Template
                      </button>
                    </div>
                    {isHtmlMode ? (
                      <textarea
                        value={formData.body}
                        onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                        className="w-full h-[500px] p-10 font-mono text-sm border-none focus:ring-0 resize-none bg-transparent leading-relaxed text-slate-700"
                        placeholder="Enter HTML code here..."
                      />
                    ) : (
                      <div className="p-4">
                        <ReactQuill
                          theme="snow"
                          value={formData.body}
                          onChange={(val) => setFormData({ ...formData, body: val })}
                          className="h-[420px] rounded-xl overflow-hidden border-none text-slate-900"
                          modules={{
                            toolbar: [
                              [{ 'header': [1, 2, false] }],
                              ['bold', 'italic', 'underline', 'strike'],
                              [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                              ['link', 'clean']
                            ],
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 shadow-sm p-10 rounded-[2.5rem] space-y-8">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center border border-orange-100">
                        <Paperclip size={24} strokeWidth={2.5} />
                      </div>
                      <h3 className="text-xl font-bold font-display tracking-tight text-slate-900">Attachments</h3>
                    </div>
                    <label className="w-10 h-10 bg-slate-100 text-slate-900 rounded-lg flex items-center justify-center hover:bg-slate-200 cursor-pointer border border-slate-200 shadow-sm transition-all duration-150">
                      <Plus size={20} strokeWidth={3} />
                      <input 
                        type="file" 
                        multiple 
                        className="hidden" 
                        onChange={(e) => {
                          if (e.target.files) {
                            setAttachments([...attachments, ...Array.from(e.target.files)]);
                          }
                        }}
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <AnimatePresence>
                      {existingAttachments.map((file, i) => (
                        <motion.div 
                          key={`ext-${i}`}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.15 }}
                          className="bg-blue-50 px-5 py-3 rounded-xl text-[11px] font-bold flex items-center gap-3 border border-blue-100 text-blue-600 shadow-sm"
                        >
                          <span className="truncate max-w-[120px]">{file.filename}</span>
                          <button 
                            onClick={() => setExistingAttachments(existingAttachments.filter((_, idx) => idx !== i))}
                            className="text-blue-500/50 hover:text-red-500 transition-colors"
                          >
                            <X size={14} strokeWidth={3} />
                          </button>
                        </motion.div>
                      ))}
                      {attachments.map((file, i) => (
                        <motion.div 
                          key={i}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.15 }}
                          className="bg-slate-50 px-5 py-3 rounded-xl text-[11px] font-bold flex items-center gap-3 border border-slate-200 shadow-sm text-slate-900"
                        >
                          <span className="truncate max-w-[120px]">{file.name}</span>
                          <button 
                            onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))}
                            className="text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <X size={14} strokeWidth={3} />
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {attachments.length === 0 && existingAttachments.length === 0 && (
                      <div className="w-full py-10 text-center bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em]">No attachments</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'audience' && (
              <motion.div 
                key="audience"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.15 }}
                className="bg-white border border-slate-200 shadow-sm p-10 rounded-[2.5rem] space-y-8"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center border border-purple-100">
                    <Users size={24} strokeWidth={2.5} />
                  </div>
                  <h3 className="text-xl font-bold font-display tracking-tight text-slate-900">Target Audience</h3>
                </div>
                <div className="relative group">
                  <select
                    required
                    value={formData.listId}
                    onChange={(e) => setFormData({ ...formData, listId: e.target.value })}
                    className="w-full px-6 py-4 bg-slate-50 rounded-xl border border-slate-200 focus:border-slate-400 transition-all outline-none font-bold text-base appearance-none cursor-pointer pr-12 text-slate-900"
                  >
                    <option value="">Select a list</option>
                    {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-focus-within:text-slate-900 transition-colors">
                    <Layout size={18} />
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.15 }}
                className="space-y-12"
              >
                <div className="bg-white border border-slate-200 shadow-sm p-10 rounded-[2.5rem] space-y-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100">
                      <RefreshCw size={24} strokeWidth={2.5} />
                    </div>
                    <h3 className="text-xl font-bold font-display tracking-tight text-slate-900">SMTP Rotation</h3>
                  </div>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">Select multiple accounts to distribute load and bypass spam filters automatically.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2 no-scrollbar">
                    {smtpAccounts.map(acc => (
                      <label key={acc.id} className={cn(
                        "flex items-center gap-4 p-5 rounded-xl cursor-pointer transition-all duration-150 border",
                        formData.smtpIds.includes(acc.id) 
                          ? "bg-slate-900 text-white border-slate-900" 
                          : "bg-slate-50 text-slate-900 border-slate-200 hover:border-slate-300"
                      )}>
                        <input
                          type="checkbox"
                          checked={formData.smtpIds.includes(acc.id)}
                          onChange={(e) => {
                            const ids = e.target.checked 
                              ? [...formData.smtpIds, acc.id]
                              : formData.smtpIds.filter(id => id !== acc.id);
                            setFormData({ ...formData, smtpIds: ids });
                          }}
                          className="w-6 h-6 rounded-lg border-slate-300 text-slate-900 focus:ring-0"
                        />
                        <div className="flex-1">
                          <p className="text-base font-bold tracking-tight">{acc.name}</p>
                          <p className={cn(
                            "text-[10px] font-black uppercase tracking-widest mt-0.5",
                            formData.smtpIds.includes(acc.id) ? "text-white/70" : "text-slate-500"
                          )}>{acc.user}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="bg-emerald-600 text-white p-10 rounded-[2.5rem] shadow-2xl shadow-emerald-600/20 space-y-4 relative overflow-hidden group">
                  <div className="relative z-10">
                    <div className="flex items-center gap-4 font-bold text-2xl font-display tracking-tight">
                      <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                        <CheckCircle2 size={28} />
                      </div>
                      Deliverability: 100%
                    </div>
                    <p className="text-sm text-emerald-50 font-medium leading-relaxed mt-2">Your settings comply with SPF, DKIM, and DMARC standards for maximum inbox reach.</p>
                  </div>
                  <div className="absolute -right-16 -bottom-16 w-48 h-48 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Sticky Bottom Action Bar */}
      <motion.div 
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.15 }}
        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 w-full max-w-4xl px-6"
      >
        <div className="bg-white/95 backdrop-blur-2xl border border-slate-200 p-6 rounded-[2rem] shadow-2xl flex items-center justify-between gap-6">
          <div className="hidden md:flex items-center gap-6 px-4">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Campaign Status</span>
              <span className="text-slate-900 font-bold text-sm">{id ? 'Editing Draft' : 'New Campaign'}</span>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Deliverability</span>
              <span className="text-emerald-600 font-bold text-sm flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-pulse" />
                Optimized
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto">
            <button 
              id="btn-cancel-campaign"
              onClick={() => navigate('/campaigns')}
              className="flex-1 md:flex-none px-8 py-4 rounded-xl font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all duration-150 text-sm"
            >
              Cancel
            </button>
            <button 
              id="btn-submit-campaign"
              onClick={handleSubmit}
              disabled={isSaving}
              className="button-primary flex-[2] md:flex-none"
            >
              {isSaving ? <RefreshCw size={20} className="animate-spin" /> : <Save size={20} strokeWidth={3} />}
              {id ? 'Update Campaign' : 'Save Campaign'}
            </button>
          </div>
        </div>
      </motion.div>

      {isPreviewOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl flex items-center justify-center p-4 md:p-8 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="bg-white w-full max-w-7xl h-full max-h-[95vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col relative border border-slate-200"
          >
            {/* Unified Preview Header */}
            <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-30">
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-2xl">
                    <Eye size={24} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tight text-slate-900 uppercase italic">Live Preview</h2>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Real-time simulation</p>
                  </div>
                </div>
                <div className="h-10 w-px bg-slate-200" />
                <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                  <button 
                    onClick={() => setPreviewMode('desktop')}
                    className={cn(
                      "flex items-center gap-3 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-150",
                      previewMode === 'desktop' ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-900"
                    )}
                  >
                    <Layout size={16} strokeWidth={3} />
                    Desktop
                  </button>
                  <button 
                    onClick={() => setPreviewMode('mobile')}
                    className={cn(
                      "flex items-center gap-3 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-150",
                      previewMode === 'mobile' ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-900"
                    )}
                  >
                    <Smartphone size={16} strokeWidth={3} />
                    Mobile
                  </button>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setIsTestSendOpen(true)}
                  className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-500 transition-all flex items-center gap-3 shadow-xl shadow-emerald-600/20"
                >
                  <Send size={18} strokeWidth={3} />
                  Send Test
                </button>
                <button onClick={() => setIsPreviewOpen(false)} className="w-14 h-14 bg-slate-50 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-2xl flex items-center justify-center transition-all border border-slate-200">
                  <X size={28} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden bg-slate-50 flex justify-center p-12">
              <div className={cn(
                "w-full h-full overflow-y-auto transition-all duration-300 no-scrollbar flex justify-center",
                previewMode === 'mobile' ? "max-w-[450px]" : "w-full"
              )}>
                <div className={cn(
                  "bg-white shadow-2xl overflow-hidden transition-all duration-300 h-fit",
                  previewMode === 'mobile' ? "rounded-[3.5rem] border-[14px] border-slate-900 w-full max-w-[380px]" : "w-full max-w-4xl rounded-[2rem]"
                )}>
                  {/* Email Header Simulation */}
                  <div className={cn(
                    "border-b border-slate-100 bg-slate-50",
                    previewMode === 'mobile' ? "p-8" : "p-12"
                  )}>
                    <div className="flex items-center gap-5 mb-10">
                      <div className="w-14 h-14 bg-slate-100 text-slate-900 rounded-2xl flex items-center justify-center text-xl font-black shadow-sm border-4 border-slate-200">
                        {formData.name.charAt(0) || 'S'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-black text-slate-900 text-lg truncate uppercase tracking-tight">{formData.name || 'Untitled Campaign'}</h3>
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Just Now</span>
                        </div>
                        <p className="text-sm text-slate-500 font-bold truncate">To: <span className="text-blue-600">recipient@example.com</span></p>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest w-16 mt-1">Subject</span>
                        <h1 className="flex-1 text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                          {formData.subject || (formData.subjects.length > 0 ? formData.subjects[0] : 'No Subject')}
                        </h1>
                      </div>
                    </div>
                  </div>

                  {/* Email Body */}
                  <div className={cn(
                    "bg-white min-h-[400px]",
                    previewMode === 'mobile' ? "p-8" : "p-12"
                  )}>
                    <div 
                      className="prose prose-slate max-w-none text-slate-900 font-sans leading-[1.6] text-lg email-preview-content text-left" 
                      style={{ wordBreak: 'break-word' }}
                      dangerouslySetInnerHTML={{ __html: formData.body || '<p class="text-slate-400 italic text-center">No content yet...</p>' }} 
                    />
                  </div>

                  {/* Email Footer Simulation */}
                  <div className="p-10 bg-slate-50 border-t border-slate-100 text-center">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Sent via Outreach Pro</p>
                    <div className="flex justify-center gap-4">
                      <div className="w-8 h-8 bg-slate-200 rounded-lg" />
                      <div className="w-8 h-8 bg-slate-200 rounded-lg" />
                      <div className="w-8 h-8 bg-slate-200 rounded-lg" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {isTestSendOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative border border-slate-200"
          >
            <button 
              onClick={() => setIsTestSendOpen(false)}
              className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
            >
              <X size={20} />
            </button>
            <h2 className="text-2xl font-bold mb-6 text-slate-900 font-display tracking-tight">Send Test Email</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2 ml-1">Recipient Email</label>
                <input 
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-6 py-4 bg-slate-50 rounded-2xl border border-slate-200 focus:border-slate-400 transition-all outline-none text-lg font-medium text-slate-900"
                />
              </div>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                This will send the current email content using the first selected SMTP account.
              </p>
              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setIsTestSendOpen(false)}
                  className="flex-1 py-4 bg-slate-50 text-slate-500 rounded-2xl font-bold hover:bg-slate-100 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleTestSend}
                  disabled={isSendingTest}
                  className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all border border-slate-900 shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSendingTest ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
                  {isSendingTest ? 'Sending...' : 'Send Test'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {isSpamCheckOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-2xl rounded-[2.5rem] p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto no-scrollbar border border-slate-200"
          >
            <button 
              onClick={() => {
                setIsSpamCheckOpen(false);
                setSpamResult(null);
              }}
              className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
            >
              <X size={20} />
            </button>
            
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner border border-blue-100">
                <Shield size={28} strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-2xl font-bold font-display tracking-tight text-slate-900">Spam Analysis</h2>
                <p className="text-sm text-slate-500 font-medium">AI-powered deliverability check</p>
              </div>
            </div>

            {isAnalyzingSpam ? (
              <div className="py-20 text-center space-y-4">
                <div className="w-12 h-12 border-4 border-slate-100 border-t-slate-900 rounded-full animate-spin mx-auto" />
                <p className="text-slate-500 font-bold text-sm uppercase tracking-widest animate-pulse">Analyzing your content...</p>
              </div>
            ) : spamResult ? (
              <div className="space-y-8">
                <div className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-200">
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Deliverability Score</p>
                    <p className="text-4xl font-black font-display text-slate-900">{spamResult.score}/100</p>
                  </div>
                  <div className={cn(
                    "w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg",
                    spamResult.score >= 80 ? "bg-emerald-500 text-white" : 
                    spamResult.score >= 50 ? "bg-amber-500 text-white" : "bg-red-500 text-white"
                  )}>
                    {spamResult.score >= 80 ? <CheckCircle size={32} /> : <AlertTriangle size={32} />}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-sm font-black uppercase tracking-widest text-red-500 flex items-center gap-2">
                      <AlertTriangle size={16} /> Issues Found
                    </h3>
                    <div className="space-y-2">
                      {spamResult.issues.map((issue: string, i: number) => (
                        <div key={i} className="p-3 bg-red-500/10 text-red-400 rounded-xl text-xs font-bold border border-red-500/20">
                          {issue}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-sm font-black uppercase tracking-widest text-emerald-500 flex items-center gap-2">
                      <Sparkles size={16} /> Suggestions
                    </h3>
                    <div className="space-y-2">
                      {spamResult.suggestions.map((suggestion: string, i: number) => (
                        <div key={i} className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl text-xs font-bold border border-emerald-500/20">
                          {suggestion}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-6 border-t border-slate-100">
                  <h3 className="text-sm font-black uppercase tracking-widest text-blue-500">Improved Version</h3>
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-500/5 rounded-2xl border border-blue-500/20">
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">Subject</p>
                      <p className="text-sm font-bold text-blue-400">{spamResult.improved_subject}</p>
                    </div>
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 shadow-sm">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Body Preview</p>
                      <div className="prose prose-sm max-w-none text-slate-500 line-clamp-4" dangerouslySetInnerHTML={{ __html: spamResult.improved_body }} />
                    </div>
                    <button 
                      onClick={() => {
                        setFormData({
                          ...formData,
                          subject: spamResult.improved_subject,
                          body: spamResult.improved_body
                        });
                        setIsSpamCheckOpen(false);
                        setSpamResult(null);
                        toast.success('Applied improved version');
                      }}
                      className="w-full py-4 bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-600/30 transition-all shadow-lg shadow-blue-600/10"
                    >
                      Apply Improved Version
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </motion.div>
        </div>
      )}

      <AnimatePresence>
        {isTemplateModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="bg-white w-full max-w-2xl rounded-[2.5rem] p-10 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-slate-200"
            >
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center border border-blue-100">
                    <Book size={24} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tight text-slate-900 uppercase italic">Template Library</h2>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Select a pre-built sequence</p>
                  </div>
                </div>
                <button onClick={() => setIsTemplateModalOpen(false)} className="w-12 h-12 bg-slate-50 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-2xl flex items-center justify-center transition-all border border-slate-200">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-4 no-scrollbar">
                {templates.length === 0 ? (
                  <div className="text-center py-16 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                    <Layout size={48} className="mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500 font-bold text-lg">No templates found</p>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2">Save your current draft as a template</p>
                  </div>
                ) : (
                  templates.map((template) => (
                    <div key={template.id} className="group p-6 bg-slate-50 rounded-2xl border border-slate-100 hover:border-slate-200 hover:bg-slate-100 transition-all duration-150">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">{template.name}</h3>
                          <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Subject: {template.subject}</p>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleSelectTemplate(template)}
                            className="px-6 py-2.5 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-800 border border-slate-900 transition-all"
                          >
                            Apply
                          </button>
                          <button 
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="p-2.5 text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 line-clamp-2 prose prose-slate prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: template.body }} />
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSaveTemplateModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl border border-slate-200"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center border border-emerald-100">
                  <Save size={24} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-slate-900 uppercase italic">Save Template</h2>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Store for future use</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">Template Name</label>
                  <input 
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="e.g., Welcome Sequence v1"
                    className="w-full px-6 py-4 bg-slate-50 rounded-xl border border-slate-200 focus:border-slate-400 transition-all outline-none font-bold text-slate-900 placeholder:text-slate-300"
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setIsSaveTemplateModalOpen(false)}
                    className="flex-1 py-4 bg-slate-50 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:text-slate-900 hover:bg-slate-100 border border-slate-200"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSaveTemplate}
                    disabled={isSavingTemplate}
                    className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 border border-slate-900 transition-all disabled:opacity-50 shadow-sm"
                  >
                    {isSavingTemplate ? 'Saving...' : 'Save Template'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDeleteConfirmOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="bg-white w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl text-center border border-slate-200"
            >
              <div className="w-24 h-24 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-8 border border-red-100 shadow-sm">
                <Trash2 size={48} strokeWidth={2.5} />
              </div>
              <h2 className="text-3xl font-black tracking-tight text-slate-900 uppercase italic mb-3">Delete Campaign?</h2>
              <p className="text-slate-500 font-medium mb-10 leading-relaxed">This action is irreversible. All associated logs and data will be permanently purged from our servers.</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  className="flex-1 py-4 bg-slate-50 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:text-slate-900 hover:bg-slate-100 border border-slate-200"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-sm"
                >
                  {isDeleting ? <RefreshCw size={18} className="animate-spin" /> : null}
                  {isDeleting ? 'Purging...' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
