import type { Framework } from './types'
// PCI DSS v4.0.1 requirement numbers with Evidence's short summaries. The
// standard's text is PCI SSC material; read it from your copy of the standard.
const requirements: [string, string][] = [
 ['1.1','Network security control processes defined and understood'],['1.2','Network security controls configured and maintained'],['1.3','Network access to and from the CDE restricted'],['1.4','Connections between trusted and untrusted networks controlled'],['1.5','Risks from devices connecting to untrusted networks and the CDE mitigated'],
 ['2.1','Secure configuration processes defined and understood'],['2.2','System components configured and managed securely'],['2.3','Wireless environments configured and managed securely'],
 ['3.1','Stored account data protection processes defined'],['3.2','Storage of account data kept to a minimum'],['3.3','Sensitive authentication data not stored after authorization'],['3.4','Display and copying of full PAN restricted'],['3.5','PAN secured wherever it is stored'],['3.6','Keys protecting stored account data secured'],['3.7','Key management processes defined and implemented'],
 ['4.1','Transmission cryptography processes defined'],['4.2','PAN protected with strong cryptography in transmission'],
 ['5.1','Malware protection processes defined'],['5.2','Malicious software prevented, or detected and addressed'],['5.3','Anti-malware mechanisms active, maintained and monitored'],['5.4','Anti-phishing mechanisms protect users'],
 ['6.1','Secure systems and software processes defined'],['6.2','Bespoke and custom software developed securely'],['6.3','Security vulnerabilities identified and addressed'],['6.4','Public-facing web applications protected against attacks'],['6.5','Changes to system components managed securely'],
 ['7.1','Need-to-know access processes defined'],['7.2','Access to components and data defined and assigned'],['7.3','Access managed through an access control system'],
 ['8.1','Identification and authentication processes defined'],['8.2','User identification and accounts managed through their lifecycle'],['8.3','Strong authentication established and managed'],['8.4','Multi-factor authentication into the CDE'],['8.5','MFA systems configured to prevent misuse'],['8.6','Application and system accounts strictly managed'],
 ['9.1','Physical access processes defined'],['9.2','Physical entry to facilities with cardholder data controlled'],['9.3','Physical access for personnel and visitors authorized'],['9.4','Media with cardholder data secured and destroyed'],['9.5','Point-of-interaction devices protected from tampering'],
 ['10.1','Logging and monitoring processes defined'],['10.2','Audit logs support anomaly detection and forensics'],['10.3','Audit logs protected from destruction and modification'],['10.4','Audit logs reviewed for anomalies'],['10.5','Audit log history retained and available'],['10.6','Time synchronization supports consistent time'],['10.7','Failures of critical security controls detected and responded to'],
 ['11.1','Security testing processes defined'],['11.2','Wireless access points identified and monitored'],['11.3','Vulnerabilities identified, prioritized and addressed'],['11.4','Penetration testing performed regularly'],['11.5','Intrusions and unexpected file changes detected'],['11.6','Unauthorized payment page changes detected'],
 ['12.1','Information security policy known and current'],['12.2','Acceptable use policies defined and implemented'],['12.3','Risks to the CDE identified, evaluated and managed'],['12.4','PCI DSS compliance managed'],['12.5','PCI DSS scope documented and validated'],['12.6','Security awareness education ongoing'],['12.7','Personnel screened'],['12.8','Third-party service provider risk managed'],['12.9','Service providers support customers\' compliance'],['12.10','Security incidents responded to immediately'],
]
const appendix: [string, string, string][] = [
 ['A1.1','Multi-tenant providers protect and separate customer environments','Appendix A1 · Multi-tenant service providers'],['A1.2','Multi-tenant providers support logging and incident response for customers','Appendix A1 · Multi-tenant service providers'],
 ['A2.1','POI terminals using SSL or early TLS are not susceptible to known exploits','Appendix A2 · SSL/early TLS for card-present POS POI'],
 ['A3.1','PCI DSS compliance program responsibility established','Appendix A3 · Designated entities supplemental validation'],['A3.2','PCI DSS scope documented and validated','Appendix A3 · Designated entities supplemental validation'],['A3.3','PCI DSS incorporated into business-as-usual activities','Appendix A3 · Designated entities supplemental validation'],['A3.4','Logical access to the CDE controlled and managed','Appendix A3 · Designated entities supplemental validation'],['A3.5','Suspicious events identified and responded to','Appendix A3 · Designated entities supplemental validation'],
]
export const pci: Framework = {
 id: 'pci', name: 'PCI DSS', licence: 'Requirement numbers with short summaries only. The standard is PCI SSC material; read it from your copy.',
 assessor: 'The merchant or a PCI QSA signs the Attestation of Compliance.',
 editions: [{ id: 'v4.0.1', label: 'PCI DSS v4.0.1', requirements: [
  ...requirements.map(([ref,title]) => ({ ref, title, section: 'Requirement '+ref.split('.')[0] })),
  ...appendix.map(([ref,title,section]) => ({ ref, title, section })),
 ] }],
}
