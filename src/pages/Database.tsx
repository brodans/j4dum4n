import React, { useState, useEffect, useMemo } from 'react';
import { Database as DatabaseIcon, Search, X, ChevronDown, Check, User, Phone, Mail, MapPin, BookOpen, Users, Baby, Camera, ZoomIn, RefreshCw } from 'lucide-react';
import type { BiodataRecord } from '../data/database';
import { loadPegawaiDatabase } from '../lib/pegawaiData';
import { sendRequest } from '../api';
import { getTodayWIB, formatBeautifulDateTime } from '../lib/dateFormatter';
import LazyImage from '../components/ui/LazyImage';
import ImageLightbox from '../components/ui/ImageLightbox';
import { useAppContext } from '../context/AppContext';

export default function Database() {
  const { userRole, tabPermissions } = useAppContext();
  const canSearchDatabase = userRole === 'admin' || tabPermissions.allowSearchDatabase;
  const [search, setSearch] = useState('');
  const [selectedOpd, setSelectedOpd] = useState('');
  const [visibleCount, setVisibleCount] = useState(50);
  const [pegawaiDatabase, setPegawaiDatabase] = useState<any[]>([]);
  const [loadingPegawai, setLoadingPegawai] = useState(true);
  const [pegawaiLoadError, setPegawaiLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);

  // States for detailed view modal
  const [selectedDetailPegawai, setSelectedDetailPegawai] = useState<any | null>(null);
  const [selectedDetailBiodata, setSelectedDetailBiodata] = useState<BiodataRecord | null>(null);
  const [detailBiodataLoading, setDetailBiodataLoading] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // States for pegawai photo (from last presensi log)
  const [pegawaiPhoto, setPegawaiPhoto] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  const [photoMeta, setPhotoMeta] = useState<{ jam: string; tanggal: string } | null>(null);

  // Lightbox state for viewing photo full-screen
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // States for OPD custom modal selector
  const [isOpdModalOpen, setIsOpdModalOpen] = useState(false);
  const [opdSearchQuery, setOpdSearchQuery] = useState('');
  const photoRequestRef = React.useRef<AbortController | null>(null);
  const biodataRequestRef = React.useRef(0);

  useEffect(() => {
    let cancelled = false;
    setLoadingPegawai(true);
    setPegawaiLoadError('');
    loadPegawaiDatabase()
      .then(records => { if (!cancelled) setPegawaiDatabase(records); })
      .catch(error => {
        if (!cancelled) {
          console.error('Gagal memuat database pegawai:', error);
          setPegawaiLoadError('Database pegawai belum dapat dimuat.');
        }
      })
      .finally(() => { if (!cancelled) setLoadingPegawai(false); });
    return () => { cancelled = true; };
  }, [loadAttempt]);

  const simplifiedPegawai = useMemo(() => pegawaiDatabase.map((item: any) => ({
    id: item?.id || item?.id_pegawai || '',
    nip: item?.nip || '',
    nama: item?.nama || '',
    jabatan: item?.nama_jabatan || item?.jabatan || '',
    instansi: item?.instansi || '',
  })), [pegawaiDatabase]);

  const opdList = useMemo(() => Array.from(
    new Set(pegawaiDatabase.map((item: any) => item?.instansi).filter(Boolean))
  ).sort() as string[], [pegawaiDatabase]);

  // Debounce the search input to keep typing completely smooth
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setVisibleCount(50);
    }, 200);
    return () => clearTimeout(handler);
  }, [search]);

  // Memoized filtered data using pre-computed simplified list
  const filteredData = useMemo(() => {
    const term = debouncedSearch.toLowerCase().trim();
    if (!term && !selectedOpd) return simplifiedPegawai;
    return simplifiedPegawai.filter((item: any) => {
      const matchesOpd = !selectedOpd || item.instansi === selectedOpd;
      const matchesSearch = !term || (item.nip || '').toLowerCase().includes(term) || (item.nama || '').toLowerCase().includes(term) || (item.id || '').toLowerCase().includes(term);
      return matchesOpd && matchesSearch;
    });
  }, [debouncedSearch, selectedOpd, simplifiedPegawai]);

  const filteredOpdList = useMemo(() => {
    const term = opdSearchQuery.trim().toLowerCase();
    if (!term) return opdList;
    return opdList.filter(opdName => opdName.toLowerCase().includes(term));
  }, [opdSearchQuery, opdList]);

  useEffect(() => () => {
    photoRequestRef.current?.abort();
    biodataRequestRef.current += 1;
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      if (visibleCount < filteredData.length) {
        setVisibleCount(prev => prev + 50);
      }
    }
  };

  const handleSelectDetail = (nip: string) => {
    photoRequestRef.current?.abort();
    photoRequestRef.current = new AbortController();
    const biodataRequest = ++biodataRequestRef.current;

    const detail = pegawaiDatabase.find((item: any) => item?.nip === nip) || null;
    setSelectedDetailPegawai(detail || null);
    setSelectedDetailBiodata(null);
    setDetailBiodataLoading(!!nip);

    // Muat data biodata dan siapkan detail bersamaan agar tampilan modal muncul utuh
    const biodataPromise = nip
      ? import('../data/database').then(({ getBiodataByNip }) => getBiodataByNip(nip))
      : Promise.resolve(null);

    // Reset photo state and fetch latest presensi photo
    setPegawaiPhoto(null);
    setPhotoLoading(true);
    setPhotoError(false);
    setPhotoMeta(null);
    setLightboxOpen(false);

    if (detail?.id) {
      fetchLastPhoto(detail.id, photoRequestRef.current.signal);
    } else {
      setPhotoLoading(false);
      setPhotoError(true);
    }

    biodataPromise
      .then(bio => {
        if (biodataRequest === biodataRequestRef.current) {
          setSelectedDetailBiodata(bio);
          setDetailBiodataLoading(false);
        }
      })
      .catch(error => {
        console.error('Gagal memuat biodata pegawai:', error);
        if (biodataRequest === biodataRequestRef.current) {
          setDetailBiodataLoading(false);
        }
      });
  };

  // Helper: build photo URL from lampiran value (same logic as TabLog)
  const buildPhotoUrl = (lamp: string): string => {
    if (lamp.startsWith('/9j/') || lamp.startsWith('iVBOR')) {
      return `data:image/jpeg;base64,${lamp}`;
    } else if (lamp.startsWith('http')) {
      return lamp;
    }
    return `/api/proxy-image?path=${encodeURIComponent(lamp)}`;
  };

  // Helper: extract a valid photo URL from a log_detail API response
  // Helper: extract a valid photo URL + metadata from a log_detail API response
  const extractPhotoFromResponse = (res: any): { url: string; jam: string; tanggal: string } | null => {
    if (!res?.data || res.data.length === 0) return null;
    // Scan from newest entry to oldest
    for (let i = res.data.length - 1; i >= 0; i--) {
      const item = res.data[i];
      const lamp = (item.lampiran || item.foto || '').trim();
      if (lamp && lamp !== 'no_image.png' && !lamp.includes('no_image')) {
        return {
          url: buildPhotoUrl(lamp),
          jam: item.jam || '',
          tanggal: item.tanggal || item.tgl || '',
        };
      }
    }
    return null;
  };

  // Format Date to YYYY-MM-DD string
  const toDateStr = (dt: Date): string =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

  // Fetch the most recent presensi photo using a two-phase strategy:
  //   Phase 1: walk back up to 14 calendar days, weekdays only (Mon-Fri) - ~10 API calls max
  //   Phase 2: sample one representative weekday (Wednesday) per month, up to 6 months back
  const fetchLastPhoto = async (idPegawai: string, signal: AbortSignal) => {
    const today = getTodayWIB();
    const [y, m, d] = today.split('-').map(Number);

    // Phase 1: last 14 calendar days, weekdays only
    for (let offset = 0; offset < 14; offset++) {
      const dt = new Date(y, m - 1, d - offset);
      const dow = dt.getDay(); // 0=Sun, 6=Sat
      if (dow < 1 || dow > 5) continue; // skip weekends
      try {
        const res = await sendRequest('/logActivity/log_detail', {
          id_pegawai: idPegawai,
          tanggal: toDateStr(dt),
        }, { signal });
        if (signal.aborted) return;
        const found = extractPhotoFromResponse(res);
        if (found) {
          setPegawaiPhoto(found.url);
          setPhotoMeta({ jam: found.jam, tanggal: found.tanggal || toDateStr(dt) });
          setPhotoLoading(false);
          return;
        }
      } catch {
        if (signal.aborted) return;
        // Keep trying the next date when the request itself fails.
      }
    }

    // Phase 2: sample ~Wednesday of each month, 1-6 months back
    for (let mo = 1; mo <= 6; mo++) {
      // Start at the 15th of the target month, then walk to nearest Wednesday
      const base = new Date(y, m - 1 - mo, 15);
      const diffToWed = (3 - base.getDay() + 7) % 7; // days forward to reach Wed
      base.setDate(base.getDate() + (diffToWed <= 3 ? diffToWed : diffToWed - 7));
      try {
        const res = await sendRequest('/logActivity/log_detail', {
          id_pegawai: idPegawai,
          tanggal: toDateStr(base),
        }, { signal });
        if (signal.aborted) return;
        const found = extractPhotoFromResponse(res);
        if (found) {
          setPegawaiPhoto(found.url);
          setPhotoMeta({ jam: found.jam, tanggal: found.tanggal || toDateStr(base) });
          setPhotoLoading(false);
          return;
        }
      } catch {
        if (signal.aborted) return;
        // Keep trying the next month when the request itself fails.
      }
    }

    // No photo found after all attempts
    if (!signal.aborted) {
      setPhotoLoading(false);
      setPhotoError(true);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <DatabaseIcon className="w-5 h-5 text-blue-500" /> Database Pegawai
        </h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative md:col-span-2">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
            <Search className="w-5 h-5" />
          </span>
          <input 
            type="text" 
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setVisibleCount(50);
            }}
            disabled={!canSearchDatabase}
            placeholder="Cari NIP, Nama, atau ID Pegawai..." 
            className="w-full pl-10 pr-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        <div>
          <button
            type="button"
            onClick={() => setIsOpdModalOpen(true)}
            disabled={!canSearchDatabase}
            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white text-sm text-left flex justify-between items-center cursor-pointer font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="truncate">
              {selectedOpd ? selectedOpd : '-- Semua OPD / Instansi --'}
            </span>
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
          </button>
        </div>
      </div>
      
      <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm flex flex-col bg-white dark:bg-slate-900">
        <div className="grid grid-cols-[150px_1fr_1fr] sm:grid-cols-[180px_1fr_1fr] px-3 py-2.5 sm:px-4 sm:py-3 text-[11px] sm:text-sm font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
          <div className="text-left tracking-wider">NIP</div>
          <div className="text-left tracking-wider">Nama Pegawai</div>
          <div className="text-left tracking-wider">Jabatan</div>
        </div>
        
        <div className="overflow-y-auto max-h-[500px] custom-scrollbar bg-white dark:bg-slate-800" onScroll={handleScroll}>
          {filteredData.length === 0 ? (
            <div className="px-6 py-10 text-center text-slate-500 dark:text-slate-400">
              {loadingPegawai ? (
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-[3px] border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin" />
                  <span className="text-sm font-medium">Memuat database pegawai...</span>
                </div>
              ) : pegawaiLoadError ? (
                <div className="flex flex-col items-center gap-3">
                  <span>{pegawaiLoadError}</span>
                  <button type="button" onClick={() => setLoadAttempt(attempt => attempt + 1)} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                    <RefreshCw className="h-4 w-4" /> Coba lagi
                  </button>
                </div>
              ) : 'Data tidak ditemukan.'}
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-700/50">
              {filteredData.slice(0, visibleCount).map((item: any, index: number) => (
                <div key={index} onClick={() => handleSelectDetail(item.nip)} className="grid grid-cols-[150px_1fr_1fr] sm:grid-cols-[180px_1fr_1fr] px-3 py-2.5 sm:px-4 sm:py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors items-center text-[11px] sm:text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                  <div className="font-mono font-medium truncate" title={item.nip}>{item.nip}</div>
                  <div className="font-medium text-slate-800 dark:text-slate-200 truncate pr-2" title={item.nama}>{item.nama}</div>
                  <div className="text-slate-600 dark:text-slate-400 truncate" title={item.jabatan || '-'}>{item.jabatan || '-'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-end items-center px-2">
        <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">Total: {filteredData.length} pegawai</div>
      </div>

      {/* MODAL DETAIL PEGAWAI */}
      {selectedDetailPegawai && (() => {
        const b = selectedDetailBiodata as any;
        const Field = ({ label, value, className = '' }: { label: string; value?: any; className?: string }) => {
          if (value === null || value === undefined || value === '') return null;
          return (
            <div className={`space-y-0.5 ${className}`}>
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">{label}</div>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-snug break-words">{String(value)}</div>
            </div>
          );
        };
        const Section = ({ title, icon: Icon, children }: any) => (
          <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2 bg-slate-50/80 dark:bg-slate-900/30">
              {Icon && <Icon className="w-4 h-4 text-indigo-500" />}
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">{title}</h4>
            </div>
            <div className="p-4">{children}</div>
          </div>
        );
        const RiwayatTable = ({ title, icon: Icon, rows, columns }: { title: string; icon?: any; rows?: any[]; columns: { key: string; label: string }[] }) => {
          if (!rows || rows.length === 0) return null;
          return (
            <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/30">
                <div className="flex items-center gap-2">
                  {Icon && <Icon className="w-4 h-4 text-indigo-500" />}
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">{title}</h4>
                </div>
                <span className="text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full">{rows.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400">
                      <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">No</th>
                      {columns.map(c => <th key={c.key} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{c.label}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {rows.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 align-top">
                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{r.no || i + 1}</td>
                        {columns.map(c => <td key={c.key} className="px-3 py-2 text-slate-700 dark:text-slate-300">{r[c.key] || '-'}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        };
        const riwayatJabatanGabung = [
          ...(b?.riwayat_jabatan_struktural || []).map((r: any) => ({ ...r, _jenis: 'Struktural' })),
          ...(b?.riwayat_jabatan_fungsional || []).map((r: any) => ({ ...r, _jenis: 'Fungsional', nama_jabatan: r.nama_jabatan_fungsional || r.nama_jabatan || r.jabatan })),
          ...(b?.riwayat_jabatan_pelaksana || []).map((r: any) => ({ ...r, _jenis: 'Pelaksana', nama_jabatan: r.nama_jabatan_pelaksana || r.nama_jabatan || r.jabatan })),
        ];
        const closeDetail = () => { biodataRequestRef.current += 1; setSelectedDetailPegawai(null); setSelectedDetailBiodata(null); setDetailBiodataLoading(false); setPegawaiPhoto(null); setPhotoLoading(false); setPhotoError(false); setPhotoMeta(null); setLightboxOpen(false); };
        return (
        <>
        <div className="modal-layer fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 z-50 animate-fade-in">
          <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-5xl overflow-hidden transform transition-all animate-scale-up flex flex-col max-h-[92vh]">
            <div className="px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 shrink-0">
              <div className="min-w-0">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-base sm:text-lg">
                  <User className="w-5 h-5 text-indigo-500" /> Biodata Pegawai
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{b?.nama || selectedDetailPegawai?.nama} &middot; {selectedDetailPegawai?.nip}</p>
              </div>
              <button onClick={closeDetail} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              {detailBiodataLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 min-h-[320px]">
                  <div className="w-10 h-10 border-[3px] border-indigo-200 dark:border-indigo-800 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Memuat data pegawai & biodata...</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 text-center">Menyiapkan informasi pegawai secara lengkap, mohon tunggu.</p>
                </div>
              ) : (
                <>
              {/* Header profil */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-5 flex flex-col sm:flex-row gap-5 items-center sm:items-start">
                <div
                  className={`relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden border-2 shadow-md bg-slate-100 dark:bg-slate-900 flex-shrink-0 transition-all ${!photoLoading && !photoError && pegawaiPhoto ? 'border-indigo-300 dark:border-indigo-600 cursor-pointer hover:shadow-xl group' : 'border-slate-200 dark:border-slate-700'}`}
                  onClick={() => { if (pegawaiPhoto && !photoLoading) setLightboxOpen(true); }}
                >
                  {photoLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900 gap-2">
                      <div className="w-7 h-7 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                      <span className="text-[10px] text-slate-400 font-medium">Memuat...</span>
                    </div>
                  )}
                  {!photoLoading && photoError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800 gap-1.5">
                      <User className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                      <span className="text-[10px] text-slate-400 text-center">Foto belum tersedia</span>
                    </div>
                  )}
                  {!photoLoading && !photoError && pegawaiPhoto && (
                    <>
                      <LazyImage src={pegawaiPhoto} alt={b?.nama || selectedDetailPegawai?.nama || ''} eager containerClassName="w-full h-full" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      <div className="absolute inset-0 bg-indigo-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><ZoomIn className="w-7 h-7 text-white" /></div>
                    </>
                  )}
                </div>
                <div className="flex-1 min-w-0 text-center sm:text-left space-y-2">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-tight">{b?.nama || selectedDetailPegawai?.nama || '-'}</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">{b?.nama_jabatan || selectedDetailPegawai?.nama_jabatan || selectedDetailPegawai?.jabatan || '-'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{b?.skpd || selectedDetailPegawai?.instansi || '-'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                    {b?.status_kep && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">{b.status_kep}</span>}
                    {b?.status_hukum && <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${String(b.status_hukum).toLowerCase()==='aktif' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'}`}>{b.status_hukum}</span>}
                    {b?.gol && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">{b.gol}</span>}
                    {b?.jenis_jabatan && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">{b.jenis_jabatan}</span>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600 dark:text-slate-300 pt-1">
                    <div><span className="text-slate-400">NIP:</span> <span className="font-mono font-semibold select-all">{selectedDetailPegawai?.nip || '-'}</span></div>
                    {b?.nip_baru && b.nip_baru !== selectedDetailPegawai?.nip && <div><span className="text-slate-400">NIP Baru:</span> <span className="font-mono font-semibold select-all">{b.nip_baru}</span></div>}
                    {b?.nik && <div><span className="text-slate-400">NIK:</span> <span className="font-mono font-semibold select-all">{b.nik}</span></div>}
                    {b?.nuptk && <div><span className="text-slate-400">NUPTK:</span> <span className="font-mono font-semibold select-all">{b.nuptk}</span></div>}
                  </div>
                  {photoMeta && !photoLoading && !photoError && pegawaiPhoto && (
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5 justify-center sm:justify-start"><Camera className="w-3 h-3" /> Foto presensi: {photoMeta.tanggal}{photoMeta.jam ? ` ${photoMeta.jam}` : ''}</div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {b && (
                  <Section title="Biodata Pribadi" icon={User}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="Tempat / Tgl Lahir" value={b.ttl} className="sm:col-span-2" />
                      <Field label="Jenis Kelamin" value={b.jk} />
                      <Field label="Agama" value={b.agama} />
                      <Field label="Status Perkawinan" value={b.perkawinan} />
                      <Field label="Tanggal Nikah" value={b.tgl_nikah} />
                    </div>
                  </Section>
                )}

                {b && (b.hp || b.email || b.alamat) && (
                  <Section title="Kontak & Alamat" icon={Phone}>
                    <div className="space-y-3 text-sm">
                      {b.hp && <div className="flex items-start gap-2"><Phone className="w-4 h-4 mt-0.5 text-emerald-500" /><span className="font-semibold select-all">{b.hp}</span></div>}
                      {b.email && <div className="flex items-start gap-2"><Mail className="w-4 h-4 mt-0.5 text-blue-500" /><span className="font-semibold select-all break-all">{b.email}</span></div>}
                      {b.alamat && <div className="flex items-start gap-2"><MapPin className="w-4 h-4 mt-0.5 text-rose-500" /><span className="font-medium leading-snug">{b.alamat}</span></div>}
                    </div>
                  </Section>
                )}

                <Section title="Kepegawaian & Jabatan" icon={DatabaseIcon}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="SKPD / Instansi" value={b?.skpd || selectedDetailPegawai?.instansi} className="sm:col-span-2" />
                    <Field label="Jabatan Saat Ini" value={b?.nama_jabatan || selectedDetailPegawai?.nama_jabatan || selectedDetailPegawai?.jabatan} className="sm:col-span-2" />
                    <Field label="Jenis Jabatan" value={b?.jenis_jabatan || selectedDetailPegawai?.tipe_jabatan} />
                    <Field label="Status Jabatan" value={b?.status_jabatan} />
                    <Field label="TMT Jabatan" value={b?.tmt_jabatan} />
                    <Field label="Status Kepegawaian" value={b?.status_kep || selectedDetailPegawai?.status_pegawai} />
                    <Field label="Status Hukum" value={b?.status_hukum} />
                    <Field label="Asal Kepegawaian" value={b?.asal_kepegawaian} />
                    <Field label="Golongan / Pangkat" value={b?.gol} />
                    <Field label="TMT Pangkat" value={b?.tmt_pangkat} />
                    <Field label="Masa Kerja (Pangkat)" value={b?.masa_kerja_pangkat} />
                    <Field label="Masa Kerja (Keseluruhan)" value={b?.masa_kerja_keseluruhan} />
                    <Field label="Sumber Gaji" value={b?.sumber_gaji} />
                    <Field label="Wilayah Pembayaran" value={b?.wilayah_pembayaran} />
                    <Field label="TMT Pensiun" value={b?.tmt_pensiun} />
                    {selectedDetailPegawai?.kelas_jabatan && <Field label="Kelas Jabatan" value={selectedDetailPegawai.kelas_jabatan} />}
                    {selectedDetailPegawai?.jam_kerja && <Field label="Jam Kerja" value={selectedDetailPegawai.jam_kerja} />}
                    {selectedDetailPegawai?.norekening && <Field label="No. Rekening" value={selectedDetailPegawai.norekening} />}
                  </div>
                </Section>

                {b?.pdd_jenjang && (
                  <Section title="Pendidikan Terakhir" icon={BookOpen}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="Jenjang" value={b.pdd_jenjang} />
                      <Field label="Tahun Lulus" value={b.pdd_lulus} />
                      <Field label="Sekolah / Universitas" value={b.pdd_sekolah} className="sm:col-span-2" />
                      <Field label="Jurusan" value={b.pdd_jurusan} className="sm:col-span-2" />
                      <Field label="Prodi / Jurusan" value={b.pdd_prodi} className="sm:col-span-2" />
                    </div>
                  </Section>
                )}
              </div>

              {/* Keluarga */}
              {(b?.pasangan?.length > 0 || b?.anak?.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {b?.pasangan?.length > 0 && (
                    <Section title={`Suami / Istri (${b.pasangan.length})`} icon={Users}>
                      <div className="space-y-2">
                        {b.pasangan.map((p: any, i: number) => (
                          <div key={i} className="bg-pink-50 dark:bg-pink-900/10 border border-pink-100 dark:border-pink-800/30 rounded-lg p-3 space-y-0.5">
                            <div className="font-bold text-slate-900 dark:text-white text-sm">{p.nama}</div>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-600 dark:text-slate-300">
                              {p.status && <span className="font-semibold text-pink-600 dark:text-pink-400">{p.status}</span>}
                              {p.ttl && <span>{p.ttl}</span>}
                              {p.pekerjaan && <span>Pekerjaan: {p.pekerjaan}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}
                  {b?.anak?.length > 0 && (
                    <Section title={`Anak (${b.anak.length})`} icon={Baby}>
                      <div className="space-y-2">
                        {b.anak.map((a: any, i: number) => (
                          <div key={i} className="bg-sky-50 dark:bg-sky-900/10 border border-sky-100 dark:border-sky-800/30 rounded-lg p-3 space-y-1">
                            <div className="font-bold text-slate-900 dark:text-white text-sm">{i + 1}. {a.nama}</div>
                            {a.ttl && <div className="text-xs text-slate-500 dark:text-slate-400">{a.ttl}</div>}
                            <div className="flex gap-2 flex-wrap">
                              {a.status && <span className="text-[10px] bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 px-1.5 py-0.5 rounded font-semibold">{a.status}</span>}
                              {a.tunjangan && <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded font-semibold">Tunjangan: {a.tunjangan}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}
                </div>
              )}

              {/* Riwayat */}
              {b && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pt-2">
                    <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                    <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Riwayat Kepegawaian</span>
                    <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                  </div>
                  <RiwayatTable title="Riwayat Pangkat / Golongan" icon={DatabaseIcon} rows={b.riwayat_pangkat} columns={[
                    { key: 'gol_ruang_pangkat', label: 'Pangkat / Gol' },
                    { key: 'jenis_kp', label: 'Jenis KP' },
                    { key: 'tmt_pangkat', label: 'TMT' },
                    { key: 'masa_kerja_tahun', label: 'MK Th' },
                    { key: 'masa_kerja_bulan', label: 'MK Bl' },
                    { key: 'keterangan', label: 'Keterangan' },
                  ]} />
                  {riwayatJabatanGabung.length > 0 && (
                    <RiwayatTable title="Riwayat Jabatan (Mutasi)" icon={DatabaseIcon} rows={riwayatJabatanGabung} columns={[
                      { key: '_jenis', label: 'Jenis' },
                      { key: 'nama_jabatan', label: 'Jabatan' },
                      { key: 'instansi', label: 'Instansi / Unit' },
                      { key: 'tmt_jabatan', label: 'TMT' },
                      { key: 'nomor_sk', label: 'No. SK' },
                      { key: 'tanggal_sk', label: 'Tgl SK' },
                    ]} />
                  )}
                  <RiwayatTable title="Riwayat Gaji Berkala" icon={DatabaseIcon} rows={b.riwayat_gaji_berkala} columns={[
                    { key: 'gol_ruang_pangkat_berkala', label: 'Gol/Pangkat' },
                    { key: 'masa_kerja_tahun', label: 'MK Th' },
                    { key: 'masa_kerja_bulan', label: 'MK Bl' },
                    { key: 'tmt_berkala', label: 'TMT Berkala' },
                  ]} />
                  <RiwayatTable title="Riwayat Pendidikan" icon={BookOpen} rows={b.riwayat_pendidikan} columns={[
                    { key: 'jenjang', label: 'Jenjang' },
                    { key: 'nama_sekolah', label: 'Sekolah / Universitas' },
                    { key: 'prodi_jurusan', label: 'Prodi / Jurusan' },
                    { key: 'tahun_lulus', label: 'Tahun Lulus' },
                  ]} />
                  <RiwayatTable title="Riwayat Diklat / Sertifikasi / Pelatihan" icon={BookOpen} rows={b.riwayat_diklat} columns={[
                    { key: 'nama_diklat', label: 'Nama Diklat' },
                    { key: 'no_sertifikat', label: 'No. Sertifikat' },
                    { key: 'tgl_sertifikat', label: 'Tgl Sertifikat' },
                    { key: 'tahun', label: 'Tahun' },
                  ]} />
                  <RiwayatTable title="Riwayat SKP" icon={DatabaseIcon} rows={b.riwayat_skp} columns={[
                    { key: 'tahun', label: 'Tahun' },
                    { key: 'angka', label: 'Nilai' },
                    { key: 'quadran_kinerja', label: 'Kinerja' },
                  ]} />
                  <RiwayatTable title="Riwayat Pernikahan" icon={Users} rows={b.pernikahan} columns={[
                    { key: 'status_pernikahan', label: 'Status' },
                    { key: 'tgl_pernikahan', label: 'Tanggal' },
                  ]} />
                </div>
              )}

              {/* ID Teknis */}
              <div className="bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 mb-2">Informasi Teknis</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono break-all space-y-1">
                  <div>GUID Pegawai: <span className="select-all">{selectedDetailPegawai?.id || '-'}</span></div>
                  {selectedDetailPegawai?.id_jabatan && <div>GUID Jabatan: <span className="select-all">{selectedDetailPegawai.id_jabatan}</span></div>}
                  {selectedDetailPegawai?.emei && <div>Device EMEI: <span className="select-all">{selectedDetailPegawai.emei}</span></div>}
                </div>
              </div>
                </>
              )}
            </div>

            <div className="px-5 sm:px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end bg-white dark:bg-slate-800 shrink-0">
              <button onClick={closeDetail} className="px-6 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-sm transition-colors cursor-pointer">
                Tutup
              </button>
            </div>
          </div>
        </div>

        {lightboxOpen && pegawaiPhoto && (
          <ImageLightbox
            src={pegawaiPhoto}
            title={`${b?.nama || selectedDetailPegawai?.nama || 'Pegawai'} — ${formatBeautifulDateTime(photoMeta?.jam || photoMeta?.tanggal || '')}`}
            onClose={() => setLightboxOpen(false)}
          />
        )}
        </>
        );
      })()}

      {/* OPD SEARCH MODAL */}
      {isOpdModalOpen && (
        <div className="modal-layer fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-scale-up flex flex-col max-h-[75vh]">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/40 shrink-0">
              <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-sm uppercase tracking-wider">
                Pilih OPD / Instansi
              </h3>
              <button 
                onClick={() => {
                  setIsOpdModalOpen(false);
                  setOpdSearchQuery('');
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Search Input inside OPD Modal */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                  <Search className="w-4 h-4" />
                </span>
                <input 
                  type="text" 
                  value={opdSearchQuery}
                  onChange={e => setOpdSearchQuery(e.target.value)}
                  placeholder="Ketik untuk mencari OPD..." 
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white text-xs font-semibold"
                  autoFocus
                />
              </div>
            </div>

            {/* Scrollable list of OPD options */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 bg-slate-50/50 dark:bg-slate-900/20 divide-y divide-slate-100 dark:divide-slate-700/50">
              {/* Option to clear selection: Semua OPD */}
              <button
                type="button"
                onClick={() => {
                  setSelectedOpd('');
                  setIsOpdModalOpen(false);
                  setOpdSearchQuery('');
                  setVisibleCount(50);
                }}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all text-xs font-bold flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer ${!selectedOpd ? 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20' : 'text-slate-700 dark:text-slate-300'}`}
              >
                <span>-- Semua OPD / Instansi --</span>
                {!selectedOpd && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
              </button>

              {/* Filtered OPD options */}
              {filteredOpdList
                .map((opdName, idx) => {
                  const isSelected = selectedOpd === opdName;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSelectedOpd(opdName);
                        setIsOpdModalOpen(false);
                        setOpdSearchQuery('');
                        setVisibleCount(50);
                      }}
                      className={`w-full text-left px-4 py-3 rounded-xl transition-all text-xs font-bold flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer ${isSelected ? 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20' : 'text-slate-700 dark:text-slate-300'}`}
                    >
                      <span className="pr-4">{opdName}</span>
                      {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />}
                    </button>
                  );
                })}
              
              {/* Empty state inside modal */}
              {filteredOpdList.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-400 italic">OPD tidak ditemukan.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
