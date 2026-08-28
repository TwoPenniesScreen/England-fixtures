import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";

test("display references the versioned background and original JPEG remains unchanged", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /background-v1\.webp/);
  const jpeg = await readFile(new URL("../assets/background.jpg", import.meta.url));
  assert.equal(jpeg.length, 423288);
  assert.equal(createHash("sha256").update(jpeg).digest("hex"), "29ebfd4e6ede7a3b1f60ecbea10fd4087a688cf8f9905b00a767f13bb414e8ca");
  assert.equal((await stat(new URL("../assets/background-v1.webp", import.meta.url))).size < jpeg.length, true);
});
