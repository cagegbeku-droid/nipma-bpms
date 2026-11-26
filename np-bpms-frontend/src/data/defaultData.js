// Baseline fallback constants for 0ms initial load
// Ensures the system NEVER displays 0 records or empty states while background syncing
export const DEFAULT_STATS = {
  total: 1020,
  residential: 961,
  commercial: 55,
  zones: 68,
  fullyDocumented: 12,
  missingDocs: 1008,
  totalAttachedFiles: 35
};

export const DEFAULT_RECENT_PERMITS = [
  {
    id: 1026,
    permit_number: 'NIPDA/DAWH/26/203',
    date_issued: '2026-11-20',
    purpose: 'RESIDENTIAL',
    applicant_name: 'MARVIN NANA NYARKOH HERDRICKS',
    phone: '',
    address: 'DAWHENYA',
    location: 'DAWHENYA',
    status: 'Synced'
  },
  {
    id: 1025,
    permit_number: 'NIPDA/PRAM/26/76',
    date_issued: '2026-11-19',
    purpose: 'RESIDENTIAL',
    applicant_name: 'DORINDA AMANKWAH',
    phone: '',
    address: 'PRAMPRAM',
    location: 'PRAMPRAM',
    status: 'Synced'
  },
  {
    id: 1024,
    permit_number: 'NIPDA/AFI/24/26',
    date_issued: '2026-11-19',
    purpose: 'RESIDENTIAL',
    applicant_name: 'PROSPER KWABLA SENANU',
    phone: '',
    address: 'AFIENYA',
    location: 'AFIENYA',
    status: 'Synced'
  },
  {
    id: 1023,
    permit_number: 'NIPDA/DAWH/24/433',
    date_issued: '2026-11-19',
    purpose: 'COMMERCIAL',
    applicant_name: 'DAVID OYEDEPO MINISTRIES INTERNATIONAL (GHANA)',
    phone: '',
    address: 'DAWHENYA',
    location: 'DAWHENYA',
    status: 'Synced'
  },
  {
    id: 1022,
    permit_number: 'NIPDA/DAWH-BUL/26/08',
    date_issued: '2026-11-19',
    purpose: 'RESIDENTIAL',
    applicant_name: 'ABDUL RAZAK ABDUL AZIZ',
    phone: '',
    address: 'BULADSO',
    location: 'BULADSO',
    status: 'Synced'
  },
  {
    id: 1021,
    permit_number: 'NIPDA/AFI-ADJ/26/81',
    date_issued: '2026-11-19',
    purpose: 'RESIDENTIAL',
    applicant_name: 'CECILIA ASARE',
    phone: '',
    address: 'AFIENYA',
    location: 'AFIENYA',
    status: 'Synced'
  }
];
