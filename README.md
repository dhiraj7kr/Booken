# Voice Transcript Studio

A browser-based web app for:

- Voice recording via microphone.
- Real-time transcript capture (Web Speech API).
- Saving recording metadata (date, time, duration, word count) and transcript.
- Viewing/copying transcript details per saved recording.
- Chatting against your saved transcript sources with source attribution.
- Adding manual transcript sources for chatbot context.

## Run locally

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Notes

- Best experience is in modern Chromium browsers (Chrome/Edge) for speech recognition.
- Data is stored in browser `localStorage`.
