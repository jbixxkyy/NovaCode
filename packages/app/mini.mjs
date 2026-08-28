import { chromium } from "@playwright/test";
const b=await chromium.launch({headless:true});
const p=await b.newPage();
await p.goto("http://127.0.0.1:3000/", {waitUntil:"domcontentloaded", timeout:10000});
console.log("ok", await p.title());
await p.screenshot({path:"C:/Users/jblix/AppData/Local/Temp/novacode/mini.png"});
await b.close();
