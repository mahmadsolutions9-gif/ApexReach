import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { Plus, Users, Upload, Trash2, FileText, Eye, X, Edit, Check, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { safeLocaleDateString } from '../lib/dateUtils';
import { cn } from '../lib/utils';

export default function ContactLists() {
  const [lists, setLists] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleteContactConfirmId, setDeleteContactConfirmId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploading, setUploading] = useState<number | null>(null);
  const [previewList, setPreviewList] = useState<any>(null);
  const [previewContacts, setPreviewContacts] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingContactId, setEditingContactId] = useState<number | null>(null);

  useEffect(() => {
    fetchLists();
  }, []);

  const handleStatusUpdate = async (contactId: number, newStatus: string) => {
    try {
      await api.put(`/api/contacts/${contactId}/status`, { status: newStatus });
      setPreviewContacts(prev => prev.map(c => c.id === contactId ? { ...c, status: newStatus } : c));
      setEditingContactId(null);
      toast.success('Status updated');
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleDeleteContact = async (contactId: number) => {
    setIsDeleting(true);
    try {
      await api.delete(`/api/contacts/${contactId}`);
      setPreviewContacts(prev => prev.filter(c => c.id !== contactId));
      toast.success('Contact deleted');
      setDeleteContactConfirmId(null);
    } catch (err) {
      toast.error('Failed to delete contact');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteList = async (listId: number) => {
    setIsDeleting(true);
    try {
      await api.delete(`/api/lists/${listId}`);
      setLists(prev => prev.filter(l => l.id !== listId));
      toast.success('List deleted');
      setDeleteConfirmId(null);
    } catch (err) {
      console.error("Delete list error:", err);
      toast.error('Failed to delete list');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredContacts = statusFilter === 'all' 
    ? previewContacts 
    : previewContacts.filter(c => c.status === statusFilter);

  const fetchLists = async () => {
    try {
      const res = await api.get('/api/lists');
      if (Array.isArray(res.data)) {
        setLists(res.data);
      } else {
        console.error('Expected array of lists, got:', res.data);
        setLists([]);
      }
    } catch (err) {
      toast.error('Failed to fetch lists');
      setLists([]);
    }
  };

  const handlePreview = async (list: any) => {
    setPreviewList(list);
    try {
      const res = await api.get(`/api/lists/${list.id}/contacts`);
      if (Array.isArray(res.data)) {
        setPreviewContacts(res.data);
      } else {
        console.error('Expected array of contacts, got:', res.data);
        setPreviewContacts([]);
      }
    } catch (err) {
      toast.error('Failed to load contacts');
      setPreviewContacts([]);
    }
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/lists', { name: newListName });
      toast.success('List created');
      setNewListName('');
      setIsAdding(false);
      fetchLists();
    } catch (err) {
      toast.error('Failed to create list');
    }
  };

  const handleFileUpload = async (listId: number, file: File) => {
    setUploading(listId);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post(`/api/lists/${listId}/upload`, formData, {
        headers: { 
          'Content-Type': 'multipart/form-data'
        }
      });
      toast.success(`Uploaded ${res.data.count} contacts`);
      fetchLists();
    } catch (err) {
      toast.error('Upload failed');
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 md:space-y-12 pt-16 md:pt-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-bold tracking-tight font-display text-slate-900">Contact Lists</h1>
          <p className="text-slate-500 font-medium">Manage your leads and segment your audience.</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="w-full md:w-auto flex items-center justify-center gap-3 bg-slate-900 text-white px-10 py-5 rounded-[2.5rem] font-bold border border-slate-900 shadow-2xl shadow-slate-200 hover:bg-slate-800 hover:-translate-y-1 active:translate-y-0 transition-all group"
        >
          <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center group-hover:rotate-90 transition-transform duration-300">
            <Plus size={16} strokeWidth={3} />
          </div>
          <span className="text-lg">New List</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {lists.map((list) => (
          <motion.div
            key={list.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm card-hover group"
          >
            <div className="flex justify-between items-start mb-8">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center shadow-inner group-hover:bg-slate-100 group-hover:text-slate-900 transition-all duration-500 text-slate-400">
                <Users size={28} strokeWidth={1.5} />
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handlePreview(list)}
                  className="p-3 hover:bg-slate-50 rounded-2xl transition-all text-slate-400 hover:text-slate-900 border border-transparent hover:border-slate-200"
                  title="Preview Contacts"
                >
                  <Eye size={20} />
                </button>
                <label className="cursor-pointer p-3 hover:bg-slate-50 rounded-2xl transition-all text-slate-400 hover:text-slate-900 border border-transparent hover:border-slate-200">
                  <Upload size={20} className={uploading === list.id ? 'animate-bounce' : ''} />
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(list.id, e.target.files[0])}
                  />
                </label>
                <button 
                  onClick={() => setDeleteConfirmId(list.id)}
                  className="p-3 hover:bg-red-50 rounded-2xl transition-all text-slate-400 hover:text-red-600 border border-transparent hover:border-red-100"
                  title="Delete List"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
            <h3 className="text-xl font-bold mb-2 group-hover:text-blue-600 transition-colors text-slate-900">{list.name}</h3>
            <div className="flex items-center gap-3 mb-6">
              <span className="px-3 py-1 bg-slate-50 text-slate-500 rounded-full text-[10px] font-bold uppercase tracking-widest border border-slate-200">
                {list.contactCount || 0} Emails
              </span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                {safeLocaleDateString(list.created_at)}
              </span>
            </div>
            
            <div className="flex items-center gap-3 text-xs font-bold text-slate-500 uppercase tracking-widest bg-slate-50 p-3 rounded-xl border border-slate-200">
              <FileText size={16} className="text-slate-400" />
              <span>Mapping: name - email</span>
            </div>
          </motion.div>
        ))}
      </div>

      {previewList && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-6 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white w-full max-w-3xl rounded-[3rem] p-10 shadow-2xl max-h-[85vh] flex flex-col border border-slate-200"
          >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-slate-50 text-slate-900 rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-slate-200/50 border border-slate-200">
                  <Users size={32} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="text-3xl font-bold font-display text-slate-900">{previewList.name}</h2>
                  <p className="text-slate-500 font-semibold uppercase tracking-widest text-[10px]">Previewing first 100 contacts</p>
                </div>
              </div>
              <div className="flex items-center gap-4 w-full md:w-auto">
                <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="flex-1 md:flex-none px-6 py-3 bg-slate-50 rounded-2xl border border-slate-200 text-sm font-bold focus:ring-2 focus:ring-slate-200 transition-all text-slate-900 outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="bounced">Bounced</option>
                </select>
                <button 
                  onClick={() => setPreviewList(null)} 
                  className="p-3 hover:bg-slate-50 rounded-2xl transition-all text-slate-400 hover:text-slate-900"
                >
                  <X size={24} />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto border border-slate-200 rounded-[2rem] bg-slate-50/50 no-scrollbar">
              <table className="w-full text-sm">
                <thead className="bg-white/80 backdrop-blur-md sticky top-0 z-10 border-b border-slate-200">
                  <tr className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                    <th className="px-8 py-5">Name</th>
                    <th className="px-8 py-5">Email</th>
                    <th className="px-8 py-5">Status</th>
                    <th className="px-8 py-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredContacts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-8 py-16 text-center">
                        <div className="flex flex-col items-center gap-3 text-slate-300">
                          <Users size={40} strokeWidth={1} />
                          <p className="font-bold uppercase tracking-widest text-xs">No contacts match this filter</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredContacts.map((c, i) => (
                      <tr key={i} className="group hover:bg-white transition-colors">
                        <td className="px-8 py-5 font-bold text-slate-900">{c.name || '—'}</td>
                        <td className="px-8 py-5 text-slate-500 font-medium">{c.email}</td>
                        <td className="px-8 py-5">
                          {editingContactId === c.id ? (
                            <select
                              value={c.status}
                              onChange={(e) => handleStatusUpdate(c.id, e.target.value)}
                              className="text-[10px] font-bold uppercase px-3 py-1.5 rounded-xl border border-slate-200 focus:ring-slate-200 bg-white text-slate-900 outline-none"
                              autoFocus
                              onBlur={() => setEditingContactId(null)}
                            >
                              <option value="active">Active</option>
                              <option value="bounced">Bounced</option>
                            </select>
                          ) : (
                            <span className={cn(
                              "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border",
                              c.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                              c.status === 'bounced' ? 'bg-red-50 text-red-600 border-red-100' :
                              'bg-slate-50 text-slate-500 border-slate-200'
                            )}>
                              {c.status}
                            </span>
                          )}
                        </td>
                        <td className="px-8 py-5 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => setEditingContactId(editingContactId === c.id ? null : c.id)}
                              className="p-2.5 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-900 transition-all border border-transparent hover:border-slate-200"
                              title="Edit Status"
                            >
                              {editingContactId === c.id ? <Check size={16} strokeWidth={2.5} /> : <Edit size={16} strokeWidth={2.5} />}
                            </button>
                            <button 
                              onClick={() => setDeleteContactConfirmId(c.id)}
                              className="p-2.5 hover:bg-red-50 rounded-xl text-slate-400 hover:text-red-600 transition-all border border-transparent hover:border-red-100"
                              title="Delete Contact"
                            >
                              <Trash2 size={16} strokeWidth={2.5} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      )}

      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-6 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white w-full max-w-md rounded-[3rem] p-10 shadow-2xl border border-slate-200"
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-slate-50 text-slate-900 rounded-2xl flex items-center justify-center border border-slate-200">
                <Plus size={24} strokeWidth={3} />
              </div>
              <h2 className="text-2xl font-bold font-display text-slate-900">New Contact List</h2>
            </div>
            <form onSubmit={handleCreateList} className="space-y-6">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">List Name</label>
                <input
                  required
                  autoFocus
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-slate-200 transition-all font-medium text-slate-900 outline-none"
                  placeholder="e.g. Q1 Leads"
                />
              </div>
              <div className="flex flex-col gap-3 pt-4">
                <button
                  type="submit"
                  className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-bold border border-slate-900 shadow-2xl shadow-slate-200 hover:bg-slate-800 hover:-translate-y-1 active:translate-y-0 transition-all"
                >
                  Create List
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="w-full py-4 text-slate-400 font-bold hover:text-slate-900 transition-all text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-sm rounded-[3rem] p-10 shadow-2xl text-center border border-slate-200"
            >
              <div className="w-20 h-20 bg-red-50 text-red-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner border border-red-100">
                <Trash2 size={40} strokeWidth={1.5} />
              </div>
              <h2 className="text-2xl font-bold mb-3 font-display text-slate-900">Delete List?</h2>
              <p className="text-slate-500 mb-10 text-sm font-medium leading-relaxed">This will permanently delete the list and all its contacts. This action cannot be undone.</p>
              <div className="flex flex-col gap-3">
                <button
                  disabled={isDeleting}
                  onClick={() => handleDeleteList(deleteConfirmId)}
                  className="w-full bg-red-600 text-white py-5 rounded-[2rem] font-bold hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl shadow-red-200"
                >
                  {isDeleting ? <RefreshCw size={20} className="animate-spin" /> : null}
                  {isDeleting ? 'Deleting...' : 'Delete List'}
                </button>
                <button
                  disabled={isDeleting}
                  onClick={() => setDeleteConfirmId(null)}
                  className="w-full py-4 text-slate-400 font-bold hover:text-slate-900 transition-all text-sm"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {deleteContactConfirmId && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl text-center border border-slate-200"
          >
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-100">
              <Trash2 size={32} />
            </div>
            <h2 className="text-2xl font-bold mb-2 text-slate-900">Delete Contact?</h2>
            <p className="text-slate-500 mb-8">Are you sure you want to delete this contact? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                disabled={isDeleting}
                onClick={() => setDeleteContactConfirmId(null)}
                className="flex-1 px-6 py-3 rounded-xl font-semibold border border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-slate-900 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={isDeleting}
                onClick={() => handleDeleteContact(deleteContactConfirmId)}
                className="flex-1 bg-red-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
