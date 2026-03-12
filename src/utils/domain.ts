import dns from 'node:dns/promises';

const MULTI_PART_TLDS = [
  '.co.uk', '.co.kr', '.co.jp', '.co.nz', '.co.za', '.co.in', '.co.id',
  '.com.au', '.com.br', '.com.cn', '.com.mx', '.com.tw', '.com.sg',
  '.net.au', '.net.br', '.net.cn',
  '.org.uk', '.org.au', '.org.br',
  '.ac.uk', '.ac.kr', '.ac.jp',
  '.ne.jp', '.or.jp', '.or.kr',
  '.gov.uk', '.gov.au', '.gov.br',
  '.edu.au', '.edu.cn',
];

function getRootDomain(domain: string): string {
  const lower = domain.toLowerCase();
  const multiTld = MULTI_PART_TLDS.find((tld) => lower.endsWith(tld));
  if (multiTld) {
    const withoutTld = lower.slice(0, -multiTld.length);
    const parts = withoutTld.split('.').filter(Boolean);
    return parts[parts.length - 1] + multiTld;
  }
  const parts = lower.split('.');
  return parts.slice(-2).join('.');
}

export function isSubdomain(domain: string): boolean {
  if (!domain) return false;
  const lower = domain.toLowerCase();
  const multiTld = MULTI_PART_TLDS.find((tld) => lower.endsWith(tld));
  if (multiTld) {
    const withoutTld = lower.slice(0, -multiTld.length);
    return withoutTld.includes('.');
  }
  return domain.split('.').length > 2;
}

export async function lookupNameservers(domain: string): Promise<string[]> {
  const rootDomain = getRootDomain(domain);
  try {
    return await dns.resolveNs(rootDomain);
  } catch {
    return [];
  }
}

const DNS_PROVIDER_MAP: [string[], string][] = [
  [['godaddy', 'domaincontrol'], 'GoDaddy'],
  [['namecheap', 'registrar-servers.com'], 'Namecheap'],
  [['cloudflare'], 'Cloudflare'],
  [['googledomains', 'google.com'], 'Google Domains'],
  [['awsdns', 'amazon'], 'AWS (Route 53)'],
  [['bluehost'], 'Bluehost'],
  [['siteground'], 'SiteGround'],
  [['hostgator'], 'HostGator'],
  [['dreamhost'], 'DreamHost'],
  [['name.com'], 'Name.com'],
  [['gandi'], 'Gandi'],
  [['gabia'], 'Gabia'],
  [['whois'], 'Whois'],
  [['cafe24'], 'Cafe24'],
  [['imweb'], 'Imweb'],
  [['xinnet'], 'Xinnet'],
  [['aliyun', 'alidns'], 'Aliyun'],
  [['dnspod', 'qcloud'], 'Tencent Cloud'],
];

export function detectDnsProvider(nameservers: string[]): string | null {
  if (nameservers.length === 0) return null;
  const nsString = nameservers.join(',').toLowerCase();
  for (const [keywords, provider] of DNS_PROVIDER_MAP) {
    if (keywords.some((kw) => nsString.includes(kw))) return provider;
  }
  return null;
}

const DNS_PROVIDER_GUIDES: Record<string, string> = {
  GoDaddy: 'https://www.godaddy.com/help/add-a-cname-record-19236',
  Namecheap: 'https://www.namecheap.com/support/knowledgebase/article.aspx/434/2237/how-do-i-set-up-host-records-for-a-domain/',
  Cloudflare: 'https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/',
  'Google Domains': 'https://support.google.com/domains/answer/3290350',
  'AWS (Route 53)': 'https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resource-record-sets-creating.html',
  Bluehost: 'https://www.bluehost.com/help/article/dns-management-add-edit-or-delete-dns-entries',
  SiteGround: 'https://www.siteground.com/kb/how_to_manage_dns_records/',
  HostGator: 'https://www.hostgator.com/help/article/how-to-change-dns-zones-mx-cname-and-a-records',
  DreamHost: 'https://help.dreamhost.com/hc/en-us/articles/215413857-DreamHost-DNS-overview',
  'Name.com': 'https://www.name.com/support/articles/205934458-Adding-a-CNAME-Record',
  Gandi: 'https://docs.gandi.net/en/domain_names/common_operations/dns_records.html',
  Gabia: 'https://customer.gabia.com/manual/dns/3041/3040',
  Whois: 'https://cs.whois.co.kr/manual/?p=view&page=1&number=435&keyfield=sub_cont&keyword=dns',
  Cafe24: 'https://help.cafe24.com/docs/domain/domain-hosting-external-service-connection/',
  Imweb: 'https://imweb.me/qna?mode=faq&q=71897',
  Xinnet: 'http://www.xinnet.com/service/cjwt/yuming/guanli/1485.html',
  Aliyun: 'https://www.alibabacloud.com/help/en/dns/user-guide/add-a-dns-record',
  'Tencent Cloud': 'https://www.tencentcloud.com/document/product/302/3446',
};

export function getDnsProviderGuide(provider: string): string | null {
  return DNS_PROVIDER_GUIDES[provider] || null;
}
