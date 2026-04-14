import React, { useState, useEffect } from 'react';
import api from '@/src/lib/api';
import { 
  Plus, 
  CheckCircle2, 
  XCircle, 
  Trash2, 
  ShieldCheck, 
  RefreshCw, 
  Info, 
  ExternalLink, 
  ShieldAlert, 
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

const PROVIDER_PRESETS = [
  { name: 'Gmail', host: 'smtp.gmail.com', port: 465, secure: true, imap_host: 'imap.gmail.com', imap_port: 993, imap_secure: true },
  { name: 'Microsoft 365 / GoDaddy (O365)', host: 'smtp.office365.com', port: 587, secure: false, imap_host: 'outlook.office365.com', imap_port: 993, imap_secure: true },
  { name: 'GoDaddy (Classic/Workspace)', host: 'smtpout.secureserver.net', port: 465, secure: true, imap_host: 'imap.secureserver.net', imap_port: 993, imap_secure: true },
  { name: 'Outlook.com / Hotmail', host: 'smtp-mail.outlook.com', port: 587, secure: false, imap_host: 'outlook.office365.com', imap_port: 993, imap_secure: true },
  { name: 'Custom / Other', host: '', port: 587, secure: false, imap_host: '', imap_port: 993, imap_secure: true },
];

export default function SMTPManagement() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: 587,
    secure: false,
    user: '',
    pass: '',
    from_email: '',
    from_name: '',
    imap_host: '',
    imap_port: 993,
    imap_secure: true,
  });
  const [testEmail, setTestEmail] = useState('');
  const [showTestEmailInput, setShowTestEmailInput] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const resetForm = () => {
    setFormData({
      name: '',
      host: PROVIDER_PRESETS[0].host,
      port: PROVIDER_PRESETS[0].port,
      secure: PROVIDER_PRESETS[0].secure,
      user: '',
      pass: '',
      from_email: '',
      from_name: '',
      imap_host: PROVIDER_PRESETS[0].imap_host || '',
      imap_port: PROVIDER_PRESETS[0].imap_port || 993,
      imap_secure: PROVIDER_PRESETS[0].imap_secure ?? true,
    });
    setShowTestEmailInput(false);
    setTestEmail('');
  };

  const fetchAccounts = async () => {
    try {
      const res = await api.get('/api/smtp');
      if (Array.isArray(res.data)) {
        setAccounts(res.data);
      } else {
        console.error('Expected array of SMTP accounts, got:', res.data);
        setAccounts([]);
      }
    } catch (err: any) {
      toast.error('Failed to fetch SMTP accounts');
      setAccounts([]);
    }
  };

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const preset = PROVIDER_PRESETS.find(p => p.name === e.target.value);
    if (preset && preset.name !== 'Custom') {
      setFormData({ 
        ...formData, 
        host: preset.host, 
        port: preset.port, 
        secure: preset.secure,
        imap_host: preset.imap_host || '',
        imap_port: preset.imap_port || 993,
        imap_secure: preset.imap_secure ?? true
      });
    }
  };

  const handleTest = async () => {
    if (showTestEmailInput && !testEmail) {
      toast.error('Please enter a test recipient email');
      return;
    }

    setTesting(true);
    try {
      setLastError(null);
      const res = await api.post('/api/smtp/test', {
        ...formData,
        testRecipient: showTestEmailInput ? testEmail : null
      });
      
      if (res.data.warning) {
        setLastError(res.data.warning);
        toast(res.data.message, {
          icon: '⚠️',
          duration: 10000
        });
      } else {
        toast.success(showTestEmailInput ? 'Test email sent successfully!' : 'Connection successful!');
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Connection failed';
      setLastError(errorMsg);
      toast.error(errorMsg, {
        duration: errorMsg.includes('Microsoft') || errorMsg.includes('IMAP Error') ? 15000 : 6000
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/smtp', formData);
      toast.success('SMTP account added');
      setIsAdding(false);
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save account');
    }
  };

  const handleDeleteAccount = async (id: number) => {
    setIsDeleting(true);
    try {
      await api.delete(`/api/smtp/${id}`);
      toast.success('Account deleted');
      setDeleteConfirmId(null);
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete account');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pt-12 bg-brand-bg min-h-screen text-brand-text">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-12">
        <div className="flex-1 min-w-0 px-6 lg:px-0">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-brand-surface text-brand-accent border border-brand-border text-[10px] font-black uppercase tracking-[0.2em] rounded-full">Infrastructure</span>
            <div className="h-px w-12 bg-brand-border" />
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter font-display mb-4 leading-[0.9] text-brand-text">
            SMTP <span className="text-brand-accent">Accounts.</span>
          </h1>
          <p className="text-brand-muted text-xl max-w-2xl font-medium leading-relaxed">
            Connect and manage your sending infrastructure with enterprise-grade security.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto px-6 lg:px-0">
          <button
            onClick={() => setShowChecklist(true)}
            className="flex-1 sm:flex-none button-secondary"
          >
            <ShieldAlert size={22} strokeWidth={2.5} className="text-amber-500 group-hover:scale-110 transition-transform" />
            <span className="text-base sm:text-lg">Deliverability Check</span>
          </button>
          <button
            onClick={() => {
              resetForm();
              setIsAdding(true);
            }}
            className="flex-1 sm:flex-none button-primary"
          >
            <Plus size={22} strokeWidth={2.5} className="group-hover:rotate-90 transition-transform duration-300" />
            <span className="text-base sm:text-lg">Add Account</span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showChecklist && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl flex items-center justify-center p-6 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="glass w-full max-w-3xl rounded-[3.5rem] p-12 shadow-2xl relative border border-brand-border my-auto overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-brand-accent/5 rounded-full -mr-32 -mt-32 blur-3xl" />
              
              <button 
                onClick={() => setShowChecklist(false)}
                className="absolute top-8 right-8 p-4 bg-brand-bg hover:bg-brand-accent hover:text-brand-bg rounded-2xl transition-all z-50 group/close"
              >
                <XCircle size={24} className="group-hover/close:rotate-90 transition-transform duration-300" />
              </button>

              <div className="flex items-center gap-6 mb-12 relative z-10">
                <div className="w-20 h-20 bg-brand-accent text-brand-bg rounded-[2rem] flex items-center justify-center shadow-2xl shadow-brand-accent/20">
                  <ShieldCheck size={40} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="text-4xl font-black font-display tracking-tight text-brand-text">Deliverability Health</h2>
                  <p className="text-brand-accent font-black uppercase tracking-[0.2em] text-[10px] mt-1">Inbox placement optimization</p>
                </div>
              </div>

              <div className="space-y-8 relative z-10">
                <div className="bg-brand-accent/10 border border-brand-accent/20 p-8 rounded-[2.5rem] space-y-4">
                  <h3 className="text-xl font-bold flex items-center gap-3 text-brand-accent">
                    <Info size={24} className="text-brand-accent" />
                    Why is my email going to spam?
                  </h3>
                  <p className="text-brand-text/70 leading-relaxed font-medium">
                    GoDaddy and Office 365 have strict filters. To land in the <strong>Inbox</strong>, your domain must prove it's legitimate through three critical DNS records.
                  </p>
                  <div className="pt-4 border-t border-brand-accent/10">
                    <p className="text-sm font-bold text-brand-accent mb-2 uppercase tracking-widest">Recommended DMARC Record:</p>
                    <code className="block bg-brand-bg/50 p-3 rounded-xl text-brand-text font-mono text-xs border border-brand-accent/20">
                      v=DMARC1; p=quarantine; adkim=r; aspf=r;
                    </code>
                  </div>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 p-8 rounded-[2.5rem] space-y-4">
                  <h3 className="text-xl font-bold flex items-center gap-3 text-amber-500">
                    <ShieldAlert size={24} />
                    GoDaddy / Office 365 Success Checklist
                  </h3>
                  <ul className="space-y-3 text-brand-text/70 font-medium">
                    <li className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center mt-0.5 flex-shrink-0 text-amber-500 font-bold text-[10px]">1</div>
                      <span><strong>Enable Authenticated SMTP:</strong> Go to Microsoft 365 Admin Center &gt; Users &gt; Active Users &gt; Select User &gt; Mail &gt; Manage Email Apps &gt; Check <strong>Authenticated SMTP</strong>.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center mt-0.5 flex-shrink-0 text-amber-500 font-bold text-[10px]">2</div>
                      <span><strong>Disable Security Defaults (CRITICAL):</strong> Go to <a href="https://entra.microsoft.com/" target="_blank" className="underline text-amber-600">Microsoft Entra (Azure AD)</a> &gt; Properties &gt; Manage Security Defaults &gt; Set to <strong>Disabled</strong>. Basic Auth will NOT work if this is enabled.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center mt-0.5 flex-shrink-0 text-amber-500 font-bold text-[10px]">3</div>
                      <span><strong>Wait for Propagation:</strong> PowerShell changes for `SmtpClientAuthenticationDisabled` can take 15-60 minutes to propagate across Microsoft's servers.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center mt-0.5 flex-shrink-0 text-amber-500 font-bold text-[10px]">4</div>
                      <span><strong>App Passwords:</strong> If you cannot disable Security Defaults, you <strong>MUST</strong> enable MFA and create an <a href="https://mysignins.microsoft.com/security-info" target="_blank" className="underline text-amber-600">App Password</a>.</span>
                    </li>
                  </ul>
                  <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                    <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-2">Getting "User is locked by security defaults"?</p>
                    <p className="text-sm text-brand-text/70">This means Microsoft is blocking your login. You <strong>MUST</strong> perform Step 2 above (Disable Security Defaults) or use an App Password. There is no other way to bypass this Microsoft security lock.</p>
                  </div>
                </div>

                <div className="grid gap-6">
                  {[
                    {
                      title: "SPF (Sender Policy Framework)",
                      desc: "Tells mail servers which IP addresses are allowed to send email for your domain.",
                      godaddy: "v=spf1 include:spf.protection.outlook.com -all",
                      icon: <CheckCircle className="text-emerald-500" />
                    },
                    {
                      title: "DKIM (DomainKeys Identified Mail)",
                      desc: "Adds a digital signature to your emails, proving they weren't tampered with.",
                      godaddy: "Enable DKIM in the Office 365 Admin Center (Security > DKIM). Select your domain and click 'Create DKIM keys'. Then add the CNAME records to your DNS.",
                      icon: <CheckCircle className="text-emerald-500" />
                    },
                    {
                      title: "DMARC (Domain-based Message Authentication)",
                      desc: "Tells servers what to do if SPF or DKIM fails (e.g., quarantine or reject).",
                      godaddy: "v=DMARC1; p=quarantine; adkim=r; aspf=r;",
                      icon: <CheckCircle className="text-emerald-500" />
                    }
                  ].map((item, i) => (
                    <div key={i} className="p-8 bg-brand-bg/50 border border-brand-border rounded-[2.5rem] shadow-sm hover:bg-brand-surface transition-all group">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-brand-surface rounded-xl group-hover:bg-brand-accent group-hover:text-brand-bg transition-all">
                            {item.icon}
                          </div>
                          <h4 className="text-xl font-bold text-brand-text">{item.title}</h4>
                        </div>
                        <a 
                          href="https://dmarcian.com/godaddy-dmarc-setup/" 
                          target="_blank" 
                          rel="noreferrer"
                          className="p-3 bg-brand-surface hover:bg-brand-accent hover:text-brand-bg rounded-xl transition-all"
                        >
                          <ExternalLink size={18} />
                        </a>
                      </div>
                      <p className="text-brand-muted font-medium mb-6 leading-relaxed">{item.desc}</p>
                      <div className="bg-brand-bg p-4 rounded-2xl font-mono text-xs break-all border border-brand-border text-brand-muted">
                        {item.godaddy}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-8 border-t border-brand-border flex flex-col sm:flex-row gap-4">
                  <button 
                    onClick={() => setShowChecklist(false)}
                    className="flex-1 button-primary"
                  >
                    I've updated my DNS
                  </button>
                  <a 
                    href="https://mxtoolbox.com/deliverability" 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex-1 button-secondary"
                  >
                    Test My Domain
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 px-6 lg:px-0">
        {accounts.map((acc) => (
          <motion.div
            key={acc.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-base card-hover p-8 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-emerald-500/10 transition-colors duration-500" />
            
            <div className="flex justify-between items-start mb-8 relative z-10">
              <div className="p-4 bg-brand-bg rounded-2xl group-hover:bg-brand-accent group-hover:text-brand-bg transition-all duration-300">
                <ShieldCheck size={28} strokeWidth={1.5} />
              </div>
              <div className="flex items-center gap-3">
                <span className="bg-emerald-500/10 text-emerald-400 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-emerald-500/20">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  Active
                </span>
                <button 
                  onClick={() => setDeleteConfirmId(acc.id)}
                  className="p-2 hover:bg-red-500/10 rounded-xl text-brand-muted hover:text-red-400 transition-all duration-200"
                  title="Delete Account"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>

            <div className="relative z-10">
              <h3 className="text-2xl font-bold mb-2 font-display text-brand-text group-hover:text-brand-accent transition-colors">{acc.name}</h3>
              <p className="text-brand-muted mb-8 font-medium truncate">{acc.user}</p>
              
              <div className="space-y-4 pt-6 border-t border-brand-border">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-brand-muted font-medium">Host</span>
                  <span className="text-sm font-bold bg-brand-bg text-brand-text px-3 py-1 rounded-lg border border-brand-border">{acc.host}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-brand-muted font-medium">Port</span>
                  <span className="text-sm font-bold bg-brand-bg text-brand-text px-3 py-1 rounded-lg border border-brand-border">{acc.port}</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="glass w-full max-w-3xl rounded-[3rem] p-10 shadow-2xl border border-brand-border max-h-[90vh] overflow-y-auto no-scrollbar"
          >
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-bold font-display text-brand-text">Add SMTP Account</h2>
              <button 
                onClick={() => setIsAdding(false)}
                className="p-3 hover:bg-brand-surface rounded-full transition-colors"
              >
                <XCircle size={24} className="text-brand-muted" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-brand-muted uppercase tracking-wider mb-2 ml-1">Account Name</label>
                  <input
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-base"
                    placeholder="e.g. Marketing Primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-brand-muted uppercase tracking-wider mb-2 ml-1">Provider Preset</label>
                  <select
                    onChange={handlePresetChange}
                    className="w-full px-6 py-4 bg-brand-surface border border-brand-border rounded-2xl focus:border-brand-accent outline-none font-bold text-brand-text transition-all appearance-none cursor-pointer"
                  >
                    {PROVIDER_PRESETS.map(p => <option key={p.name} className="bg-brand-surface">{p.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-brand-muted uppercase tracking-wider mb-2 ml-1">Host</label>
                  <input
                    required
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    className="input-base"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-brand-muted uppercase tracking-wider mb-2 ml-1">Port</label>
                  <input
                    type="number"
                    required
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                    className="input-base"
                  />
                </div>

                <div className="flex items-center gap-4 md:pt-8">
                  <div 
                    onClick={() => setFormData({ ...formData, secure: !formData.secure })}
                    className="flex items-center gap-3 cursor-pointer group"
                  >
                    <div className={`w-12 h-6 rounded-full transition-all duration-300 relative ${formData.secure ? 'bg-brand-accent' : 'bg-brand-border'}`}>
                      <div className={`absolute top-1 w-4 h-4 rounded-full transition-all duration-300 ${formData.secure ? 'left-7 bg-brand-bg' : 'left-1 bg-brand-muted'}`} />
                    </div>
                    <span className="text-sm font-bold text-brand-muted uppercase tracking-wider">Use SSL/TLS</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-brand-muted uppercase tracking-wider mb-2 ml-1">Username</label>
                  <input
                    required
                    value={formData.user}
                    onChange={(e) => setFormData({ ...formData, user: e.target.value })}
                    className="input-base"
                    placeholder="email@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-brand-muted uppercase tracking-wider mb-2 ml-1">Password</label>
                  <input
                    type="password"
                    required
                    value={formData.pass}
                    onChange={(e) => setFormData({ ...formData, pass: e.target.value })}
                    className="input-base"
                    placeholder="••••••••••••"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-brand-muted uppercase tracking-wider mb-2 ml-1">From Email</label>
                  <input
                    required
                    value={formData.from_email}
                    onChange={(e) => setFormData({ ...formData, from_email: e.target.value })}
                    className="input-base"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-brand-muted uppercase tracking-wider mb-2 ml-1">From Name</label>
                  <input
                    value={formData.from_name}
                    onChange={(e) => setFormData({ ...formData, from_name: e.target.value })}
                    className="input-base"
                    placeholder="e.g. John Doe"
                  />
                </div>

                <div className="md:col-span-2 pt-6 border-t border-brand-border">
                  <h3 className="text-xl font-bold mb-1 font-display text-brand-text">IMAP Settings (Optional)</h3>
                  <p className="text-xs text-brand-muted mb-4">Enable this if you want to automatically detect when a contact replies. (Currently disabled for background processing to ensure SMTP stability).</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-brand-muted uppercase tracking-wider mb-2 ml-1">IMAP Host</label>
                  <input
                    value={formData.imap_host}
                    onChange={(e) => setFormData({ ...formData, imap_host: e.target.value })}
                    className="input-base"
                    placeholder="imap.example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-brand-muted uppercase tracking-wider mb-2 ml-1">IMAP Port</label>
                  <input
                    type="number"
                    value={formData.imap_port}
                    onChange={(e) => setFormData({ ...formData, imap_port: parseInt(e.target.value) })}
                    className="input-base"
                  />
                </div>

                <div className="flex items-center gap-4 md:pt-8">
                  <div 
                    onClick={() => setFormData({ ...formData, imap_secure: !formData.imap_secure })}
                    className="flex items-center gap-3 cursor-pointer group"
                  >
                    <div className={`w-12 h-6 rounded-full transition-all duration-300 relative ${formData.imap_secure ? 'bg-brand-accent' : 'bg-brand-border'}`}>
                      <div className={`absolute top-1 w-4 h-4 rounded-full transition-all duration-300 ${formData.imap_secure ? 'left-7 bg-brand-bg' : 'left-1 bg-brand-muted'}`} />
                    </div>
                    <span className="text-sm font-bold text-brand-muted uppercase tracking-wider">Use IMAP SSL/TLS</span>
                  </div>
                </div>
              </div>

              <div className="space-y-6 pt-8 border-t border-brand-border">
                <div className="flex items-center justify-between bg-brand-bg p-6 rounded-[2rem] border border-brand-border">
                  <div>
                    <h4 className="font-bold text-lg text-brand-text">Verification Test</h4>
                    <p className="text-sm text-brand-muted">Ensure your settings are correct before saving.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTestEmailInput(!showTestEmailInput)}
                    className={`px-6 py-3 rounded-xl font-bold transition-all duration-150 ${showTestEmailInput ? 'bg-brand-accent text-brand-bg shadow-lg shadow-brand-accent/20' : 'bg-brand-surface text-brand-muted hover:text-brand-text border border-brand-border'}`}
                  >
                    {showTestEmailInput ? 'Send Test Email' : 'Test Connection'}
                  </button>
                </div>
                
                {showTestEmailInput && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-2"
                  >
                    <label className="block text-sm font-bold text-brand-muted uppercase tracking-wider mb-2 ml-1">Test Recipient Email</label>
                    <input
                      type="email"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      className="input-base"
                      placeholder="your-email@example.com"
                    />
                  </motion.div>
                )}
              </div>

              <div className="flex flex-col md:flex-row gap-4 pt-8">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testing}
                  className="flex-1 button-secondary"
                >
                  {testing ? <RefreshCw className="animate-spin" size={24} /> : <ShieldCheck size={24} strokeWidth={2.5} />}
                  Run Diagnostics
                </button>
                <button
                  type="submit"
                  className="flex-[1.5] button-primary"
                >
                  Confirm & Save
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass w-full max-w-md rounded-[3rem] p-10 shadow-2xl text-center border border-brand-border"
          >
            <div className="w-24 h-24 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mx-auto mb-8 border border-red-500/20 shadow-2xl shadow-red-500/10">
              <Trash2 size={48} strokeWidth={1.5} />
            </div>
            <h2 className="text-3xl font-bold mb-4 font-display text-brand-text">Delete Account?</h2>
            <p className="text-brand-muted text-lg mb-10 leading-relaxed">This action is permanent. Campaigns relying on this SMTP server will be paused or fail.</p>
            <div className="flex flex-col gap-4">
              <button
                disabled={isDeleting}
                onClick={() => handleDeleteAccount(deleteConfirmId)}
                className="button-danger w-full"
              >
                {isDeleting ? <RefreshCw className="animate-spin" size={24} /> : <Trash2 size={24} />}
                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
              <button
                disabled={isDeleting}
                onClick={() => setDeleteConfirmId(null)}
                className="w-full py-5 rounded-2xl font-bold text-brand-muted hover:text-brand-text hover:bg-brand-surface transition-all"
              >
                Keep Account
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
