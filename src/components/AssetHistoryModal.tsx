import React, { useState, useEffect, useMemo } from 'react';
import { 
  Aset, 
  AuditLog, 
  Assignment, 
  RiwayatKalibrasi, 
  Pengajuan, 
  User 
} from '../types';
import { 
  History, 
  X, 
  ShieldCheck, 
  Clock, 
  User as UserIcon, 
  ArrowRightLeft, 
  Calendar, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Tag, 
  Search, 
  Package, 
  Sparkles,
  Lock,
  RefreshCw
} from 'lucide-react';
import { apiClient } from '../lib/apiClient';

interface AssetHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  aset: Aset | null;
  auditLogs?: AuditLog[];
  assignments?: Assignment[];
  kalibrasiList?: RiwayatKalibrasi[];
  pengajuanList?: Pengajuan[];
  currentUser: User;
}

interface TimelineEvent {
  id: string;
  timestamp: string;
  formattedDate: string;
  type: 'audit' | 'assignment' | 'kalibrasi' | 'pengajuan' | 'creation';
  title: string;
  detail: string;
  actor: string;
  roleActor?: string;
  badgeColor: string;
  icon: React.ReactNode;
}

export const AssetHistoryModal: React.FC<AssetHistoryModalProps> = ({
  isOpen,
  onClose,
  aset,
  auditLogs = [],
  assignments = [],
  kalibrasiList = [],
  pengajuanList = [],
  currentUser
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [fetchedDetail, setFetchedDetail] = useState<{
    assignments: Assignment[];
    kalibrasi: RiwayatKalibrasi[];
    pengajuan: Pengajuan[];
  } | null>(null);
  const [isFetchingDetail, setIsFetchingDetail] = useState(false);

  useEffect(() => {
    if (isOpen && aset && currentUser.role === 'admin') {
      setIsFetchingDetail(true);
      apiClient.getAsetDetail(aset.id_aset)
        .then((res: any) => {
          if (res) {
            setFetchedDetail({
              assignments: res.assignments || [],
              kalibrasi: res.kalibrasi || [],
              pengajuan: res.pengajuan || []
            });
          }
        })
        .catch(err => {
          console.warn('Failed to fetch detailed asset history:', err);
        })
        .finally(() => {
          setIsFetchingDetail(false);
        });
    }
  }, [isOpen, aset?.id_aset, currentUser.role]);

  const isFungsiUmum = currentUser.role === 'admin';

  // Effective history lists
  const activeAssignments = fetchedDetail?.assignments?.length ? fetchedDetail.assignments : assignments;
  const activeKalibrasi = fetchedDetail?.kalibrasi?.length ? fetchedDetail.kalibrasi : kalibrasiList;
  const activePengajuan = fetchedDetail?.pengajuan?.length ? fetchedDetail.pengajuan : pengajuanList;

  // Build Chronological Timeline Events
  const timelineEvents = useMemo(() => {
    if (!aset) return [];

    const events: TimelineEvent[] = [];

    // 1. Audit Logs for this asset
    const matchingAuditLogs = auditLogs.filter(
      l => (l.id_aset && l.id_aset === aset.id_aset) || 
           (l.nama_aset && l.nama_aset === aset.nama) ||
           (l.detail && l.detail.toLowerCase().includes(aset.id_aset.toLowerCase()))
    );

    matchingAuditLogs.forEach(l => {
      events.push({
        id: `audit-${l.id_log}`,
        timestamp: l.waktu,
        formattedDate: new Date(l.waktu).toLocaleString('id-ID', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        }),
        type: 'audit',
        title: l.jenis_perubahan,
        detail: l.detail,
        actor: l.aktor,
        roleActor: l.role_aktor,
        badgeColor: l.jenis_perubahan.includes('Approve') ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                    l.jenis_perubahan.includes('Reject') ? 'bg-rose-100 text-rose-800 border-rose-200' :
                    l.jenis_perubahan.includes('Create') ? 'bg-blue-100 text-blue-800 border-blue-200' :
                    'bg-slate-100 text-slate-800 border-slate-200',
        icon: <Clock className="w-4 h-4 text-slate-600" />
      });
    });

    // 2. Assignment / Serah Terima History
    const matchingAssignments = activeAssignments.filter(a => a.id_aset === aset.id_aset);
    matchingAssignments.forEach(a => {
      const dateStr = a.tanggal_serah || a.id_assignment;
      events.push({
        id: `asg-${a.id_assignment}`,
        timestamp: dateStr,
        formattedDate: new Date(dateStr).toLocaleString('id-ID', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        }),
        type: 'assignment',
        title: 'Serah Terima / Assignment Aset',
        detail: `Diserahkan ke Bidang ${a.nama_bidang} (PIC: ${a.nama_pic}, Pemegang Lapangan: ${a.pemegang_lapangan || a.nama_pic}). Keterangan: ${a.keterangan || 'Penetapan Unit/Bidang Baru'}`,
        actor: a.diserah_oleh || 'Fungsi UMUM',
        roleActor: 'admin',
        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        icon: <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
      });
    });

    // 3. Kalibrasi History
    const matchingKalibrasi = activeKalibrasi.filter(k => k.id_aset === aset.id_aset);
    matchingKalibrasi.forEach(k => {
      events.push({
        id: `kal-${k.id_kalibrasi}`,
        timestamp: k.tanggal,
        formattedDate: new Date(k.tanggal).toLocaleDateString('id-ID', {
          day: '2-digit', month: 'short', year: 'numeric'
        }),
        type: 'kalibrasi',
        title: 'Pelaksanaan Kalibrasi Aset',
        detail: `Kalibrasi oleh ${k.lembaga_kalibrasi}. No. Sertifikat: ${k.nomor_sertifikat}. Jatuh tempo berikutnya: ${k.jatuh_tempo_berikutnya}. Kondisi setelah: ${k.kondisi_setelah}. ${k.catatan ? `Catatan: ${k.catatan}` : ''}`,
        actor: k.pic_input || 'Laboratorium / Custodian',
        badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
        icon: <Calendar className="w-4 h-4 text-purple-600" />
      });
    });

    // 4. Pengajuan History (Transfer / Disposal)
    const matchingPengajuan = activePengajuan.filter(p => p.id_aset === aset.id_aset);
    matchingPengajuan.forEach(p => {
      events.push({
        id: `peng-${p.id_pengajuan}`,
        timestamp: p.created_at,
        formattedDate: new Date(p.created_at).toLocaleString('id-ID', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        }),
        type: 'pengajuan',
        title: `Pengajuan ${p.jenis}`,
        detail: `Pengajuan dari Bidang ${p.nama_bidang_asal}${p.nama_bidang_tujuan ? ` ke ${p.nama_bidang_tujuan}` : ''}${p.pemegang_baru ? `. Pemegang: ${p.pemegang_baru}` : ''}${p.tgl_rencana_pengembalian ? `. Tgl Selesai Digunakan: ${p.tgl_rencana_pengembalian}` : ''}. Alasan: "${p.alasan}". Status Approval: ${p.status_approval}${p.approver_nama ? ` (Ditinjau oleh ${p.approver_nama})` : ''}`,
        actor: p.pemohon_nama,
        badgeColor: p.status_approval === 'Approved' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                    p.status_approval === 'Rejected' ? 'bg-rose-100 text-rose-800 border-rose-200' :
                    'bg-amber-100 text-amber-800 border-amber-200',
        icon: <FileText className="w-4 h-4 text-amber-600" />
      });
    });

    // 5. Initial Creation Event
    const creationTime = aset.created_at || `${aset.tahun_perolehan}-01-01T00:00:00.000Z`;
    events.push({
      id: `create-${aset.id_aset}`,
      timestamp: creationTime,
      formattedDate: new Date(creationTime).toLocaleDateString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric'
      }),
      type: 'creation',
      title: 'Pendaftaran & Registrasi Aset Baru',
      detail: `Aset terdaftar di sistem dengan Kategori: ${aset.kategori}, Merk/Model: ${aset.merk_model || '-'}, SN: ${aset.nomor_seri || '-'}. Tahun Perolehan: ${aset.tahun_perolehan}. Bidang Awal: ${aset.lokasi_awal || aset.nama_bidang_sekarang}.`,
      actor: 'System / Fungsi UMUM',
      roleActor: 'admin',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
      icon: <Package className="w-4 h-4 text-blue-600" />
    });

    // Sort Descending by Timestamp
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return events;
  }, [aset, auditLogs, activeAssignments, activeKalibrasi, activePengajuan]);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return timelineEvents.filter(ev => {
      const matchesType = filterType === 'all' || ev.type === filterType;
      const matchesSearch = !searchQuery || 
        (ev.title || '').toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (ev.detail || '').toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (ev.actor || '').toLowerCase().includes(searchQuery.toLowerCase().trim());
      return matchesType && matchesSearch;
    });
  }, [timelineEvents, filterType, searchQuery]);

  if (!isOpen || !aset) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 overflow-y-auto p-3 sm:p-4 md:p-6 flex items-start sm:items-center justify-center">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 my-auto max-h-[90vh] flex flex-col text-slate-800 animate-in fade-in zoom-in-95">
        
        {/* Modal Header */}
        <div className="shrink-0 flex items-start justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-50 text-[#005DAA] rounded-xl border border-blue-100">
              <History className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold bg-[#005DAA] text-white px-2 py-0.5 rounded-md uppercase tracking-wider">
                  History Track Aset
                </span>
                <span className="text-xs font-mono font-bold text-slate-500">
                  ID: {aset.id_aset}
                </span>
                {isFungsiUmum && (
                  <span className="inline-flex items-center space-x-1 text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    <span>Fungsi UMUM Only</span>
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                {aset.nama}
              </h2>
              <p className="text-xs text-slate-500">
                Lacak seluruh riwayat perubahan status, lokasi, assignment, kalibrasi, dan aktivitas audit trail dari waktu ke waktu.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Access Restricted View for Non-Fungsi UMUM */}
        {!isFungsiUmum ? (
          <div className="py-12 px-6 text-center space-y-4 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <Lock className="w-7 h-7" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="font-bold text-slate-900 text-base">
                Akses Terbatas: Khusus Fungsi UMUM
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Fitur <strong>Tracking History Perubahan Aset</strong> secara komprehensif dari waktu ke waktu hanya dapat diakses oleh akun <strong>Fungsi UMUM (Admin Custodian Aset)</strong>.
              </p>
            </div>
            <button
              onClick={onClose}
              className="bg-[#005DAA] hover:bg-blue-800 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-xs transition-colors"
            >
              Tutup Modal
            </button>
          </div>
        ) : (
          /* Full History Tracking View for Fungsi UMUM */
          <div className="flex-1 min-h-0 flex flex-col space-y-4 overflow-hidden pt-3">
            
            {/* Scrollable Body */}
            <div className="overflow-y-auto flex-1 min-h-0 space-y-4 pr-1">
              {/* Asset Summary Badge */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 text-xs">
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold">Kategori & Seri</div>
                <div className="font-bold text-slate-800 mt-0.5 truncate">{aset.kategori}</div>
                <div className="text-[10px] text-slate-500">SN: {aset.nomor_seri || '-'}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold">Status & Kondisi</div>
                <div className="flex items-center space-x-1 mt-0.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    aset.status === 'Digunakan' ? 'bg-emerald-100 text-emerald-800' :
                    aset.status === 'Tersedia' ? 'bg-blue-100 text-blue-800' :
                    aset.status === 'Dalam Pemeliharaan' ? 'bg-amber-100 text-amber-800' :
                    aset.status === 'Dipinjamkan' ? 'bg-purple-100 text-purple-800' :
                    aset.status === 'Proses Disposal' ? 'bg-orange-100 text-orange-800' :
                    aset.status === 'Disposal' ? 'bg-rose-100 text-rose-800' :
                    aset.status === 'Tidak Tersedia' ? 'bg-slate-200 text-slate-800' :
                    'bg-slate-100 text-slate-800'
                  }`}>
                    {aset.status}
                  </span>
                  <span className="text-[10px] text-slate-600 font-medium">({aset.kondisi})</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold">Bidang & PIC</div>
                <div className="font-bold text-slate-800 mt-0.5 truncate">{aset.nama_bidang_sekarang}</div>
                <div className="text-[10px] text-slate-500 truncate">PIC: {aset.nama_pic_sekarang}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-bold">Pemegang Terakhir</div>
                <div className="font-bold text-emerald-700 mt-0.5 truncate">
                  {aset.nama_pemegang_terakhir || aset.nama_pic_sekarang}
                </div>
                <div className="text-[10px] text-slate-500 truncate">Lokasi: {aset.lokasi_sekarang}</div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white pt-1">
              {/* Type Filter Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                    filterType === 'all'
                      ? 'bg-[#005DAA] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Semua ({timelineEvents.length})
                </button>
                <button
                  onClick={() => setFilterType('assignment')}
                  className={`px-2.5 py-1.5 rounded-lg font-bold transition-colors ${
                    filterType === 'assignment'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Assignment
                </button>
                <button
                  onClick={() => setFilterType('kalibrasi')}
                  className={`px-2.5 py-1.5 rounded-lg font-bold transition-colors ${
                    filterType === 'kalibrasi'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Kalibrasi
                </button>
                <button
                  onClick={() => setFilterType('pengajuan')}
                  className={`px-2.5 py-1.5 rounded-lg font-bold transition-colors ${
                    filterType === 'pengajuan'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Pengajuan
                </button>
                <button
                  onClick={() => setFilterType('audit')}
                  className={`px-2.5 py-1.5 rounded-lg font-bold transition-colors ${
                    filterType === 'audit'
                      ? 'bg-slate-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Audit Log
                </button>
              </div>

              {/* Search input within history */}
              <div className="relative min-w-[180px]">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari history..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-[#005DAA] outline-hidden"
                />
              </div>
            </div>

            {/* Timeline View Container */}
            <div className="max-h-[380px] overflow-y-auto pr-2 space-y-4 border-t border-slate-100 pt-4">
              {filteredEvents.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs space-y-1">
                  <Clock className="w-8 h-8 mx-auto text-slate-300" />
                  <div>Tidak ada catatan history yang sesuai kriteria filter.</div>
                </div>
              ) : (
                <div className="relative border-l-2 border-slate-200 ml-4 pl-6 space-y-6">
                  {filteredEvents.map((ev, idx) => (
                    <div key={ev.id} className="relative group">
                      
                      {/* Timeline Node Point */}
                      <div className="absolute -left-[31px] top-1 p-1 bg-white rounded-full border border-slate-300 shadow-xs group-hover:scale-110 transition-transform">
                        {ev.icon}
                      </div>

                      {/* Timeline Card */}
                      <div className="bg-slate-50/80 hover:bg-slate-50 border border-slate-200/90 rounded-xl p-3.5 space-y-1.5 transition-all shadow-2xs">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${ev.badgeColor}`}>
                              {ev.title}
                            </span>
                          </div>
                          <span className="text-[11px] font-semibold text-slate-500 font-mono flex items-center space-x-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{ev.formattedDate}</span>
                          </span>
                        </div>

                        {/* Event Details */}
                        <p className="text-xs text-slate-800 leading-relaxed font-medium pt-0.5">
                          {ev.detail}
                        </p>

                        {/* Actor Footnote */}
                        <div className="flex items-center space-x-1.5 pt-1 text-[11px] text-slate-500">
                          <UserIcon className="w-3 h-3 text-slate-400" />
                          <span>Aktor: <strong className="text-slate-700">{ev.actor}</strong></span>
                          {ev.roleActor && (
                            <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-mono font-semibold uppercase">
                              {ev.roleActor}
                            </span>
                          )}
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>

            </div>

            {/* Modal Footer */}
            <div className="shrink-0 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center space-x-1 text-slate-500">
                <Sparkles className="w-4 h-4 text-[#008C45]" />
                <span>Total <strong className="text-slate-800">{timelineEvents.length}</strong> catatan perubahan terekam.</span>
              </div>
              <button
                onClick={onClose}
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2 rounded-xl transition-colors shadow-xs"
              >
                Tutup
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
