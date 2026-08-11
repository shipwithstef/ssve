#!/usr/bin/env bash
# WI-497: shell binding of the ONE canonical WI-id validator. The pattern here is
# byte-identical to WI_ID_RE in hooks/lib/wi-id.mjs; tier-1 validate-wi-id.sh
# guard-locks the two to match. Accepts numeric (WI-9) + named (WI-SOCIAL-01,
# WI-013-DAYONE); rejects lowercase, empty, leading/trailing/consecutive hyphen,
# and any non-[A-Z0-9-] char. See hooks/lib/wi-id.mjs for the language definition.
SVC_WI_ID_RE='^WI-[A-Z0-9]+(-[A-Z0-9]+)*$'

svc_is_valid_wi_id() {
  printf '%s' "$1" | grep -Eq "$SVC_WI_ID_RE"
}
