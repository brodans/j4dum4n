export interface PasanganRecord {
  nama: string;
  status?: string;
  ttl?: string;
  pekerjaan?: string;
}

export interface AnakRecord {
  nama: string;
  ttl?: string;
  status?: string;
  tunjangan?: string;
}

export interface BiodataRecord {
  nama?: string;
  nik?: string;
  nip_baru?: string;
  nuptk?: string;
  ttl?: string;
  jk?: string;
  agama?: string;
  perkawinan?: string;
  alamat?: string;
  email?: string;
  hp?: string;
  status_kep?: string;
  sumber_gaji?: string;
  wilayah_pembayaran?: string;
  skpd?: string;
  asal_kepegawaian?: string;
  status_hukum?: string;
  gol?: string;
  tmt_pangkat?: string;
  masa_kerja_pangkat?: string;
  masa_kerja_keseluruhan?: string;
  jenis_jabatan?: string;
  nama_jabatan?: string;
  tmt_jabatan?: string;
  status_jabatan?: string;
  tmt_pensiun?: string;
  pdd_jenjang?: string;
  pdd_sekolah?: string;
  pdd_jurusan?: string;
  pdd_prodi?: string;
  pdd_lulus?: string;
  tgl_nikah?: string;
  pasangan?: PasanganRecord[];
  anak?: AnakRecord[];
  pernikahan?: Record<string, string>[];
  riwayat_pangkat?: Record<string, string>[];
  riwayat_gaji_berkala?: Record<string, string>[];
  riwayat_pendidikan?: Record<string, string>[];
  riwayat_jabatan_struktural?: Record<string, string>[];
  riwayat_jabatan_fungsional?: Record<string, string>[];
  riwayat_jabatan_pelaksana?: Record<string, string>[];
  riwayat_diklat?: Record<string, string>[];
  riwayat_skp?: Record<string, string>[];
}

let biodataCache: Record<string, BiodataRecord> | null = null;
let biodataPromise: Promise<Record<string, BiodataRecord>> | null = null;

function resolveRefs(v: any, table: string[]): any {
  if (v == null) return v;
  if (Array.isArray(v)) return v.map(x => resolveRefs(x, table));
  if (typeof v === 'object') {
    if (typeof (v as any).$ === 'number' && table) {
      const s = table[(v as any).$];
      return s !== undefined ? s : v;
    }
    const o: any = {};
    for (const k in v) o[k] = resolveRefs(v[k], table);
    return o;
  }
  return v;
}

function decodeBiodata(data: any): Record<string, BiodataRecord> {
  if (!data) return {};
  // columnar with nips: {k, n, d, s?}
  if (data && Array.isArray(data.k) && Array.isArray(data.n) && Array.isArray(data.d)) {
    const keys: string[] = data.k;
    const nips: string[] = data.n;
    const table: string[] = Array.isArray(data.s) ? data.s : [];
    const out: Record<string, BiodataRecord> = {};
    for (let i = 0; i < nips.length; i++) {
      const row = data.d[i] || [];
      const obj: any = {};
      for (let j = 0; j < keys.length; j++) {
        let v = row[j];
        if (v == null) continue;
        if (table.length) v = resolveRefs(v, table);
        obj[keys[j]] = v;
      }
      out[nips[i]] = obj;
    }
    return out;
  }
  // plain map (backward compat)
  if (typeof data === 'object' && !Array.isArray(data)) return data as Record<string, BiodataRecord>;
  return {};
}

export async function loadBiodata(): Promise<Record<string, BiodataRecord>> {
  if (biodataCache) return biodataCache;
  if (!biodataPromise) {
    biodataPromise = fetch('/data/biodata.json')
      .then(r => {
        if (!r.ok) throw new Error('Gagal memuat biodata: ' + r.status);
        return r.json();
      })
      .then((data: any) => {
        biodataCache = decodeBiodata(data);
        return biodataCache;
      })
      .catch(err => {
        biodataPromise = null;
        throw err;
      });
  }
  return biodataPromise;
}

export async function getBiodataByNip(nip: string): Promise<BiodataRecord | null> {
  const data = await loadBiodata();
  return data[nip] ?? null;
}
