type PegawaiRecord = Record<string, any>;

let databasePromise: Promise<PegawaiRecord[]> | null = null;
let searchListPromise: Promise<ReturnType<typeof toPegawaiSearchList>> | null = null;

const RETRY_DELAYS_MS = [500, 1500, 4000, 10000, 30000];

function resolveRefs(v: any, table: string[]): any {
  if (v == null) return v;
  if (Array.isArray(v)) return v.map(x => resolveRefs(x, table));
  if (typeof v === 'object') {
    if (typeof (v as any).$ === 'number') {
      const s = table[(v as any).$];
      return s !== undefined ? s : v;
    }
    const o: any = {};
    for (const k in v) o[k] = resolveRefs(v[k], table);
    return o;
  }
  return v;
}

function decodeColumnar(data: any): PegawaiRecord[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.k) && Array.isArray(data.d)) {
    const keys: string[] = data.k;
    const table: string[] = Array.isArray(data.s) ? data.s : [];
    return data.d.map((row: any[]) => {
      const obj: any = {};
      for (let i = 0; i < keys.length; i++) {
        let v = row[i];
        if (v == null) continue;
        if (table.length) v = resolveRefs(v, table);
        obj[keys[i]] = v;
      }
      return obj;
    });
  }
  return [];
}

export function loadPegawaiDatabase(): Promise<PegawaiRecord[]> {
  if (!databasePromise) {
    databasePromise = (async () => {
      let attempt = 0;
      while (true) {
        let dataPegawai: PegawaiRecord[] | null = null;
        try {
          const res = await fetch('/data/pegawai.json');
          if (!res.ok) throw new Error('HTTP ' + res.status);
          const raw = await res.json();
          dataPegawai = decodeColumnar(raw);
        } catch (error) {
          attempt++;
          if (attempt % RETRY_DELAYS_MS.length === 0) {
            console.warn('[pegawaiData] Data pegawai belum dapat dimuat; mencoba lagi.', error);
          }
          const delay = RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)];
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        if (!Array.isArray(dataPegawai) || dataPegawai.length === 0) {
          throw new Error('Database pegawai kosong atau tidak valid.');
        }
        return dataPegawai;
      }
    })().catch(error => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

export function toPegawaiSearchList(records: PegawaiRecord[]) {
  return records
    .map(item => ({
      id: item?.id || item?.id_pegawai || '',
      nip: item?.nip || '',
      nama: item?.nama || '',
      nama_instansi: item?.nama_instansi || item?.unor || item?.nama_unit_kerja || '',
      kode_unor: item?.kode_unor || item?.unor || '',
    }))
    .filter(item => item.id && item.nama);
}

export async function loadPegawaiSearchList() {
  if (!searchListPromise) {
    searchListPromise = loadPegawaiDatabase()
      .then(records => {
        const list = toPegawaiSearchList(records);
        if (list.length === 0) {
          throw new Error('Daftar pencarian pegawai kosong atau tidak valid.');
        }
        return list;
      })
      .catch(error => {
        searchListPromise = null;
        throw error;
      });
  }
  return searchListPromise;
}
