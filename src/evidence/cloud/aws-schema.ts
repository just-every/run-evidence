import { at, items, list, parseXml, textAt, type XmlValue } from './xml'
const record = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v)
const named = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const boolean = (v: unknown) => v === 'true' || v === 'false'
const cidr = (value: string, ipv6: boolean) => { const [address, mask, extra] = value.split('/'); return extra === undefined && /^\d+$/.test(mask ?? '') && Number(mask) <= (ipv6 ? 128 : 32) && (ipv6 ? /^[0-9a-f:]+$/i.test(address) && address.includes(':') : address.split('.').length === 4 && address.split('.').every(n => /^\d{1,3}$/.test(n) && Number(n) <= 255)) }
const natural = (v: unknown) => typeof v === 'string' && /^\d+$/.test(v) && Number.isSafeInteger(Number(v))
const collection = (v: XmlValue | undefined, keys: string[]) => v === '' || record(v) && Object.keys(v).length > 0 && Object.keys(v).every(k => keys.includes(k))
const present = (v: XmlValue | undefined) => v !== undefined && (v === '' || record(v))
// AWS Query/REST schemas: docs.aws.amazon.com/{STS,IAM,AWSEC2,RDS}/latest/APIReference/
// and API/{API_ListBuckets,API_GetPublicAccessBlock,API_GetBucketEncryption}.html.
export function queryShape(action: string, doc: XmlValue): string | null {
 const root = at(doc, action + 'Response'), result = at(root, action + 'Result')
 if (!present(root)) return action + ' response envelope'
 if (action === 'GetCallerIdentity' && (!/^\d{12}$/.test(textAt(result,'Account') ?? '') || !named(textAt(result,'Arn')))) return 'STS account identity'
 if (action === 'AssumeRole' && !['AccessKeyId','SecretAccessKey','SessionToken'].every(k => named(textAt(result,'Credentials',k)))) return 'STS assumed credential fields'
 if (action === 'GetAccountSummary') {
  const entries = list(at(result,'SummaryMap','entry'))
  if (!entries.every(e => named(textAt(e,'key')) && natural(textAt(e,'value'))) || !entries.some(e => textAt(e,'key') === 'AccountMFAEnabled' && ['0','1'].includes(textAt(e,'value') ?? ''))) return 'IAM summary or root MFA flag'
 }
 if (action === 'GetAccountPasswordPolicy' && !natural(textAt(result,'PasswordPolicy','MinimumPasswordLength'))) return 'IAM minimum password length'
 if (action === 'GenerateCredentialReport' && !['STARTED','INPROGRESS','COMPLETE'].includes(textAt(result,'State') ?? '')) return 'IAM report state'
 if (action === 'GetCredentialReport' && !named(textAt(result,'Content'))) return 'IAM credential report content'
 if (action === 'GetEbsEncryptionByDefault' && !boolean(textAt(root,'ebsEncryptionByDefault'))) return 'EBS encryption flag'
 if (action === 'DescribeSecurityGroups') {
  if (!collection(at(root,'securityGroupInfo'),['item'])) return 'security group list'
  for (const g of items(root,'securityGroupInfo')) {
   if (!named(textAt(g,'groupId')) || !named(textAt(g,'groupName')) || !collection(at(g,'ipPermissions'),['item'])) return 'security group identity or permissions'
   for (const rule of items(g,'ipPermissions')) {
    const protocol = textAt(rule,'ipProtocol')
    if (!named(protocol) || !(/^(-1|\d+)$/.test(protocol) || ['tcp','udp','icmp','icmpv6'].includes(protocol))) return 'security group protocol'
    if (['tcp','udp','6','17'].includes(protocol) && (!natural(textAt(rule,'fromPort')) || !natural(textAt(rule,'toPort')) || Number(textAt(rule,'fromPort')) > Number(textAt(rule,'toPort')) || Number(textAt(rule,'toPort')) > 65535)) return 'security group port range'
    for (const [field,key] of [['ipRanges','cidrIp'],['ipv6Ranges','cidrIpv6']]) {
     const container = at(rule,field)
     if (container !== undefined && !collection(container,['item'])) return 'security group source ranges'
     if (!items(rule,field).every(r => named(textAt(r,key)) && cidr(textAt(r,key)!,key === 'cidrIpv6'))) return 'security group source CIDR'
    }
   }
  }
 }
 if (action === 'DescribeDBInstances') {
  if (!collection(at(result,'DBInstances'),['DBInstance'])) return 'RDS instance list'
  for (const d of list(at(result,'DBInstances','DBInstance'))) if (!named(textAt(d,'DBInstanceIdentifier')) || !boolean(textAt(d,'StorageEncrypted')) || !boolean(textAt(d,'PubliclyAccessible')) || !natural(textAt(d,'BackupRetentionPeriod'))) return 'RDS identity, encryption, public network or retention'
 }
 return null
}
export function jsonShape(target: string, body: unknown): string | null {
 if (!record(body)) return target + ' JSON object'
 if (target.endsWith('.ListAccounts') && (!Array.isArray(body.Accounts) || !body.Accounts.every(a => record(a) && /^\d{12}$/.test(a.Id) && named(a.Name) && ['ACTIVE','SUSPENDED','PENDING_CLOSURE','PENDING_ACTIVATION','CLOSED'].includes(a.State ?? a.Status)) || body.NextToken !== undefined && body.NextToken !== null && !named(body.NextToken))) return 'Organizations account identity, status or continuation'
 if (target.endsWith('.DescribeTrails') && (!Array.isArray(body.trailList) || !body.trailList.every(t => record(t) && named(t.TrailARN) && /^[a-z]{2}(?:-gov)?-[a-z]+-\d$/.test(t.HomeRegion) && typeof t.IsMultiRegionTrail === 'boolean'))) return 'CloudTrail trail identity, home region or multi-region flag'
 if (target.endsWith('.GetTrailStatus') && typeof body.IsLogging !== 'boolean') return 'CloudTrail logging flag'
 return null
}
export function restShape(service: string, url: URL, raw: string): string | null {
 try {
  if (service === 'guardduty') {
   const body = JSON.parse(raw)
   if (!record(body)) return 'GuardDuty object'
   if (url.pathname === '/detector') {
    if (!Array.isArray(body.detectorIds) || !body.detectorIds.every(named)) return 'GuardDuty detector list'
    if (body.nextToken) return 'GuardDuty pagination incomplete'
   } else if (!['ENABLED','DISABLED'].includes(body.status)) return 'GuardDuty detector status'
   return null
  }
  const doc = parseXml(raw)
  if (url.pathname === '/' && !url.hostname.includes('s3-control')) {
   if (!collection(at(doc,'ListAllMyBucketsResult','Buckets'),['Bucket']) || !list(at(doc,'ListAllMyBucketsResult','Buckets','Bucket')).every(b => named(textAt(b,'Name')))) return 'S3 bucket list or identity'
   if (textAt(doc,'ListAllMyBucketsResult','ContinuationToken')) return 'S3 bucket pagination incomplete'
  } else if (url.search === '?location') {
   const region = textAt(doc,'LocationConstraint')
   if (region === null || region !== '' && !/^[a-z]{2}(?:-gov)?-[a-z]+-\d$/.test(region)) return 'S3 location'
  } else if (url.search === '?encryption') {
   if (!list(at(doc,'ServerSideEncryptionConfiguration','Rule')).length || !list(at(doc,'ServerSideEncryptionConfiguration','Rule')).every(r => ['AES256','aws:kms','aws:kms:dsse'].includes(textAt(r,'ApplyServerSideEncryptionByDefault','SSEAlgorithm') ?? ''))) return 'S3 default encryption algorithm'
  } else if (url.search === '?policyStatus') {
   if (!boolean(textAt(doc,'PolicyStatus','IsPublic'))) return 'S3 policy-public flag'
  } else if (!['BlockPublicAcls','IgnorePublicAcls','BlockPublicPolicy','RestrictPublicBuckets'].every(k => boolean(textAt(doc,'PublicAccessBlockConfiguration',k)))) return 'S3 public-access block flags'
 } catch { return service + ' unreadable response' }
 return null
}
