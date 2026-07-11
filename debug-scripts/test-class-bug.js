const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3000');
  
  // Wait for the Dashboard
  await page.waitForSelector('text=Create Class');
  await page.click('text=Create Class');
  
  // Fill step 1
  await page.fill('input[placeholder="e.g. Grade 5 - Hawks Group"]', 'Test Class');
  await page.fill('input[placeholder="Select Subject"]', 'Math');
  // Wait for the inputs to register
  await page.waitForTimeout(500);

  // Click Next Step
  console.log('Clicking Next Step');
  await page.click('button:has-text("Next Step")');
  
  await page.waitForTimeout(1000);
  
  // Check if we are on step 2 or if it submitted
  const hasStep2 = await page.isVisible('text=Advanced AI Customization');
  console.log('Is on step 2:', hasStep2);

  // Check if modal closed or is generating
  const hasModal = await page.isVisible('text=New Class Profile');
  console.log('Is modal open:', hasModal);
  
  await browser.close();
})();
