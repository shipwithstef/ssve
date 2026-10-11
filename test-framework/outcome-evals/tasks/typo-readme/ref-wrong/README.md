# slugify-mini

Turn any title into a url-safe slug. It is small, has no dependencies, and behaves the same way everywhere.

## Usage

```js
import { slugify } from "./src/slugify.mjs";

slugify("Hello, World!"); // => "hello-world"
slugify("Crème Brûlée");  // "creme-brulee"
```

The function is pure, so the same input always gives the same output. Accented letters are folded to plain ones, and runs of punctuation collapse into a single dash.

## Tests

Run `node --test` to check the behaviour.
