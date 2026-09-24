import React, { Suspense, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { 
  LogIn, Camera, FileText, Activity, FileCheck, Database as DatabaseIcon, 
  Menu, Moon, Sun, UserCircle, ChevronLeft, ChevronRight, LogOut, X, 
  Edit3, BarChart3, Building2, Network 
} from 'lucide-react';
import { useDarkMode } from './hooks/useDarkMode';
import { AppProvider, useAppContext } from './context/AppContext';
import LoginServer from './pages/LoginServer';

type PageModule = { default: React.ComponentType };
const pageImporters = {
  tabAbsen: () => import('./pages/Presensi'),
  tabLog: () => import('./pages/LogPresensi'),
  tabInputAktivitas: () => import('./pages/Produktivitas'),
  tabAktivitas: () => import('./pages/LogProduktivitas'),
  tabIzin: () => import('./pages/Izin'),
  tabLogPresensiInstansi: () => import('./pages/LogPresensiInstansi'),
  tabReview: () => import('./pages/ReviewProduktivitas'),
  tabDatabase: () => import('./pages/Database'),
  tabUnor: () => import('./pages/Unor'),
  tabReport: () => import('./pages/Laporan'),
} satisfies Record<string, () => Promise<PageModule>>;

const pageModuleCache = new Map<string, Promise<PageModule>>();
const loadPageModule = (pageId: string): Promise<PageModule> => {
  const importer = pageImporters[pageId as keyof typeof pageImporters];
  if (!importer) return Promise.reject(new Error(`Halaman ${pageId} tidak tersedia.`));
  const cached = pageModuleCache.get(pageId);
  if (cached) return cached;
  const promise = importer().catch(error => {
    pageModuleCache.delete(pageId);
    throw error;
  });
  pageModuleCache.set(pageId, promise);
  return promise;
};

function LazyPage({ pageId }: { pageId: string }) {
  const module = React.use(loadPageModule(pageId));
  const Component = module.default;
  return <Component />;
}

const lazyPage = (pageId: string): React.ComponentType => () => <LazyPage pageId={pageId} />;
const Presensi = lazyPage('tabAbsen');
const LogPresensi = lazyPage('tabLog');
const Produktivitas = lazyPage('tabInputAktivitas');
const LogProduktivitas = lazyPage('tabAktivitas');
const Izin = lazyPage('tabIzin');
const LogPresensiInstansi = lazyPage('tabLogPresensiInstansi');
const ReviewProduktivitas = lazyPage('tabReview');
const Database = lazyPage('tabDatabase');
const Unor = lazyPage('tabUnor');
const Laporan = lazyPage('tabReport');

import LoginScreen from './components/LoginScreen';
import SettingAkunModal from './components/SettingAkunModal';
import DeveloperInspector from './components/DeveloperInspector';
import { db } from './lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { sendRequest } from './api';
import { decryptPayload } from './lib/encryption';
import { getServerLoginCache } from './lib/cacheManager';
import { loadSession, touchSession, clearAllSessions } from './lib/sessionManager';

const PAGES = [
  { id: 'tabLogin', icon: LogIn, label: 'Login Info', component: LoginServer, path: '/login-info' },
  { id: 'tabAbsen', icon: Camera, label: 'Submit Presensi', component: Presensi, path: '/submit-presensi' },
  { id: 'tabLog', icon: FileText, label: 'History Presensi', component: LogPresensi, path: '/history-presensi' },
  { id: 'tabInputAktivitas', icon: Edit3, label: 'Produktivitas Harian', component: Produktivitas, path: '/produktivitas-harian' },
  { id: 'tabAktivitas', icon: Activity, label: 'History Produktivitas', component: LogProduktivitas, path: '/history-produktivitas' },
  { id: 'tabReview', icon: BarChart3, label: 'Review Produktivitas', component: ReviewProduktivitas, path: '/review-produktivitas' },
  { id: 'tabIzin', icon: FileCheck, label: 'Izin/Cuti', component: Izin, path: '/izin-cuti' },
  { id: 'tabLogPresensiInstansi', icon: Building2, label: 'History Presensi Instansi', component: LogPresensiInstansi, path: '/history-presensi-instansi' },
  { id: 'tabDatabase', icon: DatabaseIcon, label: 'Database Pegawai', component: Database, path: '/database-pegawai' },
  { id: 'tabUnor', icon: Network, label: 'Struktur Organisasi', component: Unor, path: '/struktur-organisasi' },
  { id: 'tabReport', icon: FileText, label: 'Laporan', component: Laporan, path: '/laporan' }
];

function Clock() {
  const [time, setTime] = useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="hidden sm:flex items-center gap-2.5 bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-200/50 dark:border-slate-700/50 shadow-sm transition-all hover:shadow-md">
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
      </span>
      <span className="text-xs font-mono font-medium tracking-tight text-slate-700 dark:text-slate-200">
        {time.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false })} 
      </span>
      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">WIB</span>
    </div>
  );
}

function PageLoading() {
  return (
    <div className="w-full space-y-6 animate-pulse" aria-label="Memuat halaman" role="status">
      <div className="h-8 w-48 rounded-lg bg-slate-200/60 dark:bg-slate-800/60" />
      <div className="h-32 w-full rounded-2xl bg-slate-200/50 dark:bg-slate-800/50" />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-40 rounded-2xl bg-slate-200/40 dark:bg-slate-800/40" />
        <div className="h-40 rounded-2xl bg-slate-200/40 dark:bg-slate-800/40" />
        <div className="h-40 rounded-2xl bg-slate-200/40 dark:bg-slate-800/40 hidden lg:block" />
      </div>
      <span className="sr-only">Memuat halaman...</span>
    </div>
  );
}

class PageErrorBoundary extends React.Component<React.PropsWithChildren<{ pageId: string }>, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  retry = () => {
    pageModuleCache.delete(this.props.pageId);
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex flex-col items-center justify-center p-8 rounded-3xl border border-rose-200/50 bg-rose-50/50 dark:border-rose-900/30 dark:bg-rose-950/20 backdrop-blur-sm text-center">
        <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mb-4">
          <X className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-semibold text-rose-900 dark:text-rose-200">Gagal Memuat Halaman</h3>
        <p className="mt-2 text-sm text-rose-600/80 dark:text-rose-300/80 max-w-md">
          Terjadi kesalahan saat mencoba memuat komponen ini. Sesi Anda tetap aman. Silakan coba muat ulang.
        </p>
        <button 
          type="button" 
          onClick={this.retry} 
          className="mt-6 rounded-xl bg-rose-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950 transition-all active:scale-95"
        >
          Coba Lagi
        </button>
      </div>
    );
  }
}

function MainApp({ onLogout, isDarkMode, toggleDarkMode }: { onLogout: () => void, isDarkMode: boolean, toggleDarkMode: () => void }) {
  const { pegawai, setPegawai, setConfig, setLoginForm, activePage, setActivePage, tabPermissions, currentUser, userRole, setCurrentUser, autoLoginTrigger, developerMode, setDeveloperMode } = useAppContext();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  // Filter pages berdasarkan permissions
  const visiblePages = PAGES.filter(page => {
    if (userRole === 'admin') return true;
    if (page.id === 'tabLogin') return true;
    if (page.id === 'tabReview') return true;
    return (tabPermissions as any)[page.id] === true;
  });

  React.useEffect(() => {
    if (!pegawai && !currentUser && activePage !== 'tabLogin') {
      setActivePage('tabLogin');
    }
  }, [pegawai, currentUser, activePage, setActivePage]);

  const handleLogout = () => {
    setCurrentUser(null);
    onLogout();
  };

  const lastHandledAutoLogin = React.useRef(0);
  React.useEffect(() => {
    if (autoLoginTrigger === 0) return;
    if (lastHandledAutoLogin.current === autoLoginTrigger) return;
    lastHandledAutoLogin.current = autoLoginTrigger;

    const runAutoLogin = async () => {
      if (pegawai) return;
      if (!currentUser || !currentUser.username) return;

      try {
        const jadhumanUsername = currentUser.username;
        const cached = getServerLoginCache(jadhumanUsername);
        
        if (cached && cached.serverUsername && cached.serverPassword) {
          setLoginForm({ username: cached.serverUsername, password: cached.serverPassword });
          setPegawai(cached.pegawai);
          setConfig(prev => ({
            ...prev,
            idPegawai:    cached.config.idPegawai    || prev.idPegawai,
            deviceId:     cached.config.deviceId     || prev.deviceId,
            latitude:     cached.config.latitude     || prev.latitude,
            longitude:    cached.config.longitude    || prev.longitude,
            idLokasi:     cached.config.idLokasi     || prev.idLokasi,
            kodeInstansi: cached.config.kodeInstansi || prev.kodeInstansi,
            kodeUnor:     cached.config.kodeUnor     || prev.kodeUnor,
          }));
          return;
        }

        const docKey = `login_${jadhumanUsername.replace(/[^a-zA-Z0-9_]/g, '_')}`;
        const docSnap = await getDoc(doc(db, 'settings', docKey));
        if (!docSnap.exists()) return;

        const storedRaw = docSnap.data();
        let stored: Record<string, any> = storedRaw;
        
        if (storedRaw.encrypted && typeof storedRaw.encrypted === 'string') {
          const encStr: string = storedRaw.encrypted;
          if (encStr.startsWith('ENC$') && encStr.endsWith('$SEC')) {
            const decoded = decryptPayload(encStr);
            if (decoded && Object.keys(decoded).length > 0) {
              stored = decoded;
            }
          }
        }

        if (!stored.username || !stored.password) return;
        setLoginForm({ username: stored.username, password: stored.password });

        const payload = {
          username: stored.username,
          password: stored.password,
          versi: stored.versi || '2.0.0',
        };
        
        const data = await sendRequest('/login/do_LoginMobile', payload);
        if (data?.success) {
          setPegawai({ ...data, password: stored.password });
          setConfig(prev => ({
            ...prev,
            idPegawai:    data.id || data.id_pegawai || stored.idPegawai || prev.idPegawai,
            deviceId:     data.emai || data.imei || data.device_id || stored.deviceId || prev.deviceId,
            latitude:     data.lat || data.latitude || stored.latitude || prev.latitude,
            longitude:    data.long || data.longitude || data.longtitude || stored.longitude || prev.longitude,
            idLokasi:     data.id_lokasi || stored.idLokasi || prev.idLokasi,
            kodeInstansi: data.kode_instansi || stored.kodeInstansi || prev.kodeInstansi,
            kodeUnor:     data.kode_unor || stored.kodeUnor || prev.kodeUnor,
          }));
        }
      } catch (err) {
        console.error('Background auto-login error:', err);
      }
    };
    runAutoLogin();
  }, [autoLoginTrigger]);

  React.useEffect(() => {
    if (autoLoginTrigger > 0) return;
    if (!currentUser?.username) return;
    if (pegawai) return;

    const jadhumanUsername = currentUser.username;
    const cached = getServerLoginCache(jadhumanUsername);
    if (cached && cached.serverUsername && cached.serverPassword) {
      setLoginForm({ username: cached.serverUsername, password: cached.serverPassword });
      setPegawai(cached.pegawai);
      setConfig(prev => ({
        ...prev,
        idPegawai:    cached.config.idPegawai    || prev.idPegawai,
        deviceId:     cached.config.deviceId     || prev.deviceId,
        latitude:     cached.config.latitude     || prev.latitude,
        longitude:    cached.config.longitude    || prev.longitude,
        idLokasi:     cached.config.idLokasi     || prev.idLokasi,
        kodeInstansi: cached.config.kodeInstansi || prev.kodeInstansi,
        kodeUnor:     cached.config.kodeUnor     || prev.kodeUnor,
      }));
    }
  }, [currentUser]);

  React.useEffect(() => {
    const handlePopState = (_e: PopStateEvent) => {
      const handlers = (window as any).customBackHandlers || [];
      if (handlers.length > 0) {
        const currentPage = PAGES.find(page => page.id === activePage) || PAGES[0];
        const path = currentPage.path || '/login-info';
        window.history.pushState(null, '', path);
        const lastHandler = handlers[handlers.length - 1];
        lastHandler();
        return;
      }

      if (isPinModalOpen) {
        setIsPinModalOpen(false);
        const currentPage = PAGES.find(page => page.id === activePage) || PAGES[0];
        window.history.pushState(null, '', currentPage.path || '/login-info');
        return;
      }

      if (isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
        const currentPage = PAGES.find(page => page.id === activePage) || PAGES[0];
        window.history.pushState(null, '', currentPage.path || '/login-info');
        return;
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isPinModalOpen, isMobileMenuOpen, activePage]);

  React.useEffect(() => {
    const closeInspector = () => setDeveloperMode(false);
    window.addEventListener('close-developer-inspector', closeInspector);
    return () => window.removeEventListener('close-developer-inspector', closeInspector);
  }, [setDeveloperMode]);

  const activePageData = (() => {
    const found = PAGES.find(page => page.id === activePage);
    if (!found) return visiblePages[0] || PAGES[0];
    const isAllowed = userRole === 'admin' || visiblePages.some(page => page.id === activePage);
    if (!isAllowed) {
      const fallback = visiblePages[0] || PAGES[0];
      if (typeof window !== 'undefined' && window.location.pathname !== fallback.path) {
        window.history.replaceState(null, '', fallback.path);
      }
      return fallback;
    }
    return found;
  })();
  
  const ActiveComponent = activePageData.component;
  const isExpanded = isSidebarExpanded || isMobileMenuOpen;

  return (
    <div className="bg-slate-50 dark:bg-[#0B1120] text-slate-800 dark:text-slate-200 font-sans h-[100dvh] w-full flex transition-colors duration-300 overflow-hidden relative">
      
      {/* Sidebar - Preserved Layout Structure */}
      <aside className={`bg-[#0F172A] dark:bg-[#070B14] border-r border-slate-800/50 flex flex-col h-full fixed inset-y-0 left-0 lg:relative lg:inset-y-auto lg:left-auto lg:flex transition-all duration-300 ease-in-out z-40 shadow-2xl lg:shadow-none ${isSidebarExpanded ? 'w-64' : 'w-[84px]'} ${isMobileMenuOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'}`}>
        
        {/* Sidebar Header */}
        <div className="h-[72px] flex items-center px-5 border-b border-slate-800/60 justify-between shrink-0">
          <div className="flex items-center gap-3 overflow-hidden group cursor-pointer" onClick={() => setIsPinModalOpen(true)} title="Pengaturan Password Jadhuman">
            <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 p-0.5 shadow-lg shadow-blue-500/20 transition-all duration-300 group-hover:scale-105 group-hover:shadow-blue-500/40">
              <div className="w-full h-full bg-[#0F172A] dark:bg-[#070B14] rounded-full p-0.5 flex items-center justify-center overflow-hidden">
                <img src="/assets/jadhuman.png" alt="Logo" className="w-full h-full scale-110 object-contain" style={{ clipPath: 'circle(50%)' }} />
              </div>
            </div>
            <span className={`overflow-hidden whitespace-nowrap font-bold text-lg tracking-tight text-white font-display transition-[max-width,opacity,margin] duration-300 ${isExpanded ? 'ml-0 max-w-[160px] opacity-100' : 'ml-0 max-w-0 opacity-0'}`}>JADHUMAN</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-slate-400 hover:text-white flex-shrink-0 transition-colors p-1.5 rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Desktop Toggle Button */}
        <button 
          onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
          className="hidden lg:flex absolute top-[84px] -right-3.5 w-7 h-7 bg-[#1E293B] dark:bg-[#0F172A] border border-slate-700/80 rounded-full items-center justify-center text-slate-400 hover:text-white shadow-lg transition-transform hover:scale-110 z-50 focus:outline-none"
        >
          {isSidebarExpanded ? <ChevronLeft className="w-4 h-4 ml-0.5" /> : <ChevronRight className="w-4 h-4 ml-0.5" />}
        </button>
        
        {/* Navigation Links - Preserved Horizontal Alignment */}
        <div className="flex-1 overflow-y-auto py-5 px-3.5 space-y-1.5 custom-scrollbar">
          {visiblePages.map((page) => {
            const isActive = page.id === activePage;
            const Icon = page.icon;
            return (
              <button
                key={page.id}
                onClick={() => {
                  setActivePage(page.id);
                  setIsMobileMenuOpen(false);
                }}
                onMouseEnter={() => { if (page.id !== 'tabLogin') void loadPageModule(page.id); }}
                onFocus={() => { if (page.id !== 'tabLogin') void loadPageModule(page.id); }}
                className={`w-full h-11 relative flex items-center rounded-xl text-left font-medium transition-all duration-200 group px-3.5 ${
                  isActive
                    ? 'bg-blue-600/10 text-blue-400'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
                title={!isExpanded ? page.label : undefined}
              >
                {/* Active Indicator Line */}
                {isActive && (
                  <motion.div layoutId="activeNav" className="absolute left-0 top-2 bottom-2 w-1 bg-blue-500 rounded-r-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                )}
                
                <Icon className={`w-5 h-5 shrink-0 transition-colors ${isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                
                <span className={`truncate text-sm transition-[max-width,opacity,margin] duration-300 ${isExpanded ? 'ml-3.5 max-w-[180px] opacity-100' : 'ml-0 max-w-0 opacity-0'}`}>{page.label}</span>
              </button>
            );
          })}
        </div>
        
        {/* User Info & Logout Footer */}
        <div className="mt-auto p-3.5 border-t border-slate-800/60 space-y-2.5 bg-gradient-to-b from-transparent to-slate-900/50 shrink-0">
          {currentUser && (
            <div className="min-h-[58px] overflow-hidden rounded-xl border border-slate-700/50 bg-[#1E293B]/50 p-3 backdrop-blur-sm transition-colors duration-300 dark:bg-[#0B1120]/50" title={`Sesi: ${currentUser.displayName || currentUser.username} (${currentUser.role})`}>
              <div className={`flex min-w-0 items-center transition-[gap,justify-content] duration-300 ${isExpanded ? 'justify-start gap-2' : 'justify-center'}`}>
                <div className={`min-w-0 overflow-hidden transition-[max-width,opacity] duration-300 ${isExpanded ? 'max-w-[150px] flex-1 opacity-100' : 'max-w-0 opacity-0'}`}>
                  <p className="mb-1.5 truncate text-[10px] font-bold uppercase leading-none tracking-widest text-slate-500">Sesi Login Aktif</p>
                  <p className="truncate text-sm font-semibold text-slate-200">{currentUser.displayName || currentUser.username}</p>
                </div>
                <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider transition-colors duration-300 ${
                  currentUser.role === 'admin'
                    ? 'border-indigo-500/20 bg-indigo-500/10 text-indigo-400'
                    : 'border-amber-500/20 bg-amber-500/10 text-amber-400'
                }`}>
                  {isExpanded ? currentUser.role : currentUser.role === 'admin' ? 'ADM' : 'USR'}
                </span>
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="w-full h-11 flex items-center rounded-xl text-left font-medium transition-all duration-200 group text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 px-3.5"
            title={!isExpanded ? 'Keluar Aplikasi' : undefined}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span className={`truncate text-sm transition-[max-width,opacity,margin] duration-300 ${isExpanded ? 'ml-3.5 max-w-[120px] opacity-100' : 'ml-0 max-w-0 opacity-0'}`}>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-30 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 h-[100dvh] relative overflow-hidden transition-all duration-300 ${isMobileMenuOpen ? 'blur-sm pointer-events-none lg:blur-none lg:pointer-events-auto' : ''}`}>
        
        {/* Glassmorphism Header */}
        <header className="h-[72px] bg-slate-100/80 dark:bg-[#0B1120]/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between px-4 sm:px-8 transition-colors duration-300 shrink-0 z-20 shadow-sm dark:shadow-slate-900/50">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors active:scale-95">
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex flex-col">
              <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 truncate max-w-[150px] sm:max-w-none font-display tracking-tight">{activePageData.label}</h2>
            </div>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-4">
            <Clock />
            
            {/* User Profile Badge */}
            {pegawai && (
              <button 
                onClick={() => setActivePage('tabLogin')} 
                className="flex items-center gap-2.5 bg-white/50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700 p-1 sm:pl-2 sm:pr-4 sm:py-1.5 rounded-full border border-slate-200 dark:border-slate-700/80 transition-all shadow-sm hover:shadow-md cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                {pegawai.foto ? (
                  <img 
                    src={`/api/proxy-image?path=${encodeURIComponent(pegawai.foto)}`}
                    alt={pegawai.nama} 
                    className="w-8 h-8 sm:w-7 sm:h-7 rounded-full object-cover aspect-square border border-slate-200 dark:border-slate-600 shrink-0 shadow-inner"
                  />
                ) : (
                  <div className="w-8 h-8 sm:w-7 sm:h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0 border border-slate-300 dark:border-slate-600">
                    <UserCircle className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                  </div>
                )}
                <span className="hidden sm:block text-sm font-semibold text-slate-700 dark:text-slate-200 max-w-[130px] truncate">
                  {pegawai.nama?.split(' ')[0] || 'User'}
                </span>
              </button>
            )}

            {/* Dark Mode Toggle */}
            <button 
              onClick={toggleDarkMode} 
              className="p-2 sm:p-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 flex-shrink-0 active:scale-95 border border-transparent dark:hover:border-slate-700"
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto custom-scrollbar relative">
          <main className="flex-1 min-w-0 overflow-x-hidden p-4 sm:p-6 lg:p-8 w-full">
            <div className="mx-auto min-w-0 w-full max-w-[1600px]">
              <PageErrorBoundary key={activePageData.id} pageId={activePageData.id}>
                <Suspense fallback={<PageLoading />}>
                  <motion.div
                    key={activePageData.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                  >
                    <ActiveComponent />
                  </motion.div>
                </Suspense>
              </PageErrorBoundary>
            </div>
          </main>
        </div>
      </div>

      <AnimatePresence>
        {isPinModalOpen && (
          <SettingAkunModal onClose={() => setIsPinModalOpen(false)} />
        )}
      </AnimatePresence>

      <DeveloperInspector enabled={developerMode} />
    </div>
  );
}

export default function App() {
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!loadSession();
  });

  const redirectPath = React.useMemo(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path !== '/' && path !== '/login') {
        return path;
      }
    }
    return null;
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = React.useCallback(() => {
    clearAllSessions();
    setIsAuthenticated(false);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/login');
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isAuthenticated) {
      if (window.location.pathname !== '/login') {
        window.history.replaceState(null, '', '/login');
      }
    } else {
      if (window.location.pathname === '/login' || window.location.pathname === '/') {
        const target = redirectPath || '/login-info';
        window.history.replaceState(null, '', target);
        window.dispatchEvent(new Event('popstate'));
      }
    }
  }, [isAuthenticated, redirectPath]);

  React.useEffect(() => {
    if (!isAuthenticated || typeof window === 'undefined') return;

    const checkSession = () => {
      const session = loadSession();
      if (!session) {
        handleLogout();
      }
    };

    const resetSessionTimer = () => {
      touchSession();
    };

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach(event => {
      window.addEventListener(event, resetSessionTimer);
    });

    const interval = setInterval(checkSession, 10000);

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetSessionTimer);
      });
      clearInterval(interval);
    };
  }, [isAuthenticated, handleLogout]);

  return (
    <AppProvider>
      <AnimatePresence mode="wait">
        {!isAuthenticated ? (
          <motion.div
            key="login"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            style={{ minHeight: '100vh' }}
          >
            <LoginScreen onLogin={handleLogin} isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />
          </motion.div>
        ) : (
          <motion.div
            key="app"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeInOut' }}
            style={{ minHeight: '100vh' }}
          >
            <MainApp onLogout={handleLogout} isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />
          </motion.div>
        )}
      </AnimatePresence>
    </AppProvider>
  );
}
