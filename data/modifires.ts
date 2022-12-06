import fetch from "node-fetch";
import jsdom from "jsdom";
const { JSDOM } = jsdom;

(async () => {
  const tags: Record<string, Record<string, any>> = {};
  const res = await fetch(
    "https://www.movabletype.jp/documentation/appendices/modifiers/"
  );
  const body = await res.text();
  const dom = new JSDOM(body);
  const items = dom.window.document.querySelectorAll<HTMLLIElement>(
    ".entrylist-with-topborder li"
  );
  items.forEach((item) => {
    const tagData: Record<string, any> = {};
    const tag = item.querySelector("a")!;
    const name = tag.textContent?.replace(/\s+/gi, "");
    if (!name) {
      return;
    }
    tagData["name"] = name;
    tagData["url"] = tag.href;
    tagData["description"] = item.querySelector("p")?.textContent;
    tags[name.toLowerCase()] = tagData;
  });

  console.log(JSON.stringify(tags));
})();
