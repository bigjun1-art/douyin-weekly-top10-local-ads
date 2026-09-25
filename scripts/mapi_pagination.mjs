// Shared implementation is bundled in each skill; no cross-skill imports.
export function parseLosslessJson(text) {
  let output = '', i = 0;
  while (i < text.length) {
    if (text[i] === '"') {
      const start = i++;
      while (i < text.length) { if (text[i] === '\\') i += 2; else if (text[i++] === '"') break; }
      output += text.slice(start, i);
    } else if (text[i] === '-' || /[0-9]/.test(text[i])) {
      const match = text.slice(i).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
      if (!match) throw new Error('INVALID_JSON_NUMBER');
      const token = match[0];
      output += /^-?\d+$/.test(token) && !Number.isSafeInteger(Number(token)) ? JSON.stringify(token) : token;
      i += token.length;
    } else output += text[i++];
  }
  return JSON.parse(output);
}
export function assertSafeNumbers(value) {
  if (typeof value === 'number' && (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))) throw new Error('UNSAFE_NUMERIC_INPUT');
  if (value && typeof value === 'object') for (const v of Object.values(value)) assertSafeNumbers(v);
}
const at = (root, path) => path.split('.').reduce((v,k)=>v?.[k],root);
function put(root,path,value) { const parts=path.split('.'); const last=parts.pop(); let parent=root; for(const p of parts) parent=parent[p]; parent[last]=value; }
export async function collectCursorPages(first, fetchNext, options = {}) {
  const o = {listPath:'video_list', pageInfoPath:'page_info', cursorKey:'cursor', moreKey:'has_more', idKey:'item_id', maxPages:100, ...options};
  if (!Number.isSafeInteger(o.maxPages) || o.maxPages < 1 || o.maxPages > 1000) throw new Error('INVALID_MAX_PAGES');
  let current=first, pages=0; const cursors=new Set(), rows=new Map();
  while (true) {
    if (Number(current.code ?? 0)!==0) throw new Error(`PAGINATION_API_ERROR:${current.code}`);
    const list=at(current.data,o.listPath), info=at(current.data,o.pageInfoPath);
    if (!Array.isArray(list) || !info || typeof info[o.moreKey]!=='boolean') throw new Error('INCOMPLETE_PAGINATION_METADATA');
    pages++;
    for (const row of list) {
      const raw=row[o.idKey]; if (raw==null || !/^\d+$/.test(String(raw)) || (typeof raw==='number' && !Number.isSafeInteger(raw))) throw new Error('INVALID_PAGE_ID');
      const id=String(raw); if (!rows.has(id)) rows.set(id,row);
    }
    if (!info[o.moreKey]) break;
    const cursor=info[o.cursorKey];
    if (cursor==null || cursor==='' || cursors.has(String(cursor)) || pages>=o.maxPages || !list.length) throw new Error('PAGINATION_INCOMPLETE_OR_REPEATED_CURSOR');
    cursors.add(String(cursor)); current=await fetchNext(String(cursor));
  }
  const result=structuredClone(first);put(result.data,o.listPath,[...rows.values()]);put(result.data,o.pageInfoPath,at(current.data,o.pageInfoPath));
  result.data.paginationVerification={complete:true,pages,uniqueCount:rows.size};return result;
}
