// Kiba — Affiliate Link Service
// Pure utility for generating affiliate URLs from product data.
// D-020: This file imports ZERO scoring modules. Affiliate logic is architecturally
// isolated from the scoring engine. No functions in this file reference scores,
// ingredient data, or any scoring types.
// D-053: Chewy shows estimated price ("Est. ~$X.XX"). Amazon shows no price (TOS).

import { AFFILIATE_CONFIG } from '../config/affiliateConfig';
import type { Product } from '../types';

// ─── Types ──────────────────────────────────────────────

export interface AffiliateLink {
  retailer: 'chewy' | 'amazon';
  url: string;
  estimatedPrice: number | null;  // Chewy only — Amazon TOS prohibits showing price
  label: string;                   // "View on Chewy" or "Check Price on Amazon"
  priceLabel: string | null;       // "Est. ~$45.99" or null (Amazon)
}

// ─── URL Builders ────────────────────────────────────────

/**
 * Build Chewy affiliate URL from source_url or chewy_sku.
 * Priority: source_url (already a full Chewy URL) > chewy_sku (construct URL).
 */
function buildChewyUrl(product: Product): string | null {
  const { tag } = AFFILIATE_CONFIG.chewy;

  // source_url is typically a full Chewy product page URL from the scraper
  if (product.source_url && product.source_url.includes('chewy.com')) {
    const separator = product.source_url.includes('?') ? '&' : '?';
    return `${product.source_url}${separator}utm_source=partner&utm_medium=affiliate&utm_id=${tag}`;
  }

  // Fall back to chewy_sku if available
  if (product.chewy_sku) {
    return `${AFFILIATE_CONFIG.chewy.baseUrl}/dp/${product.chewy_sku}?utm_source=partner&utm_medium=affiliate&utm_id=${tag}`;
  }

  return null;
}

/**
 * Build Amazon affiliate URL from ASIN.
 * D-053: Amazon Associates TOS — price must NOT be displayed.
 */
function buildAmazonUrl(product: Product): string | null {
  if (!product.asin) return null;
  const { tag } = AFFILIATE_CONFIG.amazon;
  return `${AFFILIATE_CONFIG.amazon.baseUrl}/dp/${product.asin}?tag=${tag}`;
}

// ─── Price Formatting ────────────────────────────────────

/**
 * Format Chewy estimated price per D-053: "Est. ~$X.XX"
 * Returns null if no price data.
 */
function formatEstimatedPrice(price: number | null): string | null {
  if (price == null || price <= 0) return null;
  return `Est. ~$${price.toFixed(2)}`;
}

// ─── Public API ──────────────────────────────────────────

/**
 * Get available affiliate links for a product.
 * Returns empty array if no retailer data or all retailers disabled.
 *
 * Resolution priority per retailer:
 * 1. affiliate_links JSONB (manually curated, highest priority)
 * 2. source_url / chewy_sku → Chewy URL builder
 * 3. asin → Amazon URL builder
 *
 * D-020: This function does NOT check scores. Score gating is handled
 * by the UI component (AffiliateBuyButtons), not here.
 */
export function getAffiliateLinks(product: Product): AffiliateLink[] {
  const links: AffiliateLink[] = [];

  // ─── Chewy ──────────────────────────────────────────
  if (AFFILIATE_CONFIG.chewy.enabled) {
    let chewyUrl: string | null = null;

    // Check manually curated affiliate_links first
    if (product.affiliate_links?.chewy) {
      chewyUrl = product.affiliate_links.chewy;
    } else {
      chewyUrl = buildChewyUrl(product);
    }

    if (chewyUrl) {
      links.push({
        retailer: 'chewy',
        url: chewyUrl,
        estimatedPrice: product.price,
        label: 'View on Chewy',
        priceLabel: formatEstimatedPrice(product.price),
      });
    }
  }

  // ─── Amazon ─────────────────────────────────────────
  if (AFFILIATE_CONFIG.amazon.enabled) {
    let amazonUrl: string | null = null;

    if (product.affiliate_links?.amazon) {
      amazonUrl = product.affiliate_links.amazon;
    } else {
      amazonUrl = buildAmazonUrl(product);
    }

    if (amazonUrl) {
      links.push({
        retailer: 'amazon',
        url: amazonUrl,
        estimatedPrice: null,  // D-053: Never show Amazon price
        label: 'Check Price on Amazon',
        priceLabel: null,
      });
    }
  }

  return links;
}

/**
 * Check if any affiliate links are available for a product.
 * Quick boolean check without building full link objects.
 */
export function hasAffiliateLinks(product: Product): boolean {
  if (!AFFILIATE_CONFIG.chewy.enabled && !AFFILIATE_CONFIG.amazon.enabled) return false;

  if (AFFILIATE_CONFIG.chewy.enabled) {
    if (product.affiliate_links?.chewy) return true;
    if (product.source_url?.includes('chewy.com')) return true;
    if (product.chewy_sku) return true;
  }

  if (AFFILIATE_CONFIG.amazon.enabled) {
    if (product.affiliate_links?.amazon) return true;
    if (product.asin) return true;
  }

  return false;
}

/**
 * Get the first available affiliate link for a product.
 * Used by PantryCard for a single "Reorder" button on low stock.
 * Prefers Chewy (typically cheaper for pet food) over Amazon.
 */
export function getFirstAffiliateLink(product: Product): AffiliateLink | null {
  const links = getAffiliateLinks(product);
  return links.length > 0 ? links[0] : null;
}
