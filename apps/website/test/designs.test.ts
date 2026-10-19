// Every design in the catalogue has its size details (lib/designs.ts), and nothing is listed for a design that no
// longer exists.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { designs } from "../src/lib/designs.ts";
import { styles } from "../src/store.ts";

describe("design details", () => {
  it("cover exactly the designs in the catalogue", () => {
    assert.deepEqual(Object.keys(designs).sort(), styles.map((s) => s.id).sort());
  });
});
