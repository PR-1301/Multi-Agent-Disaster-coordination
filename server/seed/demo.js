const http = require('http');

const complaints = [
  { description: "Severe bleeding from leg injury after building collapse", urgency: "critical", sector_id: "sec-1" },
  { description: "Family of 4 needs a place to sleep, house flooded", urgency: "high", sector_id: "sec-2" },
  { description: "Need blankets for the cold night, homeless", urgency: "medium", sector_id: "sec-2" },
  { description: "Trapped in a car surrounded by flood water", urgency: "critical", sector_id: "sec-3" },
  { description: "Breathing difficulties due to smoke inhalation", urgency: "high", sector_id: "sec-4" },
  { description: "Duplicate: Family of 4 needs a place to sleep, house flooded", urgency: "high", sector_id: "sec-2" }, // Duplicate
  { description: "Some broken glass, people are scared, not sure what to do", urgency: "low", sector_id: "sec-5" } // Ambiguous/unknown
];

function sendComplaint(data) {
  const payload = JSON.stringify({
    ...data,
    caller_ref: `caller-${Math.floor(Math.random() * 1000)}`,
    location: {
      lat: 40.7128 + (Math.random() - 0.5) * 0.1,
      lng: -74.0060 + (Math.random() - 0.5) * 0.1
    },
    source_command_center: "demo-script"
  });

  const req = http.request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/complaints',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': payload.length
    }
  }, (res) => {
    let output = '';
    res.on('data', d => output += d);
    res.on('end', () => console.log(`Sent complaint: ${data.description.substring(0, 30)}... | Status: ${res.statusCode} | Response: ${output}`));
  });

  req.on('error', error => console.error(error));
  req.write(payload);
  req.end();
}

let i = 0;
console.log('Starting demo stream...');
const interval = setInterval(() => {
  if (i >= complaints.length) {
    clearInterval(interval);
    console.log('Demo stream finished');
    return;
  }
  sendComplaint(complaints[i]);
  i++;
}, 3000);
