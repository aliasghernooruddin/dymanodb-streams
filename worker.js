// worker.js
const { parentPort, workerData } = require('worker_threads');
const crypto = require('crypto');
const array = workerData;
const hashedArray = [];
// Perform the CPU-intensive task here
for (const element of array) {
  const hash = crypto.createHmac('sha256', 'secret')
    .update(element.eventID)
    .digest('hex');

  hashedArray.push(hash);
}
// Send the hashedArray to the parent thread
parentPort.postMessage(hashedArray);
process.exit()