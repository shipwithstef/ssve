# Cloudflare Workers AI — Capabilities

Analyzed: 2026-06-13 (live integration into example-marketplace; all claims live-verified)

## Space
Serverless AI inference on Cloudflare's own edge GPUs. Self-hosts OPEN-WEIGHT models (Llama, Kimi, Flux, Whisper) — data goes to Cloudflare, NOT the model author. Covers text, image-gen, ASR, vision, embeddings, TTS, translation.

## Two REST call surfaces
- OpenAI-compatible POST /accounts/{id}/ai/v1/chat/completions — TEXT + embeddings only; drop-in for OpenAI/OpenRouter code. NO vision/audio.
- Native run POST /accounts/{id}/ai/run/{@cf/model} — everything else (image -> {result:{image:base64}}; ASR whisper body {audio:<base64>} -> {result:{text}}; vision; TTS).

## GOTCHAS (each cost real debugging time, 2026-06-13)
1. Inference needs the "Workers AI READ" permission group, NOT just "Workers AI Write" — a Write-only token 401s (code 10000) on every inference call. Create token with BOTH Read+Write.
2. IP-restricted tokens fail from server/edge runtimes (allowlisted dev IP works, edge IPs 401). Function-runtime token must have NO IP restriction; use a dedicated narrowly-scoped Workers-AI token.
3. Capacity errors return HTTP 200 with an errors[] body, not non-2xx. AiError code 3040 "Capacity temporarily exceeded" — inspect data.errors, retry with backoff.
4. Newest/hot models throttle: kimi-k2.7-code (1T, 2026-06-12) hit 3040 on ~4/8. Stable 6/6: @cf/meta/llama-3.3-70b-instruct-fp8-fast (good default), @cf/moonshotai/kimi-k2.6, @cf/openai/gpt-oss-120b.
5. Reasoning models (Kimi) put thinking in .reasoning_content, answer in .content; set max_tokens >=2048 (8192 safe) or content comes back null/finish_reason:length. reasoning_effort:"low" trims it.

## Pricing / limits (verified 2026-06-12/13)
- Free = 10,000 Neurons/day on BOTH Free and Paid plans (Paid removes the hard cap; overage $0.011/1000 Neurons = $11/M). Neuron = USD/0.000011.
- Frontier text ~20-35 Neurons/call -> ~300-450 calls/day free. $10k startup credits (bootstrapped) ~= 900M Neurons.
- Flux-1-schnell 4.8 Neurons/512px-tile (~520 1024px imgs/day free). Whisper 25MB audio cap.
- Kimi K2.7 context = 262,144 (256k), NOT 1M (that's Xiaomi MiMo-v2.5-Pro). function_calling/vision/reasoning true.

## EU residency
Default routes to nearest GPU globally (can be US). Strict EU-only = Enterprise "Custom Regions" (not self-serve). Bootstrapped: GDPR DPA+SCC + no-training + open-weights-self-hosted is strong, just not strict residency.
