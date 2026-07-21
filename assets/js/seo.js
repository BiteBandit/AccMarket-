import { supabase } from './supabase-config.js';

export async function applySEOForListing() {
  // 1. Get the listing ID from the URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const listingId = urlParams.get('id');

  if (!listingId) return;

  try {
    // 2. Query Supabase for the specific listing
    const { data: row, error } = await supabase
      .from('verifications')
      .select('data')
      .eq('id', listingId)
      .maybeSingle();

    if (error || !row) return;

    let data = row.data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (e) { data = {}; }
    }

    // 3. Extract metadata details
    const platform = data.platform || 'Account';
    const username = data.username ? `@${data.username}` : '';
    const price = data.price ? `$${data.price}` : '';
    const followers = data.followers ? `${data.followers} Followers` : '';

    const titleText = `Buy ${platform} Account ${username} ${price} | AccMarket`;
    const descriptionText = `Buy verified ${platform} account ${username}. ${followers} available on AccMarket. Secure escrow transaction guaranteed.`;

    // 4. Update page title
    document.title = titleText;

    // Helper function to create or update meta tags
    const setMetaTag = (selector, attribute, value, content) => {
      let element = document.querySelector(selector);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, value);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // 5. Update meta tags
    setMetaTag('meta[name="description"]', 'name', 'description', descriptionText);
    setMetaTag('meta[property="og:title"]', 'property', 'og:title', titleText);
    setMetaTag('meta[property="og:description"]', 'property', 'og:description', descriptionText);
    setMetaTag('meta[property="og:url"]', 'property', 'og:url', window.location.href);
    setMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', titleText);
    setMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', descriptionText);

  } catch (err) {
    console.error('Error applying dynamic SEO:', err);
  }
}

// Automatically run on load
document.addEventListener('DOMContentLoaded', applySEOForListing);
