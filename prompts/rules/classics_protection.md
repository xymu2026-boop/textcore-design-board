# Classics Protection Rules

- Text inside `<PRESERVE>...</PRESERVE>` is protected. Output the original span exactly when quoting it; do not rewrite, complete, or normalize it from memory.
- Classical Chinese and poetry originals must not be silently corrected by the LLM. If a canonical text is provided by the reference service, use it as the authoritative text and keep transcript differences in `review_flags`.
- If a suspected classical or poetry passage cannot be confidently identified, add a review flag instead of guessing.
- `classics_candidates.raw_span` must be a span found in the provided transcript data. Do not fill it with memorized canonical text.
- Translation, notes, and appreciation should prefer provided reference-service fields. If they are absent, mark uncertainty instead of inventing source-backed claims.
