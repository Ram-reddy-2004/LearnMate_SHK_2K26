const { onRequest } = require("firebase-functions/v2/https");
const { YoutubeTranscript } = require("youtube-transcript");
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK to interact with Firestore
admin.initializeApp();
const db = admin.firestore();

/**
 * An HTTP-triggered Cloud Function (v2) that fetches the transcript for a YouTube video.
 * It includes a caching layer using Firestore and uses built-in CORS support.
 */
exports.getTranscript = onRequest(
  {
    cpu: 1, // Allocate CPU to allow outbound networking
    cors: true, // Enable built-in CORS support
  },
  async (request, response) => {
    // Check for POST request
    if (request.method !== "POST") {
      response.status(405).json({
        error: "Method Not Allowed",
      });
      return;
    }

    // The v2 SDK and modern fetch APIs correctly parse JSON, no 'data' wrapper needed in the body itself.
    const { videoId } = request.body;

    if (!videoId) {
      response.status(400).json({
        error: "Missing 'videoId' in the request body.",
      });
      return;
    }

    const transcriptDocRef = db.collection("transcripts").doc(videoId);

    try {
      // --- Caching Logic: Step 1 - Check Firestore First ---
      const docSnapshot = await transcriptDocRef.get();
      if (docSnapshot.exists) {
        console.log(`Cache HIT for videoId: ${videoId}`);
        const cachedData = docSnapshot.data();
        response.status(200).json({
          transcript: cachedData.transcript,
          source: "cache",
        });
        return;
      }

      // --- Cache Miss: Fetch from YouTube ---
      console.log(`Cache MISS for videoId: ${videoId}. Fetching from YouTube.`);
      const transcriptParts = await YoutubeTranscript.fetchTranscript(videoId);

      if (!transcriptParts || transcriptParts.length === 0) {
        response.status(404).json({
          error: "Transcript not found or is empty for this video.",
        });
        return;
      }

      // Combine the transcript parts into a single string
      const fullTranscript = transcriptParts.map((part) => part.text).join(" ");

      // --- Caching Logic: Step 2 - Save to Firestore ---
      const cacheData = {
        transcript: fullTranscript,
        cachedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      await transcriptDocRef.set(cacheData);
      console.log(`Successfully fetched and cached transcript for ${videoId}.`);

      response.status(200).json({
        transcript: fullTranscript,
        source: "youtube-api",
      });

    } catch (error) {
      console.error(`Error processing transcript for ${videoId}:`, error);
      let errorMessage = "An unexpected error occurred.";
      if (error.message) {
        if (error.message.includes("Transcripts are disabled")) {
          errorMessage = "Transcripts are disabled for this video.";
        } else if (error.message.includes("No transcript found")) {
          errorMessage = "No transcript is available for this video.";
        } else {
          errorMessage = error.message;
        }
      }
      // Do not cache errors.
      response.status(500).json({
        error: errorMessage,
      });
    }
  }
);
