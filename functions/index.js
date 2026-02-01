

const { onRequest } = require("firebase-functions/v2/https");
const { YoutubeTranscript } = require("youtube-transcript");
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK to interact with Firestore
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * An HTTP-triggered Cloud Function (v2) that fetches the transcript for a YouTube video.
 * It includes a caching layer using Firestore and uses built-in CORS support.
 */
exports.getTranscript = onRequest(
  {
    cpu: 1, 
    memory: "256MiB",
    cors: true, // v2 automatically handles OPTIONS preflight and sets Access-Control-Allow-Origin: *
    invoker: "public", // Ensure it's reachable without Auth
  },
  async (request, response) => {
    // Handle OPTIONS specifically if needed, though cors: true does this
    if (request.method === "OPTIONS") {
      response.status(204).send("");
      return;
    }

    if (request.method !== "POST") {
      response.status(405).json({
        error: "Method Not Allowed. Please use POST.",
      });
      return;
    }

    const { videoId } = request.body;

    if (!videoId || videoId.length !== 11) {
      response.status(400).json({
        error: "Invalid or missing 'videoId'. Must be exactly 11 characters.",
      });
      return;
    }

    const transcriptDocRef = db.collection("transcripts").doc(videoId);

    try {
      // 1. Check Cache
      const docSnapshot = await transcriptDocRef.get();
      if (docSnapshot.exists) {
        const cachedData = docSnapshot.data();
        console.log(`[CACHE HIT] videoId: ${videoId}`);
        response.status(200).json({
          transcript: cachedData.transcript,
          source: "cache",
        });
        return;
      }

      // 2. Fetch from YouTube
      console.log(`[FETCHING] videoId: ${videoId} from YouTube.`);
      
      // The library might throw if transcripts are disabled
      const transcriptParts = await YoutubeTranscript.fetchTranscript(videoId).catch(err => {
        console.warn(`[LIBRARY ERROR] for ${videoId}:`, err.message);
        return null;
      });

      if (!transcriptParts || transcriptParts.length === 0) {
        response.status(404).json({
          error: "Transcript not available for this video (it might be disabled or auto-generated only).",
        });
        return;
      }

      const fullTranscript = transcriptParts
        .map((part) => part.text)
        .join(" ")
        .replace(/\s+/g, ' ')
        .trim();

      // 3. Update Cache
      await transcriptDocRef.set({
        transcript: fullTranscript,
        cachedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      response.status(200).json({
        transcript: fullTranscript,
        source: "youtube",
      });

    } catch (error) {
      console.error(`[SYSTEM ERROR] for ${videoId}:`, error);
      response.status(500).json({
        error: "Internal server error while fetching transcript.",
        details: error.message
      });
    }
  }
);
