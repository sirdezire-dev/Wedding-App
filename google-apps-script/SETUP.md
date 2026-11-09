# Connect guest answers to a Google Sheet (about 5 minutes, one time)

This is where guests' answers go: their names, who they're staying with, where and when. Only you can see the sheet. Your "Who's staying with who" page reads it using a passcode.

1. Open your sheet **Deividas & Gina — Wedding guest travel** in Google Drive (already created for you). To start a new one instead, create a blank spreadsheet at sheets.google.com.
2. In the menu, click **Extensions → Apps Script**.
3. Delete everything in the editor. Then copy all of [`Code.gs`](Code.gs) and paste it in.
4. On the line `const PASSCODE = 'CHANGE-THIS-PASSCODE';`, replace `CHANGE-THIS-PASSCODE` with a passcode only you two know. Keep the quote marks.
5. Click **Save** (the disk icon).
6. Click **Deploy → New deployment**. Click the gear next to "Select type" and choose **Web app**.
   - *Execute as:* **Me**
   - *Who has access:* **Anyone** (so guests can send answers without signing in)
7. Click **Deploy**. Google asks you to authorize. Choose your account, then **Advanced → Go to (project) → Allow**. This is your own script, so it's safe.
8. Copy the **Web app URL**. It looks like `https://script.google.com/macros/s/…/exec`.
9. Send that URL to Claude, or paste it into `data/wedding.js` next to `endpoint:`.

That's it. Guests' answers appear as rows in the *Guest answers* tab of your sheet. Open **…/couple.html** on the wedding site and enter your passcode to see who's staying with who.

**If you change the code later:** use **Deploy → Manage deployments → Edit → Version: New version**, so the web address stays the same.
