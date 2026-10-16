export interface FrameworkRequirement { ref: string; title: string; section: string; optional?: string; successors?: string[] }
export interface Edition { id: string; label: string; requirements: FrameworkRequirement[] }
export interface Framework { id: FrameworkId; name: string; licence: string; assessor: string; editions: Edition[]; categories?: string[] }
export type FrameworkId = 'soc2' | 'iso27001' | 'hipaa' | 'pci'
export type ControlGroup = 'Access' | 'Data' | 'Change' | 'People' | 'Vendors' | 'Operations' | 'Governance'
export type LibraryCadence = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'semi-annual' | 'annual'
export interface LibraryControl {
 id: string; title: string; group: ControlGroup
 proof: string; cadence: LibraryCadence
 tests: string[]; policies: string[]
 maps: Partial<Record<FrameworkId, string[]>>
}
