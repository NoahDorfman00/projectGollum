/**
 * Fuzzy name matching engine.
 *
 * Matching priority:
 *   1. Exact full name  (case-insensitive, trimmed)
 *   2. Exact alias
 *   3. First-name-only  (single-token input vs first word of name)
 *   4. Prefix match     (input is prefix of name or alias)
 *   5. Levenshtein ≤ 2  on name or any alias
 *
 * Each tier is evaluated in order; the first tier that produces results wins.
 * Within a tier the original guest objects are returned so the caller can
 * present disambiguation when there are multiple hits.
 */

const FuzzyMatch = (() => {

  /* ── helpers ── */

  function normalize(s) {
    return s.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
    return dp[m][n];
  }

  function firstName(fullName) {
    return normalize(fullName).split(' ')[0];
  }

  /* ── public API ── */

  /**
   * Search guests for the best match(es).
   * @param {string} input        - raw user input
   * @param {Array}  guests       - array of guest objects { id, name, aliases, groupId }
   * @returns {{ tier: number, matches: Array }}
   *          tier 0 = no match, 1–5 = priority tier from above
   */
  function search(input, guests) {
    const q = normalize(input);
    if (!q) return { tier: 0, matches: [] };

    // Tier 1 — exact full-name match
    const t1 = guests.filter(g => normalize(g.name) === q);
    if (t1.length) return { tier: 1, matches: t1 };

    // Tier 2 — exact alias match
    const t2 = guests.filter(g =>
      (g.aliases || []).some(a => normalize(a) === q)
    );
    if (t2.length) return { tier: 2, matches: t2 };

    // Tier 3 — first-name match (only when input is a single token)
    const tokens = q.split(' ');
    if (tokens.length === 1) {
      const t3 = guests.filter(g => firstName(g.name) === q);
      // also check aliases that are a single token
      const t3alias = guests.filter(g =>
        (g.aliases || []).some(a => {
          const na = normalize(a);
          return na.split(' ').length === 1 && na === q;
        })
      );
      const merged = dedup([...t3, ...t3alias]);
      if (merged.length) return { tier: 3, matches: merged };
    }

    // Tier 4 — prefix match
    const t4 = guests.filter(g => {
      if (normalize(g.name).startsWith(q)) return true;
      return (g.aliases || []).some(a => normalize(a).startsWith(q));
    });
    if (t4.length) return { tier: 4, matches: t4 };

    // Tier 5 — Levenshtein ≤ 2
    const maxDist = 2;
    const t5 = guests.filter(g => {
      if (levenshtein(normalize(g.name), q) <= maxDist) return true;
      if (levenshtein(firstName(g.name), q) <= maxDist) return true;
      return (g.aliases || []).some(a => levenshtein(normalize(a), q) <= maxDist);
    });
    if (t5.length) return { tier: 5, matches: t5 };

    return { tier: 0, matches: [] };
  }

  function dedup(arr) {
    const seen = new Set();
    return arr.filter(g => {
      if (seen.has(g.id)) return false;
      seen.add(g.id);
      return true;
    });
  }

  return { search, normalize, levenshtein };
})();
