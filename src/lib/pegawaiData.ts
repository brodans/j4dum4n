type PegawaiRecord = Record<string, any>;

let databasePromise: Promise<PegawaiRecord[]> | null = null;
let searchListPromise: Promise<ReturnType<typeof toPegawaiSearchList>> | null = null;

export function loadPegawaiDatabase(): Promise<PegawaiRecord[]> {
  if (!databasePromise) {
    databasePromise = import('../data/data_pegawai')
      .then(({ dataPegawai }) => dataPegawai || [])
      .catch(error => {
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
      .then(toPegawaiSearchList)
      .catch(error => {
        searchListPromise = null;
        throw error;
      });
  }
  return searchListPromise;
}