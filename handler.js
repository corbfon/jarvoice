const uuid = require("uuid");
const mime = require("mime");
const AWS = require("aws-sdk");

const s3 = new AWS.S3();
const transcribe = new AWS.TranscribeService();
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Credentials": true,
};

module.exports.getUploadURL = async (event) => {
  const s3 = new AWS.S3();
  const fileExtension =
    event.queryStringParameters && event.queryStringParameters.file_extension;

  if (!fileExtension) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error:
          "Missing query parameter file_extension. It must be a proper file extension for a mime type.",
      }),
    };
  }
  const fileId = uuid.v4();
  const fileName = `${fileId}.${fileExtension}`;
  const params = {
    Bucket: "minlab-audio-transcript-input",
    Key: fileName,
    Expires: 900, // 15 minutes
    ContentType: mime.getType(fileExtension),
  };

  try {
    const uploadURL = await s3.getSignedUrlPromise("putObject", params);
    return {
      statusCode: 200,
      body: JSON.stringify({
        uploadURL: uploadURL,
        fileName: fileName,
      }),
      headers,
    };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Could not get a signed URL for upload.",
      }),
      headers,
    };
  }
};

// module.exports.getUploadURL = async (event) => {
//     const randomID = Math.random().toString(36).substring(2, 15); // Generate a random file name
//     const s3Params = {
//       Bucket: 'minlab-audio-transcript-input',
//       Key:  `${randomID}.webm`,  // Here the file format is webm because the MediaRecorder API does not support webp
//       Expires: 3600,  // Expires in 1 hour
//       ContentType: 'audio/webm',  // This should be 'audio/webp' if the MediaRecorder API starts supporting webp
//       ACL: 'public-read'
//     };

//     const uploadURL = s3.getSignedUrl('putObject', s3Params);

//     return {
//       statusCode: 200,
//       body: JSON.stringify({
//         uploadURL: uploadURL,
//         fileName: `${randomID}.webm`
//       }),
//       headers,
//     };
//   };

module.exports.transcribeAudio = async (event) => {
  const s3ObjectKey = event.Records[0].s3.object.key;
  const s3BucketName = event.Records[0].s3.bucket.name;

  const params = {
    LanguageCode: "en-US",
    Media: {
      MediaFileUri: `https://s3.${process.env.AWS_REGION}.amazonaws.com/${s3BucketName}/${s3ObjectKey}`,
    },
    TranscriptionJobName: `${s3ObjectKey}-transcription`,
    MediaFormat: "webm",
    OutputBucketName: "minlab-audio-transcript-output",
    Settings: {
      ShowSpeakerLabels: true,
      MaxSpeakerLabels: 5,
    },
  };

  try {
    const data = await transcribe.startTranscriptionJob(params).promise();
    console.log(
      `Transcription started with job name: ${data.TranscriptionJob.TranscriptionJobName}`
    );
  } catch (error) {
    console.error(`Error starting transcription job: ${error}`);
  }
};

module.exports.getTranscript = async (event) => {
  const transcriptKey = `${event.pathParameters.id}-transcription.json`;
  console.info("transcriptKey", transcriptKey);

  try {
    // Get the transcript file from S3
    const transcriptFile = await s3
      .getObject({
        Bucket: "minlab-audio-transcript-output",
        Key: transcriptKey,
      })
      .promise();

    // Parse the transcript JSON
    const transcriptJSON = JSON.parse(transcriptFile.Body.toString());

    // Get the speaker segments
    const speakerSegments = transcriptJSON.results.speaker_labels.segments;

    // Build transcript data with speaker identification
    let transcriptData = [];
    let currentSpeaker = "";
    let sentence = "";

    speakerSegments.forEach((segment) => {
      let speaker = segment.speaker_label;
      segment.items.forEach((item) => {
        let wordTimestamp = transcriptJSON.results.items.find(
          (wordItem) =>
            wordItem.start_time === item.start_time &&
            wordItem.end_time === item.end_time
        );
        if (wordTimestamp) {
          if (currentSpeaker !== speaker && sentence !== "") {
            transcriptData.push({
              speaker: currentSpeaker.replace("spk_", "Speaker "),
              content: `${sentence.trim()}`,
            });
            sentence = "";
          }
          currentSpeaker = speaker;
          sentence += wordTimestamp.alternatives[0].content + " ";
        }
      });
    });

    // Capture the last sentence of the last speaker
    if (sentence !== "") {
      transcriptData.push({
        speaker: currentSpeaker.replace("spk_", "Speaker "),
        content: `${sentence.trim()}`,
      });
    }

    let formattedTranscript = transcriptData
      .map((data) => `[${parseInt(data.speaker) + 1}]: ${data.content}`)
      .join("\n");

    return {
      statusCode: 200,
      body: JSON.stringify({ transcript: formattedTranscript }),
      headers,
    };
  } catch (error) {
    console.error(`Error getting transcript: ${error}`);

    // If transcript is not ready or any other error occurred
    return {
      statusCode: 404,
      body: JSON.stringify({ error: "Transcript not ready or not found." }),
      headers,
    };
  }
};
