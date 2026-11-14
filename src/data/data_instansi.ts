export interface LokasiInstansi {
  id: string;
  induk: boolean | null;
  lokasi: {
    id: string; kode: string; nama: string; alamat: string | null;
    latitude: number | null; longitude: number | null; radius: number | null;
    kota: { id: number; nama: string; propinsi: { id: number; nama: string } } | null;
  };
}
export interface DataInstansi {
  kode: string; nama: string;
  tipeSkpd?: string | null; gradeSkpd?: string | null; parentInstansi?: string | null;
  instansiTdd?: string | null; namaTdd?: string | null; nipTdd?: string | null; pangkatTdd?: string | null;
  jabatanAnggaran?: string | null; namaAnggaran?: string | null; nipAnggaran?: string | null; pangkatAnggaran?: string | null;
  radiusAbsensiMeter?: number | null; kodeSik?: string | null; tampilDashboard?: boolean; aktif?: boolean;
  lokasi?: LokasiInstansi[];
  [key: string]: any;
}
let _cache: DataInstansi[] | null = null;
let _promise: Promise<DataInstansi[]> | null = null;
function decode(data: any): DataInstansi[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.k) && Array.isArray(data.d)) {
    const k: string[] = data.k;
    return data.d.map((row: any[]) => { const o: any = {}; for (let i=0;i<k.length;i++) if (row[i]!=null) o[k[i]]=row[i]; return o; });
  }
  return [];
}
export async function loadDataInstansi(): Promise<DataInstansi[]> {
  if (_cache) return _cache;
  if (!_promise) {
    _promise = fetch('/data/instansi.json')
      .then(r => { if (!r.ok) throw new Error('Gagal memuat instansi'); return r.json(); })
      .then((d: any) => { _cache = decode(d); return _cache; })
      .catch(e => { _promise = null; throw e; });
  }
  return _promise;
}
