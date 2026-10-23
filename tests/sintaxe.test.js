const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("o script do app compila", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "publicar.html"), "utf8");
  const i = html.indexOf("<script>\n(function(){");
  const j = html.lastIndexOf("</script>");
  assert.ok(i > 0 && j > i, "não achei o script principal");
  assert.doesNotThrow(() => new vm.Script(html.slice(i + "<script>".length, j), {filename: "app.js"}));
});
