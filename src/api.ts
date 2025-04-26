export async function httpStartRecord() {
  return fetch("http://localhost:8000/start_recording", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export async function httpStopRecord() {
  // Make HTTP POST request to stop recording
  return fetch("http://localhost:8000/stop_recording", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export async function getWorkflows() {
  return fetch("http://localhost:8000/workflows", {
    method: "GET",
  });
}
