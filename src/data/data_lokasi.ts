export type Lokasi = Record<string, any>;
let _cache: Lokasi[] | null = null;
let _promise: Promise<Lokasi[]> | null = null;
function decode(data: any): Lokasi[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.k) && Array.isArray(data.d)) {
    const k: string[] = data.k;
    return data.d.map((row: any[]) => { const o: any = {}; for (let i=0;i<k.length;i++) if (row[i]!=null) o[k[i]]=row[i]; return o; });
  }
  return [];
}
export async function loadDataLokasi(): Promise<Lokasi[]> {
  if (_cache) return _cache;
  if (!_promise) {
    _promise = fetch('/data/lokasi.json')
      .then(r => { if (!r.ok) throw new Error('Gagal memuat lokasi'); return r.json(); })
      .then((d: any) => { _cache = decode(d); return _cache; })
      .catch(e => { _promise = null; throw e; });
  }
  return _promise;
}
