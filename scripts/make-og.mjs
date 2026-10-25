// Social preview image (1200 x 630) from the real hero, with the cord at rest.
// Needs the preview server (npm run serve). Run with: npm run og
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, reducedMotion: 'reduce' });
await page.goto('http://localhost:4173/', { waitUntil: 'load' });
// The nav bar, the strip and the grain are page furniture, not part of the picture.
await page.addStyleTag({ content: '.nav, .hero__strip, .grain, .skip-link, .hero__actions, .hero__micro, .wa-bubble { display: none !important; } .hero__copy .hero__sub { max-width: none; margin: 0; }' });
// The social line (the brief): one promise per beat.
await page.evaluate(() => { document.querySelector('.hero__sub').innerHTML = '<span class="line-mask"><span>Get found. Get trusted.</span></span><span class="line-mask"><span>Never miss an enquiry.</span></span>'; });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);
await page.screenshot({ path: 'public/og-image.png' });
await browser.close();
console.log('public/og-image.png');
