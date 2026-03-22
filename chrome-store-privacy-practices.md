# Chrome Web Store – Privacy Practices (Smart Bug Reporter)

Copy each block into the matching field on the **Privacy practices** tab.

---

## 1. Single purpose description

```
Smart Bug Reporter has a single purpose: when the user clicks "Capture bug," it captures a screenshot of the current tab, console logs and network requests from that page, and browser/environment info, then formats them so the user can paste a ready-made report into Jira or GitHub. No data is sent to any external server; everything stays on the user's device until they paste it into their own issue tracker.
```

---

## 2. Justification for activeTab

```
activeTab is used when the user clicks "Capture bug" to take a screenshot of the current tab (via captureVisibleTab) and to run a small script in that tab to read the already-captured console and network data (stored in the page by our content script). We do not access any tab without the user explicitly clicking Capture.
```

---

## 3. Justification for host permission use

```
Host permissions are required so that our content script can run on the page the user is viewing (to capture console and network data from page load) and so we can run a one-time script in that tab when the user clicks "Capture bug" to collect that data and take a screenshot. We do not access sites in the background; we only operate on the tab when the user triggers capture.
```

---

## 4. Justification for scripting

```
The scripting API is used when the user clicks "Capture bug" to run a function in the active tab that reads the console and network data our content script has already stored in the page. This is the only way to retrieve that data for the report. We do not run scripts on other tabs or in the background.
```

---

## 5. Storage permission (not used)

**As of v1.0.1, the extension does not request `storage`.**  
Do **not** enter a storage justification in the Privacy practices tab—remove that field if the dashboard still shows it from an older draft, or leave it blank if optional.

Bug report data (screenshot, logs, requests) is kept in memory for the popup only and is not persisted with `chrome.storage`.

---

## 6. Data usage certification

When you certify that data usage complies with the Developer Program Policies:

- **No data sent off-device:** Screenshot, console logs, and network data are used only to build the report text that the user copies. Nothing is transmitted to the developer or third parties.
- **No personal data collected for tracking:** We only capture what is necessary for the bug report (page content, console, network) when the user clicks Capture.
- **User control:** The user decides when to capture and where to paste the report.

**Short statement for your records:**

```
Smart Bug Reporter does not collect, store on external servers, or share user data. All captured data is used only to generate the report the user copies into Jira or GitHub. We do not use the data for advertising, analytics, or any purpose other than creating the bug report in the user's browser.
```

---

## 7. Data usage form (What user data do you plan to collect?)

- **User activity** – Yes. We capture console output and network requests (API calls) from the page when the user clicks Capture.
- **Website content** – Yes. We capture the visible screenshot and page URL (and optionally the console/network that reflect page activity). We do not read arbitrary text or images beyond what is needed for the report.
- **Personally identifiable information** – No (unless the user types it in the "Steps" field, which they control).
- **Authentication / Financial / Health / etc.** – No.

**Certify all three checkboxes** at the bottom of the Data usage form.

---

## 8. Contact email

Set and verify your **contact email** on the **Account** tab before publishing.
