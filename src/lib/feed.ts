import articles from '../data/articles.json';
import dashboards from '../data/dashboards.json';
import videos from '../data/videos.json';
import links from '../data/links.json';
import catalog from '../data/catalog.json';

export type Section = 'creations' | 'outils' | 'data';

export interface FeedItem {
  id: string;
  title: string;
  section: Section;
  kind: string;
  url: string;
  date: string;
  updated?: string;
  summary: string;
  tags: string[];
}

export const SECTION_LABELS: Record<Section, string> = {
  creations: 'Créations',
  outils: 'Outils',
  data: 'Réalisations Data',
};

const strip = (html: string) =>
  html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const clip = (s: string, n = 140) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

export function getFeed(): FeedItem[] {
  const items: FeedItem[] = [];

  for (const a of articles as any[]) {
    items.push({ id: `article-${a.slug}`, title: a.title, section: 'data', kind: 'Article', url: `/data/articles#${a.slug}`, date: a.date, summary: clip(strip(a.html)), tags: a.tags ?? [] });
  }
  for (const d of dashboards as any[]) {
    if (!d.date) continue;
    items.push({ id: `dashboard-${d.slug}`, title: d.title, section: 'data', kind: 'Rapport', url: `/data/dashboards#${d.slug}`, date: d.date, summary: clip(strip(d.html)), tags: [] });
  }
  for (const v of videos as any[]) {
    if (!v.date) continue;
    items.push({ id: `video-${v.slug}`, title: v.title, section: 'data', kind: 'Vidéo', url: `/data/videos#${v.slug}`, date: v.date, summary: clip(v.desc ?? ''), tags: [] });
  }
  for (const l of links as any[]) {
    if (!l.date) continue;
    items.push({ id: `lien-${l.slug}`, title: l.title, section: 'data', kind: 'Lien', url: `/data/liens#${l.slug}`, date: l.date, summary: clip(l.note ?? ''), tags: l.tags ?? [] });
  }
  for (const c of catalog as any[]) {
    items.push({ id: `catalog-${c.id}`, title: c.title, section: c.section, kind: c.kind, url: c.url, date: c.date, updated: c.updated, summary: c.summary, tags: [] });
  }

  return items.sort((a, b) => b.date.localeCompare(a.date));
}

export const lastActivity = (i: FeedItem) => i.updated ?? i.date;

export const formatDate = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
