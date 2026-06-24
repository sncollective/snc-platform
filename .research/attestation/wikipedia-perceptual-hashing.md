---
source_handle: wikipedia-perceptual-hashing
fetched: 2026-06-24
source_url: https://en.wikipedia.org/wiki/Perceptual_hashing
provenance: source-direct
---

# Perceptual Hashing — Wikipedia

## Paraphrased Summary

Wikipedia's article on perceptual hashing, a technique for near-duplicate detection of multimedia content. Directly relevant to the deduplication problem where multiple viewers clip the same moment of a stream.

## Definition

Perceptual hashing is "a fingerprinting algorithm that produces a snippet, hash, or fingerprint of various forms of multimedia." Unlike cryptographic hashing, it produces similar hashes for perceptually similar content, enabling near-duplicate detection. Functions as "a locality-sensitive hash, which is analogous if features of the multimedia are similar."

## Algorithms Documented

- **pHash** — open-source library, foundational algorithm
- **DCT-DWT schemes** — classical approaches
- **NeuralHash** (Apple, 2021) — deep learning based
- **DINOHash** (2025) — current state-of-the-art per article

## Use Cases

**Copyright & Content Moderation:**
- Detecting online copyright infringement
- Identifying CSAM via PhotoDNA (Microsoft, 2009)
- Video copy detection and authentication

**UGC Deduplication:**
- Image database searching and matching
- Video content identification across platforms

## Platforms Using It

- Google Image Search (confirmed 2017)
- Meta (Stable Signature watermarking, October 2023)
- Apple (NeuralHash, later discontinued)

## Limitation

Research has demonstrated vulnerability to adversarial attacks — hash collisions achievable "with minor changes applied to the images."

## Key Passage

> "A fingerprinting algorithm that produces a snippet, hash, or fingerprint of various forms of multimedia" — functions as a locality-sensitive hash for similar content.
