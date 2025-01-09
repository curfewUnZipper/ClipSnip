import { NextResponse } from "next/server";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import ytdlp from "yt-dlp-exec";
import { exec } from "child_process";

interface ClipRequestBody {
  youtubeLink: string;
  startTime: string;
  duration: string;
}

const clipsDirectory = path.join(process.cwd(), "public", "downloads");

// Ensure the `downloads` directory exists
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

  let videoPath = "";
  try {
    const videoId = new URL(youtubeLink).searchParams.get("v");
    if (!videoId) {
      return NextResponse.json(
        { error: "Invalid YouTube link" },
        { status: 400 }
      );
    }

    videoPath = path.join(clipsDirectory, `${videoId}.mp4`);
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

    // Step 1: Download the video using yt-dlp
    console.log("Downloading video...");
    await ytdlp(youtubeLink, {
      output: videoPath,
      format: "best",
    });

    // Step 2: Extract the clip using ffmpeg
    console.log("Generating clip...");
    const ffmpegCommand = `ffmpeg -ss ${startTime} -i "${videoPath}" -t ${duration} -c:v libx264 -preset ultrafast -crf 23 -c:a aac -strict experimental -y "${clipPath}"`;
    await promisify(exec)(ffmpegCommand);

    console.log("Clip generated successfully:", clipPath);

    // Return the clip URL
    return NextResponse.json({
      message: "Clip generated successfully",
      clipUrl: `/downloads/${path.basename(clipPath)}`,
    });
  } catch (error) {
    console.error("Error generating clip:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unknown error occurred while processing the video",
      },
      { status: 500 }
    );
  } finally {
    // Step 3: Clean up temporary files (optional)
    setTimeout(() => {
      try {
        if (fs.existsSync(videoPath)) {
          fs.unlinkSync(videoPath); // Delete downloaded video
          console.log("Temporary video file deleted:", videoPath);
        }
      } catch (cleanupError) {
        console.error("Error during cleanup:", cleanupError);
      }
    }, 60000); // Delay cleanup by 60 seconds
  }
}
