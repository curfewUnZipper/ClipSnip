import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
const execPromise = promisify(exec);
interface ClipRequestBody {
  youtubeLink: string;
  startTime: string;
  duration: string;
}
const clipsDirectory = path.join(process.cwd(), "public", "downloads");
// Ensure the clips directory exists
if (!fs.existsSync(clipsDirectory)) {
  fs.mkdirSync(clipsDirectory, { recursive: true });
}
export async function POST(req: Request) {
  const { youtubeLink, startTime, duration } =
    (await req.json()) as ClipRequestBody;
  if (!youtubeLink || !startTime || !duration) {
    return NextResponse.json(
      { error: "YouTube link, start time, and duration are required" },
      { status: 400 }
    );
  }
  try {
    const videoId = new URL(youtubeLink).searchParams.get("v");
    if (!videoId) {
      return NextResponse.json(
        { error: "Invalid YouTube link" },
        { status: 400 }
      );
    }
    const videoPath = path.join(clipsDirectory, `${videoId}.mp4`);
    const clipPath = path.join(
      clipsDirectory,
      `${videoId}_clip_${startTime.replace(/:/g, "-")}_${duration}.mp4`
    );
    // Check if the clip already exists
    if (fs.existsSync(clipPath)) {
      return NextResponse.json({
        message: "Clip already exists",
        clipUrl: `/downloads/${path.basename(clipPath)}`,
      });
    }
    // Download the video if not already downloaded
    if (!fs.existsSync(videoPath)) {
      await execPromise(`yt-dlp -f best -o "${videoPath}" ${youtubeLink}`);
    }
    // Ensure the video is re-encoded for seekability
    const reencodedVideoPath = path.join(
      clipsDirectory,
      `${videoId}_reencoded.mp4`
    );
    await execPromise(
      `ffmpeg -i "${videoPath}" -c:v libx264 -preset ultrafast -crf 23 -c:a aac -strict experimental -y "${reencodedVideoPath}"`
    );
    // Extract the clip from the re-encoded video
    await execPromise(
      `ffmpeg -ss ${startTime} -i "${reencodedVideoPath}" -t ${duration} -c:v libx264 -preset ultrafast -crf 23 -c:a aac -strict experimental -y "${clipPath}"`
    );
    // Return the clip URL
    return NextResponse.json({
      message: "Clip generated successfully",
      clipUrl: `/downloads/${path.basename(clipPath)}`,
    });
  } catch (error) {
    console.error("Error generating clip:", error);
    return NextResponse.json(
      { error: "Failed to process the video" },
      { status: 500 }
    );
  }
}
// New API route to delete all clips
export async function GET() {
  try {
    if (fs.existsSync(clipsDirectory)) {
      const files = fs.readdirSync(clipsDirectory);
      files.forEach((file) => {
        const filePath = path.join(clipsDirectory, file);
        if (file.endsWith("_clip.mp4") || file.endsWith("_reencoded.mp4")) {
          fs.unlinkSync(filePath);
        }
      });
    }
    return NextResponse.json({ message: "All clips deleted successfully" });
  } catch (error) {
    console.error("Error deleting clips:", error);
    return NextResponse.json(
      { error: "Failed to delete clips" },
      { status: 500 }
    );
  }
}
