#!/usr/bin/env bash
# Download logo images for the exemplar bank.
# Strategy: try high-res /apple-touch-icon.png first (often 180-512px PNG with transparency),
# then /favicon.svg, then fall back to Google favicon proxy at sz=256.
# Re-runnable; skips files that already exist.

set -euo pipefail
cd "$(dirname "$0")"
mkdir -p originals

# Format: id|domain|brand_name|category
ENTRIES=$(cat <<'EOF'
A1|stripe.com|Stripe|wordmark-iconic
A2|linear.app|Linear|wordmark-iconic
A3|mubi.com|Mubi|wordmark-editorial
A4|aesop.com|Aesop|wordmark-heritage
A5|pinterest.com|Pinterest|wordmark-rebrand-2024
A6|cash.app|Cash-App|monogram-iconic
B1|airbnb.com|Airbnb|monogram-iconic
B2|slack.com|Slack|monogram-iconic
B3|notion.so|Notion|monogram-iconic
B4|beatsbydre.com|Beats|monogram-negative-space
B5|spotify.com|Spotify|abstract-iconic
C1|fedex.com|FedEx|negative-space-canonical
D1|nasa.gov|NASA|abstract-heritage
D2|nike.com|Nike|abstract-iconic
D3|apple.com|Apple|abstract-iconic
E1|rivian.com|Rivian|custom-letterform-auto
E2|burberry.com|Burberry|rebrand-2023-heritage
E3|pepsi.com|Pepsi|rebrand-2023-heritage
E4|eurostar.com|Eurostar|rebrand-2023
E5|walmart.com|Walmart|rebrand-2025
F1|anthropic.com|Anthropic|tech-rebrand-2024
F2|vercel.com|Vercel|tech-iconic
F3|arc.net|Arc-browser|tech-rebrand-2022
F4|raycast.com|Raycast|tech-rebrand-2023
G1|jaguar.com|Jaguar|cautionary-rebrand-2024
G2|x.com|X-Twitter|cautionary-rebrand-2023
H3|pos.toasttab.com|Toast-POS|hospitality-saas
I1|cursor.com|Cursor|vibecode-2025
I2|bolt.new|Bolt-new|vibecode-2024
I3|lovable.dev|Lovable|vibecode-2024
I4|v0.dev|v0|vibecode-2024
I5|replit.com|Replit|vibecode-rebrand-2024
I6|windsurf.com|Windsurf|vibecode-2024
I7|granola.ai|Granola|breakout-2024
I8|perplexity.ai|Perplexity|breakout-2023-2024
I9|elevenlabs.io|ElevenLabs|ai-2024
I10|suno.com|Suno|ai-music-2024
I11|krea.ai|Krea|ai-image-2024
I12|runwayml.com|Runway|ai-video
I13|wispr.ai|Wispr-Flow|ai-input-2024
I14|openai.com|OpenAI|ai-iconic
I15|mistral.ai|Mistral|ai-2024
I16|groq.com|Groq|ai-infra-2024
I17|cognition.ai|Cognition-Devin|ai-2024
I18|pika.art|Pika|ai-video-2024
I19|midjourney.com|Midjourney|ai-image-iconic
I20|captions.ai|Captions|ai-creator-2024
EOF
)

ua='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36'

fetch() {
  local id="$1" domain="$2" name="$3"
  local out_base="originals/${id}_${name}"

  # Skip if any extension already exists
  if ls "${out_base}".* >/dev/null 2>&1; then
    echo "  [skip] $id $name (already downloaded)"
    return 0
  fi

  # Try sources in order of quality. First success wins.
  local urls=(
    "https://${domain}/apple-touch-icon.png"
    "https://${domain}/apple-touch-icon-precomposed.png"
    "https://${domain}/favicon.svg"
    "https://www.${domain}/apple-touch-icon.png"
    "https://www.${domain}/favicon.svg"
    "https://www.google.com/s2/favicons?domain=${domain}&sz=256"
  )

  for url in "${urls[@]}"; do
    # HEAD-style probe with GET (some servers reject HEAD)
    local ext="png"
    [[ "$url" == *.svg ]] && ext="svg"
    [[ "$url" == *favicons* ]] && ext="png"

    if curl -sLf -A "$ua" --max-time 15 -o "${out_base}.${ext}.tmp" "$url" 2>/dev/null; then
      local size
      size=$(stat -c%s "${out_base}.${ext}.tmp" 2>/dev/null || echo 0)
      if [ "$size" -gt 200 ]; then
        mv "${out_base}.${ext}.tmp" "${out_base}.${ext}"
        echo "  [ok]  $id $name ($size bytes from ${url:0:60}...)"
        return 0
      fi
      rm -f "${out_base}.${ext}.tmp"
    fi
  done

  echo "  [FAIL] $id $name (no source returned a valid image)"
  return 1
}

echo "Downloading exemplar logos to originals/..."
ok=0; fail=0
while IFS='|' read -r id domain name category; do
  [ -z "$id" ] && continue
  if fetch "$id" "$domain" "$name"; then ok=$((ok+1)); else fail=$((fail+1)); fi
done <<< "$ENTRIES"

echo ""
echo "Done. ok=$ok  fail=$fail"
echo "Files in originals/:"
ls -la originals/ | tail -n +2
