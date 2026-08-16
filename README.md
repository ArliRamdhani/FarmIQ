# FarmIQ 🌾

**FarmIQ** is a modern, multimodal AI-powered assistant designed to empower farmers, livestock managers, and agricultural professionals with real-time diagnostics, actionable advice, and intelligent insights.

Built on top of **Gemini 2.5 Flash Lite**, FarmIQ processes both text queries and field image uploads to deliver precise guidance on crop protection, animal health, and yield management.

## 🌟 Key Features
* **Visual Disease Diagnostics:** Upload photos of infected crops or livestock for instant identification and treatment recommendations.
* **Smart Agricultural Assistant:** 24/7 context-aware guidance for crop rotation, pest control, fertilization, and livestock nutrition.
* **Market & Price Insights:** Data-driven queries regarding agricultural trends, commodity prices, and yield optimization.
* **Lightweight & Fast:** Optimized for low latency using Express.js and inline Base64 data streaming.

## 🛠️ Tech Stack
* **Backend:** Node.js, Express.js
* **AI Model:** Google Gemini 2.5 Flash Lite API (`generateContent`)
* **File Handling:** Multer (In-memory buffer processing)
* **Frontend:** HTML5, Tailwind CSS, JavaScript (Fetch API)

## 🚀 Quick Start

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/ArliRamdhani/FarmIQ.git](https://github.com/ArliRamdhani/FarmIQ.git)
   cd FarmIQ
