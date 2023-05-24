let recorder, blob, uniqueId;
const recordButton = document.getElementById("recordButton");
const uploadButton = document.getElementById("uploadButton");
const transcript = document.getElementById("transcript");
const serviceURL = 'https://hyuxza302d.execute-api.us-east-1.amazonaws.com/dev'

recordButton.addEventListener("click", function() {
  if (this.innerHTML === "Record") {
    startRecording();
  } else {
    stopRecording();
  }
});

uploadButton.addEventListener("click", function() {
  uploadAudio();
});

let chunks = [];
const mediaOptions = { audio: true };

function startRecording() {
    navigator.mediaDevices.getUserMedia(mediaOptions)
        .then(function (stream) {
            console.log('Received stream with', stream.getAudioTracks().length, 'audio tracks');
            recorder = new MediaRecorder(stream);
            recorder.start();

            console.log('Started recorder:', recorder.state);
            recordButton.innerHTML = "Stop";
            recordButton.style.backgroundColor = "red";

            recorder.ondataavailable = function (event) {
                console.log('Received data:', event.data);
                chunks.push(event.data);
            };

            recorder.onerror = function (event) {
                console.error('Error from MediaRecorder:', event);
            };
        })
        .catch(function (error) {
            console.error("MediaRecording failed: ", error);
        });
}

function stopRecording() {
    recorder.stop();

    recordButton.innerHTML = "Record";
    recordButton.style.backgroundColor = "blue";
    uploadButton.removeAttribute("disabled");
    uploadButton.style.backgroundColor = "blue";
}

function uploadAudio() {
    blob = new Blob(chunks, { 'type': 'audio/webm' }); // Here the type should be 'audio/webp', but the browser MediaRecorder does not currently support 'audio/webp'
    chunks = [];
    
    console.log(`Audio Blob size: ${blob.size}`);

    fetch(`${serviceURL}/uploadURL`)
        .then(response => response.json())
        .then(data => {
            console.log('file name', data.fileName, 'size', blob.size)
            uniqueId = data.fileName;
            return fetch(data.uploadURL, {
                method: 'PUT',
                body: blob
            });
        })
        .then(() => {
            uploadButton.style.backgroundColor = "grey";
            uploadButton.setAttribute("disabled", "true");
            transcript.innerHTML = "Uploading... Please wait.";
            pollForTranscript();
        })
        .catch(error => console.error('Error uploading file:', error));
}

function pollForTranscript() {
    let poll = setInterval(() => {
        fetch(`${serviceURL}/transcript/${uniqueId}`)
            .then(response => {
                if (response.status >= 400) {
                    return;
                } else {
                    clearInterval(poll);
                    return response.json();
                }
            })
            .then(data => {
                if (data) {
                    transcript.innerHTML = data.transcript;
                }
            })
            .catch(error => console.error('Error fetching transcript:', error));
    }, 5000); // Polls every 5 seconds
}