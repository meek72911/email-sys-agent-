import { chromium } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 await page.goto((process.env.RELAY_BASE_URL||'http://127.0.0.1:3002')+'/login');
 await page.screenshot({path:join(tmpdir(),'relay-login-desktop.png'),fullPage:true});
 console.log('Desktop login:',await page.locator('h1').innerText());
 await page.keyboard.press('Tab');console.log('First focus:',await page.evaluate(()=>document.activeElement?.getAttribute('name')));
 await page.setViewportSize({width:375,height:812});await page.screenshot({path:join(tmpdir(),'relay-login-mobile.png'),fullPage:true});
 console.log('Mobile overflow:',await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
}finally{await browser.close();}
