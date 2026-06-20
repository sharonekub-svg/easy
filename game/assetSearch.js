/* ===== Meccha Chameleon — Asset search (Poly Pizza + Sketchfab) =====
 * Thin wrappers over the two public model APIs, normalised to one result shape:
 *   { source, id, name, author, license, attribution, thumb, download, viewer, tris }
 *
 * This is the CURATION layer of the asset pipeline: search a keyword, preview
 * results, then save the ones you want into assets/models/ (loaded via
 * game/models.js). Keys are passed in by the caller — never hard-code them.
 *
 * Notes / gotchas:
 * - Poly Pizza returns a DIRECT .glb url (result.download) — easy to load.
 * - Sketchfab SEARCH needs no auth; DOWNLOAD needs your token AND returns a
 *   zip archive (gltf + textures), so loading it in-browser needs unzipping
 *   (or a small backend). For the demo, use it to browse + grab the model, and
 *   download the .glb/zip from Sketchfab itself.
 * - Both are cross-origin: Sketchfab's API sends CORS headers; Poly Pizza may
 *   need a proxy if your browser blocks it (see README note).
 */

// ---------------- Poly Pizza ----------------
export async function searchPolyPizza(query, apiKey, limit) {
  if (!apiKey) throw new Error('Poly Pizza needs a free API key (poly.pizza/api)');
  const url = `https://api.poly.pizza/v1.1/search/${encodeURIComponent(query)}?Limit=${limit || 20}`;
  const res = await fetch(url, { headers: { 'x-auth-token': apiKey } });
  if (!res.ok) throw new Error('Poly Pizza ' + res.status + ' ' + res.statusText);
  const data = await res.json();
  return (data.results || []).map((r) => ({
    source: 'polypizza',
    id: r.ID,
    name: r.Title || 'Untitled',
    author: (r.Creator && r.Creator.Username) || 'unknown',
    license: r.Licence || r.License || 'CC',
    attribution: r.Attribution || (r.Title + ' by ' + ((r.Creator && r.Creator.Username) || '?')),
    thumb: r.Thumbnail || (r.Images && r.Images.Thumbnail),
    download: r.Download || null,        // direct .glb
    viewer: r.ID ? 'https://poly.pizza/m/' + r.ID : null,
    tris: r.TriCount || null
  }));
}

// ---------------- Sketchfab ----------------
export async function searchSketchfab(query, opts) {
  opts = opts || {};
  const u = new URL('https://api.sketchfab.com/v3/search');
  u.searchParams.set('type', 'models');
  u.searchParams.set('q', query);
  u.searchParams.set('downloadable', 'true');           // only models you can download
  u.searchParams.set('count', String(opts.count || 24));
  if (opts.license) u.searchParams.set('license', opts.license); // e.g. 'cc0','by','by-sa'
  if (opts.maxTris) u.searchParams.set('max_face_count', String(opts.maxTris));
  const headers = opts.token ? { Authorization: 'Token ' + opts.token } : {};
  const res = await fetch(u, { headers });
  if (!res.ok) throw new Error('Sketchfab ' + res.status + ' ' + res.statusText);
  const data = await res.json();
  return (data.results || []).map((m) => ({
    source: 'sketchfab',
    id: m.uid,
    name: m.name || 'Untitled',
    author: (m.user && (m.user.displayName || m.user.username)) || 'unknown',
    license: (m.license && (m.license.label || m.license.slug)) || '',
    attribution: (m.name || '') + ' by ' + ((m.user && (m.user.displayName || m.user.username)) || '?'),
    thumb: m.thumbnails && m.thumbnails.images && m.thumbnails.images.length ? m.thumbnails.images[0].url : null,
    download: null,                                       // resolved via sketchfabDownload()
    viewer: m.viewerUrl || ('https://sketchfab.com/3d-models/' + m.uid),
    tris: (m.faceCount != null ? m.faceCount : null),
    isDownloadable: !!m.isDownloadable
  }));
}

// Resolve a temporary download for a Sketchfab model (requires your token).
// Returns { gltfZip, glb, usdz } — note gltfZip is a .zip you must extract.
export async function sketchfabDownload(uid, token) {
  if (!token) throw new Error('Sketchfab download needs your API token (sketchfab.com/settings/password → API)');
  const res = await fetch('https://api.sketchfab.com/v3/models/' + uid + '/download', { headers: { Authorization: 'Token ' + token } });
  if (!res.ok) throw new Error('Sketchfab download ' + res.status + ' (is the model downloadable?)');
  const d = await res.json();
  return { gltfZip: d.gltf && d.gltf.url, glb: d.glb && d.glb.url, usdz: d.usdz && d.usdz.url };
}

// One call that maps a prompt keyword to the best candidates across both
// sources (Poly Pizza first — direct glb; Sketchfab as backup browse).
export async function searchAll(query, keys, limit) {
  const out = { polypizza: [], sketchfab: [], errors: [] };
  await Promise.all([
    (async () => { try { out.polypizza = await searchPolyPizza(query, keys.polyPizza, limit); } catch (e) { out.errors.push('polypizza: ' + e.message); } })(),
    (async () => { try { out.sketchfab = await searchSketchfab(query, { token: keys.sketchfab, count: limit, license: keys.sketchfabLicense }); } catch (e) { out.errors.push('sketchfab: ' + e.message); } })()
  ]);
  return out;
}
