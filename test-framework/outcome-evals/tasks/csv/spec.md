# parseCsvLine

Create `solution.mjs` exporting `parseCsvLine(line)`, which splits ONE line of CSV into an array of strings, following RFC 4180 quoting.

- Fields are separated by `,`. An empty line is one empty field: `""` → `[""]`. A trailing comma adds a final empty field.
- A field that starts with `"` is quoted: it runs to the matching closing quote, `""` inside it is one literal `"`, and commas inside it are literal. After the closing quote the next character must be `,` or the end of the line.
- A `"` that appears in an unquoted field after its first character is a literal character (`a"b` → `a"b`).
- No whitespace trimming: spaces are part of fields, and ` "a"` (space before the quote) is an unquoted field containing the quotes.
- The input never contains a line break outside quotes. Inside quotes, `\n` and `\r` are kept literally.

Throw a `SyntaxError` for an unterminated quoted field or for any character other than `,` right after a closing quote. Throw a `TypeError` if `line` is not a string.
