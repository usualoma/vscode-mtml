import fetch from "node-fetch";
import jsdom from "jsdom";
const { JSDOM } = jsdom;

(async () => {
  const tags: Record<string, Record<string, any>> = {};
  const res = await fetch(
    "https://www.movabletype.jp/documentation/appendices/tags/"
  );
  const body = await res.text();
  const dom = new JSDOM(body);
  const items = [
    ...dom.window.document.querySelectorAll<HTMLLIElement>(
      ".entrylist-with-topborder li"
    ),
  ];
  while (items.length) {
    const item = items.shift();
    if (!item) {
      break;
    }

    const tagData: Record<string, any> = {};
    const tag = item.querySelector("a")!;
    const name = tag.textContent?.replace(/\s+/gi, "");
    if (!name) {
      return;
    }
    tagData["name"] = name;
    tagData["url"] = tag.href;
    tagData["type"] = item.querySelector(".block") ? "block" : "function";

    const res = await fetch(tag.href);
    const body = await res.text();
    const dom = new JSDOM(body);
    const description =
      dom.window.document.querySelector<HTMLParagraphElement>(".entry-body p");
    tagData["description"] = description?.textContent || "";

    tagData["modifiers"] = {};
    const dts =
      dom.window.document.querySelectorAll<HTMLDataElement>(
        ".entry-modifier dt"
      );
    const dds =
      dom.window.document.querySelectorAll<HTMLDataElement>(
        ".entry-modifier dd"
      );
    dts.forEach((dt, i) => {
      let name = dt.textContent?.replace(/\s+/gi, "");
      if (!name) {
        return;
      }
      let value = "";
      if (name.indexOf("=") > -1) {
        [name, value] = name.split("=", 2);
        value = value.replace(/"/gi, "").replace("|", ",");
      }
      const dd = dds[i];
      const description = dd?.textContent || "";
      tagData["modifiers"][name.toLowerCase()] = {
        name,
        value,
        description,
        url: tag.href,
      };
    });

    tags[name.replace(/^MT/, "").toLowerCase()] = tagData;
  }

  console.log(JSON.stringify(tags));
})();
