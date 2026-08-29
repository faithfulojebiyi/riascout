/**
 * Curation for the derived reference attributes: which group a column belongs
 * to, and whether it earns a place in the default grid.
 *
 * Attributes are still derived from the allowlist, so a column cannot go
 * missing. This only decides presentation — anything absent here lands in its
 * entity's catch-all group, hidden, and is switchable from grid settings.
 */
export const ATTRIBUTE_GROUPS = [
  'Identity',
  'Pipeline',
  'Contact',
  'Current firm',
  'Career',
  'Credentials',
  'Compliance',
  'Ownership',
  'Location',
  'Movement',
  'Firm detail',
  'Firm metrics',
  'Firm coverage',
] as const;

export type AttributeGroup = (typeof ATTRIBUTE_GROUPS)[number];

export type ColumnMeta = {
  group: AttributeGroup;
  /** a column in the default grid view; everything else is off by default */
  visible?: boolean;
  /** frozen to the left of the grid */
  pinned?: boolean;
};

/** keyed by the allowlist key, e.g. "advisor.full_name" */
export const COLUMN_META: Readonly<Record<string, ColumnMeta>> = {
  // ── advisor ───────────────────────────────────────────────────────────────
  'advisor.full_name': { group: 'Identity', visible: true, pinned: true },
  'advisor.first_name': { group: 'Identity' },
  'advisor.last_name': { group: 'Identity' },
  'advisor.advisor_crd': { group: 'Identity', visible: true },
  'advisor.is_active': { group: 'Identity', visible: true },

  'advisor.current_firm_name': { group: 'Current firm', visible: true },
  'advisor.current_firm_crd': { group: 'Current firm' },
  'advisor.current_firm_since': { group: 'Current firm', visible: true },
  'advisor.current_firm_count': { group: 'Current firm' },

  'advisor.tenure_months': { group: 'Career', visible: true },
  'advisor.experience_months': { group: 'Career', visible: true },
  'advisor.previous_firm_count': { group: 'Career' },
  'advisor.avg_previous_tenure_months': { group: 'Career' },
  'advisor.previous_firm_crds': { group: 'Career' },

  'advisor.exam_codes': { group: 'Credentials', visible: true },
  'advisor.designations': { group: 'Credentials', visible: true },
  'advisor.jurisdictions': { group: 'Credentials' },
  'advisor.jurisdiction_count': { group: 'Credentials' },

  'advisor.disclosure_status': { group: 'Compliance', visible: true },
  'advisor.disclosure_count': { group: 'Compliance' },

  'advisor.owns_current_firm': { group: 'Ownership', visible: true },
  'advisor.ownership_band': { group: 'Ownership' },
  'advisor.is_control_person': { group: 'Ownership' },
  'advisor.owner_title': { group: 'Ownership' },

  'advisor.city': { group: 'Location', visible: true },
  'advisor.state': { group: 'Location', visible: true },
  'advisor.postal_code': { group: 'Location' },
  'advisor.country_code': { group: 'Location' },
  'advisor.is_us_workplace': { group: 'Location' },

  'advisor.last_moved_on': { group: 'Movement', visible: true },
  'advisor.last_detected_on': { group: 'Movement' },
  'advisor.previous_firm_crd': { group: 'Movement' },
  'advisor.move_count_5y': { group: 'Movement' },

  'advisor.firm_aum': { group: 'Firm detail', visible: true },
  'advisor.firm_aum_band': { group: 'Firm detail' },
  'advisor.firm_channel': { group: 'Firm detail', visible: true },
  'advisor.firm_state': { group: 'Firm detail' },
  'advisor.firm_domain': { group: 'Firm detail' },
  'advisor.firm_linkedin_url': { group: 'Firm detail' },

  // ── firm ──────────────────────────────────────────────────────────────────
  'firm.firm_name': { group: 'Identity', visible: true, pinned: true },
  'firm.firm_crd': { group: 'Identity', visible: true },
  'firm.sec_number': { group: 'Identity' },
  'firm.domain': { group: 'Contact', visible: true },
  'firm.linkedin_url': { group: 'Contact', visible: true },
  'firm.social_platforms': { group: 'Contact' },

  'firm.city': { group: 'Location', visible: true },
  'firm.state': { group: 'Location', visible: true },
  'firm.country_code': { group: 'Location' },
  'firm.postal_code': { group: 'Location' },

  'firm.regulatory_aum': { group: 'Firm metrics', visible: true },
  'firm.aum_band': { group: 'Firm metrics' },
  'firm.advisor_count': { group: 'Firm metrics', visible: true },
  'firm.client_count': { group: 'Firm metrics', visible: true },
  'firm.employee_count': { group: 'Firm metrics' },
  'firm.aum_per_advisor': { group: 'Firm metrics', visible: true },
  'firm.channel_code': { group: 'Firm metrics', visible: true },
  'firm.is_sec_registered': { group: 'Firm metrics' },
  'firm.is_era': { group: 'Firm metrics' },

  'firm.net_advisor_flow_90d': { group: 'Movement', visible: true },
  'firm.advisors_gained_90d': { group: 'Movement' },
  'firm.advisors_lost_90d': { group: 'Movement' },
};

/** columns not listed above land here, hidden */
export const FALLBACK_GROUP: Record<'advisor_search' | 'firm_search', AttributeGroup> = {
  advisor_search: 'Firm detail',
  firm_search: 'Firm coverage',
};
