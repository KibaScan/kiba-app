// Kiba — M9 Community Blog Service
// Read-only access to admin-authored posts. blog_posts table: migration 043
// (RLS = public read where is_published=true). All writes via service role,
// not from the app.

import { supabase } from './supabase';
import { isOnline } from '../utils/network';

export interface BlogPost {
  id: string;
  title: string;
  subtitle: string | null;
  cover_image_url: string | null;
  body_markdown: string;
  published_at: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

const DEFAULT_LIMIT = 20;
const COLUMNS = 'id, title, subtitle, cover_image_url, body_markdown, published_at, is_published, created_at, updated_at';

export async function fetchPublishedPosts(limit: number = DEFAULT_LIMIT): Promise<BlogPost[]> {
  if (!(await isOnline())) return [];

  try {
    const { data, error } = await supabase
      .from('blog_posts')
      .select(COLUMNS)
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data as BlogPost[];
  } catch (e) {
    console.error('[fetchPublishedPosts] FAILED:', e);
    return [];
  }
}

export async function fetchPostById(id: string): Promise<BlogPost | null> {
  if (!(await isOnline())) return null;

  try {
    const { data, error } = await supabase
      .from('blog_posts')
      .select(COLUMNS)
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return data as BlogPost;
  } catch (e) {
    console.error('[fetchPostById] FAILED:', e);
    return null;
  }
}
