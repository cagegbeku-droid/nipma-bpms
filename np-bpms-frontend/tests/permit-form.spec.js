import { test, expect } from '@playwright/test';
import path from 'path';

test('Should successfully fill and submit a new permit form', async ({ page }) => {
  // 1. Navigate to your local React app (make sure your npm start is running!)
  // Adjust the port (3000, 5173, etc.) to match whatever your local React server uses.
  await page.goto('http://localhost:3000/new-permit'); 

  // 2. The robot fills out the text data
  // We use the exact 'name' attributes you assigned in your NewPermit.jsx file
  await page.fill('input[name="permitNumber"]', 'AUTO-TEST/2026/001');
  await page.fill('input[name="dateIssued"]', '2026-07-21');
  await page.fill('input[name="firstName"]', 'Automated');
  await page.fill('input[name="lastName"]', 'Robot');
  await page.fill('input[name="phone"]', '0541234567');
  await page.fill('input[name="address"]', '123 Server Lane');
  await page.fill('input[name="location"]', 'Accra Tech Hub');

  // 3. The robot uploads a file 
  // (Create a tiny blank text file named 'test-cert.pdf' in your tests folder for this to work)
  const testFilePath = path.join(__dirname, 'test-cert.pdf');
  await page.setInputFiles('input[name="certificate"]', testFilePath);

  // 4. Click the submit button
  await page.click('button:has-text("Save to Secure Archives")');

  // 5. THE ASSERTION: The robot waits and verifies that the green success message appears
  const successMessage = page.locator('text=Success! Record and all documents archived securely.');
  
  // We give it a 15-second timeout because uploading to Google Drive takes a few seconds!
  await expect(successMessage).toBeVisible({ timeout: 15000 });
});