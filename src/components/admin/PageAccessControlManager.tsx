import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { FaEdit, FaTrash, FaPlus, FaEye, FaEyeSlash, FaLock, FaUnlock } from 'react-icons/fa';
import { TRUST_LEVEL_CONFIGS } from '../../types/trustLevels';

interface PageAccessControl {
  id: string;
  page_path: string;
  page_name: string;
  description: string;
  min_trust_level: number;
  requires_discord_verification: boolean;
  requires_paid_verification: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface EditModalProps {
  control: PageAccessControl | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (control: Partial<PageAccessControl>) => Promise<void>;
  isCreating: boolean;
}

const EditModal: React.FC<EditModalProps> = ({ control, isOpen, onClose, onSave, isCreating }) => {
  const [formData, setFormData] = useState<Partial<PageAccessControl>>({
    page_path: '',
    page_name: '',
    description: '',
    min_trust_level: 0,
    requires_discord_verification: false,
    requires_paid_verification: false,
    is_active: true
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (control) {
      setFormData(control);
    } else {
      setFormData({
        page_path: '',
        page_name: '',
        description: '',
        min_trust_level: 0,
        requires_discord_verification: false,
        requires_paid_verification: false,
        is_active: true
      });
    }
  }, [control]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error saving page access control:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#232b36] rounded-lg p-6 max-w-md w-full border border-[#3a4250] shadow-xl">
        <h2 className="text-xl font-bold text-gray-200 mb-4">
          {isCreating ? 'Create Page Access Control' : 'Edit Page Access Control'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Page Path</label>
            <input
              type="text"
              value={formData.page_path || ''}
              onChange={(e) => setFormData({ ...formData, page_path: e.target.value })}
              className="w-full p-2 border rounded bg-[#323a45] text-gray-200 border-[#3a4250] focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="/example-page"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Page Name</label>
            <input
              type="text"
              value={formData.page_name || ''}
              onChange={(e) => setFormData({ ...formData, page_name: e.target.value })}
              className="w-full p-2 border rounded bg-[#323a45] text-gray-200 border-[#3a4250] focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Example Page"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full p-2 border rounded bg-[#323a45] text-gray-200 border-[#3a4250] focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Description of this page's purpose"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Minimum Trust Level</label>
            <select
              value={formData.min_trust_level || 0}
              onChange={(e) => setFormData({ ...formData, min_trust_level: Number(e.target.value) })}
              className="w-full p-2 border rounded bg-[#323a45] text-gray-200 border-[#3a4250] focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {TRUST_LEVEL_CONFIGS.map(config => (
                <option key={config.level} value={config.level}>
                  {config.icon} {config.label} (Level {config.level})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-gray-300">
              <input
                type="checkbox"
                checked={formData.requires_discord_verification || false}
                onChange={(e) => setFormData({ ...formData, requires_discord_verification: e.target.checked })}
                className="checkbox checkbox-sm"
              />
              <span>Requires Discord Verification</span>
            </label>

            <label className="flex items-center gap-2 text-gray-300">
              <input
                type="checkbox"
                checked={formData.requires_paid_verification || false}
                onChange={(e) => setFormData({ ...formData, requires_paid_verification: e.target.checked })}
                className="checkbox checkbox-sm"
              />
              <span>Requires Paid Tracker Verification</span>
            </label>

            <label className="flex items-center gap-2 text-gray-300">
              <input
                type="checkbox"
                checked={formData.is_active !== false}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="checkbox checkbox-sm"
              />
              <span>Active</span>
            </label>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary flex-1"
            >
              {loading ? 'Saving...' : (isCreating ? 'Create' : 'Save')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost flex-1 text-gray-300"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const PageAccessControlManager: React.FC = () => {
  const [controls, setControls] = useState<PageAccessControl[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    control: PageAccessControl | null;
    isCreating: boolean;
  }>({ isOpen: false, control: null, isCreating: false });

  const loadControls = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('page_access_controls')
        .select('*')
        .order('page_path');

      if (error) throw error;
      setControls(data || []);
    } catch (error) {
      console.error('Error loading page access controls:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadControls();
  }, []);

  const handleSave = async (controlData: Partial<PageAccessControl>) => {
    try {
      if (editModal.isCreating) {
        await supabase
          .from('page_access_controls')
          .insert([controlData]);
      } else {
        await supabase
          .from('page_access_controls')
          .update(controlData)
          .eq('id', editModal.control?.id);
      }
      await loadControls();
    } catch (error) {
      console.error('Error saving page access control:', error);
      throw error;
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this page access control?')) return;
    
    try {
      await supabase
        .from('page_access_controls')
        .delete()
        .eq('id', id);
      await loadControls();
    } catch (error) {
      console.error('Error deleting page access control:', error);
    }
  };

  const handleBulkToggle = async (isActive: boolean) => {
    try {
      await supabase
        .from('page_access_controls')
        .update({ is_active: isActive })
        .in('id', controls.map(c => c.id));
      await loadControls();
    } catch (error) {
      console.error('Error bulk updating page access controls:', error);
    }
  };

  const filteredControls = controls.filter(control =>
    control.page_path.toLowerCase().includes(searchTerm.toLowerCase()) ||
    control.page_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTrustLevelBadge = (level: number) => {
    const config = TRUST_LEVEL_CONFIGS.find(c => c.level === level);
    return config ? `${config.icon} ${config.label}` : `Level ${level}`;
  };

  return (
    <div className="bg-[#232b36] rounded-lg p-6 border border-[#3a4250]">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-200">Page Access Controls</h2>
        <button
          onClick={() => setEditModal({ isOpen: true, control: null, isCreating: true })}
          className="btn btn-primary flex items-center gap-2"
        >
          <FaPlus size={14} />
          Add New Control
        </button>
      </div>

      {/* Search and Bulk Actions */}
      <div className="flex gap-4 mb-6">
        <input
          type="text"
          placeholder="Search pages..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input input-bordered flex-1 bg-[#323a45] text-gray-200 border-[#3a4250]"
        />
        <button
          onClick={() => handleBulkToggle(true)}
          className="btn btn-sm btn-success"
        >
          <FaEye size={12} />
          Enable All
        </button>
        <button
          onClick={() => handleBulkToggle(false)}
          className="btn btn-sm btn-warning"
        >
          <FaEyeSlash size={12} />
          Disable All
        </button>
      </div>

      {/* Controls Table */}
      <div className="overflow-x-auto">
        <table className="table w-full">
          <thead>
            <tr>
              <th className="text-gray-300">Page Path</th>
              <th className="text-gray-300">Page Name</th>
              <th className="text-gray-300">Trust Level</th>
              <th className="text-gray-300">Discord</th>
              <th className="text-gray-300">Paid</th>
              <th className="text-gray-300">Status</th>
              <th className="text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center text-gray-400 py-8">
                  Loading page access controls...
                </td>
              </tr>
            ) : filteredControls.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-gray-400 py-8">
                  No page access controls found.
                </td>
              </tr>
            ) : (
              filteredControls.map((control) => (
                <tr key={control.id} className="hover:bg-[#2a323c]">
                  <td className="text-gray-200 font-mono text-sm">{control.page_path}</td>
                  <td className="text-gray-200">{control.page_name}</td>
                  <td>
                    <span className="badge badge-sm">
                      {getTrustLevelBadge(control.min_trust_level)}
                    </span>
                  </td>
                  <td>
                    {control.requires_discord_verification ? (
                      <span className="text-blue-400">✓</span>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </td>
                  <td>
                    {control.requires_paid_verification ? (
                      <span className="text-yellow-400">✓</span>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </td>
                  <td>
                    {control.is_active ? (
                      <span className="badge badge-success badge-sm">Active</span>
                    ) : (
                      <span className="badge badge-neutral badge-sm">Inactive</span>
                    )}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditModal({ isOpen: true, control, isCreating: false })}
                        className="btn btn-xs btn-primary"
                        title="Edit"
                      >
                        <FaEdit size={10} />
                      </button>
                      <button
                        onClick={() => handleDelete(control.id)}
                        className="btn btn-xs btn-error"
                        title="Delete"
                      >
                        <FaTrash size={10} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      <EditModal
        control={editModal.control}
        isOpen={editModal.isOpen}
        isCreating={editModal.isCreating}
        onClose={() => setEditModal({ isOpen: false, control: null, isCreating: false })}
        onSave={handleSave}
      />
    </div>
  );
};