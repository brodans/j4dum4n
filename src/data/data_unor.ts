export interface DataUnor { kode: string; nama: string; [key: string]: any; }
let _cache: DataUnor[] | null = null;
let _promise: Promise<DataUnor[]> | null = null;
function decode(data: any): DataUnor[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.k) && Array.isArray(data.d)) {
    const k: string[] = data.k;
    return data.d.map((row: any[]) => { const o: any = {}; for (let i=0;i<k.length;i++) if (row[i]!=null) o[k[i]]=row[i]; return o; });
  }
  return [];
}
export async function loadDataUnor(): Promise<DataUnor[]> {
  if (_cache) return _cache;
  if (!_promise) {
    _promise = fetch('/data/unor.json')
      .then(r => { if (!r.ok) throw new Error('Gagal memuat unor'); return r.json(); })
      .then((d: any) => { _cache = decode(d); return _cache; })
      .catch(e => { _promise = null; throw e; });
  }
  return _promise;
}
