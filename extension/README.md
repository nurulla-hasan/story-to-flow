# Story to Flow — Chrome Extension Bridge

This Chrome extension bridges the **Story-to-Flow** web app (both `localhost:3000` and `https://story-to-flow.vercel.app`) directly to **Google Flow** (`flow.google.com`), enabling one-click **"Send to Flow"**:
- Automatically switches to or opens your `flow.google.com` tab.
- Pastes the code-assembled scene prompt into Flow's editor.
- Automatically attaches the start frame / keyframe image if present.
- Auto-clicks **Generate** to start video rendering.

---

## How to Install in Google Chrome (1 Minute Setup)

1. Open **Google Chrome**.
2. Go to `chrome://extensions` in the address bar.
3. Enable **Developer mode** using the toggle switch at the top-right corner.
4. Click the **Load unpacked** button at the top-left.
5. Select this unzipped `extension` folder.
6. The extension **"Story to Flow - Auto Bridge"** will appear in your extensions list!

---

## How to Use

1. Make sure you are signed into your Google account on [flow.google.com](https://flow.google.com).
2. Open Story-to-Flow at [https://story-to-flow.vercel.app](https://story-to-flow.vercel.app) (or `http://localhost:3000`).
3. In any scene card, click **"🚀 Send to Flow"**.
4. The extension will automatically open/focus Flow, paste your prompt, attach the image (if any), and start generation!
