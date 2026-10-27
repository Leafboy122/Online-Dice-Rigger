
Online-Dice.com Rigger

A lightweight Chrome Extension designed for client-side visual simulation and DOM manipulation demonstrations on text-based web layouts. This tool intercepts keyboard inputs locally to modify specified text nodes on the front-end user interface.

Features

• Local Interface Manipulation: Safely tests DOM overrides on client-side visual structures.
• Keyboard Hotkeys: Triggers explicit numbers or custom interface values dynamically via configured keystrokes.
• 100% Open Source: Built entirely with flat, readable JavaScript, HTML, and CSS files for easy auditing and education.

🚀 How to Download & Install


Step 1: Download the Source Code

Click the link below to instantly download the official repository bundle directly from GitHub:
👉 [Download Extension Source ZIP](https://github.com/Leafboy122/Online-Dice-Rigger/archive/refs/heads/main.zip)

Step 2: Extract the Files

1. Locate the downloaded file (Online-Dice-Rigger-main.zip) in your downloads folder.
2. Extract or unzip the contents into a standard folder on your desktop.

Step 3: Load into Google Chrome

1. Open Google Chrome and navigate to the extensions page by typing chrome://extensions/ in the URL bar.
2. In the top-right corner of the Extensions page, toggle the Developer Mode switch to ON.
3. In the top-left corner, click the Load unpacked button.
4. Select the extracted folder containing the source files (the folder containing manifest.json).

🛠️ How It Works (Technical Overview)

This utility serves as an educational example of how modern browser extensions interact with the Document Object Model (DOM):
• manifest.json: Registers the background permissions and limits script injection scope exclusively to the designated layout environment.
• content.js: Listens for target visual node changes and runs a client-side text replace string.
• popup.js / popup.html: Provides a simple UI popover to toggle configuration adjustments on the fly.
Note: As a client-side script, all manipulation happens entirely within your local browser window. It does not communicate with or modify remote server-side databases.

License

Completely open source for educational use, scripting practice, and front-end design manipulation analysis.
