import { Injectable } from '@nestjs/common';
import {
  HistoricalOrder,
  MarketSnapshot,
  PricePoint,
  RecommendationRequest,
} from '../types';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class OdpsDataProvider {
  private parseCsvLine(line: string): string[] {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i += 1;
          continue;
        }
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === ',' && !inQuotes) {
        out.push(cur);
        cur = '';
        continue;
      }
      cur += ch;
    }
    out.push(cur);
    return out;
  }

  private loadSqlTemplate(fileName: string): string {
    const sqlPath = path.resolve(process.cwd(), 'sql', fileName);
    return fs.readFileSync(sqlPath, 'utf8');
  }

  private renderTemplate(
    template: string,
    params: Record<string, string | number>,
  ): string {
    let out = template;
    for (const [k, v] of Object.entries(params)) {
      out = out.replaceAll(`\${${k}}`, String(v));
      out = out.replaceAll(`\${{${k}}}`, String(v));
    }
    return out;
  }

  private requireOdpsConfig(): {
    accessId: string;
    secretAccessKey: string;
    project: string;
    endpoint: string;
  } {
    const cfg = this.odpsConfig();
    const accessId = cfg.accessId?.trim() ?? '';
    const secretAccessKey = cfg.secretAccessKey?.trim() ?? '';
    const project = cfg.project?.trim() ?? '';
    const endpoint = cfg.endpoint?.trim() ?? '';
    if (!accessId || !secretAccessKey || !project || !endpoint) {
      throw new Error('ODPS config missing (access_id/secret_access_key/project/endpoint)');
    }
    return { accessId, secretAccessKey, project, endpoint };
  }

  private canonicalizeOdpsHeaders(headers: Record<string, string>): string {
    return Object.entries(headers)
      .filter(([k]) => k.toLowerCase().startsWith('x-odps-'))
      .map(([k, v]) => [k.toLowerCase(), String(v).trim()] as const)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}\n`)
      .join('');
  }

  private canonicalizeResource(url: URL, endpointBasePath: string): string {
    const rawPath = decodeURIComponent(url.pathname);
    const basePath = decodeURIComponent(endpointBasePath || '').replace(/\/$/, '');
    let pathname = rawPath;
    if (basePath && pathname.startsWith(basePath)) {
      pathname = pathname.slice(basePath.length) || '/';
    }
    if (!pathname.startsWith('/')) pathname = `/${pathname}`;

    const entries = Array.from(url.searchParams.entries()).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    if (entries.length === 0) return pathname;
    const qs = entries
      .map(([k, v]) => (v !== '' ? `${k}=${v}` : k))
      .join('&');
    return `${pathname}?${qs}`;
  }

  private signOdpsRequest(params: {
    method: string;
    url: URL;
    endpointBasePath: string;
    headers: Record<string, string>;
    body?: string;
  }): string {
    return this.signOdpsRequestV2(params);
  }

  private buildCanonicalStr(params: {
    method: string;
    url: URL;
    endpointBasePath: string;
    headers: Record<string, string>;
  }): string {
    const method = params.method.toUpperCase();
    const contentType = params.headers['Content-Type'] ?? params.headers['content-type'] ?? '';
    const contentMd5 =
      params.headers['Content-MD5'] ??
      params.headers['content-md5'] ??
      '';
    const date = params.headers['Date'] ?? params.headers['date'] ?? '';
    const canonicalHeaders = this.canonicalizeOdpsHeaders(params.headers);
    const canonicalResource = this.canonicalizeResource(params.url, params.endpointBasePath);
    return [
      method,
      contentMd5,
      contentType,
      date,
      `${canonicalHeaders}${canonicalResource}`,
    ].join('\n');
  }

  private signOdpsRequestV2(params: {
    method: string;
    url: URL;
    endpointBasePath: string;
    headers: Record<string, string>;
  }): string {
    const cfg = this.requireOdpsConfig();
    const canonicalStr = this.buildCanonicalStr(params);
    const sig = crypto
      .createHmac('sha1', cfg.secretAccessKey)
      .update(canonicalStr, 'utf8')
      .digest('base64');
    return `ODPS ${cfg.accessId}:${sig}`;
  }

  private odpsRegion(): string | null {
    const env = process.env.ODPS_REGION?.trim();
    if (env) return env;
    const cfg = this.requireOdpsConfig();
    const host = new URL(cfg.endpoint).hostname;
    const m = host.match(/^service\.([^.]+)\.maxcompute\.aliyun\.com$/i);
    return m?.[1] ?? null;
  }

  private signOdpsRequestV4(params: {
    method: string;
    url: URL;
    endpointBasePath: string;
    headers: Record<string, string>;
    region: string;
  }): string {
    const cfg = this.requireOdpsConfig();
    const canonicalStr = this.buildCanonicalStr(params);
    const sigPrefix = 'aliyun_v4';
    const dateStr = toIsoDate(new Date()).replaceAll('-', '');

    const kSecret = Buffer.from(`${sigPrefix}${cfg.secretAccessKey}`, 'utf8');
    const kDate = crypto.createHmac('sha256', kSecret).update(dateStr, 'utf8').digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(params.region, 'utf8').digest();
    const kService = crypto.createHmac('sha256', kRegion).update('odps', 'utf8').digest();
    const signKey = crypto
      .createHmac('sha256', kService)
      .update(`${sigPrefix}_request`, 'utf8')
      .digest();

    const signature = crypto
      .createHmac('sha1', signKey)
      .update(canonicalStr, 'utf8')
      .digest('base64');

    const credential = `${cfg.accessId}/${dateStr}/${params.region}/odps/${sigPrefix}_request`;
    return `ODPS ${credential}:${signature}`;
  }

  private async odpsFetch(params: {
    method: 'GET' | 'POST';
    path: string;
    query?: Record<string, string>;
    body?: string;
    contentType?: string;
    accept?: string;
  }): Promise<{ status: number; text: string; headers: Record<string, string> }> {
    const cfg = this.requireOdpsConfig();
    const base = new URL(cfg.endpoint);
    const url = new URL(base.toString());
    const basePath = base.pathname.replace(/\/$/, '');
    url.pathname = `${basePath}${params.path}`;
    if (params.query) {
      for (const [k, v] of Object.entries(params.query)) {
        url.searchParams.set(k, v);
      }
    }

    const date = new Date().toUTCString();
    const headers: Record<string, string> = {
      Date: date,
      'x-odps-date': date,
    };
    if (params.accept) headers.Accept = params.accept;
    if (params.body !== undefined) {
      headers['Content-Type'] = params.contentType ?? 'application/xml';
      headers['Content-MD5'] = crypto
        .createHash('md5')
        .update(params.body, 'utf8')
        .digest('hex');
    }

    const authV2 = this.signOdpsRequestV2({
      method: params.method,
      url,
      endpointBasePath: basePath,
      headers,
    });
    headers.Authorization = authV2;

    const res1 = await fetch(url.toString(), {
      method: params.method,
      headers,
      body: params.body,
    });
    const text1 = await res1.text();
    const headers1: Record<string, string> = {};
    res1.headers.forEach((v, k) => {
      headers1[k.toLowerCase()] = v;
    });
    if (res1.status !== 403 || !text1.includes('SignatureNotMatch')) {
      return { status: res1.status, text: text1, headers: headers1 };
    }

    const region = this.odpsRegion();
    if (!region) return { status: res1.status, text: text1, headers: headers1 };

    const authV4 = this.signOdpsRequestV4({
      method: params.method,
      url,
      endpointBasePath: basePath,
      headers,
      region,
    });
    headers.Authorization = authV4;

    const res2 = await fetch(url.toString(), {
      method: params.method,
      headers,
      body: params.body,
    });
    const text2 = await res2.text();
    const headers2: Record<string, string> = {};
    res2.headers.forEach((v, k) => {
      headers2[k.toLowerCase()] = v;
    });
    return { status: res2.status, text: text2, headers: headers2 };
  }

  private extractXmlTag(xml: string, tag: string): string | null {
    const m = xml.match(new RegExp(`<${tag}>([^<]+)</${tag}>`, 'i'));
    return m?.[1]?.trim() ?? null;
  }

  private extractSqlResultTextFromInstanceXml(xml: string): string | null {
    const m = xml.match(/<Result\b([^>]*)>([\s\S]*?)<\/Result>/i);
    if (!m) return null;
    const attrs = m[1] ?? '';
    const text = (m[2] ?? '').trim();
    if (!text) return null;
    const hasBase64 = /Transform\s*=\s*"Base64"/i.test(attrs);
    if (!hasBase64) return text;
    try {
      return Buffer.from(text, 'base64').toString('utf8');
    } catch {
      return text;
    }
  }

  private async submitSql(sql: string, taskName: string): Promise<string> {
    const cfg = this.requireOdpsConfig();
    const xml = [
      '<Instance>',
      '<Job>',
      '<Priority>9</Priority>',
      '<Tasks>',
      '<SQL>',
      `<Name>${taskName}</Name>`,
      `<Query><![CDATA[${sql}]]></Query>`,
      '</SQL>',
      '</Tasks>',
      '</Job>',
      '</Instance>',
    ].join('');

    const res = await this.odpsFetch({
      method: 'POST',
      path: `/projects/${encodeURIComponent(cfg.project)}/instances`,
      body: xml,
      contentType: 'application/xml',
      accept: 'application/xml',
    });
    if (res.status < 200 || res.status >= 300) {
      const detail = res.text.trim();
      throw new Error(`ODPS submit failed: ${res.status}${detail ? ` ${detail.slice(0, 500)}` : ''}`);
    }
    const location = res.headers.location ?? '';
    const idFromLocation = location ? location.split('/').pop() : null;
    const id = idFromLocation || this.extractXmlTag(res.text, 'Id');
    if (!id) throw new Error('ODPS submit failed: missing instance Id');
    return id;
  }

  private extractXmlTagAll(xml: string, tag: string): string[] {
    const out: string[] = [];
    const re = new RegExp(`<${tag}>([^<]+)</${tag}>`, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml))) {
      out.push((m[1] ?? '').trim());
    }
    return out;
  }

  private async tryDetectTaskFailure(params: {
    instanceId: string;
    taskName?: string;
  }): Promise<string | null> {
    const cfg = this.requireOdpsConfig();
    const instanceId = params.instanceId;
    const taskName = params.taskName;

    const probes: Array<{ path: string; accept: string }> = [
      {
        path: `/projects/${encodeURIComponent(cfg.project)}/instances/${encodeURIComponent(instanceId)}/tasks`,
        accept: 'application/xml',
      },
      ...(taskName
        ? [
          {
            path: `/projects/${encodeURIComponent(cfg.project)}/instances/${encodeURIComponent(instanceId)}/tasks/${encodeURIComponent(taskName)}`,
            accept: 'application/xml',
          },
        ]
        : []),
    ];

    for (const p of probes) {
      const res = await this.odpsFetch({ method: 'GET', path: p.path, accept: p.accept });
      if (res.status < 200 || res.status >= 300) continue;
      const statuses = this.extractXmlTagAll(res.text, 'Status').map((s) => s.toUpperCase());
      if (statuses.some((s) => s.includes('FAILED') || s.includes('CANCELLED'))) {
        return res.text.trim().slice(0, 1200);
      }
      if (statuses.some((s) => s.includes('SUCCESS'))) return null;
    }
    return null;
  }

  private async waitInstanceSuccess(instanceId: string, taskName?: string): Promise<void> {
    const cfg = this.requireOdpsConfig();
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      const res = await this.odpsFetch({
        method: 'GET',
        path: `/projects/${encodeURIComponent(cfg.project)}/instances/${encodeURIComponent(instanceId)}`,
        accept: 'application/xml',
      });
      if (res.status >= 200 && res.status < 300) {
        const status = this.extractXmlTag(res.text, 'Status') ?? '';
        const isDone = status.toLowerCase().includes('terminated');
        if (isDone) {
          const failureDetail = await this.tryDetectTaskFailure({ instanceId, taskName });
          if (failureDetail) {
            throw new Error(`ODPS instance failed: ${failureDetail}`);
          }
          return;
        }
      }
      await new Promise((r) => setTimeout(r, 1200));
    }
    throw new Error('ODPS query timeout');
  }

  private parseOrderComparisonResult(text: string): Array<{
    period: 'THIS_YEAR' | 'LAST_YEAR';
    checkin_date: string;
    room_nights: number;
  }> {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const out: Array<{
      period: 'THIS_YEAR' | 'LAST_YEAR';
      checkin_date: string;
      room_nights: number;
    }> = [];

    for (const line of lines) {
      const cols = line.includes('\t') ? line.split('\t') : this.parseCsvLine(line);
      if (cols.length < 3) continue;
      const periodRaw = (cols[0] ?? '').trim();
      if (!periodRaw || periodRaw.toUpperCase() === 'PERIOD') continue;
      const period = periodRaw.toUpperCase();
      if (period !== 'THIS_YEAR' && period !== 'LAST_YEAR') continue;
      const checkin_date = (cols[1] ?? '').trim();
      const room_nights = Number((cols[2] ?? '').trim());
      if (!checkin_date || !Number.isFinite(room_nights)) continue;
      out.push({
        period: period as 'THIS_YEAR' | 'LAST_YEAR',
        checkin_date,
        room_nights,
      });
    }
    return out;
  }

  private parseBaofangInventoryResult(text: string): Array<{
    start_date: string;
    day_remain_room: number;
  }> {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const out: Array<{
      start_date: string;
      day_remain_room: number;
    }> = [];

    for (const line of lines) {
      const cols = line.includes('\t') ? line.split('\t') : this.parseCsvLine(line);
      if (cols.length < 2) continue;
      const start_date = (cols[0] ?? '').trim();
      if (!start_date || start_date.toLowerCase() === 'start_date') continue;
      const day_remain_room = Number((cols[1] ?? '').trim());
      if (!Number.isFinite(day_remain_room)) continue;
      out.push({ start_date, day_remain_room });
    }
    return out;
  }

  private async fetchSqlResult(instanceId: string, taskName: string): Promise<string> {
    const cfg = this.requireOdpsConfig();
    const tries: Array<{
      path: string;
      query?: Record<string, string>;
      accept?: string;
      parse?: (text: string) => string | null;
    }> = [
        {
          path: `/projects/${encodeURIComponent(cfg.project)}/instances/${encodeURIComponent(instanceId)}/results`,
          query: { taskname: taskName },
          accept: 'text/plain',
        },
        {
          path: `/projects/${encodeURIComponent(cfg.project)}/instances/${encodeURIComponent(instanceId)}/result`,
          query: { taskname: taskName },
          accept: 'text/plain',
        },
        {
          path: `/projects/${encodeURIComponent(cfg.project)}/instances/${encodeURIComponent(instanceId)}/tasks/${encodeURIComponent(taskName)}/results`,
          accept: 'text/plain',
        },
        {
          path: `/projects/${encodeURIComponent(cfg.project)}/instances/${encodeURIComponent(instanceId)}`,
          query: { taskname: taskName, result: '' },
          accept: 'application/xml',
          parse: (text) => this.extractSqlResultTextFromInstanceXml(text),
        },
        {
          path: `/projects/${encodeURIComponent(cfg.project)}/instances/${encodeURIComponent(instanceId)}/tasks/${encodeURIComponent(taskName)}/result`,
          accept: 'application/xml',
          parse: (text) => this.extractSqlResultTextFromInstanceXml(text),
        },
      ];

    let lastStatus = 0;
    for (const t of tries) {
      const resGet = await this.odpsFetch({
        method: 'GET',
        path: t.path,
        query: t.query,
        accept: t.accept ?? 'text/plain',
      });
      lastStatus = resGet.status;
      if (resGet.status >= 200 && resGet.status < 300) {
        const parsed = t.parse ? t.parse(resGet.text) : resGet.text;
        if (parsed) return parsed;
      }

      if (resGet.status === 405) {
        const resPost = await this.odpsFetch({
          method: 'POST',
          path: t.path,
          query: t.query,
          accept: t.accept ?? 'text/plain',
          body: '',
          contentType: 'text/plain',
        });
        lastStatus = resPost.status;
        if (resPost.status >= 200 && resPost.status < 300) {
          const parsed = t.parse ? t.parse(resPost.text) : resPost.text;
          if (parsed) return parsed;
        }
      }
    }
    throw new Error(`ODPS fetch result failed: ${lastStatus}`);
  }

  private odpsConfig(): {
    accessId?: string;
    secretAccessKey?: string;
    project?: string;
    endpoint?: string;
  } {
    const fromEnv = {
      accessId: process.env.ODPS_ACCESS_ID,
      secretAccessKey: process.env.ODPS_SECRET_ACCESS_KEY,
      project: process.env.ODPS_PROJECT,
      endpoint: process.env.ODPS_ENDPOINT,
    };
    if (fromEnv.accessId && fromEnv.secretAccessKey && fromEnv.project && fromEnv.endpoint) {
      return fromEnv;
    }

    const yamlPath =
      process.env.ODPS_CONFIG_PATH ??
      path.resolve(process.cwd(), 'sql', 'odps.yaml');

    if (!fs.existsSync(yamlPath)) {
      return fromEnv;
    }

    const text = fs.readFileSync(yamlPath, 'utf8');
    const pick = (key: string): string | undefined => {
      const m = text.match(new RegExp(`^\\s*${key}\\s*:\\s*"?([^"\\n]+)"?\\s*$`, 'm'));
      return m?.[1]?.trim();
    };

    return {
      accessId: fromEnv.accessId ?? pick('access_id'),
      secretAccessKey: fromEnv.secretAccessKey ?? pick('secret_access_key'),
      project: fromEnv.project ?? pick('project'),
      endpoint: fromEnv.endpoint ?? pick('endpoint'),
    };
  }

  private targetDate(req: RecommendationRequest): string {
    const d = req.targetDate ? new Date(req.targetDate) : new Date();
    return toIsoDate(d);
  }

  private seedBase(req: RecommendationRequest): string {
    const cfg = this.odpsConfig();
    return [
      cfg.project ?? 'unknown_project',
      cfg.endpoint ?? 'unknown_endpoint',
      this.targetDate(req),
    ].join('|');
  }

  private hash32(seed: string): number {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i += 1) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  private pickInt(seed: string, min: number, max: number): number {
    const a = Math.min(min, max);
    const b = Math.max(min, max);
    const span = b - a + 1;
    return a + (this.hash32(seed) % span);
  }

  private addDays(d: Date, days: number): Date {
    const next = new Date(d);
    next.setDate(next.getDate() + days);
    return next;
  }

  private daysBetween(a: Date, b: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    const x = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    const y = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((y - x) / msPerDay);
  }

  private buildDateSeries(endIso: string, days: number): string[] {
    const end = new Date(endIso);
    const start = this.addDays(end, -Math.max(0, days - 1));
    const out: string[] = [];
    for (let i = 0; i < days; i += 1) {
      out.push(toIsoDate(this.addDays(start, i)));
    }
    return out;
  }

  async getMarketSnapshot(req: RecommendationRequest): Promise<MarketSnapshot> {
    const snapshotDate = this.targetDate(req);
    const baseSeed = this.seedBase(req);
    const dates = this.buildDateSeries(snapshotDate, 30);

    const otaMin = 560;
    const otaMax = 820;
    const priceSeries: PricePoint[] = dates.map((date) => {
      const span = otaMax - otaMin + 1;
      const price = otaMin + Math.floor(Math.random() * span);
      return { date, price };
    });

    const competitorPriceSeries: PricePoint[] = dates.map((date, idx) => {
      const anchor = priceSeries[idx]?.price ?? otaMin;
      const noise = this.pickInt(`${baseSeed}:comp:${date}`, -18, 18);
      return { date, price: Math.max(1, Math.round(anchor * 0.95 + 22 + noise)) };
    });
    const startDate = req.startDate?.trim() ?? '';
    const endDate = req.endDate?.trim() ?? '';
    const hid = req.hid?.trim() ?? '';
    let packageRemaining: Array<{ date: string; remaining: number }> = [];

    if (
      hid &&
      /^\d+$/.test(hid) &&
      /^\d{4}-\d{2}-\d{2}$/.test(startDate) &&
      /^\d{4}-\d{2}-\d{2}$/.test(endDate)
    ) {
      const template = this.loadSqlTemplate('get_baofang_inventory.sql');
      const sql = this.renderTemplate(template, {
        hid,
        start_date: startDate,
        end_date: endDate,
      });
      const taskName = 'get_baofang_inventory';
      const instanceId = await this.submitSql(sql, taskName);
      await this.waitInstanceSuccess(instanceId, taskName);
      const raw = await this.fetchSqlResult(instanceId, taskName);
      const rows = this.parseBaofangInventoryResult(raw);
      packageRemaining = rows.map((row) => ({
        date: row.start_date,
        remaining: Math.max(0, row.day_remain_room),
      }));
    }

    return {
      snapshotDate,
      priceSeries,
      competitorPriceSeries,
      inventoryStatus: {
        packageRemaining,
      },
    };
  }

  async getHistoricalOrders(req: RecommendationRequest): Promise<HistoricalOrder[]> {
    const startDate = req.startDate?.trim() ?? '';
    const endDate = req.endDate?.trim() ?? '';
    const hid = req.hid?.trim() ?? '';
    if (!hid || !startDate || !endDate) return [];
    if (!/^\d+$/.test(hid)) return [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return [];

    const template = this.loadSqlTemplate('order_comparison_last_this_year.sql');
    const sql = this.renderTemplate(template, {
      hid,
      start_date: startDate,
      end_date: endDate,
    });

    const taskName = 'order_comparison_last_this_year';
    const instanceId = await this.submitSql(sql, taskName);
    await this.waitInstanceSuccess(instanceId, taskName);
    const raw = await this.fetchSqlResult(instanceId, taskName);
    const rows = this.parseOrderComparisonResult(raw);

    return rows
      .filter((r) => r.room_nights > 0)
      .map((r) => ({
        orderId: `ODPS-ROOM_NIGHTS-${hid}-${r.period}-${r.checkin_date}`,
        createdAt: new Date(`${r.checkin_date}T00:00:00.000Z`).toISOString(),
        checkInDate: r.checkin_date,
        nights: r.room_nights,
      }));
  }

  async getHistoricalPrices(req: RecommendationRequest): Promise<PricePoint[]> {
    const snapshotDate = this.targetDate(req);
    const baseSeed = this.seedBase(req);
    const dates = this.buildDateSeries(snapshotDate, 90);
    return dates.map((date) => {
      const price = this.pickInt(`${baseSeed}:histPrice:${date}`, 500, 1800);
      return { date, price };
    });
  }

  async getCompetitorPrices(req: RecommendationRequest): Promise<PricePoint[]> {
    const snapshotDate = this.targetDate(req);
    const baseSeed = this.seedBase(req);
    const dates = this.buildDateSeries(snapshotDate, 30);
    const base = this.pickInt(`${baseSeed}:compPrice:base`, 540, 840);
    return dates.map((date, idx) => {
      const drift = idx * 1.4;
      const wave = Math.round(Math.sin(idx / 5) * 18);
      const noise = this.pickInt(`${baseSeed}:compPrice:${date}`, -18, 18);
      return { date, price: Math.max(1, Math.round(base + drift + wave + noise)) };
    });
  }
}
