import path from "path";
import fs from "fs";
import { NextResponse } from "next/server";
import ytdlp from "yt-dlp-exec"; // yt-dlp-exec package
import { exec } from "child_process";
import { promisify } from "util";

const clipsDirectory = path.join(process.cwd(), "public", "downloads");

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

  try {
    // Download video using yt-dlp-exec
    await ytdlp(youtubeLink, {
      output: videoPath,
      format: "best",
    });

    // Extract the clip using ffmpeg
    await promisify(exec)(
      `ffmpeg -ss ${startTime} -i "${videoPath}" -t ${duration} -c:v libx264 -preset ultrafast -crf 23 -c:a aac -strict experimental -y "${clipPath}"`
    );

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
  } finally {
    // Clean up the temporary video file
    if (fs.existsSync(videoPath)) {
      fs.unlink(videoPath, (err) => {
        if (err) console.error("Error cleaning up video file:", err);
      });
    }
  }
}
