import React, { useState, useEffect } from 'react';
import { Aset, User, KondisiAset, StatusAset, getAllowedKondisiForStatus, ALL_STATUSES, ALL_KONDISI } from '../types';
import { apiClient } from '../lib/apiClient';
import { CameraScanner } from './CameraScanner';
import { 
  QrCode, 
  Search, 
  Camera, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  MapPin, 
  Wrench, 
  FileText,
  RotateCw,
  Calendar,
  Award,
  ShieldAlert
} from 'lucide-react';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  asets: Aset[];
  currentUser: User;
  onUpdateStatusMobile: (idOrQr: string, data: any) => Promise<void>;
  onAddKalibrasi?: (id: string, data: any) => Promise<void>;
  initialAsset?: Aset | null;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  asets,
  currentUser,
  onUpdateStatusMobile,
  onAddKalibrasi,
  initialAsset
}) => {
  const isManagementRole = currentUser.role === 'management' || currentUser.role === 'pimpinan';
  const [scannedQr, setScannedQr] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<Aset | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Mode selection: 'status' or 'kalibrasi'
  const [scanMode, setScanMode] = useState<'status' | 'kalibrasi'>('status');

  // Update Status Form State
  const [kondisi, setKondisi] = useState<KondisiAset>('Baik');
  const [lokasi, setLokasi] = useState('');
  const [status, setStatus] = useState<StatusAset>('Digunakan');
  const [tglRencanaPengembalian, setTglRencanaPengembalian] = useState('');
  const [pemegangTerakhir, setPemegangTerakhir] = useState('');
  const [catatan, setCatatan] = useState('');

  // Update Kalibrasi Form State
  const [tglKalibrasi, setTglKalibrasi] = useState(new Date().toISOString().split('T')[0]);
  const [lembagaKalibrasi, setLembagaKalibrasi] = useState('SUCOFINDO Calibration Services');
  const [noSertifikat, setNoSertifikat] = useState('');
  const [tglBerikutnya, setTglBerikutnya] = useState('');
  const [kondisiSetelah, setKondisiSetelah] = useState<KondisiAset>('Baik');
  const [catatanKalibrasi, setCatatanKalibrasi] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && initialAsset) {
      initAssetStates(initialAsset);
    }
  }, [isOpen, initialAsset]);

  if (!isOpen) return null;

  const handleResetScan = () => {
    setSelectedAsset(null);
    setScannedQr('');
    setErrorMsg('');
    setSuccessMsg('');
    setCatatan('');
    setCatatanKalibrasi('');
    setScanMode('status');
    setIsSubmitting(false);
  };

  const handleCloseModal = () => {
    handleResetScan();
    onClose();
  };

  const handleStatusChange = (newStatus: StatusAset) => {
    setStatus(newStatus);
    const allowed = getAllowedKondisiForStatus(newStatus);
    if (!allowed.includes(kondisi)) {
      setKondisi(allowed[0]);
    }
  };

  const initAssetStates = (found: Aset) => {
    setSelectedAsset(found);
    const validStatus = (ALL_STATUSES.includes(found.status as any) ? found.status : 'Tersedia') as StatusAset;
    setStatus(validStatus);

    const allowed = getAllowedKondisiForStatus(validStatus);
    if (allowed.includes(found.kondisi as any)) {
      setKondisi(found.kondisi);
    } else {
      setKondisi(allowed[0]);
    }

    setLokasi(found.lokasi_sekarang || '');
    setTglRencanaPengembalian(found.tgl_rencana_pengembalian || '');
    setPemegangTerakhir(found.nama_pemegang_terakhir || found.nama_pic_sekarang || '');

    // Init Kalibrasi defaults
    const todayStr = new Date().toISOString().split('T')[0];
    const nextYearDate = new Date();
    nextYearDate.setFullYear(nextYearDate.getFullYear() + 1);
    const nextYearStr = nextYearDate.toISOString().split('T')[0];

    setTglKalibrasi(found.tgl_kalibrasi_terakhir || todayStr);
    setLembagaKalibrasi('SUCOFINDO Calibration Services');
    setNoSertifikat(found.sertifikat_kalibrasi_no || `CERT/SCI/${new Date().getFullYear()}/${found.id_aset}`);
    setTglBerikutnya(found.tgl_kalibrasi_berikutnya || nextYearStr);
    setKondisiSetelah(ALL_KONDISI.includes(found.kondisi as any) ? found.kondisi : 'Baik');
    setCatatanKalibrasi('');
  };

  const extractCleanCode = (input: string): string => {
    if (!input) return '';
    let str = input.trim();
    if (str.startsWith('http://') || str.startsWith('https://')) {
      try {
        const url = new URL(str);
        const queryParam = url.searchParams.get('code') || 
                           url.searchParams.get('id') || 
                           url.searchParams.get('qr') ||
                           url.searchParams.get('asset_number') ||
                           url.searchParams.get('tag_number');
        if (queryParam && queryParam.trim()) return queryParam.trim();
        const lastSeg = url.pathname.split('/').filter(Boolean).pop();
        if (lastSeg) return lastSeg.trim();
      } catch (e) {}
    }
    return str;
  };

  const handleLookup = async (code: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    if (!code || !code.trim()) return;

    const targetCode = extractCleanCode(code);
    const targetLower = targetCode.toLowerCase();

    // 1. Check local state list first
    const found = asets.find(a => 
      (a.qr_code && a.qr_code.toLowerCase() === targetLower) ||
      (a.id_aset && a.id_aset.toLowerCase() === targetLower) ||
      (a.nomor_seri && a.nomor_seri.toLowerCase() === targetLower) ||
      (a.asset_number && a.asset_number.toLowerCase() === targetLower) ||
      (a.tag_number && a.tag_number.toLowerCase() === targetLower)
    );

    if (found) {
      initAssetStates(found);
      return;
    }

    // 2. Query server API directly (supports 222+ assets in MongoDB Atlas)
    try {
      const serverAsset = await apiClient.getAsetDetail(targetCode);
      if (serverAsset && serverAsset.id_aset) {
        initAssetStates(serverAsset);
        return;
      }
    } catch (err) {
      // Not found on server
    }

    setSelectedAsset(null);
    setErrorMsg(`Aset dengan kode QR/ID/No. Seri "${targetCode}" tidak ditemukan dalam sistem.`);
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;

    if (status === 'Digunakan' && !tglRencanaPengembalian) {
      setErrorMsg('Tanggal Rencana Pengembalian wajib diisi untuk aset yang digunakan.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await onUpdateStatusMobile(selectedAsset.id_aset, {
        kondisi,
        lokasi_sekarang: lokasi,
        status,
        tgl_rencana_pengembalian: status === 'Digunakan' ? tglRencanaPengembalian : '',
        catatan,
        nama_pemegang_terakhir: pemegangTerakhir || selectedAsset.nama_pic_sekarang,
        actorName: currentUser.nama,
        actorRole: currentUser.role
      });

      setSuccessMsg(`Status aset [${selectedAsset.id_aset}] berhasil diperbarui di lapangan!`);
      setIsSubmitting(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memperbarui status');
      setIsSubmitting(false);
    }
  };

  const handleKalibrasiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;

    if (!onAddKalibrasi) {
      setErrorMsg('Fungsi update kalibrasi tidak tersedia.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await onAddKalibrasi(selectedAsset.id_aset, {
        tanggal: tglKalibrasi,
        lembaga_kalibrasi: lembagaKalibrasi,
        nomor_sertifikat: noSertifikat,
        jatuh_tempo_berikutnya: tglBerikutnya,
        kondisi_setelah: kondisiSetelah,
        pic_input: currentUser.nama,
        catatan: catatanKalibrasi
      });

      setSuccessMsg(`Sertifikat & jadwal kalibrasi aset [${selectedAsset.id_aset}] berhasil diperbarui!`);
      setIsSubmitting(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memperbarui data kalibrasi');
      setIsSubmitting(false);
    }
  };

  // Check if current user is authorized to update calibration for this asset
  const isAdminOrCustodian = currentUser.role === 'admin' || currentUser.role === 'custodian';
  const isPicForThisAsset = selectedAsset ? (
    isAdminOrCustodian ||
    (currentUser.id_bidang && selectedAsset.id_bidang_sekarang && currentUser.id_bidang === selectedAsset.id_bidang_sekarang) ||
    (currentUser.bidang && selectedAsset.nama_bidang_sekarang && currentUser.bidang.toLowerCase().trim() === selectedAsset.nama_bidang_sekarang.toLowerCase().trim()) ||
    (currentUser.nama && selectedAsset.nama_pic_sekarang && currentUser.nama.toLowerCase().trim() === selectedAsset.nama_pic_sekarang.toLowerCase().trim())
  ) : false;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 overflow-y-auto p-3 sm:p-4 md:p-6 flex items-start sm:items-center justify-center">
      <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-gray-100 my-auto max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#005DAA] flex items-center justify-center">
              <QrCode className="w-5 h-5 text-[#008C45]" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Scan QR Code / Pemutakhiran Mandiri PIC</h3>
              <p className="text-[10px] text-slate-500">Antarmuka Mobile-First untuk Petugas Lapangan</p>
            </div>
          </div>
          <button onClick={handleCloseModal} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Error Banner */}
        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs space-y-2 mb-3">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-snug">{errorMsg}</div>
            </div>
            <div className="pt-2 border-t border-rose-200 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={handleResetScan}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[11px] flex items-center space-x-1"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Scan Lagi</span>
              </button>
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-3 py-1.5 bg-white border border-rose-300 text-rose-800 rounded-lg font-bold text-[11px]"
              >
                Selesai / Tutup
              </button>
            </div>
          </div>
        )}

        {/* Global Success Banner */}
        {successMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs space-y-2 mb-3">
            <div className="flex items-start space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="font-bold">{successMsg}</div>
            </div>
            <div className="pt-2 border-t border-emerald-200 flex items-center justify-between">
              <span className="text-[11px] text-emerald-800 font-semibold">Scan aset lainnya?</span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleResetScan}
                  className="px-3 py-1.5 bg-[#008C45] hover:bg-[#007037] text-white rounded-lg font-bold text-[11px] flex items-center space-x-1"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Scan Aset Lain</span>
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 rounded-lg font-bold text-[11px]"
                >
                  Selesai / Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Real Live Camera Scanner & Input */}
        {!selectedAsset && !successMsg && !errorMsg && (
          <div className="overflow-y-auto flex-1 min-h-0 space-y-3 pr-1">
            
            {/* Real Live Camera Scanner */}
            <CameraScanner
              scannerId="qr-modal-camera-stream"
              onScanSuccess={(decodedText) => {
                setScannedQr(decodedText);
                handleLookup(decodedText);
              }}
            />

          </div>
        )}

        {/* Selected Asset - Forms or View Only (Management) */}
        {selectedAsset && !successMsg && !errorMsg && (
          isManagementRole ? (
            <div className="overflow-y-auto flex-1 min-h-0 space-y-3 text-xs pr-1">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-amber-900 text-xs space-y-1">
                <div className="font-bold flex items-center space-x-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Mode Pemantauan (View Only) - Role Management</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Role Management hanya memiliki akses pemantauan real-time dan tidak melakukan Update Mandiri PIC. Detail aset hasil scan QR:
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5">
                <div>
                  <div className="text-[10px] font-bold text-sky-700 uppercase tracking-wider">Aset Teridentifikasi</div>
                  <div className="font-bold text-gray-900 text-base">{selectedAsset.nama}</div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    ID Aset: <span className="font-mono font-semibold">{selectedAsset.id_aset}</span> | SN: <span className="font-mono font-semibold">{selectedAsset.nomor_seri}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 text-xs">
                  <div>
                    <span className="text-gray-500 text-[11px] block">Bidang / Unit:</span>
                    <span className="font-bold text-slate-800">{selectedAsset.nama_bidang_sekarang}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[11px] block">PIC Penanggung Jawab:</span>
                    <span className="font-bold text-slate-800">{selectedAsset.nama_pic_sekarang}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[11px] block">Kondisi Fisik:</span>
                    <span className="font-bold text-slate-800">{selectedAsset.kondisi}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[11px] block">Status Pemakaian:</span>
                    <span className="font-bold text-slate-800">{selectedAsset.status}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500 text-[11px] block">Jatuh Tempo Kalibrasi:</span>
                    <span className="font-bold text-slate-800">{selectedAsset.tgl_kalibrasi_berikutnya || 'Tidak Ada Jadwal'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500 text-[11px] block">Lokasi Terkini:</span>
                    <span className="font-bold text-slate-800">{selectedAsset.lokasi_sekarang || '-'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500 text-[11px] block">Pemegang Terakhir:</span>
                    <span className="font-bold text-slate-800">{selectedAsset.pemegang_terakhir || selectedAsset.nama_pic_sekarang}</span>
                  </div>
                </div>
              </div>

              <div className="shrink-0 flex items-center space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedAsset(null)}
                  className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-lg font-bold text-slate-700 flex items-center justify-center space-x-1.5"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Scan Aset Lain</span>
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="w-1/2 py-2.5 bg-[#008C45] hover:bg-[#007037] text-white rounded-lg font-bold shadow-xs"
                >
                  Tutup Modal
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-y-auto flex-1 min-h-0 space-y-3 text-xs pr-1">
              
              {/* Asset Header Info Card */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <div className="text-[10px] font-bold text-sky-700 uppercase tracking-wider">Aset Teridentifikasi</div>
                <div className="font-bold text-gray-900 text-sm">{selectedAsset.nama}</div>
                <div className="text-[10px] text-gray-500">
                  ID: {selectedAsset.id_aset} | SN: {selectedAsset.nomor_seri}
                </div>
                <div className="text-[10px] text-gray-500 flex items-center justify-between pt-0.5">
                  <span>Bidang: <strong className="text-slate-700">{selectedAsset.nama_bidang_sekarang}</strong></span>
                  <span>PIC: <strong className="text-slate-700">{selectedAsset.nama_pic_sekarang}</strong></span>
                </div>
              </div>

              {/* Mode Selection Tabs: 1) Update Kondisi & Lokasi, 2) Update Kalibrasi */}
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl font-bold">
                <button
                  type="button"
                  onClick={() => setScanMode('status')}
                  className={`py-2 px-2 rounded-lg text-[11px] flex items-center justify-center space-x-1.5 transition-all ${
                    scanMode === 'status'
                      ? 'bg-white text-[#002B66] shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>1. Kondisi & Lokasi</span>
                </button>

                <button
                  type="button"
                  onClick={() => setScanMode('kalibrasi')}
                  className={`py-2 px-2 rounded-lg text-[11px] flex items-center justify-center space-x-1.5 transition-all ${
                    scanMode === 'kalibrasi'
                      ? 'bg-white text-[#002B66] shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Award className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>2. Update Kalibrasi</span>
                </button>
              </div>

              {/* TAB 1: UPDATE KONDISI & LOKASI ASET */}
              {scanMode === 'status' && (
                <form onSubmit={handleStatusSubmit} className="space-y-3">
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1 flex items-center space-x-1">
                      <MapPin className="w-3.5 h-3.5 text-sky-600" />
                      <span>Lokasi Fisik Terkini di Lapangan *</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Site Lapangan / Tangki 04"
                      value={lokasi}
                      onChange={(e) => setLokasi(e.target.value)}
                      className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1 flex items-center justify-between">
                      <span>Personel Pemegang / Pemakai Terakhir di Lapangan</span>
                      <span className="text-[10px] text-sky-700 font-normal">(Scope {selectedAsset.nama_bidang_sekarang})</span>
                    </label>
                    <input
                      type="text"
                      placeholder={`Default: ${selectedAsset.nama_pic_sekarang} (PIC Bidang)`}
                      value={pemegangTerakhir}
                      onChange={(e) => setPemegangTerakhir(e.target.value)}
                      className="w-full p-2.5 border border-sky-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66] bg-sky-50/50"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      * Tuliskan nama karyawan/inspector yang memegang barang ini di lapangan. Jika kosong, pertanggungjawaban otomatis kembali ke PIC Bidang.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Status Pemakaian *</label>
                      <select
                        value={status}
                        onChange={(e) => handleStatusChange(e.target.value as StatusAset)}
                        className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66] font-medium"
                      >
                        {ALL_STATUSES.map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Kondisi Fisik *</label>
                      <select
                        value={kondisi}
                        onChange={(e) => setKondisi(e.target.value as KondisiAset)}
                        className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66] font-medium"
                      >
                        {getAllowedKondisiForStatus(status).map((kd) => (
                          <option key={kd} value={kd}>{kd}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {(status === 'Proses Disposal' || status === 'Disposal') && (
                    <p className="text-[10px] text-amber-700 bg-amber-50 p-1.5 rounded border border-amber-200">
                      ℹ️ Status <strong>{status}</strong> hanya berlaku untuk aset dengan kondisi <strong>Rusak Berat</strong>.
                    </p>
                  )}
                  {status === 'Tidak Tersedia' && (
                    <p className="text-[10px] text-rose-700 bg-rose-50 p-1.5 rounded border border-rose-200">
                      ℹ️ Status <strong>Tidak Tersedia</strong> hanya berlaku untuk aset dengan kondisi <strong>Hilang</strong>.
                    </p>
                  )}

                  {status === 'Digunakan' && (
                    <div>
                      <label className="block font-semibold text-amber-800 mb-1 flex items-center space-x-1">
                        <Calendar className="w-3.5 h-3.5 text-amber-600" />
                        <span>Tanggal Rencana Pengembalian *</span>
                      </label>
                      <input
                        type="date"
                        required
                        min={new Date().toISOString().split('T')[0]}
                        value={tglRencanaPengembalian}
                        onChange={(e) => setTglRencanaPengembalian(e.target.value)}
                        className="w-full p-2.5 border border-amber-300 rounded-lg outline-hidden focus:ring-2 focus:ring-amber-500 bg-amber-50/50 font-medium text-amber-900"
                      />
                      <p className="text-[10px] text-amber-700 mt-1">
                        * Jika terlewat lebih dari 1 hari tanpa perubahan status/pengajuan baru, email peringatan otomatis dikirimkan ke PIC &amp; Fungsi Umum.
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1 flex items-center space-x-1">
                      <FileText className="w-3.5 h-3.5 text-gray-500" />
                      <span>Catatan Pemutakhiran Lapangan</span>
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Contoh: Alat selesai digunakan untuk uji ketebalan plat tangki. Siap dikembalikan ke gudang."
                      value={catatan}
                      onChange={(e) => setCatatan(e.target.value)}
                      className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66]"
                    />
                  </div>

                  <div className="shrink-0 flex items-center space-x-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setSelectedAsset(null)}
                      className="w-1/3 py-2.5 border border-gray-300 rounded-lg font-bold text-gray-700 hover:bg-gray-50"
                    >
                      Kembali
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-2/3 py-2.5 bg-[#002B66] hover:bg-[#001D47] text-white rounded-lg font-bold shadow-md flex items-center justify-center space-x-2"
                    >
                      {isSubmitting ? (
                        <RotateCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-[#00A3E0]" />
                          <span>Update Status Real-Time</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 2: UPDATE SERTIFIKAT & JADWAL KALIBRASI ASET */}
              {scanMode === 'kalibrasi' && (
                !isPicForThisAsset ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-amber-900">
                    <div className="flex items-center space-x-2 font-bold text-xs">
                      <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Bukan Aset Tanggung Jawab Bidang Anda</span>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      Aset ini tercatat berada di bawah wewenang <strong>{selectedAsset.nama_bidang_sekarang}</strong> (PIC: {selectedAsset.nama_pic_sekarang}).
                    </p>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      Pembaruan sertifikat kalibrasi hanya dapat dilakukan oleh PIC Bidang {selectedAsset.nama_bidang_sekarang} atau Custodian/Admin Aset.
                    </p>
                    <div className="pt-2 border-t border-amber-200 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setScanMode('status')}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[11px]"
                      >
                        Kembali ke Update Kondisi
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleKalibrasiSubmit} className="space-y-3">
                    <div className="bg-emerald-50/70 border border-emerald-200 p-2.5 rounded-xl text-emerald-900 text-[11px] flex items-center space-x-2">
                      <Award className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Input Sertifikat & Perbarui Jadwal Kalibrasi Berikutnya</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block font-semibold text-gray-700 mb-1">
                          Tanggal Kalibrasi *
                        </label>
                        <input
                          type="date"
                          required
                          value={tglKalibrasi}
                          onChange={(e) => setTglKalibrasi(e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66]"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-gray-700 mb-1">
                          Jatuh Tempo Berikutnya *
                        </label>
                        <input
                          type="date"
                          required
                          value={tglBerikutnya}
                          onChange={(e) => setTglBerikutnya(e.target.value)}
                          className="w-full p-2 border border-emerald-400 bg-emerald-50/30 rounded-lg outline-hidden focus:ring-2 focus:ring-[#008C45] font-bold text-emerald-900"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">
                        Lembaga / Laboratorium Penguji *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Contoh: SUCOFINDO Calibration Services - Medan"
                        value={lembagaKalibrasi}
                        onChange={(e) => setLembagaKalibrasi(e.target.value)}
                        className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66]"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">
                        Nomor Sertifikat Kalibrasi *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Contoh: CERT/SCI/2026/0891"
                        value={noSertifikat}
                        onChange={(e) => setNoSertifikat(e.target.value)}
                        className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66] font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">
                        Kondisi Aset Setelah Uji Kalibrasi *
                      </label>
                      <select
                        value={kondisiSetelah}
                        onChange={(e) => setKondisiSetelah(e.target.value as KondisiAset)}
                        className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66]"
                      >
                        <option value="Baik">Baik / Layak Pakai</option>
                        <option value="Perlu Perbaikan">Perlu Perbaikan / Kalibrasi Ulang</option>
                        <option value="Rusak Berat">Rusak Berat / Tidak Layak Pakai</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">
                        Catatan Uji / Hasil Pengujian Kalibrasi
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Contoh: Alat telah dikalibrasi sesuai standar ASTM E797 dengan akurasi 99.8%. Sertifikat fisik disimpan di arsip Laboratorium."
                        value={catatanKalibrasi}
                        onChange={(e) => setCatatanKalibrasi(e.target.value)}
                        className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66]"
                      />
                    </div>

                    <div className="shrink-0 flex items-center space-x-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setSelectedAsset(null)}
                        className="w-1/3 py-2.5 border border-gray-300 rounded-lg font-bold text-gray-700 hover:bg-gray-50"
                      >
                        Kembali
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-2/3 py-2.5 bg-[#008C45] hover:bg-[#007037] text-white rounded-lg font-bold shadow-md flex items-center justify-center space-x-2"
                      >
                        {isSubmitting ? (
                          <RotateCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Award className="w-4 h-4 text-emerald-200" />
                            <span>Simpan Kalibrasi Aset</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )
              )}

            </div>
          )
        )}

      </div>
    </div>
  );
};

