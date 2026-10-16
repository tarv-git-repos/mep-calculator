export interface CompanyBrandingSettings {
  logoUrl?: string; // Base64 data URL or image URL
  logoWidth?: number;
  logoHeight?: number;

  companyName: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  licenseNo: string;
  isoCertNo: string;

  disclaimer: string;
  footerText: string;
  showPageNumbers: boolean;

  showSignatureBlock: boolean;
  preparedByTitle: string;
  reviewedByTitle: string;
  approvedByTitle: string;
  showStampBox: boolean;
}

export const DEFAULT_BRANDING: CompanyBrandingSettings = {
  logoUrl: '',
  companyName: 'Consistent Engineering Consultants',
  tagline: 'Mechanical, Electrical & Plumbing (MEP) Building Services Consultants',
  address: 'Level 14, Al Moosa Tower 1, Sheikh Zayed Road, Dubai, United Arab Emirates',
  phone: '+971 4 332 8888',
  email: 'info@consistentconsultants.com',
  website: 'www.consistentconsultants.com',
  licenseNo: 'DED Consulting License # 784920',
  isoCertNo: 'ISO 9001:2015 & ISO 14001 Certified',

  disclaimer:
    'This engineering calculation has been generated in accordance with established international codes & standards (ASHRAE, NFPA, NBC, BS EN, CIBSE). The contractor shall verify all site dimensions and coordinate with architectural and structural layouts prior to procurement or installation.',
  footerText: 'Confidential & Proprietary — For Client Review & Authority Approval Only',
  showPageNumbers: true,

  showSignatureBlock: true,
  preparedByTitle: 'Design Engineer',
  reviewedByTitle: 'Sr. Design Engineer',
  approvedByTitle: 'Discipline Coordinator',
  showStampBox: true,
};

export const LOCAL_STORAGE_BRANDING_KEY = 'mep_org_branding';

export function getCompanyBranding(): CompanyBrandingSettings {
  if (typeof window === 'undefined') return DEFAULT_BRANDING;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_BRANDING_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return { ...DEFAULT_BRANDING, ...parsed };
      }
    }
  } catch (e) {}
  return DEFAULT_BRANDING;
}

export function saveCompanyBranding(branding: Partial<CompanyBrandingSettings>): CompanyBrandingSettings {
  const current = getCompanyBranding();
  const merged = { ...current, ...branding };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_BRANDING_KEY, JSON.stringify(merged));
      window.dispatchEvent(new CustomEvent('mep-branding-updated', { detail: merged }));
    } catch (e) {}
  }
  return merged;
}
