import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import { NextResponse } from "next/server";

const clipsDirectory = path.join(process.cwd(), "public", "downloads");

// Ensure the `downloads` directory exists
if (!fs.existsSync(clipsDirectory)) {
  fs.mkdirSync(clipsDirectory, { recursive: true });
}

export async function POST(req: Request) {
  const { youtubeLink, startTime, duration } = await req.json();

  if (!youtubeLink || !startTime || !duration) {
    return NextResponse.json(
      { error: "YouTube link, start time, and duration are required" },
      { status: 400 }
    );
  }

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

  try {
    // Use absolute path for yt-dlp
    const ytdlpPath = "/usr/local/bin/yt-dlp";

    // Step 1: Download the video
    const downloadCommand = `${ytdlpPath} "${youtubeLink}" --output "${videoPath}" --format best`;
    await promisify(exec)(downloadCommand);

    // Step 2: Extract the clip using ffmpeg
    const ffmpegCommand = `ffmpeg -ss ${startTime} -i "${videoPath}" -t ${duration} -c:v libx264 -preset ultrafast -crf 23 -c:a aac -strict experimental -y "${clipPath}"`;
    await promisify(exec)(ffmpegCommand);

    return NextResponse.json({
      message: "Clip generated successfully",
      clipUrl: `/downloads/${path.basename(clipPath)}`,
    });
  } catch (error) {
    console.error("Error generating clip:", error);

    return NextResponse.json(
      { error: "Failed to generate the clip. Check logs for details." },
      { status: 500 }
    );
  } finally {
    // Clean up temporary video file
    if (fs.existsSync(videoPath)) {
      fs.unlink(videoPath, (err) => {
        if (err) console.error("Error cleaning up video file:", err);
      });
    }
  }
}
