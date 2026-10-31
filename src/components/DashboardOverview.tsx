import React, { useState, useEffect, useMemo } from 'react';
import { DashboardStats, UtilizationStats, AuditLog, Pengajuan, User, Aset } from '../types';
import { apiClient } from '../lib/apiClient';
import { 
  Package, 
  CheckCircle2, 
  Clock, 
  Wrench, 
  Trash2, 
  AlertTriangle, 
  FileCheck, 
  ArrowRight,
  TrendingUp,
  Building2,
  Calendar,
  Activity,
  QrCode,
  Check,
  X,
  ShieldAlert,
  AlertCircle,
  BarChart3,
  Layers,
  Gauge,
  Sparkles,
  Inbox,
  Search
} from 'lucide-react';
import { canUserApprovePengajuan } from '../lib/approvalUtils';

interface DashboardOverviewProps {
  stats: DashboardStats;
  asets?: Aset[];
  auditLogs: AuditLog[];
  pendingRequests: Pengajuan[];
  currentUser: User;
  onNavigateToTab: (tab: string) => void;
  onApproveRequest: (id: string, note: string) => void;
  onRejectRequest: (id: string, note: string) => void;
  onOpenScanner: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  stats,
  asets = [],
  auditLogs,
  pendingRequests,
  currentUser,
  onNavigateToTab,
  onApproveRequest,
  onRejectRequest,
  onOpenScanner
}) => {
  const [utilizationData, setUtilizationData] = useState<UtilizationStats | null>(null);
  const [utilizationTab, setUtilizationTab] = useState<'bidang' | 'kategori'>('bidang');
  const [operasionalTab, setOperasionalTab] = useState<'mingguan' | 'bulanan' | 'allTime'>('bulanan');
  const [isLoadingUtilization, setIsLoadingUtilization] = useState(false);

  // State untuk Modal & Filter Utilisasi Per-Aset
  const [selectedAssetModal, setSelectedAssetModal] = useState<Aset | null>(null);
  const [modalWindowTab, setModalWindowTab] = useState<'mingguan' | 'bulanan' | 'allTime'>('bulanan');
  const [searchOpAsset, setSearchOpAsset] = useState<string>('');
  const [sortOpOrder, setSortOpOrder] = useState<'rate_desc' | 'rate_asc' | 'nama_asc'>('rate_desc');

  // Fetch live utilization statistics
  useEffect(() => {
    let isMounted = true;
    const fetchUtilization = async () => {
      setIsLoadingUtilization(true);
      try {
        const data = await apiClient.getUtilizationStats();
        if (isMounted && data) {
          setUtilizationData(data);
        }
      } catch (err) {
        console.warn('Error loading utilization stats:', err);
      } finally {
        if (isMounted) setIsLoadingUtilization(false);
      }
    };
    fetchUtilization();
    return () => { isMounted = false; };
  }, [stats]);

  // Compute fallback overall metrics if live data not yet available
  const overallActive = utilizationData?.overall?.aktif ?? Math.max(0, stats.totalAset - stats.disposal);
  const overallDigunakan = utilizationData?.overall?.digunakan ?? stats.digunakan;
  const overallRate = utilizationData?.overall?.rate ?? (overallActive > 0 ? Number(((overallDigunakan / overallActive) * 100).toFixed(1)) : 0);

  // Helper for status badge and colors based on rate
  const getRateColor = (rate: number) => {
    if (rate >= 80) {
      return {
        text: 'text-[#008C45]',
        bg: 'bg-[#008C45]',
        bgLight: 'bg-emerald-50',
        border: 'border-emerald-200',
        badge: 'bg-emerald-100 text-[#008C45] border-emerald-300',
        label: 'Optimal (Sangat Baik)'
      };
    }
    if (rate >= 50) {
      return {
        text: 'text-amber-600',
        bg: 'bg-amber-500',
        bgLight: 'bg-amber-50',
        border: 'border-amber-200',
        badge: 'bg-amber-100 text-amber-700 border-amber-300',
        label: 'Moderat (Perlu Optimalisasi)'
      };
    }
    return {
      text: 'text-rose-600',
      bg: 'bg-rose-500',
      bgLight: 'bg-rose-50',
      border: 'border-rose-200',
      badge: 'bg-rose-100 text-rose-700 border-rose-300',
      label: 'Rendah (Aset Banyak Idle)'
    };
  };

  const currentTheme = getRateColor(overallRate);

  // Normalize distribution so that any sub-unit like "Fungsi Umum" is aggregated under "Bidang Dukungan Bisnis"
  const normalizedAsetPerBidang = useMemo(() => {
    if (!stats.asetPerBidang || stats.asetPerBidang.length === 0) return [];
    
    const map: Record<string, number> = {};
    let total = 0;

    stats.asetPerBidang.forEach(b => {
      let name = b.nama_bidang || 'Bidang Dukungan Bisnis';
      const lower = name.toLowerCase();
      if (lower.includes('fungsi umum') || lower.includes('dukungan bisnis')) {
        name = 'Bidang Dukungan Bisnis';
      }
      map[name] = (map[name] || 0) + (b.jumlah || 0);
      total += (b.jumlah || 0);
    });

    return Object.entries(map).map(([nama_bidang, jumlah]) => ({
      nama_bidang,
      jumlah,
      persen: total > 0 ? Math.round((jumlah / total) * 100) : 0
    }));
  }, [stats.asetPerBidang]);

  // Per-asset operational list and individual utilization
  const filteredOpAsets = useMemo(() => {
    const list = (asets || []).filter(a => a.kategori === 'Peralatan Operasi' || a.basis_operasi);
    const q = searchOpAsset.toLowerCase().trim();
    const filtered = list.filter(a => {
      if (!q) return true;
      return (
        (a.id_aset || '').toLowerCase().includes(q) ||
        (a.nama || '').toLowerCase().includes(q) ||
        (a.tag_number || '').toLowerCase().includes(q) ||
        (a.asset_number || '').toLowerCase().includes(q) ||
        (a.nama_bidang_sekarang || '').toLowerCase().includes(q)
      );
    });

    return filtered.sort((a, b) => {
      const rateA = a.utilization?.[operasionalTab]?.rate ?? 0;
      const rateB = b.utilization?.[operasionalTab]?.rate ?? 0;
      if (sortOpOrder === 'rate_desc') return rateB - rateA;
      if (sortOpOrder === 'rate_asc') return rateA - rateB;
      return (a.nama || '').localeCompare(b.nama || '');
    });
  }, [asets, searchOpAsset, sortOpOrder, operasionalTab]);

  return (
    <div className="space-y-6">
      
      {/* Top Banner / Welcome Info */}
      <div className="bg-[#005DAA] rounded-xl p-6 text-white shadow-md border border-blue-600 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <div className="inline-flex items-center space-x-2 bg-white/95 text-slate-900 border border-emerald-300 text-xs px-3 py-1 rounded-full font-bold shadow-xs">
                <img
                  src="https://i.ibb.co.com/xKsyxsWX/logo-sucofindo.png"
                  alt="Logo SUCOFINDO"
                  className="h-4 w-auto object-contain"
                />
                <span>PT SUCOFINDO</span>
              </div>

              {currentUser.role === 'puma' ? (
                <div className="inline-flex items-center space-x-1.5 bg-indigo-900/80 text-indigo-100 border border-indigo-400/50 text-xs px-3 py-1 rounded-full font-bold shadow-xs">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Akses Staff PUMA (Pengadaan & Manajemen Aset Nasional)</span>
                </div>
              ) : (currentUser.role === 'admin' || currentUser.role === 'management' || currentUser.role === 'pimpinan') ? (
                <div className="inline-flex items-center space-x-1.5 bg-blue-900/60 text-blue-100 border border-blue-400/30 text-xs px-3 py-1 rounded-full font-bold">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-300" />
                  <span>Akses Penuh ({currentUser.role === 'admin' ? 'Fungsi Umum' : 'Management'})</span>
                </div>
              ) : (
                <div className="inline-flex items-center space-x-1.5 bg-amber-500/20 text-amber-200 border border-amber-400/30 text-xs px-3 py-1 rounded-full font-bold">
                  <Activity className="w-3.5 h-3.5 text-amber-300" />
                  <span>Akses Terbatas PIC ({currentUser.nama_bidang || currentUser.bidang})</span>
                </div>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Sistem Monitoring Aset Real - Time (SMART SCI)
            </h1>
            <p className="text-xs sm:text-sm text-blue-100/90 mt-1 max-w-2xl leading-relaxed">
              Desentralisasi input data oleh PIC Bidang & Unit Pelayanan, dengan kontrol terpusat & visibilitas oleh Fungsi Umum (Bidang Dukungan Bisnis).
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={onOpenScanner}
              className="bg-[#008C45] hover:bg-[#007037] text-white px-4 py-2.5 rounded-lg font-bold text-xs shadow-sm flex items-center space-x-2 transition-colors active:scale-95"
            >
              <QrCode className="w-4 h-4" />
              <span>Scan QR Code Aset</span>
            </button>
          </div>
        </div>
      </div>

      {/* 1. Ringkasan Aset (Summary Cards Grid: 7 Status + Total Master) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        
        {/* Total Aset */}
        <div 
          onClick={() => onNavigateToTab('master')}
          className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <p className="text-[10px] font-bold text-[#005DAA] uppercase tracking-wider truncate">Total Master</p>
          <div className="flex items-end justify-between mt-1.5">
            <p className="text-xl font-extrabold text-slate-900">{stats.totalAset}</p>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#005DAA] flex items-center justify-center group-hover:bg-[#005DAA] group-hover:text-white transition-colors">
              <Package className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-[9px] text-slate-400 font-medium mt-1 block truncate">Semua Cabang</span>
        </div>

        {/* 1. Digunakan */}
        <div 
          onClick={() => onNavigateToTab('master')}
          className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <p className="text-[10px] font-bold text-[#008C45] uppercase tracking-wider truncate">Digunakan</p>
          <div className="flex items-end justify-between mt-1.5">
            <p className="text-xl font-extrabold text-slate-900">{stats.digunakan}</p>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#008C45] flex items-center justify-center group-hover:bg-[#008C45] group-hover:text-white transition-colors">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-[9px] text-emerald-600 font-semibold mt-1 block truncate">Sedang Dipakai</span>
        </div>

        {/* 2. Tersedia */}
        <div 
          onClick={() => onNavigateToTab('master')}
          className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider truncate">Tersedia</p>
          <div className="flex items-end justify-between mt-1.5">
            <p className="text-xl font-extrabold text-slate-900">{stats.tersedia ?? stats.idle ?? 0}</p>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Check className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-[9px] text-blue-600 font-semibold mt-1 block truncate">Siap Digunakan</span>
        </div>

        {/* 3. Dalam Pemeliharaan */}
        <div 
          onClick={() => onNavigateToTab('master')}
          className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider truncate">Pemeliharaan</p>
          <div className="flex items-end justify-between mt-1.5">
            <p className="text-xl font-extrabold text-slate-900">{stats.dalamPemeliharaan ?? stats.maintenance ?? 0}</p>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <Wrench className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-[9px] text-amber-600 font-medium mt-1 block truncate">Service / Repair</span>
        </div>

        {/* 4. Dipinjamkan */}
        <div 
          onClick={() => onNavigateToTab('master')}
          className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wider truncate">Dipinjamkan</p>
          <div className="flex items-end justify-between mt-1.5">
            <p className="text-xl font-extrabold text-slate-900">{stats.dipinjamkan ?? 0}</p>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-[9px] text-purple-600 font-medium mt-1 block truncate">Pihak Luar/Unit</span>
        </div>

        {/* 5. Proses Disposal */}
        <div 
          onClick={() => onNavigateToTab('master')}
          className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider truncate">Proses Disposal</p>
          <div className="flex items-end justify-between mt-1.5">
            <p className="text-xl font-extrabold text-slate-900">{stats.prosesDisposal ?? 0}</p>
            <div className="w-7 h-7 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center group-hover:bg-orange-600 group-hover:text-white transition-colors">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-[9px] text-orange-600 font-medium mt-1 block truncate">Pengajuan Hapus</span>
        </div>

        {/* 6. Disposal */}
        <div 
          onClick={() => onNavigateToTab('master')}
          className="bg-rose-50 p-3 rounded-xl border border-rose-200 shadow-xs cursor-pointer hover:bg-rose-100 transition-all"
        >
          <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider truncate">Disposal</p>
          <div className="flex items-end justify-between mt-1.5">
            <p className="text-xl font-extrabold text-rose-950">{stats.disposal}</p>
            <div className="w-7 h-7 rounded-lg bg-rose-200 text-rose-800 flex items-center justify-center">
              <Trash2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-[9px] text-rose-700 font-medium mt-1 block truncate">Dihapuskan</span>
        </div>

        {/* 7. Tidak Tersedia */}
        <div 
          onClick={() => onNavigateToTab('master')}
          className="bg-slate-100 p-3 rounded-xl border border-slate-300 shadow-xs cursor-pointer hover:bg-slate-200 transition-all"
        >
          <p className="text-[10px] font-bold text-slate-700 uppercase tracking-wider truncate">Tidak Tersedia</p>
          <div className="flex items-end justify-between mt-1.5">
            <p className="text-xl font-extrabold text-slate-900">{stats.tidakTersedia ?? 0}</p>
            <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center">
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-[9px] text-slate-600 font-medium mt-1 block truncate">Hilang</span>
        </div>

      </div>

      {/* 1.5. Utilization Rate Section (Tingkat Utilisasi Aset) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header Bar */}
        <div className="p-4 sm:px-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#005DAA]/10 text-[#005DAA] flex items-center justify-center font-bold">
              <Gauge className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <span>Tingkat Utilisasi Aset (Utilization Rate)</span>
                <span className="text-[10px] bg-blue-100 text-[#005DAA] px-2 py-0.5 rounded-full font-bold uppercase">
                  Real-time
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Rasio efektivitas penggunaan aset aktif (non-disposal) di seluruh bidang kerja
              </p>
            </div>
          </div>

          {/* Toggle Tab per Bidang / per Kategori */}
          <div className="inline-flex p-1 bg-slate-100 rounded-lg border border-slate-200 self-start sm:self-auto text-xs font-semibold">
            <button
              type="button"
              onClick={() => setUtilizationTab('bidang')}
              className={`px-3 py-1 rounded-md transition-all flex items-center space-x-1.5 ${
                utilizationTab === 'bidang'
                  ? 'bg-white text-[#005DAA] shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Per Bidang</span>
            </button>
            <button
              type="button"
              onClick={() => setUtilizationTab('kategori')}
              className={`px-3 py-1 rounded-md transition-all flex items-center space-x-1.5 ${
                utilizationTab === 'kategori'
                  ? 'bg-white text-[#005DAA] shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Per Kategori</span>
            </button>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          
          {/* Sisi Kiri: Overall Utilization Rate Big Metric */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center p-6 bg-slate-50/70 rounded-xl border border-slate-200/80 text-center relative overflow-hidden">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Utilization Rate
            </span>

            {/* Big Percentage Number with dynamic color */}
            <div className={`text-4xl sm:text-5xl font-black tracking-tight ${currentTheme.text} my-1`}>
              {overallRate}%
            </div>

            {/* Status Pill */}
            <div className={`mt-1 mb-2 inline-flex items-center space-x-1.5 px-3 py-0.5 rounded-full text-xs font-bold border ${currentTheme.badge}`}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{currentTheme.label}</span>
            </div>

            {/* Fraction Subtitle */}
            <p className="text-xs text-slate-600 font-medium max-w-[220px]">
              <strong className="text-slate-900 font-bold">{overallDigunakan}</strong> dari <strong className="text-slate-900 font-bold">{overallActive}</strong> aset aktif sedang digunakan
            </p>

            {/* Visual Mini Linear Bar */}
            <div className="w-full max-w-[200px] bg-slate-200 h-2 rounded-full mt-3 overflow-hidden">
              <div
                className={`h-full ${currentTheme.bg} transition-all duration-700 rounded-full`}
                style={{ width: `${Math.min(100, Math.max(overallRate, 4))}%` }}
              ></div>
            </div>

            <span className="text-[10px] text-slate-400 mt-2 block">
              *Aset berstatus Disposal dikecualikan dari kalkulasi
            </span>
          </div>

          {/* Sisi Kanan: Progress Bar Breakdown */}
          <div className="lg:col-span-8 space-y-3.5">
            {utilizationTab === 'bidang' ? (
              // Breakdown per Bidang
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-wider pb-1 border-b border-slate-100">
                  <span>Bidang / Unit Kerja</span>
                  <span>Utilisasi &amp; Aset Digunakan</span>
                </div>

                {(utilizationData?.perBidang && utilizationData.perBidang.length > 0
                  ? utilizationData.perBidang
                  : normalizedAsetPerBidang.map(b => ({
                      bidang: b.nama_bidang,
                      rate: 80,
                      digunakan: Math.round(b.jumlah * 0.8),
                      aktif: b.jumlah
                    }))
                ).map((b, idx) => {
                  const bTheme = getRateColor(b.rate);
                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-800 truncate max-w-[240px] sm:max-w-md">
                          {b.bidang}
                        </span>
                        <div className="flex items-center space-x-2 shrink-0">
                          <span className="text-[11px] text-slate-500 font-medium">
                            {b.digunakan}/{b.aktif} Aset
                          </span>
                          <span className={`font-bold px-2 py-0.5 rounded text-xs ${bTheme.bgLight} ${bTheme.text} border ${bTheme.border}`}>
                            {b.rate}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${bTheme.bg}`}
                          style={{ width: `${Math.min(100, Math.max(b.rate, 3))}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              // Breakdown per Kategori
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-wider pb-1 border-b border-slate-100">
                  <span>Kategori Aset</span>
                  <span>Utilisasi &amp; Status</span>
                </div>

                {(utilizationData?.perKategori && utilizationData.perKategori.length > 0
                  ? utilizationData.perKategori
                  : stats.asetPerKategori.map(k => ({
                      kategori: k.kategori,
                      rate: 85,
                      static: k.kategori.toLowerCase().includes('tanah') || k.kategori.toLowerCase().includes('bangunan'),
                      digunakan: Math.round(k.jumlah * 0.85),
                      aktif: k.jumlah
                    }))
                ).map((k, idx) => {
                  const kTheme = getRateColor(k.rate);
                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center space-x-1.5 truncate max-w-[240px] sm:max-w-md">
                          <span className="font-semibold text-slate-800 truncate">
                            {k.kategori}
                          </span>
                          {k.static && (
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium border border-slate-200 shrink-0">
                              Statis
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 shrink-0">
                          {k.digunakan !== undefined && k.aktif !== undefined && (
                            <span className="text-[11px] text-slate-500 font-medium">
                              {k.digunakan}/{k.aktif} Aset
                            </span>
                          )}
                          <span className={`font-bold px-2 py-0.5 rounded text-xs ${kTheme.bgLight} ${kTheme.text} border ${kTheme.border}`}>
                            {k.rate}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${kTheme.bg}`}
                          style={{ width: `${Math.min(100, Math.max(k.rate, 3))}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* 1.6. Khusus: Utilisasi Aset Operasional (Peralatan Operasi Berbasis Working Day & Continuous) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header Bar */}
        <div className="p-4 sm:px-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-blue-50/70 via-slate-50 to-emerald-50/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#005DAA] text-white flex items-center justify-center font-bold shadow-xs">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <span>Utilisasi Khusus Aset Operasional (Peralatan Operasi)</span>
                <span className="text-[10px] bg-emerald-100 text-[#008C45] px-2 py-0.5 rounded-full font-bold uppercase">
                  Cut-Off H-1
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Formula: (Actual Operating Time / Available Time) × 100% • Disesuaikan dengan jadwal perbaikan/maintenance
              </p>
            </div>
          </div>

          {/* Time Window Tabs */}
          <div className="inline-flex p-1 bg-white rounded-lg border border-slate-200 self-start sm:self-auto text-xs font-semibold shadow-2xs">
            <button
              type="button"
              onClick={() => setOperasionalTab('mingguan')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                operasionalTab === 'mingguan'
                  ? 'bg-[#005DAA] text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📅 Mingguan (7 Hari)
            </button>
            <button
              type="button"
              onClick={() => setOperasionalTab('bulanan')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                operasionalTab === 'bulanan'
                  ? 'bg-[#005DAA] text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🗓️ Bulanan (30 Hari)
            </button>
            <button
              type="button"
              onClick={() => setOperasionalTab('allTime')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                operasionalTab === 'allTime'
                  ? 'bg-[#005DAA] text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ⏳ Sejak Dioperasikan
            </button>
          </div>
        </div>

        {/* Body Content */}
        {(() => {
          const opData = utilizationData?.operasional;
          const currentStats = opData?.[operasionalTab] || {
            rate: 0,
            actualHours: 0,
            availableHours: 0,
            maintenanceHours: 0
          };
          const opTheme = getRateColor(currentStats.rate);

          return (
            <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              
              {/* Sisi Kiri: Big Rate & Status */}
              <div className="lg:col-span-4 flex flex-col items-center justify-center p-6 bg-slate-50/70 rounded-xl border border-slate-200/80 text-center">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Rate Utilisasi Operasional ({operasionalTab === 'mingguan' ? 'Mingguan' : operasionalTab === 'bulanan' ? 'Bulanan' : 'All-Time'})
                </span>

                <div className={`text-4xl sm:text-5xl font-black tracking-tight ${opTheme.text} my-1`}>
                  {currentStats.rate}%
                </div>

                <div className={`mt-1 mb-2 inline-flex items-center space-x-1.5 px-3 py-0.5 rounded-full text-xs font-bold border ${opTheme.badge}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{opTheme.label}</span>
                </div>

                <p className="text-xs text-slate-600 font-medium max-w-[220px]">
                  Total <strong className="text-slate-900">{opData?.totalAsetOperasi || 0} unit</strong> peralatan operasi aktif terpantau
                </p>

                <div className="w-full max-w-[200px] bg-slate-200 h-2 rounded-full mt-3 overflow-hidden">
                  <div
                    className={`h-full ${opTheme.bg} transition-all duration-700 rounded-full`}
                    style={{ width: `${Math.min(100, Math.max(currentStats.rate, 3))}%` }}
                  ></div>
                </div>

                <span className="text-[10px] text-slate-400 mt-2 block">
                  *Acuan data H-1 untuk kestabilan & performa cepat
                </span>
              </div>

              {/* Sisi Kanan: Tiga Kotak Metrik Jam & Formula Info */}
              <div className="lg:col-span-8 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  
                  {/* 1. Jam Operasi Aktual */}
                  <div className="bg-emerald-50/60 border border-emerald-200 p-4 rounded-xl">
                    <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                      Actual Operating Time
                    </span>
                    <div className="text-2xl font-extrabold text-emerald-950 mt-1">
                      {currentStats.actualHours} <span className="text-sm font-semibold text-emerald-800">jam</span>
                    </div>
                    <span className="text-[10px] text-emerald-700 mt-1 block">
                      Waktu durasi riil saat status Digunakan
                    </span>
                  </div>

                  {/* 2. Jam Maintenance Downtime */}
                  <div className="bg-amber-50/60 border border-amber-200 p-4 rounded-xl">
                    <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
                      Downtime Maintenance
                    </span>
                    <div className="text-2xl font-extrabold text-amber-950 mt-1">
                      {currentStats.maintenanceHours} <span className="text-sm font-semibold text-amber-800">jam</span>
                    </div>
                    <span className="text-[10px] text-amber-700 mt-1 block">
                      Pengurang Available Time saat perbaikan
                    </span>
                  </div>

                  {/* 3. Available Time Netto */}
                  <div className="bg-blue-50/60 border border-blue-200 p-4 rounded-xl">
                    <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider block">
                      Available Time (Netto)
                    </span>
                    <div className="text-2xl font-extrabold text-blue-950 mt-1">
                      {currentStats.availableHours} <span className="text-sm font-semibold text-blue-800">jam</span>
                    </div>
                    <span className="text-[10px] text-blue-700 mt-1 block">
                      Basis kerja (8h/5d atau 24h/7d) - downtime
                    </span>
                  </div>

                </div>

                {/* Penjelasan Metode & Formula */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
                  <div className="flex items-center justify-between font-bold text-slate-800">
                    <span className="flex items-center space-x-1.5">
                      <Gauge className="w-3.5 h-3.5 text-[#005DAA]" />
                      <span>Standar Formula Utilisasi Aset SMART SCI</span>
                    </span>
                    <span className="font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-slate-200 text-[#005DAA]">
                      Rate = (Actual / Available) × 100%
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Setiap scan pemakaian alat oleh personel lapangan mencatat jam aktual. Jika alat masuk ke masa perbaikan (<em>'Dalam Pemeliharaan'</em>), jam tersebut otomatis memotong kapasitas ketersediaan (Available Time) sehingga angka utilisasi tetap adil dan akurat.
                  </p>
                </div>
              </div>

              {/* Tabel Utilisasi Per-Aset (Setiap Peralatan Operasi Dihitung Terpisah) */}
              <div className="lg:col-span-12 border-t border-slate-200 pt-5 mt-2">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                      <span>📋 Tabel Utilisasi Per-Aset (Dihitung Terpisah Per Unit)</span>
                      <span className="text-[11px] font-bold bg-blue-100 text-[#005DAA] px-2 py-0.5 rounded-full">
                        {filteredOpAsets.length} Unit Terpantau
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Setiap unit peralatan operasi dihitung secara mandiri dengan rumus: (Jam Aktual / Jam Netto Tersedia) × 100%.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Search Per-Aset */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Cari ID, Tag, Nama unit..."
                        value={searchOpAsset}
                        onChange={(e) => setSearchOpAsset(e.target.value)}
                        className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-48 sm:w-56 focus:outline-hidden focus:ring-1 focus:ring-[#005DAA]"
                      />
                    </div>

                    {/* Sort Order */}
                    <select
                      value={sortOpOrder}
                      onChange={(e) => setSortOpOrder(e.target.value as any)}
                      className="py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-semibold focus:outline-hidden focus:ring-1 focus:ring-[#005DAA] cursor-pointer"
                    >
                      <option value="rate_desc">⚡ Rate Tertinggi</option>
                      <option value="rate_asc">⏳ Rate Terendah</option>
                      <option value="nama_asc">🔤 Nama Aset (A-Z)</option>
                    </select>
                  </div>
                </div>

                {/* Table list */}
                {filteredOpAsets.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
                    Tidak ada peralatan operasi yang sesuai dengan kata kunci pencarian.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider sticky top-0 z-10 text-[10px] border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">Aset &amp; Identitas</th>
                            <th className="py-2.5 px-3">Penempatan</th>
                            <th className="py-2.5 px-3">Basis Operasi</th>
                            <th className="py-2.5 px-3 text-right">Actual (Jam)</th>
                            <th className="py-2.5 px-3 text-right">Downtime (Jam)</th>
                            <th className="py-2.5 px-3 text-right">Available Netto</th>
                            <th className="py-2.5 px-3 min-w-[150px]">Rate Utilisasi ({operasionalTab === 'mingguan' ? '7 Hari' : operasionalTab === 'bulanan' ? '30 Hari' : 'All-Time'})</th>
                            <th className="py-2.5 px-3 text-center">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {filteredOpAsets.map((item) => {
                            const uStats = item.utilization?.[operasionalTab] || {
                              rate: 0,
                              actualHours: 0,
                              availableHours: 0,
                              maintenanceHours: 0
                            };
                            const itemTheme = getRateColor(uStats.rate);

                            return (
                              <tr key={item.id_aset} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-2.5 px-3">
                                  <div className="font-bold text-slate-900">{item.nama}</div>
                                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 mt-0.5">
                                    <span className="font-bold text-[#005DAA]">{item.id_aset}</span>
                                    {item.tag_number && (
                                      <>
                                        <span>•</span>
                                        <span>Tag: {item.tag_number}</span>
                                      </>
                                    )}
                                    {item.asset_number && (
                                      <>
                                        <span>•</span>
                                        <span>No: {item.asset_number}</span>
                                      </>
                                    )}
                                  </div>
                                </td>

                                <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                                  <div className="font-semibold text-slate-800">{item.nama_cabang || '-'}</div>
                                  <div className="text-[10px] text-slate-500">{item.nama_bidang_sekarang || '-'}</div>
                                </td>

                                <td className="py-2.5 px-3">
                                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                                    item.basis_operasi === 'Continuous Operation'
                                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                                      : 'bg-blue-50 text-blue-700 border-blue-200'
                                  }`}>
                                    {item.basis_operasi === 'Continuous Operation' ? 'Continuous (24h/7d)' : 'Working Day (8h/5d)'}
                                  </span>
                                </td>

                                <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                                  {uStats.actualHours} j
                                </td>

                                <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-700">
                                  {uStats.maintenanceHours} j
                                </td>

                                <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-900">
                                  {uStats.availableHours} j
                                </td>

                                <td className="py-2.5 px-3 min-w-[150px]">
                                  <div className="flex items-center justify-between text-xs font-bold mb-1">
                                    <span className={`font-mono ${itemTheme.text}`}>
                                      {uStats.rate}%
                                    </span>
                                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold border ${itemTheme.badge}`}>
                                      {itemTheme.label.split(' ')[0]}
                                    </span>
                                  </div>
                                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full ${itemTheme.bg} rounded-full`}
                                      style={{ width: `${Math.min(100, Math.max(uStats.rate, 2))}%` }}
                                    />
                                  </div>
                                </td>

                                <td className="py-2.5 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedAssetModal(item);
                                      setModalWindowTab(operasionalTab);
                                    }}
                                    className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-100 hover:bg-[#005DAA] text-slate-700 hover:text-white rounded-md text-[10px] font-bold transition-all cursor-pointer shadow-2xs"
                                  >
                                    <Activity className="w-3 h-3" />
                                    <span>Detail</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

            </div>
          );
        })()}
      </div>

      {/* Overdue Asset Warning Banner */}
      {stats.terlambatPengembalian !== undefined && stats.terlambatPengembalian > 0 && (
        <div 
          onClick={() => onNavigateToTab('master')}
          className="bg-red-600 text-white p-4 rounded-xl shadow-md border border-red-700 flex items-center justify-between cursor-pointer hover:bg-red-700 transition-all"
        >
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-white/20 rounded-xl shrink-0">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm sm:text-base">
                ⚠️ {stats.terlambatPengembalian} Aset Lapangan Terlambat Dikembalikan (&gt;1 Hari)
              </h4>
              <p className="text-xs text-red-100 mt-0.5">
                Peralatan masih berstatus 'Digunakan' melewati batas rencana pengembalian tanpa perubahan status atau pengajuan perpanjangan. Notifikasi email otomatis telah dikirim ke PIC &amp; Fungsi Umum.
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center space-x-1 font-bold text-xs bg-white text-red-700 px-3.5 py-2 rounded-lg shadow-xs shrink-0 hover:bg-red-50">
            <span>Filter Aset Terlambat</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      )}

      {/* Main Grid: Distribution + Calibration Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* 2. Peta / Distribusi Aset per Bidang */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-slate-700 uppercase text-xs tracking-widest flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#005DAA]" />
              <span>Distribusi Aset per Bidang & Unit Pelayanan</span>
            </h3>
            <span className="text-[10px] bg-emerald-100 text-[#008C45] px-2.5 py-0.5 rounded-full font-bold uppercase">Real-time</span>
          </div>

          <div className="p-5 space-y-4">
            {normalizedAsetPerBidang.map((b, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="font-semibold text-slate-800 truncate max-w-[280px] sm:max-w-md">{b.nama_bidang}</span>
                  <span className="font-bold text-[#005DAA]">{b.jumlah} Unit ({b.persen}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
                  <div 
                    className="bg-[#008C45] h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(b.persen, 5)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Satu sumber data akurat untuk seluruh unit bisnis.</span>
            <button 
              onClick={() => onNavigateToTab('master')} 
              className="text-[#005DAA] font-bold hover:underline flex items-center space-x-1"
            >
              <span>Lihat Detail Master Aset</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 3. Peringatan Kalibrasi (H-30 / Overdue) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-slate-700 uppercase text-xs tracking-widest flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>Peringatan Kalibrasi (H-30)</span>
            </h3>
            <span className="bg-rose-100 text-rose-700 text-xs px-2.5 py-0.5 rounded-full font-bold">
              {stats.kalibrasiAlerts.length} Aset
            </span>
          </div>

          <div className="p-5 space-y-3 max-h-[280px] overflow-y-auto divide-y divide-slate-100">
            {stats.kalibrasiAlerts.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                <CheckCircle2 className="w-8 h-8 text-[#008C45] mx-auto mb-1.5" />
                Semua aset dalam jadwal kalibrasi aman.
              </div>
            ) : (
              stats.kalibrasiAlerts.map((a) => {
                const today = new Date();
                const dueDate = a.tgl_kalibrasi_berikutnya ? new Date(a.tgl_kalibrasi_berikutnya) : null;
                const isOverdue = dueDate && dueDate < today;

                return (
                  <div key={a.id_aset} className="pt-2.5 text-xs flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 truncate max-w-[200px]">{a.nama}</div>
                      <div className="text-[10px] text-slate-500">{a.nama_bidang_sekarang}</div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                        isOverdue 
                          ? 'bg-rose-100 text-rose-800 border border-rose-200 animate-pulse' 
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {isOverdue ? 'Jatuh Tempo!' : `Jatuh Tempo: ${a.tgl_kalibrasi_berikutnya}`}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
            <button 
              onClick={() => onNavigateToTab('kalibrasi')}
              className="text-xs text-[#005DAA] font-bold hover:underline flex items-center space-x-1"
            >
              <span>Buka Modul Kalibrasi</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* Bottom Grid: Pengajuan Menunggu Persetujuan & Real-Time Audit Log Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* 4. Pengajuan Menunggu Persetujuan (Approval Workflow) */}
        <div className={`${currentUser.role === 'admin' ? 'lg:col-span-6' : 'lg:col-span-12'} bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden`}>
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-slate-700 uppercase text-xs tracking-widest flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-[#005DAA]" />
              <span>Pengajuan Menunggu Persetujuan</span>
            </h3>
            <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
              {pendingRequests.length} Pending
            </span>
          </div>

          <div className="p-5 space-y-3 max-h-[300px] overflow-y-auto">
            {pendingRequests.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                Tidak ada pengajuan transfer atau disposal yang memerlukan persetujuan saat ini.
              </div>
            ) : (
              pendingRequests.map((p, idx) => (
                <div key={`${p.id_pengajuan}-${idx}`} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#005DAA] text-sm">{p.nama_aset}</span>
                    <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                      p.jenis === 'Transfer' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {p.jenis}
                    </span>
                  </div>

                  <div className="text-slate-600 space-y-1">
                    <p><span className="font-medium text-slate-500">Pemohon:</span> {p.pemohon_nama} ({p.nama_bidang_asal})</p>
                    {p.pemegang_baru && (
                      <p><span className="font-medium text-emerald-700 font-semibold">Calon Pemegang Terakhir:</span> <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">{p.pemegang_baru}</span></p>
                    )}
                    {p.tgl_rencana_pengembalian && (
                      <p><span className="font-medium text-amber-800 font-semibold">📅 Target Selesai Pakai:</span> <span className="bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-bold">{p.tgl_rencana_pengembalian}</span></p>
                    )}
                    {p.jenis === 'Transfer' && (
                      <p><span className="font-medium text-slate-500">Tujuan:</span> {p.nama_bidang_tujuan}</p>
                    )}
                    <p><span className="font-medium text-slate-500">Alasan:</span> {p.alasan}</p>
                  </div>

                  {(() => {
                    const check = canUserApprovePengajuan(p, currentUser);
                    if (check.allowed) {
                      return (
                        <div className="flex items-center space-x-2 pt-2 border-t border-slate-200">
                          <button
                            onClick={() => onApproveRequest(p.id_pengajuan, 'Disetujui via Dashboard')}
                            className="bg-[#008C45] hover:bg-[#007037] text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1 shadow-xs transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Setujui</span>
                          </button>
                          <button
                            onClick={() => onRejectRequest(p.id_pengajuan, 'Ditolak via Dashboard')}
                            className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1 shadow-xs transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Tolak</span>
                          </button>
                        </div>
                      );
                    }
                    return (
                      <div className="bg-amber-50/80 border border-amber-200/60 rounded-lg p-2 text-[11px] text-amber-900 font-medium flex items-start space-x-1.5 mt-2">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <span>{check.reason}</span>
                      </div>
                    );
                  })()}
                </div>
              ))
            )}
          </div>
        </div>

        {/* 5. Riwayat Aktivitas Terbaru (Audit Trail) - KHUSUS FUNGSI UMUM */}
        {currentUser.role === 'admin' && (
          <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-700 uppercase text-xs tracking-widest flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#008C45]" />
                <span>Aktivitas Terbaru (Audit Trail)</span>
              </h3>
              <button
                onClick={() => onNavigateToTab('audit')}
                className="text-xs text-[#005DAA] font-bold hover:underline"
              >
                Lihat Semua
              </button>
            </div>

            <div className="p-5 space-y-3 max-h-[300px] overflow-y-auto divide-y divide-slate-100">
              {auditLogs.slice(0, 6).map((log) => (
                <div key={log.id_log} className="pt-2.5 text-xs flex items-start space-x-3">
                  <div className="w-2 h-2 rounded-full bg-[#008C45] mt-1.5 shrink-0"></div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{log.aktor}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(log.waktu).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-slate-600 text-[11px] mt-0.5">{log.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* MODAL: Detail Utilisasi Per-Aset (Popup Rincian Kalkulasi) */}
      {selectedAssetModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 overflow-y-auto p-3 sm:p-4 md:p-6 flex items-start sm:items-center justify-center">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-gray-100 my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95">
            
            {/* Header Modal */}
            <div className="shrink-0 flex items-center justify-between pb-3.5 border-b border-gray-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#005DAA] flex items-center justify-center font-bold">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base leading-tight">
                    Rincian Utilisasi Per-Aset: {selectedAssetModal.nama}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 font-mono">
                    <span className="font-bold text-[#005DAA]">{selectedAssetModal.id_aset}</span>
                    {selectedAssetModal.tag_number && (
                      <>
                        <span>•</span>
                        <span>Tag: {selectedAssetModal.tag_number}</span>
                      </>
                    )}
                    {selectedAssetModal.asset_number && (
                      <>
                        <span>•</span>
                        <span>No: {selectedAssetModal.asset_number}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedAssetModal(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 min-h-0 py-4 space-y-4 text-xs">
              
              {/* Asset Identity Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold block">Basis Jam Kerja:</span>
                  <span className="font-bold text-slate-900">
                    {selectedAssetModal.basis_operasi || 'Working Day Based'}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    {selectedAssetModal.basis_operasi === 'Continuous Operation' ? '24 Jam / 7 Hari' : '8 Jam / 5 Hari'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold block">Status Fisik:</span>
                  <span className="font-bold text-slate-900">{selectedAssetModal.status}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold block">Cabang / Lokasi:</span>
                  <span className="font-bold text-slate-900">{selectedAssetModal.nama_cabang || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold block">Bidang / Unit:</span>
                  <span className="font-bold text-slate-900">{selectedAssetModal.nama_bidang_sekarang || '-'}</span>
                </div>
              </div>

              {/* Time Window Selector Tabs */}
              <div className="flex items-center space-x-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalWindowTab('mingguan')}
                  className={`flex-1 py-1.5 px-3 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                    modalWindowTab === 'mingguan'
                      ? 'bg-white text-[#005DAA] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📅 7 Hari Terakhir
                </button>
                <button
                  type="button"
                  onClick={() => setModalWindowTab('bulanan')}
                  className={`flex-1 py-1.5 px-3 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                    modalWindowTab === 'bulanan'
                      ? 'bg-white text-[#005DAA] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🗓️ 30 Hari Terakhir
                </button>
                <button
                  type="button"
                  onClick={() => setModalWindowTab('allTime')}
                  className={`flex-1 py-1.5 px-3 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                    modalWindowTab === 'allTime'
                      ? 'bg-white text-[#005DAA] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ⏳ Sejak Dioperasikan
                </button>
              </div>

              {/* Active Window Utilization Stats */}
              {(() => {
                const modalStats = selectedAssetModal.utilization?.[modalWindowTab] || {
                  rate: 0,
                  actualHours: 0,
                  availableHours: 0,
                  maintenanceHours: 0,
                  sessions: []
                };
                const mTheme = getRateColor(modalStats.rate);

                return (
                  <div className="space-y-4">
                    {/* Big Summary Rate */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                          Tingkat Utilisasi Unit ({modalWindowTab === 'mingguan' ? '7 Hari' : modalWindowTab === 'bulanan' ? '30 Hari' : 'All-Time'})
                        </span>
                        <div className="flex items-baseline space-x-2 mt-1">
                          <span className={`text-3xl font-black ${mTheme.text}`}>
                            {modalStats.rate}%
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${mTheme.badge}`}>
                            {mTheme.label}
                          </span>
                        </div>
                        <div className="w-56 bg-slate-200 h-2 rounded-full mt-2 overflow-hidden">
                          <div
                            className={`h-full ${mTheme.bg} rounded-full`}
                            style={{ width: `${Math.min(100, Math.max(modalStats.rate, 2))}%` }}
                          />
                        </div>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-slate-200 font-mono text-[11px] space-y-1 sm:text-right">
                        <div>Actual Time: <strong className="text-emerald-700">{modalStats.actualHours} jam</strong></div>
                        <div>Maintenance Downtime: <strong className="text-amber-700">-{modalStats.maintenanceHours} jam</strong></div>
                        <div>Available Time Netto: <strong className="text-blue-900">{modalStats.availableHours} jam</strong></div>
                      </div>
                    </div>

                    {/* Breakdown Formula */}
                    <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between font-bold text-blue-900 text-xs">
                        <span>Rumus &amp; Perhitungan Mandiri Aset Ini:</span>
                        <span className="font-mono bg-white px-2 py-0.5 rounded border border-blue-200 text-[#005DAA]">
                          ({modalStats.actualHours} / {modalStats.availableHours}) × 100% = {modalStats.rate}%
                        </span>
                      </div>
                      <p className="text-[11px] text-blue-800 leading-relaxed">
                        • Jam aktual dihitung dari total waktu durasi saat aset ditransisikan berstatus <em>'Digunakan'</em> via scan QR sampai kembali <em>'Tersedia'</em>.<br/>
                        • Jika aset masuk status <em>'Dalam Pemeliharaan'</em>, jam downtime ({modalStats.maintenanceHours} jam) mengurangi basis jam kerja sehingga rasio utilisasi adil dan proporsional.
                      </p>
                    </div>

                    {/* Log Sesi Pemakaian */}
                    <div className="space-y-2">
                      <h4 className="font-bold text-slate-800 text-xs flex items-center justify-between">
                        <span>Riwayat Sesi Pemakaian Pada Periode Ini</span>
                        <span className="text-[10px] text-slate-500 font-normal">
                          {modalStats.sessions?.length || 0} Sesi Tercatat
                        </span>
                      </h4>

                      {modalStats.sessions && modalStats.sessions.length > 0 ? (
                        <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2 bg-slate-50">
                          {modalStats.sessions.map((sess, idx) => (
                            <div key={idx} className="bg-white p-2.5 rounded-lg border border-slate-100 flex items-center justify-between text-[11px]">
                              <div>
                                <span className="font-bold text-slate-900 block">{sess.pic || 'Personel Lapangan'}</span>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {new Date(sess.mulai).toLocaleDateString('id-ID')} • {new Date(sess.mulai).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} s/d {sess.selesai ? new Date(sess.selesai).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Selesai'}
                                </span>
                              </div>
                              <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                                +{sess.durasiJam} jam
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-400 text-[11px]">
                          Belum ada catatan durasi pemakaian pada jendela waktu ini.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

            </div>

            {/* Footer */}
            <div className="shrink-0 pt-3 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedAssetModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
