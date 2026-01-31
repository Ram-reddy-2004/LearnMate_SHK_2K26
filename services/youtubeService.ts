/**
 * Fetches the transcript for a given YouTube video ID using a client-side
 * CORS proxy. This method avoids the need for a separate backend function
 * and solves the persistent "Failed to fetch" errors.
 *
 * @param videoId The ID of the YouTube video.
 * @returns A promise that resolves to the video's transcript as a string.
 */
export const getYouTubeTranscript = async (videoId: string): Promise<string> => {
    // A free, public CORS proxy to bypass YouTube's restrictions.
    // This is a common technique for client-side projects.
    const corsProxyUrl = 'https://api.allorigins.win/raw?url=';

    try {
        // Step 1: Fetch the list of available transcripts to find the English one.
        const listUrl = `https://www.youtube.com/api/timedtext?type=list&v=${videoId}`;
        const listResponse = await fetch(`${corsProxyUrl}${encodeURIComponent(listUrl)}`);
        
        if (!listResponse.ok) {
            return `[Transcript not available: Could not fetch transcript list. Status: ${listResponse.status}]`;
        }

        const listText = await listResponse.text();
        const parser = new DOMParser();
        const listDoc = parser.parseFromString(listText, "application/xml");
        
        // Find an English track. Prefers 'en' but falls back to other English variants.
        const englishTrack = Array.from(listDoc.getElementsByTagName('track')).find(
            track => track.getAttribute('lang_code')?.startsWith('en')
        );

        if (!englishTrack) {
            return `[Transcript not available: No English transcript found for this video.]`;
        }
        
        const langCode = englishTrack.getAttribute('lang_code');

        // Step 2: Fetch the actual transcript content using the found language code.
        const transcriptUrl = `https://www.youtube.com/api/timedtext?lang=${langCode}&v=${videoId}`;
        const transcriptResponse = await fetch(`${corsProxyUrl}${encodeURIComponent(transcriptUrl)}`);
        
        if (!transcriptResponse.ok) {
             return `[Transcript not available: Could not fetch transcript content. Status: ${transcriptResponse.status}]`;
        }

        const transcriptText = await transcriptResponse.text();
        const transcriptDoc = parser.parseFromString(transcriptText, "application/xml");

        // Step 3: Parse the transcript XML and combine the text parts.
        const textNodes = transcriptDoc.getElementsByTagName('text');
        const transcript = Array.from(textNodes)
            .map(node => node.textContent || '')
            .join(' ');

        if (!transcript.trim()) {
            return `[Transcript not available: The transcript for this video is empty.]`;
        }

        // Basic clean-up to decode HTML entities like &amp; and remove XML tags if any slip through
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = transcript;
        
        return tempDiv.textContent || tempDiv.innerText || "";

    } catch (error) {
        console.error(`Client-side error while fetching transcript for ${videoId}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'A network error occurred.';
        return `[Could not retrieve transcript due to an error: ${errorMessage}]`;
    }
};
