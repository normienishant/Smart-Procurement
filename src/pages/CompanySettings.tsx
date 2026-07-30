import { useEffect, useState } from 'react';
import { Building2, Save, Loader2, Upload, X } from 'lucide-react';
import { getCompanySettings, updateCompanySettings } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface CompanySettings {
  id: string;
  company_name: string;
  logo_url: string;
  address: string;
  gstin: string;
  pan: string;
  phone: string;
  email: string;
}

export default function CompanySettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<CompanySettings>({
    id: '',
    company_name: '',
    logo_url: '',
    address: '',
    gstin: '',
    pan: '',
    phone: '',
    email: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');

  useEffect(() => {
    async function load() {
      const data = await getCompanySettings();
      if (data) {
        setSettings(data);
        setPreview(data.logo_url || '');
      }
      setLoading(false);
    }
    load();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      let logoUrl = settings.logo_url;
      if (file) {
        // For demo, we'll use base64; in production, upload to Supabase Storage
        logoUrl = preview;
      }

      const { error } = await updateCompanySettings({
        id: settings.id,
        company_name: settings.company_name,
        logo_url: logoUrl,
        address: settings.address,
        gstin: settings.gstin,
        pan: settings.pan,
        phone: settings.phone,
        email: settings.email,
      });

      if (error) throw error;
      toast.success('Company settings updated');
      setFile(null);
    } catch (err) {
      toast.error('Failed to update settings');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#f97316]" /></div>;
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Building2 size={24} className="text-[#f97316]" />
        <h1 className="text-2xl font-bold text-[#f5f5f5]">Company Details</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Logo */}
        <div className="bg-[#111111] border border-[#1c1c1c] rounded-xl p-5">
          <label className="block text-sm font-medium text-[#a3a3a3] mb-2">Company Logo</label>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-lg border border-[#242424] bg-[#0d0d0d] flex items-center justify-center overflow-hidden">
              {preview ? <img src={preview} alt="Logo" className="w-full h-full object-contain" /> : <Building2 size={32} className="text-[#525252]" />}
            </div>
            <div>
              <label className="cursor-pointer px-4 py-2 rounded-lg border border-[#242424] hover:border-[#f97316]/50 text-sm text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors inline-flex items-center gap-2">
                <Upload size={16} /> Upload Logo
                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </label>
              {file && <span className="text-xs text-[#525252] ml-2">{file.name}</span>}
            </div>
          </div>
        </div>

        {/* Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-[#a3a3a3] mb-1.5">Company Name</label>
            <input
              type="text"
              value={settings.company_name}
              onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-[#111111] border border-[#242424] text-[#f5f5f5] text-sm placeholder-[#3a3a3a] focus:outline-none focus:border-[#f97316]/50"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-[#a3a3a3] mb-1.5">GSTIN</label>
            <input
              type="text"
              value={settings.gstin}
              onChange={(e) => setSettings({ ...settings, gstin: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-[#111111] border border-[#242424] text-[#f5f5f5] text-sm placeholder-[#3a3a3a] focus:outline-none focus:border-[#f97316]/50"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-[#a3a3a3] mb-1.5">PAN</label>
            <input
              type="text"
              value={settings.pan}
              onChange={(e) => setSettings({ ...settings, pan: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-[#111111] border border-[#242424] text-[#f5f5f5] text-sm placeholder-[#3a3a3a] focus:outline-none focus:border-[#f97316]/50"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-[#a3a3a3] mb-1.5">Phone</label>
            <input
              type="text"
              value={settings.phone}
              onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-[#111111] border border-[#242424] text-[#f5f5f5] text-sm placeholder-[#3a3a3a] focus:outline-none focus:border-[#f97316]/50"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-widest text-[#a3a3a3] mb-1.5">Email</label>
            <input
              type="email"
              value={settings.email}
              onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-[#111111] border border-[#242424] text-[#f5f5f5] text-sm placeholder-[#3a3a3a] focus:outline-none focus:border-[#f97316]/50"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-widest text-[#a3a3a3] mb-1.5">Address</label>
            <textarea
              value={settings.address}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl bg-[#111111] border border-[#242424] text-[#f5f5f5] text-sm placeholder-[#3a3a3a] focus:outline-none focus:border-[#f97316]/50"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 rounded-xl bg-[#f97316] hover:bg-[#ea6c0a] text-white font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {saving ? 'Saving...' : 'Save Company Details'}
        </button>
      </form>
    </div>
  );
}