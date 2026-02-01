
/**
 * Utility to extract Video ID from various YouTube URL formats.
 */
export const getYoutubeVideoId = (url: string): string | null => {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/i;
    const match = url.match(regex);
    return match ? match[1] : null;
};

/**
 * Fetches basic video metadata (Title, Author) using YouTube's OEmbed endpoint.
 * This helps the UI and provides a label for the AI.
 */
export const getYoutubeMetadata = async (url: string): Promise<{ title: string; author: string } | null> => {
    try {
        const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
        const response = await fetch(oEmbedUrl);
        if (response.ok) {
            const data = await response.json();
            return {
                title: data.title || "Unknown Title",
                author: data.author_name || "Unknown Author"
            };
        }
    } catch (e) {
        console.warn("[YouTube] Metadata fetch failed:", e);
    }
    return null;
};
