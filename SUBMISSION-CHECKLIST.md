# Chrome Web Store – Submission Checklist (Smart Bug Reporter)

Use this list when submitting the extension to the Chrome Web Store.

---

## 1. Developer account

- [ ] Chrome Web Store Developer account created (one-time $5 fee if not already done).
- [ ] **Account tab:** Contact email entered.
- [ ] **Account tab:** Contact email **verified** (click link in the email from Google).

---

## 2. Item listing

- [ ] **Short description** (132 chars max) – Copy from `chrome-store-description.md` (e.g. Option A or B).
- [ ] **Detailed description** – Copy the full “Detailed description” from `chrome-store-description.md`.
- [ ] **Category** – e.g. Developer Tools or Productivity.
- [ ] **Language** – Select primary language.

---

## 3. Graphic assets

- [ ] **Store icon** – 128×128 px PNG (96×96 content + 16 px transparent padding).
  - Use `store-assets/icon-128.png` (build with `node store-assets/build-icon.js` if needed).
- [ ] **Screenshots** – At least 1, max 5. Size: 1280×800 or 640×400. Format: JPEG or 24-bit PNG.
  - See `store-assets/README.md` for suggested screens and how to create them.

---

## 4. Privacy practices tab

- [ ] **Single purpose description** – Copy from `chrome-store-privacy-practices.md`.
- [ ] **Justification for activeTab** – Copy from same file.
- [ ] **Justification for host permission use** – Copy from same file.
- [ ] **Justification for scripting** – Copy from same file.
- [ ] **Storage** – Not requested (v1.0.1+); no justification needed.
- [ ] **Privacy policy URL** – Public URL where your privacy policy is hosted.
  - Host `privacy-policy.html` (e.g. GitHub Pages). See `PRIVACY-POLICY-URL.md`.
- [ ] **Data usage** – “What user data do you plan to collect?”  
  - Check **User activity** and **Website content** (and any others that apply). See `chrome-store-privacy-practices.md`.
- [ ] **Certify all three** checkboxes at the bottom of the Data usage section.

---

## 5. Package

- [ ] Extension packaged (zip the extension folder: manifest.json + all referenced files; no extra folders like `node_modules` or `.git` unless required).
- [ ] Upload the zip in the Developer Dashboard (or upload unpacked if the dashboard allows).

---

## 6. Final steps

- [ ] Review all fields and save.
- [ ] Submit for review.
- [ ] After approval, set visibility (e.g. Public) if needed.

---

## Quick reference – where to find text

| What | File |
|------|------|
| Short & detailed description | `chrome-store-description.md` |
| Single purpose + all justifications | `chrome-store-privacy-practices.md` |
| Privacy policy page | `privacy-policy.html` (host to get URL) |
| How to get privacy policy URL | `PRIVACY-POLICY-URL.md` |
| Icon & screenshots specs | `store-assets/README.md` |
