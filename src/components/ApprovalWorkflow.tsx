import React, { useState, useEffect } from 'react';
import { Pengajuan, Aset, Bidang, User } from '../types';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  FileCheck, 
  Plus, 
  ArrowRightLeft, 
  Trash2, 
  X, 
  Check, 
  MessageSquare,
  AlertCircle
} from 'lucide-react';
import { PaginationControls } from './PaginationControls';
import { canUserApprovePengajuan } from '../lib/approvalUtils';

interface ApprovalWorkflowProps {
  requests: Pengajuan[];
  asets: Aset[];
  bidangList: Bidang[];
  userList: User[];
  currentUser: User;
  onSubmitRequest: (data: Partial<Pengajuan>) => Promise<void>;
  onApproveRequest: (id: string, note: string) => Promise<void>;
  onRejectRequest: (id: string, note: string) => Promise<void>;
}

export const ApprovalWorkflow: React.FC<ApprovalWorkflowProps> = ({
  requests,
  asets,
  bidangList,
  userList,
  currentUser,
  onSubmitRequest,
  onApproveRequest,
  onRejectRequest
}) => {
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [reviewModalRequest, setReviewModalRequest] = useState<Pengajuan | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitErrorMsg, setSubmitErrorMsg] = useState('');

  // New Request Form State
  const [selectedAssetId, setSelectedAssetId] = useState(asets[0]?.id_aset || '');
  const [jenis, setJenis] = useState<'Transfer' | 'Disposal' | 'Pengajuan Pemakaian'>('Transfer');
  const [idBidangTujuan, setIdBidangTujuan] = useState(bidangList[1]?.id_bidang || '');
  const [idPicTujuan, setIdPicTujuan] = useState(userList[1]?.id || '');
  const [pemegangBaruInput, setPemegangBaruInput] = useState('');
  const [tglRencanaPengembalianInput, setTglRencanaPengembalianInput] = useState('');
  const [alasan, setAlasan] = useState('');

  const handleBidangTujuanChange = (newBidangId: string) => {
    setIdBidangTujuan(newBidangId);
    const matchingPic = userList.find(u => u.id_bidang === newBidangId && u.role === 'pic_bidang') ||
                        userList.find(u => u.id_bidang === newBidangId) ||
                        userList[0];
    if (matchingPic) {
      setIdPicTujuan(matchingPic.id);
    }
  };

  const handlePicTujuanChange = (newPicId: string) => {
    setIdPicTujuan(newPicId);
    const selectedUser = userList.find(u => u.id === newPicId);
    if (selectedUser && selectedUser.id_bidang) {
      const matchingBidang = bidangList.find(b => b.id_bidang === selectedUser.id_bidang);
      if (matchingBidang) {
        setIdBidangTujuan(matchingBidang.id_bidang);
      }
    }
  };

  const handleOpenSubmitModal = () => {
    const currentAsset = asets.find(a => a.id_aset === selectedAssetId) || asets[0];
    const currentBidangId = currentAsset?.id_bidang_sekarang;
    const targetBidang = bidangList.find(b => b.id_bidang !== currentBidangId) || bidangList[0];
    if (targetBidang) {
      setIdBidangTujuan(targetBidang.id_bidang);
      const pic = userList.find(u => u.id_bidang === targetBidang.id_bidang && u.role === 'pic_bidang') ||
                  userList.find(u => u.id_bidang === targetBidang.id_bidang) ||
                  userList[0];
      if (pic) setIdPicTujuan(pic.id);
    }
    setTglRencanaPengembalianInput(currentAsset?.tgl_rencana_pengembalian || '');
    setSubmitErrorMsg('');
    setShowSubmitModal(true);
  };

  // Pagination for History
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const pendingList = requests.filter(r => r.status_approval === 'Pending');
  const historyList = requests.filter(r => r.status_approval !== 'Pending');

  const totalHistoryItems = historyList.length;
  const totalHistoryPages = Math.max(1, Math.ceil(totalHistoryItems / pageSize));
  const startHistoryIndex = (currentPage - 1) * pageSize;
  const paginatedHistoryList = historyList.slice(startHistoryIndex, startHistoryIndex + pageSize);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (jenis === 'Pengajuan Pemakaian' && !tglRencanaPengembalianInput) {
      setSubmitErrorMsg('Tanggal Rencana Pengembalian / Selesai Digunakan wajib diisi.');
      return;
    }
    setIsSubmitting(true);
    setSubmitErrorMsg('');
    try {
      await onSubmitRequest({
        id_aset: selectedAssetId,
        jenis,
        id_bidang_tujuan: jenis === 'Transfer' ? idBidangTujuan : undefined,
        id_pic_tujuan: jenis === 'Transfer' ? idPicTujuan : undefined,
        pemegang_baru: pemegangBaruInput.trim() || currentUser.nama,
        tgl_rencana_pengembalian: tglRencanaPengembalianInput,
        alasan,
        pemohon_id: currentUser.id,
        pemohon_nama: currentUser.nama,
        pemohon_role: currentUser.role
      });
      setIsSubmitting(false);
      setShowSubmitModal(false);
      setAlasan('');
      setPemegangBaruInput('');
      setTglRencanaPengembalianInput('');
    } catch (err: any) {
      console.error(err);
      setIsSubmitting(false);
      setSubmitErrorMsg(err?.message || 'Gagal mengirim pengajuan.');
    }
  };

  const handleApprove = async () => {
    if (!reviewModalRequest) return;
    setIsSubmitting(true);
    try {
      await onApproveRequest(reviewModalRequest.id_pengajuan, reviewNote || 'Disetujui oleh Fungsi Umum');
      setIsSubmitting(false);
      setReviewModalRequest(null);
      setReviewNote('');
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!reviewModalRequest) return;
    setIsSubmitting(true);
    try {
      await onRejectRequest(reviewModalRequest.id_pengajuan, reviewNote || 'Permohonan ditolak');
      setIsSubmitting(false);
      setReviewModalRequest(null);
      setReviewNote('');
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <FileCheck className="w-5 h-5 text-[#005DAA]" />
            <span>Approval Workflow (Pemakaian, Pemutakhiran, Transfer & Disposal)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Persetujuan PIC Bidang & Custodian untuk pengajuan pemakaian, pemutakhiran kondisi/lokasi, transfer, dan disposal aset.
          </p>
        </div>

        <button
          onClick={handleOpenSubmitModal}
          className="bg-[#005DAA] hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-colors shrink-0"
        >
          <Plus className="w-4 h-4 text-emerald-300" />
          <span>Ajukan Transfer / Disposal</span>
        </button>
      </div>

      {/* Pending Approval Requests Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-extrabold text-gray-900 text-sm flex items-center space-x-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <span>Menunggu Persetujuan Fungsi Umum ({pendingList.length})</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pendingList.length === 0 ? (
            <div className="col-span-full bg-white p-8 rounded-xl border border-gray-200 text-center text-gray-400 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              Tidak ada pengajuan transfer atau disposal yang menunggu persetujuan saat ini.
            </div>
          ) : (
            pendingList.map((p, idx) => (
              <div key={`${p.id_pengajuan}-${idx}`} className="bg-white p-4 rounded-xl border border-amber-200 shadow-xs space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-gray-400">{p.id_pengajuan}</span>
                    <h3 className="font-bold text-gray-900 text-sm">{p.nama_aset}</h3>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded font-extrabold text-[10px] ${
                    p.jenis === 'Transfer' 
                      ? 'bg-sky-100 text-sky-800' 
                      : p.jenis === 'Pengajuan Pemakaian'
                      ? 'bg-blue-100 text-blue-800 border border-blue-200'
                      : p.jenis === 'Pemutakhiran Lapangan'
                      ? 'bg-purple-100 text-purple-800 border border-purple-200'
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {p.jenis}
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-1 border border-slate-100 text-gray-700">
                  <p><span className="font-semibold text-gray-500">Pemohon (Staff Lapangan):</span> {p.pemohon_nama} ({p.nama_bidang_asal})</p>
                  {p.jenis === 'Transfer' && (
                    <p><span className="font-semibold text-gray-500">Tujuan Transfer:</span> {p.nama_bidang_tujuan} (PIC: {p.nama_pic_tujuan || '-'})</p>
                  )}
                  {(p.jenis === 'Pemutakhiran Lapangan' || p.jenis === 'Pengajuan Pemakaian') && (
                    <div className="bg-blue-50/80 p-2.5 rounded-lg border border-blue-100 text-[11px] text-blue-950 space-y-0.5 my-1 font-medium">
                      <div className="flex items-center justify-between font-bold text-blue-900 border-b border-blue-100 pb-1 mb-1">
                        <span>Detail Pengajuan Pemakaian / Lapangan</span>
                        <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-extrabold">
                          Status: {p.status_baru || 'Digunakan'}
                        </span>
                      </div>
                      <div><strong>Nama Pemegang Terakhir / Pengguna:</strong> {p.pemegang_baru || '-'}</div>
                      <div><strong>Lokasi Pemakaian / Site:</strong> {p.lokasi_baru || '-'}</div>
                      <div><strong>Kondisi Peralatan:</strong> {p.kondisi_baru || '-'}</div>
                      {p.tgl_rencana_pengembalian && (
                        <div className="pt-1 mt-1 border-t border-blue-200/60 text-amber-900 font-bold">
                          <span>📅 Tanggal Selesai Digunakan / Target Kembali: </span>
                          <span className="bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded">{p.tgl_rencana_pengembalian}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <p><span className="font-semibold text-gray-500">Catatan/Alasan:</span> {p.alasan}</p>
                  <p className="text-[10px] text-gray-400">Diajukan: {new Date(p.created_at).toLocaleString()}</p>
                </div>

                {(() => {
                  const check = canUserApprovePengajuan(p, currentUser);
                  if (check.allowed) {
                    return (
                      <div className="flex items-center space-x-2 pt-1">
                        <button
                          onClick={() => {
                            setReviewModalRequest(p);
                            setReviewNote('');
                          }}
                          className="w-full bg-[#002B66] hover:bg-[#001D47] text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center space-x-1 shadow-xs transition-colors"
                        >
                          <Check className="w-4 h-4 text-[#00A3E0]" />
                          <span>Tinjau & Beri Keputusan Approval</span>
                        </button>
                      </div>
                    );
                  }
                  return (
                    <div className="bg-amber-50/90 border border-amber-200/90 rounded-lg p-2.5 text-[11px] text-amber-900 font-medium flex items-start space-x-2 pt-1.5 mt-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>{check.reason}</span>
                    </div>
                  );
                })()}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Approval History Section */}
      <div className="space-y-3 pt-4">
        <h2 className="font-extrabold text-gray-900 text-sm">Riwayat Persetujuan Pengajuan</h2>

        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Aset & Jenis</th>
                  <th className="py-3 px-4">Pemohon</th>
                  <th className="py-3 px-4">Tujuan / Alasan</th>
                  <th className="py-3 px-4">Status & Approver</th>
                  <th className="py-3 px-4">Catatan Approver</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {totalHistoryItems === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-400">
                      Belum ada riwayat persetujuan.
                    </td>
                  </tr>
                ) : (
                  paginatedHistoryList.map((h, idx) => (
                    <tr key={`${h.id_pengajuan}-${idx}`} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4">
                        <div className="font-bold text-gray-900">{h.nama_aset}</div>
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          h.jenis === 'Transfer' ? 'bg-sky-100 text-sky-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {h.jenis}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-800">{h.pemohon_nama}</div>
                        <div className="text-[10px] text-gray-500">{h.nama_bidang_asal}</div>
                      </td>

                      <td className="py-3 px-4 max-w-xs">
                        {h.jenis === 'Transfer' && (
                          <div className="font-medium text-gray-900">Ke: {h.nama_bidang_tujuan}</div>
                        )}
                        <div className="text-[10px] text-gray-500 line-clamp-2">{h.alasan}</div>
                      </td>

                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded font-bold text-[10px] ${
                          h.status_approval === 'Approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {h.status_approval === 'Approved' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          <span>{h.status_approval}</span>
                        </span>
                        <div className="text-[10px] text-gray-500 mt-0.5">Oleh: {h.approver_nama || 'Admin'}</div>
                      </td>

                      <td className="py-3 px-4 text-gray-600 text-[11px]">
                        {h.catatan_approver || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <PaginationControls
            currentPage={currentPage}
            totalPages={totalHistoryPages}
            pageSize={pageSize}
            totalItems={totalHistoryItems}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>

      {/* MODAL: Submit Request Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 overflow-y-auto p-3 sm:p-4 md:p-6 flex items-start sm:items-center justify-center">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-gray-100 my-auto max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95">
            <div className="shrink-0 flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-extrabold text-gray-900 text-base">Ajukan Transfer / Disposal Aset</h3>
              <button onClick={() => setShowSubmitModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="overflow-y-auto flex-1 min-h-0 space-y-3.5 text-xs py-2 pr-1">
              {submitErrorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{submitErrorMsg}</span>
                </div>
              )}
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Pilih Aset Operasional *</label>
                <select
                  value={selectedAssetId}
                  onChange={(e) => setSelectedAssetId(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66]"
                >
                  {asets.map((a) => (
                    <option key={a.id_aset} value={a.id_aset}>
                      [{a.id_aset}] {a.nama} ({a.nama_bidang_sekarang})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Jenis Pengajuan *</label>
                <select
                  value={jenis}
                  onChange={(e) => setJenis(e.target.value as any)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66]"
                >
                  <option value="Transfer">Transfer Aset Antar Bidang</option>
                  <option value="Pengajuan Pemakaian">Pengajuan Pemakaian / Peminjaman Lapangan</option>
                  <option value="Disposal">Penghapusan Aset (Disposal)</option>
                </select>
              </div>

              {jenis === 'Transfer' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Bidang Tujuan *</label>
                    <select
                      value={idBidangTujuan}
                      onChange={(e) => handleBidangTujuanChange(e.target.value)}
                      className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66]"
                    >
                      {bidangList.map((b) => (
                        <option key={b.id_bidang} value={b.id_bidang}>{b.nama_bidang}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">PIC Tujuan *</label>
                    <select
                      value={idPicTujuan}
                      onChange={(e) => handlePicTujuanChange(e.target.value)}
                      className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66]"
                    >
                      {userList.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nama} ({u.nama_bidang || 'Bidang N/A'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {jenis !== 'Disposal' && (
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Nama Pemegang / Personel Pemakai Lapangan
                  </label>
                  <input
                    type="text"
                    placeholder={`Default: ${currentUser.nama} (Pemohon)`}
                    value={pemegangBaruInput}
                    onChange={(e) => setPemegangBaruInput(e.target.value)}
                    className="w-full p-2.5 border border-sky-300 bg-sky-50/50 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66]"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    * Setelah disetujui, nama ini akan otomatis memperbarui "Nama Pemegang Terakhir" di Master Data Aset.
                  </p>
                </div>
              )}

              {jenis === 'Pengajuan Pemakaian' && (
                <div>
                  <label className="block font-semibold text-amber-800 mb-1">
                    Tanggal Rencana Pengembalian / Selesai Digunakan *
                  </label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={tglRencanaPengembalianInput}
                    onChange={(e) => setTglRencanaPengembalianInput(e.target.value)}
                    className="w-full p-2.5 border border-amber-300 bg-amber-50/50 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66] font-medium text-amber-900"
                  />
                  <p className="text-[10px] text-amber-700 mt-1">
                    * Wajib diisi. Jika terlambat lebih dari 1 hari tanpa perubahan status/pengajuan baru, email peringatan otomatis dikirimkan.
                  </p>
                </div>
              )}

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Alasan Pengajuan *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Jelaskan kebutuhan transfer atau pertimbangan disposal alat..."
                  value={alasan}
                  onChange={(e) => setAlasan(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66]"
                />
              </div>

              <div className="shrink-0 flex items-center justify-end space-x-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg font-bold text-gray-700 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[#002B66] hover:bg-[#001D47] text-white rounded-lg font-bold shadow-sm"
                >
                  Kirim Pengajuan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Review & Approve/Reject Modal for Fungsi Umum */}
      {reviewModalRequest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 overflow-y-auto p-3 sm:p-4 md:p-6 flex items-start sm:items-center justify-center">
          <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-gray-100 my-auto max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95">
            <div className="shrink-0 flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
              <h3 className="font-extrabold text-gray-900 text-sm">Review Pengajuan Fungsi Umum</h3>
              <button onClick={() => setReviewModalRequest(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 min-h-0 space-y-4 text-xs pr-1">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                <div className="font-bold text-[#002B66]">{reviewModalRequest.nama_aset}</div>
                <div className="text-gray-600">
                  Jenis: <strong className="text-gray-900">{reviewModalRequest.jenis}</strong>
                </div>
                <div className="text-gray-600">
                  Pemohon: {reviewModalRequest.pemohon_nama} ({reviewModalRequest.nama_bidang_asal})
                </div>
                {reviewModalRequest.jenis === 'Transfer' && (
                  <div className="text-gray-600">Tujuan: {reviewModalRequest.nama_bidang_tujuan}</div>
                )}
                {reviewModalRequest.pemegang_baru && (
                  <div className="text-gray-600">Pemegang Baru: <strong className="text-gray-800">{reviewModalRequest.pemegang_baru}</strong></div>
                )}
                {reviewModalRequest.lokasi_baru && (
                  <div className="text-gray-600">Lokasi / Site Baru: <strong className="text-gray-800">{reviewModalRequest.lokasi_baru}</strong></div>
                )}
                {reviewModalRequest.tgl_rencana_pengembalian && (
                  <div className="text-amber-900 font-bold bg-amber-50 p-2 rounded-lg border border-amber-200 mt-1">
                    📅 Tanggal Selesai Digunakan / Target Pengembalian: <span className="underline">{reviewModalRequest.tgl_rencana_pengembalian}</span>
                  </div>
                )}
                <div className="text-gray-600">Alasan: {reviewModalRequest.alasan}</div>
              </div>

              <div className="space-y-2 text-xs">
                <label className="block font-semibold text-gray-700">Catatan/Pesan Persetujuan atau Penolakan:</label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Disetujui. Harap update status serah terima fisik aset di sistem."
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66]"
                />
              </div>
            </div>

            <div className="shrink-0 flex items-center justify-end space-x-2 pt-3 border-t border-gray-100 mt-3">
              <button
                type="button"
                onClick={handleReject}
                disabled={isSubmitting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs shadow-xs"
              >
                Tolak Pengajuan
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={isSubmitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs"
              >
                Setujui Pengajuan
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
