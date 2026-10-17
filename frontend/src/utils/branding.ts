export interface HeaderCustomField {
  id: string;
  label: string;
  value: string;
}

export interface FooterCustomField {
  id: string;
  label: string;
  value: string;
}

export interface CompanyBrandingSettings {
  logoUrl?: string; // Base64 data URL or image URL
  logoWidth?: number;
  logoHeight?: number;

  stampUrl?: string; // Base64 data URL or image URL for PE Stamp / Seal
  sealUrl?: string;

  companyName: string;
  tagline: string;

  // Fully customizable Dynamic Header Fields (each with custom Title & Value, deletable and addable)
  headerFields?: HeaderCustomField[];

  // Legacy direct fields for 100% backwards compatibility
  address: string;
  phone: string;
  email: string;
  website: string;
  licenseNo: string;
  licenseId?: string;
  isoCertNo: string;
  isoCertNumber?: string;

  // Fully customizable Footer Design
  disclaimer: string;
  disclaimerText?: string;
  disclaimerTitle?: string;
  footerText: string;
  footerLeftText?: string;
  footerRightText?: string;
  showPageNumbers: boolean;
  footerFields?: FooterCustomField[];

  showSignatureBlock: boolean;
  preparedByTitle: string;
  reviewedByTitle: string;
  approvedByTitle: string;
  showStampBox: boolean;
  enableStampBox?: boolean;
}

export const DEFAULT_HEADER_FIELDS: HeaderCustomField[] = [
  { id: 'hf-license', label: 'Consulting License ID', value: 'MEP-CONS-2026-A1' },
  { id: 'hf-iso', label: 'ISO Certification Number', value: 'ISO 9001:2015 & ISO 14001' },
  { id: 'hf-address', label: 'Corporate Office Address', value: 'Suite 400, Engineering Tower, Tech Park Road, Mumbai' },
  { id: 'hf-phone', label: 'Official Phone Number', value: '+91 98765 43210' },
  { id: 'hf-email', label: 'Contact Email', value: 'contact@vikrammep.com' },
  { id: 'hf-website', label: 'Official Website URL', value: 'www.vikrammep.com' },
];

export const DEFAULT_BRANDING: CompanyBrandingSettings = {
  logoUrl: '',
  stampUrl: '',
  sealUrl: '',
  companyName: 'Consistent Engineering Consultants',
  tagline: 'Mechanical, Electrical & Plumbing (MEP) Building Services Consultants',
  address: 'Level 14, Al Moosa Tower 1, Sheikh Zayed Road, Dubai, United Arab Emirates',
  phone: '+971 4 332 8888',
  email: 'info@consistentconsultants.com',
  website: 'www.consistentconsultants.com',
  licenseNo: 'DED Consulting License # 784920',
  licenseId: 'DED Consulting License # 784920',
  isoCertNo: 'ISO 9001:2015 & ISO 14001 Certified',
  isoCertNumber: 'ISO 9001:2015 & ISO 14001 Certified',

  headerFields: [...DEFAULT_HEADER_FIELDS],

  disclaimer:
    'This engineering calculation has been generated in accordance with established international codes & standards (ASHRAE, NFPA, NBC, BS EN, CIBSE). The contractor shall verify all site dimensions and coordinate with architectural and structural layouts prior to procurement or installation.',
  disclaimerText:
    'This engineering calculation has been generated in accordance with established international codes & standards (ASHRAE, NFPA, NBC, BS EN, CIBSE). The contractor shall verify all site dimensions and coordinate with architectural and structural layouts prior to procurement or installation.',
  disclaimerTitle: 'Notice / Confidentiality',
  footerText: 'Confidential & Proprietary — For Client Review & Authority Approval Only',
  footerLeftText: 'Consistent Engineering Consultants • Confidential & Proprietary',
  footerRightText: '',
  showPageNumbers: true,
  footerFields: [],

  showSignatureBlock: true,
  preparedByTitle: 'Design Engineer',
  reviewedByTitle: 'Sr. Discipline Lead',
  approvedByTitle: 'Principal MEP Director',
  showStampBox: true,
  enableStampBox: true,
};

export const LOCAL_STORAGE_BRANDING_KEY = 'mep_org_branding';

export function getCompanyBranding(): CompanyBrandingSettings {
  if (typeof window === 'undefined') return DEFAULT_BRANDING;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_BRANDING_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const combined = { ...DEFAULT_BRANDING, ...parsed };

        // Ensure headerFields is an array with valid items
        if (!Array.isArray(combined.headerFields)) {
          combined.headerFields = [
            { id: 'hf-license', label: 'Consulting License ID', value: combined.licenseId || combined.licenseNo || '' },
            { id: 'hf-iso', label: 'ISO Certification Number', value: combined.isoCertNumber || combined.isoCertNo || '' },
            { id: 'hf-address', label: 'Corporate Office Address', value: combined.address || '' },
            { id: 'hf-phone', label: 'Official Phone Number', value: combined.phone || '' },
            { id: 'hf-email', label: 'Contact Email', value: combined.email || '' },
            { id: 'hf-website', label: 'Official Website URL', value: combined.website || '' },
          ];
        }

        combined.licenseId = combined.licenseId || combined.licenseNo || '';
        combined.licenseNo = combined.licenseNo || combined.licenseId || '';
        combined.isoCertNumber = combined.isoCertNumber || combined.isoCertNo || '';
        combined.isoCertNo = combined.isoCertNo || combined.isoCertNumber || '';
        combined.disclaimerText = combined.disclaimerText || combined.disclaimer || '';
        combined.disclaimer = combined.disclaimer || combined.disclaimerText || '';
        combined.disclaimerTitle = combined.disclaimerTitle || 'Notice / Confidentiality';
        combined.stampUrl = combined.stampUrl || combined.sealUrl || '';
        combined.sealUrl = combined.sealUrl || combined.stampUrl || '';
        combined.enableStampBox = combined.enableStampBox ?? combined.showStampBox ?? true;
        combined.showStampBox = combined.showStampBox ?? combined.enableStampBox ?? true;
        combined.showPageNumbers = combined.showPageNumbers ?? true;
        combined.footerText = combined.footerText || combined.footerLeftText || 'Confidential & Proprietary';
        combined.footerLeftText = combined.footerLeftText || `${combined.companyName || 'MEP'} • Confidential & Proprietary`;

        return combined;
      }
    }
  } catch (e) {}
  return DEFAULT_BRANDING;
}

export function saveCompanyBranding(branding: Partial<CompanyBrandingSettings>): CompanyBrandingSettings {
  const current = getCompanyBranding();
  const merged: CompanyBrandingSettings = { ...current, ...branding };

  if (Array.isArray(merged.headerFields)) {
    const findVal = (term: string) => merged.headerFields?.find(f => f.label.toLowerCase().includes(term.toLowerCase()))?.value || '';
    merged.licenseId = findVal('license');
    merged.licenseNo = merged.licenseId;
    merged.isoCertNumber = findVal('iso');
    merged.isoCertNo = merged.isoCertNumber;
    merged.address = findVal('address');
    merged.phone = findVal('phone');
    merged.email = findVal('email');
    merged.website = findVal('website');
  }

  merged.licenseId = merged.licenseId || merged.licenseNo || '';
  merged.licenseNo = merged.licenseNo || merged.licenseId || '';
  merged.isoCertNumber = merged.isoCertNumber || merged.isoCertNo || '';
  merged.isoCertNo = merged.isoCertNo || merged.isoCertNumber || '';
  merged.disclaimerText = merged.disclaimerText || merged.disclaimer || '';
  merged.disclaimer = merged.disclaimer || merged.disclaimerText || '';
  merged.disclaimerTitle = merged.disclaimerTitle || 'Notice / Confidentiality';
  merged.stampUrl = merged.stampUrl || merged.sealUrl || '';
  merged.sealUrl = merged.sealUrl || merged.stampUrl || '';
  merged.enableStampBox = merged.enableStampBox ?? merged.showStampBox ?? true;
  merged.showStampBox = merged.showStampBox ?? merged.enableStampBox ?? true;
  merged.footerLeftText = merged.footerLeftText || `${merged.companyName || 'MEP'} • Confidential & Proprietary`;

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_BRANDING_KEY, JSON.stringify(merged));
      // Also write to legacy key if any old component looked there
      localStorage.setItem('mep_company_branding', JSON.stringify(merged));
      window.dispatchEvent(new CustomEvent('mep-branding-updated', { detail: merged }));
    } catch (e) {}
  }
  return merged;
}
