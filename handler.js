const uuid = require('uuid')
const AWS = require('aws-sdk');

const s3 = new AWS.S3();
const transcribe = new AWS.TranscribeService();
const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': true,
}

module.exports.getUploadURL = async (event) => {
    const s3 = new AWS.S3();
    const fileName = uuid.v4();
    const params = {
        Bucket: 'minlab-audio-transcript-input',
        Key: fileName,
        Expires: 900, // 15 minutes
        ContentType: 'audio/webm'
    };

    try {
        const uploadURL = await s3.getSignedUrlPromise('putObject', params);
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
                error: 'Could not get a signed URL for upload.'
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
    const s3Uri = `s3://minlab-audio-transcript-input/6793ea12-2b8f-40c7-aa2e-f816b276bf6a`
    // https://transcribe-demo.s3-REGION.amazonaws.com/hello_world.wav
    console.log('url', `https://s3.${process.env.AWS_REGION}.amazonaws.com/${s3BucketName}/${s3ObjectKey}`)
  
    const params = {
      LanguageCode: 'en-US',
      Media: {
        MediaFileUri: `https://s3.${process.env.AWS_REGION}.amazonaws.com/${s3BucketName}/${s3ObjectKey}`
      },
      TranscriptionJobName: `${s3ObjectKey}-transcription`,
      MediaFormat: 'webm', // Currently, AWS Transcribe does not support webp format for audio, use webm or other supported formats
      OutputBucketName: 'minlab-audio-transcript-output'
    };
  
    try {
      const data = await transcribe.startTranscriptionJob(params).promise();
      console.log(`Transcription started with job name: ${data.TranscriptionJob.TranscriptionJobName}`);
    } catch (error) {
      console.error(`Error starting transcription job: ${error}`);
    }
  };

  module.exports.getTranscript = async (event) => {
    const transcriptKey = `${event.pathParameters.id}-transcription.json`;
    console.info('transcriptKey', transcriptKey)
  
    try {
      // Get the transcript file from S3
      const transcriptFile = await s3.getObject({
        Bucket: 'minlab-audio-transcript-output',
        Key: transcriptKey
      }).promise();
  
      // Parse the transcript JSON
      const transcriptJSON = JSON.parse(transcriptFile.Body.toString());
  
      // Get the transcribed text
      const transcriptText = transcriptJSON.results.transcripts[0].transcript;
  
      return {
        statusCode: 200,
        body: JSON.stringify({ transcript: transcriptText }),
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