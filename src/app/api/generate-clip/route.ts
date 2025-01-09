import { NextResponse } from "next/server";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import ytdlp from "yt-dlp-exec"; // Use yt-dlp-exec package
import { exec } from "child_process";

interface ClipRequestBody {
  youtubeLink: string;
  startTime: string;
  duration: string;
}

const clipsDirectory = path.join(process.cwd(), "public", "downloads");

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

    // Download the video using yt-dlp-exec
    await ytdlp(youtubeLink, {
      output: videoPath,
      format: "best",
    });

    // Extract the clip from the downloaded video
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
  }
}
