#!/usr/bin/env bash
# Tier 1.5: Skill Comprehension Tests
#
# Reads Q&A prompt files from prompts/comprehension/ and verifies the LLM
# understands each skill's contract. Each file contains one or more
# (Question, Expected Pattern) pairs.
#
# Cost: ~5K tokens per Q&A pair, ~30-60s per pair.
# Requires: kimi CLI (preferred) or claude CLI
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
source "$SCRIPT_DIR/../test-helpers.sh"

COMPREHENSION_DIR="$SCRIPT_DIR/prompts/comprehension"

PASS=0
FAIL=0
SKIPPED=0

# Detect available LLM runner
if command -v kimi &>/dev/null; then
  RUN_LLM="run_kimi"
  RUNNER_NAME="kimi"
elif command -v claude &>/dev/null; then
  RUN_LLM="run_claude"
  RUNNER_NAME="claude"
else
  echo "ERROR: No LLM CLI found (kimi or claude required)"
  exit 1
fi

# Build a prompt that includes the skill's SKILL.md content for context
skill_prompt() {
  local skill_name="$1"
  local question="$2"
  local skill_file="$REPO_ROOT/skills/$skill_name/SKILL.md"

  if [[ ! -f "$skill_file" ]]; then
    echo "ERROR: Skill file not found: $skill_file"
    return 1
  fi

  # Include first 300 lines of the skill (frontmatter + core rules + process)
  local content
  content=$(head -300 "$skill_file")

  cat <<EOF
Here is the content of svc's $skill_name skill:

---
$content
---

Based on the skill content above, answer this question concisely:
$question
EOF
}

# Parse a comprehension file and run tests for each Q&A pair.
# File format:
#   Skill: <skill-name>
#   <blank>
#   Q: <question>
#   A: Expected pattern: <pattern>
#   <blank>
#   Q: <question>
#   A: Expected pattern: <pattern>
run_comprehension_file() {
  local file="$1"
  local skill_name=""
  local questions=()
  local patterns=()

  # Extract skill name from first line
  skill_name=$(head -1 "$file" | sed 's/^Skill: *//')
  if [[ -z "$skill_name" ]]; then
    echo "  [SKIP] $(basename "$file") — no Skill: line"
    SKIPPED=$((SKIPPED + 1))
    return
  fi

  # Parse Q/A pairs using awk
  local qa_data
  qa_data=$(awk '
    BEGIN { state="start"; q=""; a="" }
    /^Q: / {
      if (q != "" && a != "") { print q "\t" a }
      q = substr($0, 4)
      a = ""
      state = "q"
      next
    }
    /^A: Expected pattern: / {
      a = substr($0, 22)
      state = "a"
      next
    }
    state == "q" {
      q = q "\n" $0
    }
    state == "a" {
      a = a "\n" $0
    }
    END {
      if (q != "" && a != "") { print q "\t" a }
    }
  ' "$file")

  if [[ -z "$qa_data" ]]; then
    echo "  [SKIP] $skill_name — no Q/A pairs found"
    SKIPPED=$((SKIPPED + 1))
    return
  fi

  # Verify skill file exists
  local skill_file="$REPO_ROOT/skills/$skill_name/SKILL.md"
  if [[ ! -f "$skill_file" ]]; then
    echo "  [SKIP] $skill_name — SKILL.md not found"
    SKIPPED=$((SKIPPED + 1))
    return
  fi

  local qa_count
  qa_count=$(echo "$qa_data" | grep -c $'\t' || true)
  echo "--- Skill: $skill_name ($qa_count questions) ---"

  # Process each Q&A pair
  while IFS=$'\t' read -r question expected_pattern; do
    # Trim leading/trailing whitespace
    question=$(echo "$question" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    expected_pattern=$(echo "$expected_pattern" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

    # Skip empty pairs (from blank lines in input)
    if [[ -z "$question" || -z "$expected_pattern" ]]; then
      continue
    fi

    # Take only first line of question for display
    local question_display
    question_display=$(echo "$question" | head -1 | cut -c1-80)

    echo "  Q: $question_display..."

    local prompt
    prompt=$(skill_prompt "$skill_name" "$question")

    local output
    if [[ "$RUNNER_NAME" == "kimi" ]]; then
      # Use --final-message-only to get just the answer, not the full trace
      local output_file
      output_file=$(mktemp)
      if echo "$prompt" | timeout 60 kimi --print --yolo --final-message-only --input-format text > "$output_file" 2>&1; then
        output=$(cat "$output_file")
      else
        output=$(cat "$output_file")
      fi
      rm -f "$output_file"
    else
      output=$($RUN_LLM "$prompt" 60) || true
    fi

    # Semantic match: extract significant terms from expected pattern
    # and check if the answer contains enough of them
    local significant_terms
    significant_terms=$(echo "$expected_pattern" | grep -oE '[a-zA-Z][a-zA-Z0-9_-]{3,}' | grep -viE '^(expected|pattern|the|and|for|with|from|that|this|what|are|how|does|should|must|can|you|your|has|have|had|was|were|been|being|is|are|not|yes|no|one|two|three|four|five|six|seven|eight|nine|ten|all|any|each|every|some|many|most|more|than|then|when|where|why|who|which|will|would|could|should|may|might|shall|into|onto|upon|over|under|above|below|between|among|within|without|through|during|before|after|since|until|while|because|although|though|unless|whether|either|neither|both|such|only|also|just|even|still|yet|already|yet|too|very|much|many|more|most|less|least|quite|rather|almost|nearly|hardly|barely|simply|merely|partly|mostly|mainly|largely|entirely|fully|completely|totally|absolutely|definitely|certainly|probably|possibly|perhaps|maybe|likely|unlikely|surely|clearly|obviously|apparently|seemingly|presumably|supposedly|allegedly|reportedly|notably|especially|particularly|specifically|especially|mainly|mostly|largely|primarily|principally|chiefly|generally|usually|normally|typically|commonly|frequently|often|sometimes|occasionally|rarely|seldom|never|always|constantly|continuously|repeatedly|regularly|daily|weekly|monthly|yearly|annually|hourly|nightly|weekly|monthly|quarterly|yearly|once|twice|thrice|again|back|there|here|now|soon|later|earlier|eventually|finally|ultimately|initially|originally|previously|formerly|recently|lately|currently|presently|nowadays|today|tomorrow|yesterday|tonight|morning|afternoon|evening|night|day|week|month|year|time|way|thing|things|people|person|place|places|work|works|part|parts|number|numbers|group|groups|case|cases|point|points|fact|facts|idea|ideas|issue|issues|problem|problems|question|questions|answer|answers|reason|reasons|result|results|example|examples|change|changes|effect|effects|use|uses|kind|kinds|form|forms|side|sides|end|ends|hand|hands|part|parts|area|areas|name|names|line|lines|word|words|look|looks|sound|sounds|feel|feels|seem|seems|turn|turns|become|becomes|come|comes|go|goes|get|gets|make|makes|take|takes|see|sees|know|knows|think|thinks|say|says|tell|tells|ask|asks|give|gives|put|puts|keep|keeps|let|lets|help|helps|show|shows|play|plays|run|runs|move|moves|live|lives|believe|believes|bring|brings|happen|happens|write|writes|provide|provides|sit|sits|stand|stands|lose|loses|pay|pays|meet|meets|include|includes|continue|continues|set|sets|learn|learns|change|changes|lead|leads|understand|understands|watch|watches|follow|follows|stop|stops|create|creates|speak|speaks|read|reads|allow|allows|add|adds|spend|spends|grow|grows|open|opens|walk|walks|win|wins|offer|offers|remember|remembers|love|loves|consider|considers|appear|appears|buy|buys|wait|waits|serve|serves|die|dies|send|sends|expect|expects|build|builds|stay|stays|fall|falls|cut|cuts|reach|reaches|kill|kills|remain|remains|suggest|suggests|raise|raises|pass|passes|sell|sells|require|requires|report|reports|decide|decides|pull|pulls|return|returns|explain|explains|carry|carries|develop|develops|hope|hopes|drive|drives|break|breaks|receive|receives|agree|agrees|support|supports|remove|removes|return|returns|describe|describes|create|creates|add|adds|apply|applies|avoid|avoids|prepare|prepares|compare|compares|declare|declares|deliver|delivers|depend|depends|deserve|deserves|destroy|destroys|determine|determines|develop|develops|differ|differs|direct|directs|discover|discovers|discuss|discusses|divide|divides|draw|draws|drop|drops|eat|eats|encourage|encourages|enjoy|enjoys|ensure|ensures|examine|examines|exist|exists|expand|expands|experience|experiences|express|expresses|face|faces|fail|fails|fear|fears|feel|feels|fight|fights|fill|fills|find|finds|fit|fits|fix|fixes|focus|focuses|force|forces|forget|forgets|forgive|forgives|form|forms|found|founds|gain|gains|gather|gathers|get|gets|give|gives|go|goes|grant|grants|guess|guesses|handle|handles|hang|hangs|happen|happens|hate|hates|have|has|hear|hears|hide|hides|hit|hits|hold|holds|hope|hopes|hurt|hurts|identify|identifies|ignore|ignores|imagine|imagines|imply|implies|improve|improves|include|includes|increase|increases|indicate|indicates|influence|influences|inform|informs|insist|insists|install|installs|intend|intends|introduce|introduces|invite|invites|involve|involves|join|joins|jump|jumps|justify|justifies|keep|keeps|kick|kicks|kill|kills|kiss|kisses|knock|knocks|know|knows|lack|lacks|last|lasts|laugh|laughs|lay|lays|lead|leads|learn|learns|leave|leaves|lend|lends|let|lets|lie|lies|lift|lifts|like|likes|limit|limits|link|links|listen|listens|live|lives|look|looks|lose|loses|love|loves|maintain|maintains|make|makes|manage|manages|matter|matters|mean|means|measure|measures|meet|meets|mention|mentions|mind|minds|miss|misses|move|moves|need|needs|note|notes|notice|notices|obtain|obtains|occur|occurs|offer|offers|open|opens|order|orders|own|owns|pass|passes|pay|pays|perform|performs|permit|permits|pick|picks|place|places|plan|plans|play|plays|point|points|prefer|prefers|prepare|prepares|present|presents|press|presses|prevent|prevents|produce|produces|promise|promises|propose|proposes|protect|protects|prove|proves|provide|provides|publish|publishes|pull|pulls|purchase|purchases|push|pushes|put|puts|qualify|qualifies|question|questions|quit|quits|raise|raises|reach|reaches|read|reads|realize|realizes|receive|receives|recognize|recognizes|recommend|recommends|record|records|reduce|reduces|refer|refers|reflect|reflects|refuse|refuses|regard|regards|relate|relates|release|releases|remain|remains|remember|remembers|remove|removes|repeat|repeats|replace|replaces|reply|replies|report|reports|represent|represents|require|requires|research|researches|resolve|resolves|respond|responds|rest|rests|result|results|return|returns|reveal|reveals|review|reviews|risk|risks|roll|rolls|run|runs|satisfy|satisfies|save|saves|say|says|see|sees|seek|seeks|seem|seems|sell|sells|send|sends|serve|serves|set|sets|settle|settles|shake|shakes|share|shares|shift|shifts|shine|shines|shoot|shoots|show|shows|shut|shuts|sing|sings|sink|sinks|sit|sits|sleep|sleeps|slide|slides|smile|smiles|sort|sorts|sound|sounds|speak|speaks|spend|spends|spread|spreads|stand|stands|start|starts|state|states|stay|stays|step|steps|stick|sticks|stop|stops|study|studies|submit|submits|succeed|succeeds|suffer|suffers|suggest|suggests|supply|supplies|support|supports|suppose|supposes|surprise|surprises|survive|survives|take|takes|talk|talks|teach|teaches|tell|tells|tend|tends|test|tests|thank|thanks|think|thinks|throw|throws|tie|ties|touch|touches|track|tracks|trade|trades|train|trains|transfer|transfers|travel|travels|treat|treats|trick|tricks|try|tries|turn|turns|understand|understands|undertake|undertakes|update|updates|upgrade|upgrades|use|uses|used|value|values|vary|varies|view|views|visit|visits|voice|voices|vote|votes|wait|waits|wake|wakes|walk|walks|want|wants|warn|warns|wash|washes|watch|watches|wear|wears|win|wins|wish|wishes|wonder|wonders|work|works|worry|worries|write|writes)$' | sort -u | tr '\n' ' ')

    local term_count=0
    local match_count=0
    local missing_terms=""
    for term in $significant_terms; do
      term_count=$((term_count + 1))
      if echo "$output" | grep -qi "$term"; then
        match_count=$((match_count + 1))
      else
        missing_terms="$missing_terms $term"
      fi
    done

    # Require at least 20% of significant terms, minimum 2 matches
    local threshold=$(( term_count * 2 / 10 ))
    if [[ $threshold -lt 2 ]]; then
      threshold=2
    fi

    if [[ $match_count -ge $threshold ]]; then
      echo "  [PASS] Semantic match ($match_count/$term_count terms)"
      PASS=$((PASS + 1))
    else
      echo "  [FAIL] Semantic match ($match_count/$term_count terms, needed $threshold)"
      echo "    Missing terms:$missing_terms"
      echo "    Answer snippet: $(echo "$output" | tr '\n' ' ' | cut -c1-200)"
      FAIL=$((FAIL + 1))
    fi
  done <<< "$qa_data"

  echo ""
}

# CLI options
SAMPLE_SIZE="${SAMPLE_SIZE:-0}"   # 0 = all, N = random sample of N skills
SINGLE_SKILL="${SINGLE_SKILL:-}"  # Run only one skill by name

if [[ -n "$SINGLE_SKILL" ]]; then
  echo "=== Tier 1.5: Skill Comprehension ($SINGLE_SKILL only) ==="
elif [[ "$SAMPLE_SIZE" -gt 0 ]]; then
  echo "=== Tier 1.5: Skill Comprehension (random sample of $SAMPLE_SIZE) ==="
else
  echo "=== Tier 1.5: Skill Comprehension (all skills) ==="
fi
echo "  Runner: $RUNNER_NAME"
echo "  Prompts: $COMPREHENSION_DIR"
echo ""

if [[ ! -d "$COMPREHENSION_DIR" ]]; then
  echo "ERROR: Comprehension prompts directory not found: $COMPREHENSION_DIR"
  exit 1
fi

# Collect files to process
files=()
for prompt_file in "$COMPREHENSION_DIR"/*.txt; do
  [[ ! -f "$prompt_file" ]] && continue
  files+=("$prompt_file")
done

# Filter to single skill if requested
if [[ -n "$SINGLE_SKILL" ]]; then
  filtered=()
  for f in "${files[@]}"; do
    sn=$(head -1 "$f" | sed 's/^Skill: *//')
    if [[ "$sn" == "$SINGLE_SKILL" ]]; then
      filtered+=("$f")
      break
    fi
  done
  files=("${filtered[@]}")
  if [[ ${#files[@]} -eq 0 ]]; then
    echo "ERROR: Skill '$SINGLE_SKILL' not found in comprehension prompts"
    exit 1
  fi
fi

# Sample if requested
if [[ "$SAMPLE_SIZE" -gt 0 && ${#files[@]} -gt $SAMPLE_SIZE ]]; then
  # Shuffle and take sample (using sort -R)
  IFS=$'\n' read -r -d '' -a files < <(printf '%s\n' "${files[@]}" | sort -R | head -n "$SAMPLE_SIZE")
fi

for prompt_file in "${files[@]}"; do
  run_comprehension_file "$prompt_file"
done

report_results "Skill Comprehension" $PASS $FAIL

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
exit 0
