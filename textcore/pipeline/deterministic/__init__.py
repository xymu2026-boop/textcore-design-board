"""Deterministic scaffold helpers for future pipeline stages.

The functions in this package are pure, local-only baselines. They do not call
LLMs, mutate course state, or attach themselves to the current runner.
"""

from textcore.pipeline.deterministic.quality_gates import check_version_ratio
from textcore.pipeline.deterministic.sentence_ranker import (
    DEFAULT_KEYWORD_SETS,
    important_sentences,
    score_sentence,
    sentence_split,
)
from textcore.pipeline.deterministic.transcript_cleaner import clean_transcript_text
from textcore.pipeline.deterministic.version_scaffold import build_chunk_scaffolds

__all__ = [
    "DEFAULT_KEYWORD_SETS",
    "build_chunk_scaffolds",
    "check_version_ratio",
    "clean_transcript_text",
    "important_sentences",
    "score_sentence",
    "sentence_split",
]
